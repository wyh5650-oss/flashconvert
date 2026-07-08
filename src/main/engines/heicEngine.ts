import { readFile, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import convertHeic from 'heic-convert'
import { encodeWithSharp } from './sharpEngine'
import { CanceledError, ConversionError, type EngineAdapter } from './types'

/**
 * HEIC/HEIF 专用解码（libheif WASM）。
 * ffmpeg-static 6.1 essentials 构建没有 HEIF demuxer，故走 heic-convert，
 * 解码为 PNG 后复用 sharp 编码管线。
 */
const INPUTS = ['heic', 'heif']
const OUTPUTS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff']

export const heicEngine: EngineAdapter = {
  name: 'heic-convert',
  canConvert(inputExt, target) {
    return INPUTS.includes(inputExt) && OUTPUTS.includes(target)
  },
  async convert(task, onProgress, signal) {
    onProgress({ progress: 0.1 })
    let decoded: Buffer
    try {
      const input = await readFile(task.inputPath)
      const out = await convertHeic({ buffer: input, format: 'PNG' })
      decoded = Buffer.from(out)
    } catch (e) {
      throw new ConversionError(
        '无法解码这张 HEIC 图片，文件可能已损坏',
        e instanceof Error ? e.message : String(e)
      )
    }
    if (signal.aborted) throw new CanceledError()
    onProgress({ progress: 0.6 })

    const temp = join(tmpdir(), `flashconvert-${task.id}.png`)
    try {
      await writeFile(temp, decoded)
      await encodeWithSharp(temp, task, signal)
      onProgress({ progress: 1 })
    } finally {
      await unlink(temp).catch(() => {})
    }
  }
}
