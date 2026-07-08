import { existsSync } from 'node:fs'
import { copyFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runProcess } from '../utils/proc'
import { CanceledError, ConversionError, type EngineAdapter } from './types'

/**
 * Office → PDF：依赖本机 LibreOffice（soffice --headless）。
 * 未安装时 canConvert 返回 false，PDF 目标自然不出现在能力表里。
 */
const INPUTS = ['docx', 'doc', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'rtf']

const CANDIDATES =
  process.platform === 'darwin'
    ? ['/Applications/LibreOffice.app/Contents/MacOS/soffice']
    : [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
      ]

let cached: string | null | undefined

export function detectSoffice(): string | null {
  if (cached !== undefined) return cached
  cached = CANDIDATES.find((p) => existsSync(p)) ?? null
  return cached
}

export const officeEngine: EngineAdapter = {
  name: 'libreoffice',
  canConvert(inputExt, target) {
    return target === 'pdf' && INPUTS.includes(inputExt) && detectSoffice() !== null
  },
  async convert(task, onProgress, signal) {
    const soffice = detectSoffice()
    if (!soffice) throw new ConversionError('未检测到 LibreOffice，无法输出 PDF')

    const work = join(tmpdir(), `flashconvert-lo-${task.id}`)
    const profile = join(work, 'profile')
    await rm(work, { recursive: true, force: true })
    await mkdir(profile, { recursive: true })
    onProgress({ progress: 0.15 })
    try {
      const r = await runProcess(
        soffice,
        [
          '--headless',
          '--norestore',
          '--nolockcheck',
          `-env:UserInstallation=${pathToFileURL(profile).href}`,
          '--convert-to',
          'pdf',
          '--outdir',
          work,
          task.inputPath
        ],
        signal
      )
      if (signal.aborted) throw new CanceledError()
      const produced = join(work, `${basename(task.inputPath, extname(task.inputPath))}.pdf`)
      if (r.code !== 0 || !existsSync(produced)) {
        throw new ConversionError(
          '导出 PDF 失败：请确认文件未加密，且 LibreOffice 未被其他窗口占用',
          (r.stderr || r.stdout).slice(-800)
        )
      }
      onProgress({ progress: 0.9 })
      await copyFile(produced, task.outputPath)
      onProgress({ progress: 1 })
    } finally {
      await rm(work, { recursive: true, force: true }).catch(() => {})
    }
  }
}
