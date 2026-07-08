/**
 * 引擎自测试：npx electron . --test-convert [samplesDir]
 * 走真实 TaskQueue + Adapter 代码路径，打印 PASS/FAIL 并以失败数为退出码。
 */
import { app } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { get7za } from './engines/archiveEngine'
import { DEFAULT_OPTIONS, type AdvancedOptions, type TaskEvent } from '../shared/types'
import { TaskQueue } from './queue'
import { targetsFor } from './engines/registry'
import { getFfmpegPath } from './engines/imageFallback'
import { resolveVideoEncoder } from './engines/hwaccel'
import { detectSoffice } from './engines/officeEngine'
import { addHistory, getSettings, listHistory, removeHistory, setSettings } from './store'
import { runProcess } from './utils/proc'

const results: { name: string; ok: boolean; detail: string }[] = []

function record(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

async function fileSize(p: string): Promise<number> {
  try {
    return (await stat(p)).size
  } catch {
    return -1
  }
}

export async function runSelfTest(samplesDir?: string): Promise<void> {
  const dir = join(tmpdir(), 'flashconvert-selftest')
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  console.log(`selftest dir: ${dir}`)

  // 1) 生成 ~10MB 级测试图（3000x3000 噪声 PNG）
  const bigPng = join(dir, 'big.png')
  await sharp({
    create: {
      width: 3000,
      height: 3000,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
      noise: { type: 'gaussian', mean: 128, sigma: 60 }
    }
  })
    .png()
    .toFile(bigPng)
  const pngSize = await fileSize(bigPng)
  record('生成测试 PNG (>5MB)', pngSize > 5 * 1024 * 1024, `${(pngSize / 1048576).toFixed(1)} MB`)

  // 2) 用 ffmpeg 造 BMP 样本（顺带验证 ffmpeg 可执行）
  const bmp = join(dir, 'sample.bmp')
  try {
    const r = await runProcess(
      getFfmpegPath(),
      ['-y', '-hide_banner', '-i', bigPng, '-vf', 'scale=800:800', bmp],
      new AbortController().signal
    )
    record('FFmpeg 可执行且能产出 BMP', r.code === 0 && (await fileSize(bmp)) > 0)
  } catch (e) {
    record('FFmpeg 可执行且能产出 BMP', false, e instanceof Error ? e.message : String(e))
  }

  // 3) 能力表检查
  const pngTargets = targetsFor('png')
  record('能力表 png→(webp,jpg,avif)', ['webp', 'jpg', 'avif'].every((t) => pngTargets.includes(t)), pngTargets.join(','))
  record('能力表 bmp 走兜底', targetsFor('bmp').includes('png'), targetsFor('bmp').join(','))
  record('能力表 tar→zip/7z', targetsFor('tar').includes('zip') && targetsFor('tar').includes('7z'), targetsFor('tar').join(','))

  // 4) 队列真实转换用例
  const events = new Map<string, TaskEvent[]>()
  const queue = new TaskQueue((e) => {
    const list = events.get(e.id) ?? []
    list.push(e)
    events.set(e.id, list)
  })

  const wait = (id: string, timeoutMs = 120_000): Promise<TaskEvent> =>
    new Promise((resolve, reject) => {
      const t0 = Date.now()
      const timer = setInterval(() => {
        const list = events.get(id) ?? []
        const final = list.find((e) => e.type === 'done' || e.type === 'error' || e.type === 'canceled')
        if (final) {
          clearInterval(timer)
          resolve(final)
        } else if (Date.now() - t0 > timeoutMs) {
          clearInterval(timer)
          reject(new Error('timeout'))
        }
      }, 100)
    })

  const mk = (
    id: string,
    input: string,
    target: string,
    options: AdvancedOptions = { ...DEFAULT_OPTIONS.image }
  ): Parameters<TaskQueue['add']>[0][0] => ({
    id,
    inputPath: input,
    outputPath: join(dir, `${id}.${target}`),
    inputExt: input.split('.').pop()!.toLowerCase(),
    target,
    options
  })

  const cases: [string, string, string][] = [
    ['t-webp', bigPng, 'webp'],
    ['t-jpg', bigPng, 'jpg'],
    ['t-avif', bigPng, 'avif'],
    ['t-bmp2png', bmp, 'png']
  ]
  for (const [id, input, target] of cases) {
    queue.add([mk(id, input, target)])
    try {
      const final = await wait(id)
      const out = join(dir, `${id}.${target}`)
      const ok = final.type === 'done' && (await fileSize(out)) > 0
      record(`转换 ${id}`, ok, final.type === 'error' ? final.message : `${((await fileSize(out)) / 1024).toFixed(0)} KB`)
    } catch (e) {
      record(`转换 ${id}`, false, e instanceof Error ? e.message : String(e))
    }
  }

  // 5) 反向链路 webp→png
  const webpOut = join(dir, 't-webp.webp')
  queue.add([mk('t-back', webpOut, 'png')])
  try {
    const final = await wait('t-back')
    record('转换 webp→png（双向）', final.type === 'done' && (await fileSize(join(dir, 't-back.png'))) > 0)
  } catch (e) {
    record('转换 webp→png（双向）', false, String(e))
  }

  // 6) 取消：avif 编码较慢，启动后立刻取消
  queue.add([mk('t-cancel', bigPng, 'avif')])
  setTimeout(() => queue.cancel('t-cancel'), 150)
  try {
    const final = await wait('t-cancel', 30_000)
    const leftover = await fileSize(join(dir, 't-cancel.avif'))
    record('取消任务且无残留文件', final.type === 'canceled' && leftover === -1, `event=${final.type}, leftover=${leftover}`)
  } catch (e) {
    record('取消任务且无残留文件', false, String(e))
  }

  // 7) HEIC 样本（可选，samplesDir 提供时）
  const heic = samplesDir ? join(samplesDir, 'sample.heic') : ''
  if (heic && existsSync(heic)) {
    queue.add([mk('t-heic', heic, 'jpg')])
    try {
      const final = await wait('t-heic')
      record('HEIC→JPG（heic-convert）', final.type === 'done', final.type === 'error' ? final.message : '')
    } catch (e) {
      record('HEIC→JPG（heic-convert）', false, String(e))
    }
  } else {
    console.log('SKIP  HEIC 用例（未提供样本目录）')
  }

  /* ================= M4 音视频 ================= */

  // 生成 1080p 测试视频（testsrc2 + 正弦音轨，6 秒）与 WAV 样本
  const mp4 = join(dir, 'test.mp4')
  const wav = join(dir, 'test.wav')
  try {
    const rv = await runProcess(
      getFfmpegPath(),
      ['-y', '-hide_banner',
        '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30:duration=6',
        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast',
        '-c:a', 'aac', '-shortest', mp4],
      new AbortController().signal
    )
    record('生成 1080p 测试视频', rv.code === 0 && (await fileSize(mp4)) > 0)
    const ra = await runProcess(
      getFfmpegPath(),
      ['-y', '-hide_banner', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5', '-c:a', 'pcm_s16le', wav],
      new AbortController().signal
    )
    record('生成 WAV 测试音频', ra.code === 0 && (await fileSize(wav)) > 0)
  } catch (e) {
    record('生成音视频样本', false, String(e))
  }

  record('能力表 mp4 现在有目标', targetsFor('mp4').length > 0, targetsFor('mp4').join(','))

  const hw = await resolveVideoEncoder('h264', 'auto')
  record('硬件加速探测（信息）', hw !== null, hw ? `${hw.encoder}${hw.hardware ? ' (硬件)' : ' (软件)'}` : '')

  const avCases: [string, string, string, AdvancedOptions?][] = [
    ['v-mkv', mp4, 'mkv'],
    ['v-mov', mp4, 'mov'],
    ['v-webm', mp4, 'webm'],
    ['v-gif', mp4, 'gif'],
    ['v-mp3', mp4, 'mp3'],
    ['a-flac', wav, 'flac'],
    ['a-mp3', wav, 'mp3', { ...DEFAULT_OPTIONS.audio, bitrateMode: 'custom', bitrateKbps: 192 }],
    [
      'v-custom',
      mp4,
      'mp4',
      { ...DEFAULT_OPTIONS.video, resolution: 'custom', width: 1280, height: 720, bitrateMode: 'custom', bitrateKbps: 1500 }
    ]
  ]
  for (const [id, input, target, options] of avCases) {
    queue.add([mk(id, input, target, options)])
    try {
      const final = await wait(id, 300_000)
      const out = join(dir, `${id}.${target}`)
      const ok = final.type === 'done' && (await fileSize(out)) > 0
      record(`转换 ${id}`, ok, final.type === 'error' ? final.message : `${((await fileSize(out)) / 1024).toFixed(0)} KB`)
    } catch (e) {
      record(`转换 ${id}`, false, e instanceof Error ? e.message : String(e))
    }
  }

  // 进度事件断言：v-mkv 必须出现过 0<p<1 的真实进度
  const mkvProgress = (events.get('v-mkv') ?? []).filter(
    (e) => e.type === 'progress' && e.progress > 0 && e.progress < 1
  )
  record('视频转换有真实进度事件', mkvProgress.length >= 1, `${mkvProgress.length} 个进度点`)

  // 自定义分辨率断言：输出应为 1280x720
  try {
    const probe = await runProcess(
      getFfmpegPath(),
      ['-hide_banner', '-i', join(dir, 'v-custom.mp4')],
      new AbortController().signal
    )
    record('自定义分辨率 1280x720 生效', probe.stderr.includes('1280x720'))
  } catch (e) {
    record('自定义分辨率 1280x720 生效', false, String(e))
  }

  // 取消：webm(vp9) 编码慢，启动后取消
  queue.add([mk('v-cancel', mp4, 'webm', { ...DEFAULT_OPTIONS.video })])
  setTimeout(() => queue.cancel('v-cancel'), 800)
  try {
    const final = await wait('v-cancel', 60_000)
    const leftover = await fileSize(join(dir, 'v-cancel.webm'))
    record('取消视频转换且无残留', final.type === 'canceled' && leftover === -1, `event=${final.type}, leftover=${leftover}`)
  } catch (e) {
    record('取消视频转换且无残留', false, String(e))
  }

  /* ================= M5 文档与压缩包 ================= */

  // 压缩包样本
  const arcSrc = join(dir, 'arc-src')
  await mkdir(arcSrc, { recursive: true })
  await writeFile(join(arcSrc, 'a.txt'), '你好，闪转！hello flashconvert\n'.repeat(2000))
  await writeFile(join(arcSrc, 'b.md'), '# 标题\n\n正文内容。\n'.repeat(800))
  const zipSample = join(dir, 'sample.zip')
  try {
    const rz = await runProcess(
      get7za(),
      ['a', '-tzip', zipSample, join(arcSrc, '*'), '-y', '-bso0'],
      new AbortController().signal
    )
    record('7za 可执行且产出 zip 样本', rz.code === 0 && (await fileSize(zipSample)) > 0)
  } catch (e) {
    record('7za 可执行且产出 zip 样本', false, String(e))
  }

  queue.add([mk('arc-7z', zipSample, '7z', { ...DEFAULT_OPTIONS.archive })])
  try {
    const final = await wait('arc-7z', 120_000)
    record('压缩包 zip→7z', final.type === 'done' && (await fileSize(join(dir, 'arc-7z.7z'))) > 0,
      final.type === 'error' ? final.message : '')
  } catch (e) {
    record('压缩包 zip→7z', false, String(e))
  }

  queue.add([
    mk('arc-zip', join(dir, 'arc-7z.7z'), 'zip', {
      ...DEFAULT_OPTIONS.archive,
      level: 'max',
      password: 'test123'
    })
  ])
  try {
    const final = await wait('arc-zip', 120_000)
    let listed = false
    if (final.type === 'done') {
      const lr = await runProcess(
        get7za(),
        ['l', join(dir, 'arc-zip.zip'), '-ptest123'],
        new AbortController().signal
      )
      listed = lr.code === 0 && lr.stdout.includes('a.txt')
    }
    record('压缩包 7z→zip（极限+密码）', final.type === 'done' && listed,
      final.type === 'error' ? final.message : `password list ok=${listed}`)
  } catch (e) {
    record('压缩包 7z→zip（极限+密码）', false, String(e))
  }

  // 文档：md → docx（首次会触发 Pandoc 下载）→ html
  const mdSample = join(dir, 'doc.md')
  await writeFile(
    mdSample,
    '# 闪转测试文档\n\n这是 **Pandoc** 转换测试。\n\n- 列表项一\n- 列表项二\n\n> 引用块\n'
  )
  queue.add([mk('doc-docx', mdSample, 'docx', { ...DEFAULT_OPTIONS.document })])
  try {
    const final = await wait('doc-docx', 600_000)
    record('文档 md→docx（含首次下载 Pandoc）', final.type === 'done' && (await fileSize(join(dir, 'doc-docx.docx'))) > 0,
      final.type === 'error' ? final.message : '')
  } catch (e) {
    record('文档 md→docx（含首次下载 Pandoc）', false, String(e))
  }

  queue.add([mk('doc-html', join(dir, 'doc-docx.docx'), 'html', { ...DEFAULT_OPTIONS.document })])
  try {
    const final = await wait('doc-html', 120_000)
    record('文档 docx→html', final.type === 'done' && (await fileSize(join(dir, 'doc-html.html'))) > 0,
      final.type === 'error' ? final.message : '')
  } catch (e) {
    record('文档 docx→html', false, String(e))
  }

  // md→html 阅读器排版（默认）：内嵌阅读器 CSS + 渲染为 <h1>（非源码呈现）
  queue.add([mk('doc-reader', mdSample, 'html', { ...DEFAULT_OPTIONS.document })])
  try {
    const final = await wait('doc-reader', 120_000)
    let ok = false
    let detail = final.type === 'error' ? final.message : ''
    if (final.type === 'done') {
      const html = await readFile(join(dir, 'doc-reader.html'), 'utf8')
      const rendered = html.includes('</h1>') && html.includes('闪转测试文档')
      const styled = html.includes('--flashconvert-reader')
      ok = rendered && styled
      detail = `rendered=${rendered}, readerCss=${styled}`
    }
    record('md→html 阅读器排版（默认）', ok, detail)
  } catch (e) {
    record('md→html 阅读器排版（默认）', false, String(e))
  }

  // md→html 原始代码样式（勾选 rawSource）：源码字面量以代码块呈现
  queue.add([mk('doc-raw-html', mdSample, 'html', { kind: 'document', rawSource: true })])
  try {
    const final = await wait('doc-raw-html', 120_000)
    let ok = false
    let detail = final.type === 'error' ? final.message : ''
    if (final.type === 'done') {
      const html = await readFile(join(dir, 'doc-raw-html.html'), 'utf8')
      const hasRawHeading = html.includes('# 闪转测试文档')
      const asCode = html.includes('<pre') || html.includes('sourceCode')
      ok = hasRawHeading && asCode
      detail = `raw=${hasRawHeading}, codeBlock=${asCode}`
    }
    record('md→html 原始代码样式（勾选）', ok, detail)
  } catch (e) {
    record('md→html 原始代码样式（勾选）', false, String(e))
  }

  // md→docx 原始代码样式
  queue.add([mk('doc-raw-docx', mdSample, 'docx', { kind: 'document', rawSource: true })])
  try {
    const final = await wait('doc-raw-docx', 120_000)
    record('md→docx 原始代码样式（勾选）', final.type === 'done' && (await fileSize(join(dir, 'doc-raw-docx.docx'))) > 0,
      final.type === 'error' ? final.message : '')
  } catch (e) {
    record('md→docx 原始代码样式（勾选）', false, String(e))
  }

  // Office → PDF（本机装了 LibreOffice 才测）
  record(
    'md 目标含 pdf/odt/rtf',
    ['pdf', 'odt', 'rtf'].every((t) => targetsFor('md').includes(t)),
    targetsFor('md').join(',')
  )

  // md→pdf（Chromium 打印链，输出应为合法 PDF）
  queue.add([mk('doc-pdf-md', mdSample, 'pdf', { ...DEFAULT_OPTIONS.document })])
  try {
    const final = await wait('doc-pdf-md', 180_000)
    let ok = false
    let detail = final.type === 'error' ? final.message : ''
    if (final.type === 'done') {
      const buf = await readFile(join(dir, 'doc-pdf-md.pdf'))
      const magic = buf.subarray(0, 4).toString()
      ok = buf.length > 0 && magic === '%PDF'
      detail = `${(buf.length / 1024).toFixed(0)} KB, magic=${magic}`
    }
    record('md→pdf（Chromium 打印链）', ok, detail)
  } catch (e) {
    record('md→pdf（Chromium 打印链）', false, String(e))
  }

  // md→rtf（Pandoc 新增目标）
  queue.add([mk('doc-rtf', mdSample, 'rtf', { ...DEFAULT_OPTIONS.document })])
  try {
    const final = await wait('doc-rtf', 120_000)
    record('md→rtf', final.type === 'done' && (await fileSize(join(dir, 'doc-rtf.rtf'))) > 0,
      final.type === 'error' ? final.message : '')
  } catch (e) {
    record('md→rtf', false, String(e))
  }

  /* ---------- PDF 输入（PDF.js 引擎），复用上面生成的真实 PDF ---------- */
  const pdfInput = join(dir, 'doc-pdf-md.pdf')
  record(
    '能力表 pdf→png/jpg/txt/docx',
    ['png', 'jpg', 'txt', 'docx'].every((t) => targetsFor('pdf').includes(t)),
    targetsFor('pdf').join(',')
  )

  queue.add([mk('pdf-png', pdfInput, 'png', { ...DEFAULT_OPTIONS.document })])
  try {
    const final = await wait('pdf-png', 180_000)
    let ok = false
    let detail = final.type === 'error' ? final.message : ''
    if (final.type === 'done') {
      const buf = await readFile(join(dir, 'pdf-png.png'))
      ok = buf.length > 0 && buf[0] === 0x89 && buf.subarray(1, 4).toString() === 'PNG'
      detail = `${(buf.length / 1024).toFixed(0)} KB`
    }
    record('pdf→png（PDF.js 渲染）', ok, detail)
  } catch (e) {
    record('pdf→png（PDF.js 渲染）', false, String(e))
  }

  queue.add([mk('pdf-txt', pdfInput, 'txt', { ...DEFAULT_OPTIONS.document })])
  try {
    const final = await wait('pdf-txt', 180_000)
    let ok = false
    let detail = final.type === 'error' ? final.message : ''
    if (final.type === 'done') {
      const text = await readFile(join(dir, 'pdf-txt.txt'), 'utf8')
      ok = text.includes('闪转测试文档')
      detail = `${text.length} chars`
    }
    record('pdf→txt（文本提取）', ok, detail)
  } catch (e) {
    record('pdf→txt（文本提取）', false, String(e))
  }

  queue.add([mk('pdf-docx', pdfInput, 'docx', { ...DEFAULT_OPTIONS.document })])
  try {
    const final = await wait('pdf-docx', 180_000)
    record('pdf→docx（提取文本+Pandoc）', final.type === 'done' && (await fileSize(join(dir, 'pdf-docx.docx'))) > 0,
      final.type === 'error' ? final.message : '')
  } catch (e) {
    record('pdf→docx（提取文本+Pandoc）', false, String(e))
  }

  const soffice = detectSoffice()
  if (soffice) {
    queue.add([mk('doc-pdf', join(dir, 'doc-docx.docx'), 'pdf', { ...DEFAULT_OPTIONS.document })])
    try {
      const final = await wait('doc-pdf', 300_000)
      record('文档 docx→pdf（LibreOffice）', final.type === 'done' && (await fileSize(join(dir, 'doc-pdf.pdf'))) > 0,
        final.type === 'error' ? final.message : '')
    } catch (e) {
      record('文档 docx→pdf（LibreOffice）', false, String(e))
    }
  } else {
    // 无 LibreOffice：docx→pdf 应自动走 Chromium 兜底链
    queue.add([mk('doc-pdf-docx', join(dir, 'doc-docx.docx'), 'pdf', { ...DEFAULT_OPTIONS.document })])
    try {
      const final = await wait('doc-pdf-docx', 180_000)
      let ok = false
      let detail = final.type === 'error' ? final.message : ''
      if (final.type === 'done') {
        const buf = await readFile(join(dir, 'doc-pdf-docx.pdf'))
        ok = buf.length > 0 && buf.subarray(0, 4).toString() === '%PDF'
        detail = `${(buf.length / 1024).toFixed(0)} KB`
      }
      record('docx→pdf（无 LibreOffice 时 Chromium 兜底）', ok, detail)
    } catch (e) {
      record('docx→pdf（无 LibreOffice 时 Chromium 兜底）', false, String(e))
    }
  }

  /* ================= M6 持久化与重试 ================= */

  try {
    const before = getSettings().concurrency
    setSettings({ concurrency: 3 })
    const ok1 = getSettings().concurrency === 3
    setSettings({ concurrency: before })
    record('设置持久化回环（electron-store）', ok1)
  } catch (e) {
    record('设置持久化回环（electron-store）', false, String(e))
  }

  try {
    addHistory({
      id: 'selftest-h1',
      name: 'x.png',
      inputPath: 'C:\\x.png',
      outputPath: 'C:\\x.webp',
      from: 'png',
      to: 'webp',
      size: 123,
      ok: true,
      time: new Date().toISOString()
    })
    const present = listHistory().some((r) => r.id === 'selftest-h1')
    removeHistory('selftest-h1')
    const gone = !listHistory().some((r) => r.id === 'selftest-h1')
    record('历史记录增删（electron-store）', present && gone)
  } catch (e) {
    record('历史记录增删（electron-store）', false, String(e))
  }

  // 失败自动重试：损坏输入应重试一次后报错（progress(0) 出现 ≥2 次 + 恰好 1 个 error）
  const corrupt = join(dir, 'corrupt.png')
  await writeFile(corrupt, Buffer.from('this is not a real png file at all'))
  queue.add([mk('t-retry', corrupt, 'jpg')])
  try {
    const final = await wait('t-retry', 60_000)
    const evs = events.get('t-retry') ?? []
    const zeroProgress = evs.filter((e) => e.type === 'progress' && e.progress === 0).length
    const errors = evs.filter((e) => e.type === 'error').length
    record(
      '损坏文件自动重试一次后报友好错误',
      final.type === 'error' && zeroProgress >= 2 && errors === 1,
      `progress0=${zeroProgress}, errors=${errors}, msg=${final.type === 'error' ? final.message : ''}`
    )
  } catch (e) {
    record('损坏文件自动重试一次后报友好错误', false, String(e))
  }

  const failed = results.filter((r) => !r.ok).length
  console.log(`---- SELFTEST SUMMARY: ${results.length - failed}/${results.length} passed ----`)
  app.exit(failed)
}
