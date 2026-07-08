import type { AudioOptions, VideoOptions } from '../../shared/types'
import { DEFAULT_OPTIONS } from '../../shared/types'
import { runProcess } from '../utils/proc'
import { getFfmpegPath } from './imageFallback'
import { resolveVideoEncoder } from './hwaccel'
import {
  CanceledError,
  ConversionError,
  type EngineAdapter,
  type EngineProgress,
  type EngineTask
} from './types'

const VIDEO_IN = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'wmv', 'm4v', 'ts', 'mpg', 'mpeg']
const AUDIO_IN = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'aiff']
const VIDEO_OUT = ['mp4', 'mkv', 'webm', 'mov', 'gif']
const AUDIO_OUT = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a']

function videoOptions(task: EngineTask): VideoOptions {
  return task.options.kind === 'video' ? task.options : DEFAULT_OPTIONS.video
}

function audioOptions(task: EngineTask): AudioOptions {
  return task.options.kind === 'audio' ? task.options : DEFAULT_OPTIONS.audio
}

/** 用 `ffmpeg -i` 的报错输出解析时长（避免额外分发 ffprobe） */
export async function probeDurationSec(
  inputPath: string,
  signal: AbortSignal
): Promise<number | null> {
  const r = await runProcess(getFfmpegPath(), ['-hide_banner', '-i', inputPath], signal).catch(
    (e) => {
      if (e instanceof CanceledError) throw e
      return null
    }
  )
  if (!r) return null
  const m = r.stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (!m) return null
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

function audioCodecArgs(target: string, opts: AudioOptions): string[] {
  const args: string[] = ['-vn']
  const kbps = opts.bitrateMode === 'custom' && opts.bitrateKbps ? `${opts.bitrateKbps}k` : null
  switch (target) {
    case 'mp3':
      args.push('-c:a', 'libmp3lame', ...(kbps ? ['-b:a', kbps] : ['-q:a', '2']))
      break
    case 'wav':
      args.push('-c:a', 'pcm_s16le')
      break
    case 'flac':
      args.push('-c:a', 'flac')
      break
    case 'aac':
    case 'm4a':
      args.push('-c:a', 'aac', '-b:a', kbps ?? '192k')
      break
    case 'ogg':
      args.push('-c:a', 'libvorbis', ...(kbps ? ['-b:a', kbps] : ['-q:a', '5']))
      break
    default:
      throw new ConversionError(`暂不支持输出 ${target.toUpperCase()}`)
  }
  if (opts.sampleRate !== 'original') args.push('-ar', opts.sampleRate)
  if (opts.channels !== 'original') args.push('-ac', opts.channels === 'mono' ? '1' : '2')
  if (opts.normalize) args.push('-af', 'loudnorm=I=-14:TP=-1.5:LRA=11')
  return args
}

function scaleFilter(opts: VideoOptions): string | null {
  if (opts.resolution === 'original') return null
  let w: number | undefined
  let h: number | undefined
  if (opts.resolution === 'custom') {
    w = opts.width
    h = opts.height
  } else {
    const [pw, ph] = opts.resolution.split('x').map(Number)
    w = pw
    h = ph
  }
  if (!w && !h) return null
  return `scale=${w ?? -2}:${h ?? -2}:force_original_aspect_ratio=decrease:force_divisible_by=2`
}

async function buildVideoArgs(task: EngineTask): Promise<string[]> {
  const opts = videoOptions(task)
  const target = task.target

  if (target === 'gif') {
    const fps = opts.fps === 'original' ? '12' : opts.fps
    const scale =
      opts.resolution === 'original'
        ? 'scale=480:-2:flags=lanczos'
        : `${scaleFilter(opts)}:flags=lanczos`.replace(
            ':force_original_aspect_ratio=decrease:force_divisible_by=2',
            ':force_original_aspect_ratio=decrease'
          )
    return [
      '-filter_complex',
      `fps=${fps},${scale},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
      '-an'
    ]
  }

  // WebM 容器只装 VP9/AV1
  const codec = target === 'webm' && opts.codec !== 'av1' ? 'vp9' : opts.codec
  const resolved = await resolveVideoEncoder(codec, opts.hwaccel)
  if (!resolved) {
    throw new ConversionError(
      '所选的硬件加速在本机不可用，请在高级设置中改为"自动"或"关闭"'
    )
  }

  const args: string[] = ['-c:v', resolved.encoder]

  if (opts.bitrateMode === 'custom' && opts.bitrateKbps) {
    args.push('-b:v', `${opts.bitrateKbps}k`)
  } else if (!resolved.hardware) {
    switch (resolved.encoder) {
      case 'libx264':
        args.push('-crf', '23', '-preset', 'medium')
        break
      case 'libx265':
        args.push('-crf', '26', '-preset', 'medium')
        break
      case 'libvpx-vp9':
        args.push('-crf', '32', '-b:v', '0', '-row-mt', '1')
        break
      case 'libsvtav1':
        args.push('-crf', '32', '-preset', '8')
        break
    }
  }

  if (codec === 'h264' || codec === 'hevc') args.push('-pix_fmt', 'yuv420p')

  const scale = scaleFilter(opts)
  if (scale) args.push('-vf', scale)
  if (opts.fps !== 'original') args.push('-r', opts.fps)

  if (target === 'webm') args.push('-c:a', 'libopus', '-b:a', '128k')
  else args.push('-c:a', 'aac', '-b:a', '192k')

  if (target === 'mp4' || target === 'mov') args.push('-movflags', '+faststart')

  return args
}

/** 解析 -progress pipe:1 的 key=value 流 */
function makeProgressParser(
  durationSec: number | null,
  onProgress: (p: EngineProgress) => void
): (line: string) => void {
  let speedX: number | undefined
  return (line) => {
    const [key, value] = line.split('=')
    if (!key || value === undefined) return
    if (key === 'speed') {
      const v = parseFloat(value)
      if (!Number.isNaN(v) && v > 0) speedX = v
    } else if (key === 'out_time_us' || key === 'out_time_ms') {
      // 两个字段单位都是微秒（ffmpeg 的历史遗留命名）
      const us = Number(value)
      if (!Number.isFinite(us) || us < 0 || !durationSec) return
      const t = us / 1e6
      const progress = Math.min(0.99, t / durationSec)
      const etaSec =
        speedX && speedX > 0 ? Math.max(0, Math.round((durationSec - t) / speedX)) : undefined
      onProgress({ progress, speedX, etaSec })
    }
  }
}

async function convertMedia(
  task: EngineTask,
  onProgress: (p: EngineProgress) => void,
  signal: AbortSignal
): Promise<void> {
  const duration = await probeDurationSec(task.inputPath, signal)
  if (signal.aborted) throw new CanceledError()

  const isAudioTarget = AUDIO_OUT.includes(task.target)
  const codecArgs = isAudioTarget
    ? audioCodecArgs(task.target, audioOptions(task))
    : await buildVideoArgs(task)

  const args = [
    '-y',
    '-hide_banner',
    '-nostats',
    '-progress',
    'pipe:1',
    '-i',
    task.inputPath,
    ...codecArgs,
    task.outputPath
  ]

  const r = await runProcess(
    getFfmpegPath(),
    args,
    signal,
    undefined,
    makeProgressParser(duration, onProgress)
  )
  if (r.code !== 0) {
    throw new ConversionError(
      `${task.inputExt.toUpperCase()} → ${task.target.toUpperCase()} 转换失败，源文件可能损坏或编码不受支持`,
      r.stderr.slice(-1200)
    )
  }
  onProgress({ progress: 1 })
}

export const videoEngine: EngineAdapter = {
  name: 'ffmpeg-video',
  canConvert(inputExt, target) {
    return VIDEO_IN.includes(inputExt) && (VIDEO_OUT.includes(target) || AUDIO_OUT.includes(target))
  },
  convert: convertMedia
}

export const audioEngine: EngineAdapter = {
  name: 'ffmpeg-audio',
  canConvert(inputExt, target) {
    return AUDIO_IN.includes(inputExt) && AUDIO_OUT.includes(target)
  },
  convert: convertMedia
}
