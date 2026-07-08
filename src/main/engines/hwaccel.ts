import { runProcess } from '../utils/proc'
import { getFfmpegPath } from './imageFallback'

export type HwVendor = 'nvenc' | 'qsv' | 'amf'

const HW_ENCODERS: Record<HwVendor, { h264: string; hevc: string }> = {
  nvenc: { h264: 'h264_nvenc', hevc: 'hevc_nvenc' },
  qsv: { h264: 'h264_qsv', hevc: 'hevc_qsv' },
  amf: { h264: 'h264_amf', hevc: 'hevc_amf' }
}

const probeCache = new Map<string, boolean>()

/**
 * 编码器真实可用性探测：-encoders 列表里有 ≠ 驱动可用，
 * 用 0.2 秒的黑场做一次微型编码验证，结果缓存。
 */
export async function probeEncoder(encoder: string): Promise<boolean> {
  const cached = probeCache.get(encoder)
  if (cached !== undefined) return cached
  try {
    const r = await runProcess(
      getFfmpegPath(),
      [
        '-hide_banner',
        '-f', 'lavfi',
        '-i', 'color=black:s=128x128:d=0.2:r=10',
        '-c:v', encoder,
        '-f', 'null',
        '-'
      ],
      new AbortController().signal
    )
    const ok = r.code === 0
    probeCache.set(encoder, ok)
    return ok
  } catch {
    probeCache.set(encoder, false)
    return false
  }
}

/**
 * 解析硬件加速选项 → 实际视频编码器名。
 * auto：按 NVENC → QSV → AMF 顺序探测，全不可用回退软件编码。
 * 指定厂商但探测失败：返回 null（由调用方给出友好报错）。
 */
export async function resolveVideoEncoder(
  codec: 'h264' | 'hevc' | 'vp9' | 'av1',
  hwaccel: 'auto' | HwVendor | 'off'
): Promise<{ encoder: string; hardware: boolean } | null> {
  const software: Record<typeof codec, string> = {
    h264: 'libx264',
    hevc: 'libx265',
    vp9: 'libvpx-vp9',
    av1: 'libsvtav1'
  }

  // VP9/AV1 硬编支持面窄且质量参差，统一走软件编码
  if (codec === 'vp9' || codec === 'av1' || hwaccel === 'off') {
    return { encoder: software[codec], hardware: false }
  }

  if (hwaccel === 'auto') {
    for (const vendor of ['nvenc', 'qsv', 'amf'] as HwVendor[]) {
      const enc = HW_ENCODERS[vendor][codec]
      if (await probeEncoder(enc)) return { encoder: enc, hardware: true }
    }
    return { encoder: software[codec], hardware: false }
  }

  const enc = HW_ENCODERS[hwaccel][codec]
  if (await probeEncoder(enc)) return { encoder: enc, hardware: true }
  return null
}
