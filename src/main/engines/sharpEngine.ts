import { unlink } from 'node:fs/promises'
import sharp from 'sharp'
import type { ImageOptions } from '../../shared/types'
import { DEFAULT_OPTIONS } from '../../shared/types'
import { CanceledError, ConversionError, type EngineAdapter, type EngineTask } from './types'

const INPUTS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'tif', 'tiff', 'svg']
const OUTPUTS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff', 'gif']

function imageOptions(task: EngineTask): ImageOptions {
  return task.options.kind === 'image' ? task.options : DEFAULT_OPTIONS.image
}

/** 供 sharp 引擎与 ffmpeg 兜底引擎复用的编码管线 */
export async function encodeWithSharp(
  inputPath: string,
  task: EngineTask,
  signal: AbortSignal
): Promise<void> {
  const opts = imageOptions(task)
  const target = task.target === 'jpeg' ? 'jpg' : task.target
  const animated = target === 'gif' || target === 'webp'

  let pipeline = sharp(inputPath, { animated, failOn: 'none', limitInputPixels: 1e9 })

  let meta
  try {
    meta = await pipeline.metadata()
  } catch (e) {
    throw new ConversionError(
      '无法读取这张图片，文件可能已损坏或格式不受支持',
      e instanceof Error ? e.message : String(e)
    )
  }
  if (signal.aborted) throw new CanceledError()

  if (opts.size !== 'original') {
    let w: number | undefined
    let h: number | undefined
    if (opts.size === 'custom') {
      w = opts.width
      h = opts.height
    } else {
      const [pw, ph] = opts.size.split('x').map(Number)
      w = pw
      h = ph
    }
    if (w || h) {
      pipeline = pipeline.resize({
        width: w,
        height: h,
        fit: opts.keepAspect ? 'inside' : 'fill'
      })
    }
  }

  if (target === 'jpg' && (meta.hasAlpha ?? false)) {
    pipeline = pipeline.flatten({ background: opts.background })
  }

  if (opts.keepMetadata) {
    pipeline = pipeline.withMetadata()
  }

  const q = Math.min(100, Math.max(1, opts.quality))
  switch (target) {
    case 'jpg':
      pipeline = pipeline.jpeg({ quality: q, mozjpeg: true })
      break
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 9 })
      break
    case 'webp':
      pipeline = pipeline.webp({ quality: q })
      break
    case 'avif':
      pipeline = pipeline.avif({ quality: q })
      break
    case 'tiff':
      pipeline = pipeline.tiff({ quality: q })
      break
    case 'gif':
      pipeline = pipeline.gif()
      break
    default:
      throw new ConversionError(`暂不支持输出 ${target.toUpperCase()} 格式`)
  }

  try {
    await pipeline.toFile(task.outputPath)
  } catch (e) {
    throw new ConversionError(
      '图片转换失败，可能是磁盘空间不足或输出目录不可写',
      e instanceof Error ? e.message : String(e)
    )
  }

  if (signal.aborted) {
    await unlink(task.outputPath).catch(() => {})
    throw new CanceledError()
  }
}

export const sharpEngine: EngineAdapter = {
  name: 'sharp',
  canConvert(inputExt, target) {
    return INPUTS.includes(inputExt) && OUTPUTS.includes(target)
  },
  async convert(task, onProgress, signal) {
    onProgress({ progress: 0.15 })
    await encodeWithSharp(task.inputPath, task, signal)
    onProgress({ progress: 1 })
  }
}
