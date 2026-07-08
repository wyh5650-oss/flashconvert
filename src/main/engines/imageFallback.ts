import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unlink } from 'node:fs/promises'
import ffmpegPath from 'ffmpeg-static'
import { runProcess } from '../utils/proc'
import { encodeWithSharp } from './sharpEngine'
import { CanceledError, ConversionError, type EngineAdapter } from './types'

/** sharp 预编译版不认识的图片输入，先用 FFmpeg 解码成 PNG 再走 sharp 编码（HEIC 走专用引擎） */
const INPUTS = ['bmp', 'ico', 'psd']
const OUTPUTS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff']

export function getFfmpegPath(): string {
  if (!ffmpegPath) {
    throw new ConversionError('未找到 FFmpeg 组件，请重新安装应用', 'ffmpeg-static returned null')
  }
  return ffmpegPath.replace('app.asar', 'app.asar.unpacked')
}

export const imageFallbackEngine: EngineAdapter = {
  name: 'ffmpeg-image',
  canConvert(inputExt, target) {
    return INPUTS.includes(inputExt) && OUTPUTS.includes(target)
  },
  async convert(task, onProgress, signal) {
    const temp = join(tmpdir(), `flashconvert-${task.id}.png`)
    onProgress({ progress: 0.1 })
    try {
      const result = await runProcess(
        getFfmpegPath(),
        ['-y', '-hide_banner', '-i', task.inputPath, '-frames:v', '1', temp],
        signal
      )
      if (result.code !== 0) {
        throw new ConversionError(
          `无法解码 ${task.inputExt.toUpperCase()} 文件，文件可能已损坏或该变体暂不支持`,
          result.stderr.slice(-800)
        )
      }
      if (signal.aborted) throw new CanceledError()
      onProgress({ progress: 0.6 })
      await encodeWithSharp(temp, task, signal)
      onProgress({ progress: 1 })
    } finally {
      await unlink(temp).catch(() => {})
    }
  }
}
