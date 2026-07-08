import { app } from 'electron'
import { createWriteStream, existsSync } from 'node:fs'
import { chmod, copyFile, mkdir, readdir, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join } from 'node:path'
import { DEFAULT_OPTIONS, type DocumentOptions } from '../../shared/types'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { path7za } from '7zip-bin'
import { runProcess } from '../utils/proc'
import {
  CanceledError,
  ConversionError,
  type EngineAdapter,
  type EngineProgress,
  type EngineTask
} from './types'

/**
 * Pandoc 文档引擎。二进制不随包分发（约 200MB 解压后），
 * 首次使用时从官方 GitHub Release 下载到用户数据目录缓存。
 */
const PANDOC_VERSION = '3.6.3'

function pandocAsset(): string {
  if (process.platform === 'darwin') {
    return process.arch === 'arm64'
      ? `pandoc-${PANDOC_VERSION}-arm64-macOS.zip`
      : `pandoc-${PANDOC_VERSION}-x86_64-macOS.zip`
  }
  return `pandoc-${PANDOC_VERSION}-windows-x86_64.zip`
}

const PANDOC_GH_URL = `https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/${pandocAsset()}`

/**
 * 下载源顺序：官方直连在前（海外/有代理最快），三个国内加速镜像顺序兜底。
 * 镜像均经真实资产可用性验证，失效时按序自动跳过。
 */
const PANDOC_SOURCES = [
  PANDOC_GH_URL,
  `https://gh-proxy.com/${PANDOC_GH_URL}`,
  `https://ghproxy.net/${PANDOC_GH_URL}`,
  `https://ghfast.top/${PANDOC_GH_URL}`
]

/** 响应头超时（毫秒）：超过即放弃当前源换下一个 */
const HEADER_TIMEOUT_MS = 20_000

const INPUTS = ['md', 'markdown', 'html', 'htm', 'docx', 'epub', 'txt', 'odt']
const OUTPUTS = ['md', 'html', 'docx', 'epub', 'txt', 'odt', 'rtf']

function pandocExe(): string {
  const name = process.platform === 'win32' ? `pandoc-${PANDOC_VERSION}.exe` : `pandoc-${PANDOC_VERSION}`
  return join(app.getPath('userData'), 'bin', name)
}

let ensuring: Promise<string> | null = null

async function ensurePandoc(
  onProgress: (p: EngineProgress) => void,
  signal: AbortSignal
): Promise<string> {
  const exe = pandocExe()
  if (existsSync(exe)) return exe
  if (!ensuring) {
    ensuring = downloadPandoc(exe, onProgress, signal).finally(() => {
      ensuring = null
    })
  }
  return ensuring
}

/** 从单个源下载到 zipPath；响应头超时或任何失败都抛错交给上层换源 */
async function tryDownload(
  url: string,
  zipPath: string,
  onProgress: (p: EngineProgress) => void,
  signal: AbortSignal
): Promise<void> {
  const ctl = new AbortController()
  const onAbort = (): void => ctl.abort()
  signal.addEventListener('abort', onAbort, { once: true })
  const headerTimer = setTimeout(() => ctl.abort(), HEADER_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctl.signal, redirect: 'follow' })
    clearTimeout(headerTimer)
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
    const total = Number(res.headers.get('content-length')) || 0
    let received = 0
    const counter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        received += chunk.length
        if (total > 0) onProgress({ progress: Math.min(0.35, (received / total) * 0.35) })
        cb(null, chunk)
      }
    })
    await pipeline(Readable.fromWeb(res.body as never), counter, createWriteStream(zipPath))
  } finally {
    clearTimeout(headerTimer)
    signal.removeEventListener('abort', onAbort)
  }
}

async function downloadPandoc(
  exe: string,
  onProgress: (p: EngineProgress) => void,
  signal: AbortSignal
): Promise<string> {
  const work = join(tmpdir(), 'flashconvert-pandoc-dl')
  await rm(work, { recursive: true, force: true })
  await mkdir(work, { recursive: true })
  await mkdir(join(exe, '..'), { recursive: true })
  const zipPath = join(work, 'pandoc.zip')
  try {
    let downloaded = false
    let lastError: unknown
    for (const url of PANDOC_SOURCES) {
      if (signal.aborted) throw new CanceledError()
      try {
        onProgress({ progress: 0 })
        await tryDownload(url, zipPath, onProgress, signal)
        downloaded = true
        break
      } catch (e) {
        if (signal.aborted || e instanceof CanceledError) throw new CanceledError()
        lastError = e
        console.warn(`pandoc download failed from ${url}, trying next source`, e)
      }
    }
    if (!downloaded) {
      throw lastError instanceof Error ? lastError : new Error(String(lastError))
    }
    if (signal.aborted) throw new CanceledError()

    const ex = await runProcess(
      path7za.replace('app.asar', 'app.asar.unpacked'),
      ['x', zipPath, `-o${work}`, '-y', '-bso0'],
      signal
    )
    if (ex.code !== 0) throw new Error(`unzip failed: ${ex.stderr.slice(-300)}`)

    // 在解压目录里找 pandoc 可执行文件（win: 根目录 pandoc.exe；mac: bin/pandoc）
    const bin = process.platform === 'win32' ? 'pandoc.exe' : 'pandoc'
    let found: string | null = null
    for (const entry of await readdir(work, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      for (const candidate of [join(work, entry.name, bin), join(work, entry.name, 'bin', bin)]) {
        if (existsSync(candidate)) {
          found = candidate
          break
        }
      }
      if (found) break
    }
    if (!found) throw new Error('pandoc binary not found in archive')
    await copyFile(found, exe)
    if (process.platform !== 'win32') await chmod(exe, 0o755)
    return exe
  } catch (e) {
    if (e instanceof CanceledError) throw e
    throw new ConversionError(
      '首次转换文档需要下载 Pandoc 组件（约 40MB），官方源与国内镜像均下载失败，请检查网络后重试',
      e instanceof Error ? e.message : String(e)
    )
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {})
  }
}

/** 阅读器排版样式（md→html 时内嵌，深浅色自适应） */
const READER_CSS = `<style>
:root{color-scheme:light dark;--flashconvert-reader:1}
body{font-family:-apple-system,'SF Pro Text','Segoe UI','Microsoft YaHei',sans-serif;
line-height:1.75;max-width:780px;margin:0 auto;padding:48px 28px;
color:#1d1d1f;background:#fff;font-size:16px}
h1,h2,h3,h4,h5,h6{line-height:1.35;margin:1.6em 0 .6em;font-weight:600;letter-spacing:-.01em}
h1{font-size:1.9em;padding-bottom:.35em;border-bottom:1px solid rgba(0,0,0,.1)}
h2{font-size:1.45em}h3{font-size:1.2em}
p{margin:.9em 0}
a{color:#0a84ff;text-decoration:none}a:hover{text-decoration:underline}
code{font-family:ui-monospace,'Cascadia Code',Consolas,monospace;font-size:.88em;
background:rgba(0,0,0,.055);padding:.15em .4em;border-radius:5px}
pre{background:#f6f6f8;border:1px solid rgba(0,0,0,.07);padding:16px 18px;border-radius:12px;
overflow:auto;line-height:1.6}
pre code{background:none;padding:0;font-size:.86em}
blockquote{border-left:3px solid #0a84ff;margin:1em 0;padding:6px 18px;
color:#57575c;background:rgba(10,132,255,.05);border-radius:0 10px 10px 0}
table{border-collapse:collapse;width:100%;margin:1.2em 0}
th,td{border:1px solid rgba(0,0,0,.12);padding:8px 14px;text-align:left}
th{background:rgba(0,0,0,.035)}
img{max-width:100%;border-radius:10px}
hr{border:none;border-top:1px solid rgba(0,0,0,.1);margin:2.2em 0}
ul,ol{padding-left:1.6em}li{margin:.35em 0}
@media print{:root{color-scheme:light}body{background:#fff;color:#1d1d1f;max-width:none;padding:0}}
@media (prefers-color-scheme:dark){
body{color:#e8e8ed;background:#1c1c1e}
h1{border-bottom-color:rgba(255,255,255,.12)}
code{background:rgba(255,255,255,.09)}
pre{background:#2c2c2e;border-color:rgba(255,255,255,.08)}
blockquote{color:#a5a5ad;background:rgba(10,132,255,.12)}
th,td{border-color:rgba(255,255,255,.14)}th{background:rgba(255,255,255,.05)}
hr{border-top-color:rgba(255,255,255,.12)}}
</style>`

function documentOptions(task: EngineTask): DocumentOptions {
  return task.options.kind === 'document' ? task.options : DEFAULT_OPTIONS.document
}

const MD_LIKE = ['md', 'markdown', 'txt']

/** 若开启原始样式则把源码包进四反引号代码块，返回实际输入路径（可能是临时文件） */
async function prepareInput(task: EngineTask, temps: string[]): Promise<{ inputPath: string; rawMode: boolean }> {
  const opts = documentOptions(task)
  const rawMode = opts.rawSource && MD_LIKE.includes(task.inputExt)
  if (!rawMode) return { inputPath: task.inputPath, rawMode }
  const src = await readFile(task.inputPath, 'utf8')
  const inputPath = join(tmpdir(), `flashconvert-raw-${task.id}.md`)
  await writeFile(inputPath, '````markdown\n' + src + '\n````\n', 'utf8')
  temps.push(inputPath)
  return { inputPath, rawMode }
}

/**
 * 转成内嵌阅读器排版样式的独立 HTML（html 目标与 Chromium PDF 链共用）。
 * 本地图片经 --embed-resources 内联，输出自包含。
 */
export async function convertToStyledHtml(
  task: EngineTask,
  htmlOut: string,
  onProgress: (p: EngineProgress) => void,
  signal: AbortSignal
): Promise<void> {
  const exe = await ensurePandoc(onProgress, signal)
  if (signal.aborted) throw new CanceledError()
  const temps: string[] = []
  try {
    const { inputPath, rawMode } = await prepareInput(task, temps)
    const header = join(tmpdir(), `flashconvert-css-${task.id}.html`)
    await writeFile(header, READER_CSS, 'utf8')
    temps.push(header)
    const stem = basename(task.inputPath, extname(task.inputPath))
    const args = ['-s']
    if (task.inputExt === 'txt' || rawMode) args.push('-f', 'markdown')
    args.push(
      '--include-in-header', header,
      '-V', `pagetitle=${stem}`,
      '--embed-resources',
      '--resource-path', dirname(task.inputPath),
      inputPath,
      '-o', htmlOut
    )
    const r = await runProcess(exe, args, signal)
    if (r.code !== 0) {
      throw new ConversionError(
        `文档转换失败（${task.inputExt.toUpperCase()} → HTML），文件可能包含不支持的内容`,
        r.stderr.slice(-800)
      )
    }
  } finally {
    for (const t of temps) await unlink(t).catch(() => {})
  }
}

export const pandocEngine: EngineAdapter = {
  name: 'pandoc',
  canConvert(inputExt, target) {
    if (!INPUTS.includes(inputExt) || !OUTPUTS.includes(target)) return false
    if ((inputExt === 'md' || inputExt === 'markdown') && target === 'md') return false
    return true
  },
  async convert(task, onProgress, signal) {
    if (task.target === 'html') {
      await convertToStyledHtml(task, task.outputPath, onProgress, signal)
      onProgress({ progress: 1 })
      return
    }

    const exe = await ensurePandoc(onProgress, signal)
    if (signal.aborted) throw new CanceledError()
    onProgress({ progress: 0.5 })

    const temps: string[] = []
    try {
      const { inputPath, rawMode } = await prepareInput(task, temps)
      const args: string[] = ['-s']
      if (task.inputExt === 'txt' || rawMode) args.push('-f', 'markdown')
      if (task.target === 'txt') args.push('-t', 'plain')
      args.push(inputPath, '-o', task.outputPath)

      const r = await runProcess(exe, args, signal)
      if (r.code !== 0) {
        throw new ConversionError(
          `文档转换失败（${task.inputExt.toUpperCase()} → ${task.target.toUpperCase()}），文件可能包含不支持的内容`,
          r.stderr.slice(-800)
        )
      }
      onProgress({ progress: 1 })
    } finally {
      for (const t of temps) await unlink(t).catch(() => {})
    }
  }
}
