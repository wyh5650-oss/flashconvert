import { app, BrowserWindow } from 'electron'
import { unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { pandocEngine } from './pandocEngine'
import {
  CanceledError,
  ConversionError,
  type EngineAdapter,
  type EngineTask
} from './types'

/**
 * PDF 输入引擎（Mozilla PDF.js，零额外二进制）：
 * - PDF → PNG/JPG：隐藏窗口逐页渲染（2x 采样，多页输出 -p2/-p3… 兄弟文件）
 * - PDF → TXT：逐页文本提取
 * - PDF → MD/HTML/DOCX：文本提取后复用 Pandoc 链（定位为"可编辑文本"，不复刻版式）
 * 扫描件（无文本层）转文本类目标时给出明确提示。
 */
const IMG_TARGETS = ['png', 'jpg']
const TEXT_TARGETS = ['txt', 'md', 'html', 'docx']
const MAX_PAGES = 500

function pdfjsDir(): string {
  return join(app.getAppPath(), 'node_modules', 'pdfjs-dist').replace(
    'app.asar',
    'app.asar.unpacked'
  )
}

function viewerHtml(pdfPath: string): string {
  const lib = pathToFileURL(join(pdfjsDir(), 'build', 'pdf.min.mjs')).href
  const worker = pathToFileURL(join(pdfjsDir(), 'build', 'pdf.worker.min.mjs')).href
  const pdf = pathToFileURL(pdfPath).href
  return `<!doctype html><html><body><script type="module">
window.__READY = false; window.__ERROR = '';
try {
  const pdfjs = await import(${JSON.stringify(lib)});
  pdfjs.GlobalWorkerOptions.workerSrc = ${JSON.stringify(worker)};
  const doc = await pdfjs.getDocument({ url: ${JSON.stringify(pdf)} }).promise;
  window.__pages = doc.numPages;
  window.renderPage = async (n, fmt, q) => {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 2 });
    const c = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp, background: '#FFFFFF' }).promise;
    return c.toDataURL(fmt === 'jpg' ? 'image/jpeg' : 'image/png', q);
  };
  window.extractText = async () => {
    const parts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const tc = await (await doc.getPage(i)).getTextContent();
      parts.push(tc.items.map((it) => it.str + (it.hasEOL ? '\\n' : '')).join(''));
    }
    return parts.join('\\n\\n');
  };
  window.__READY = true;
} catch (e) { window.__ERROR = String((e && e.message) || e); }
</script></body></html>`
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export const pdfEngine: EngineAdapter = {
  name: 'pdfjs',
  canConvert(inputExt, target) {
    return inputExt === 'pdf' && (IMG_TARGETS.includes(target) || TEXT_TARGETS.includes(target))
  },
  async convert(task, onProgress, signal) {
    const tempHtml = join(tmpdir(), `flashconvert-pdfview-${task.id}.html`)
    await writeFile(tempHtml, viewerHtml(task.inputPath), 'utf8')

    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        // 仅加载本地临时页面与本地 PDF，需放开 file:// 之间的访问
        webSecurity: false
      }
    })
    const onAbort = (): void => win.destroy()
    signal.addEventListener('abort', onAbort, { once: true })

    try {
      await win.loadFile(tempHtml)

      // 等待 PDF.js 初始化（模块加载 + 文档解析）
      let pages = 0
      const deadline = Date.now() + 30_000
      for (;;) {
        if (signal.aborted) throw new CanceledError()
        const st = (await win.webContents.executeJavaScript(
          '({ r: window.__READY, e: window.__ERROR, p: window.__pages || 0 })'
        )) as { r: boolean; e: string; p: number }
        if (st.e) {
          const friendly = /password/i.test(st.e)
            ? '该 PDF 已加密，请先解除密码后再转换'
            : '无法打开这份 PDF，文件可能已损坏'
          throw new ConversionError(friendly, st.e)
        }
        if (st.r) {
          pages = Math.min(st.p, MAX_PAGES)
          break
        }
        if (Date.now() > deadline) throw new ConversionError('PDF 解析超时，请重试')
        await sleep(200)
      }
      onProgress({ progress: 0.05 })

      if (IMG_TARGETS.includes(task.target)) {
        const ext = extname(task.outputPath)
        const stem = task.outputPath.slice(0, -ext.length)
        const quality = task.target === 'jpg' ? 0.92 : undefined
        for (let n = 1; n <= pages; n++) {
          if (signal.aborted) throw new CanceledError()
          const dataUrl = (await win.webContents.executeJavaScript(
            `renderPage(${n}, ${JSON.stringify(task.target)}, ${quality ?? 'undefined'})`
          )) as string
          const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
          const out = n === 1 ? task.outputPath : `${stem}-p${n}${ext}`
          await writeFile(out, buf)
          onProgress({ progress: 0.05 + (0.95 * n) / pages })
        }
        return
      }

      // 文本类目标
      const text = (await win.webContents.executeJavaScript('extractText()')) as string
      if (signal.aborted) throw new CanceledError()
      if (!text.trim()) {
        throw new ConversionError(
          '这份 PDF 没有可提取的文本（可能是扫描件），请改为转换成 PNG/JPG 图片'
        )
      }
      onProgress({ progress: 0.5 })

      if (task.target === 'txt') {
        await writeFile(task.outputPath, text, 'utf8')
        onProgress({ progress: 1 })
        return
      }

      const tempTxt = join(tmpdir(), `flashconvert-pdftext-${task.id}.txt`)
      await writeFile(tempTxt, text, 'utf8')
      try {
        const subtask: EngineTask = {
          ...task,
          inputPath: tempTxt,
          inputExt: 'txt',
          options: { kind: 'document', rawSource: false }
        }
        await pandocEngine.convert(
          subtask,
          (p) => onProgress({ progress: 0.5 + (p.progress ?? 0) * 0.5 }),
          signal
        )
      } finally {
        await unlink(tempTxt).catch(() => {})
      }
    } catch (e) {
      if (signal.aborted || e instanceof CanceledError) throw new CanceledError()
      throw e
    } finally {
      signal.removeEventListener('abort', onAbort)
      if (!win.isDestroyed()) win.destroy()
      await unlink(tempHtml).catch(() => {})
    }
  }
}
