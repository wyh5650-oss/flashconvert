import { BrowserWindow } from 'electron'
import { unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { convertToStyledHtml } from './pandocEngine'
import { CanceledError, ConversionError, type EngineAdapter } from './types'

/**
 * 文档 → PDF：先经 Pandoc 出阅读器排版 HTML，再用 Electron 内置 Chromium
 * 打印引擎输出 PDF（printToPDF）。零额外依赖，样式与 md→html 完全一致。
 * html/htm 输入按原文件直接打印（保留其自带样式）。
 * 注册顺序在 LibreOffice 之后：装了 LO 的机器 Office→PDF 优先走 LO（保真度更高）。
 */
const INPUTS = ['md', 'markdown', 'html', 'htm', 'docx', 'epub', 'txt', 'odt']

export const chromiumPdfEngine: EngineAdapter = {
  name: 'chromium-pdf',
  canConvert(inputExt, target) {
    return target === 'pdf' && INPUTS.includes(inputExt)
  },
  async convert(task, onProgress, signal) {
    const isHtmlInput = task.inputExt === 'html' || task.inputExt === 'htm'
    const tempHtml = join(tmpdir(), `flashconvert-pdf-${task.id}.html`)
    let htmlPath = task.inputPath
    try {
      if (!isHtmlInput) {
        await convertToStyledHtml(
          task,
          tempHtml,
          (p) => onProgress({ progress: Math.min(0.55, (p.progress ?? 0) * 0.55) }),
          signal
        )
        htmlPath = tempHtml
      }
      if (signal.aborted) throw new CanceledError()
      onProgress({ progress: 0.7 })

      const win = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
      })
      const onAbort = (): void => win.destroy()
      signal.addEventListener('abort', onAbort, { once: true })
      try {
        await win.loadFile(htmlPath)
        const pdf = await win.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4'
        })
        if (signal.aborted) throw new CanceledError()
        await writeFile(task.outputPath, pdf)
      } catch (e) {
        if (signal.aborted || e instanceof CanceledError) throw new CanceledError()
        throw new ConversionError(
          '导出 PDF 失败，文档可能包含无法渲染的内容',
          e instanceof Error ? e.message : String(e)
        )
      } finally {
        signal.removeEventListener('abort', onAbort)
        if (!win.isDestroyed()) win.destroy()
      }
      onProgress({ progress: 1 })
    } finally {
      if (!isHtmlInput) await unlink(tempHtml).catch(() => {})
    }
  }
}
