import type { EngineAdapter } from './types'
import { sharpEngine } from './sharpEngine'
import { heicEngine } from './heicEngine'
import { imageFallbackEngine } from './imageFallback'
import { audioEngine, videoEngine } from './ffmpegAv'
import { pandocEngine } from './pandocEngine'
import { officeEngine } from './officeEngine'
import { chromiumPdfEngine } from './chromiumPdf'
import { archiveEngine } from './archiveEngine'

/** 能力注册表：顺序即优先级（sharp 快于兜底；Office→PDF 优先 LibreOffice，Chromium 兜底）。 */
const adapters: EngineAdapter[] = [
  sharpEngine,
  heicEngine,
  imageFallbackEngine,
  videoEngine,
  audioEngine,
  pandocEngine,
  officeEngine,
  chromiumPdfEngine,
  archiveEngine
]

/** 已知目标格式的展示顺序（视频输入：容器在前、提取音频在后） */
const TARGET_ORDER = [
  'mp4', 'mkv', 'webm', 'mov',
  'jpg', 'png', 'webp', 'avif', 'gif', 'tiff', 'bmp',
  'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a',
  'pdf', 'docx', 'md', 'html', 'epub', 'odt', 'rtf', 'txt',
  'zip', '7z', 'tar'
]

export function targetsFor(inputExt: string): string[] {
  const ext = inputExt.toLowerCase()
  const set = new Set<string>()
  for (const a of adapters) {
    for (const t of TARGET_ORDER) {
      if (t !== ext && a.canConvert(ext, t)) set.add(t)
    }
  }
  return [...set].sort((x, y) => TARGET_ORDER.indexOf(x) - TARGET_ORDER.indexOf(y))
}

export function adapterFor(inputExt: string, target: string): EngineAdapter | null {
  const ext = inputExt.toLowerCase()
  return adapters.find((a) => a.canConvert(ext, target.toLowerCase())) ?? null
}
