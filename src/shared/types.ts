export type WindowCommand = 'minimize' | 'maximize' | 'close'

/** 文件选择/拖入后的基础信息（由主进程 stat 补全） */
export interface PickedFile {
  path: string
  name: string
  size: number
  ext: string
}

/** ---------- 按类别的高级设置 ---------- */

export interface VideoOptions {
  kind: 'video'
  /** 'original' 或 '宽x高'，custom 时用 width/height */
  resolution: 'original' | '3840x2160' | '2560x1440' | '1920x1080' | '1280x720' | '854x480' | 'custom'
  width?: number
  height?: number
  bitrateMode: 'auto' | 'custom'
  bitrateKbps?: number
  fps: 'original' | '60' | '30' | '24'
  codec: 'h264' | 'hevc' | 'vp9' | 'av1'
  hwaccel: 'auto' | 'nvenc' | 'qsv' | 'amf' | 'off'
}

export interface AudioOptions {
  kind: 'audio'
  bitrateMode: 'auto' | 'custom'
  bitrateKbps?: number
  sampleRate: 'original' | '44100' | '48000' | '96000'
  channels: 'original' | 'mono' | 'stereo'
  normalize: boolean
}

export interface ImageOptions {
  kind: 'image'
  quality: number
  size: 'original' | '3840x2160' | '1920x1080' | 'custom'
  width?: number
  height?: number
  keepAspect: boolean
  keepMetadata: boolean
  background: string
}

export interface ArchiveOptions {
  kind: 'archive'
  level: 'store' | 'fast' | 'normal' | 'max'
  password?: string
}

export interface DocumentOptions {
  kind: 'document'
  /** true=输出 Markdown 原始代码样式；false=输出排版后的阅读样式（默认） */
  rawSource: boolean
}

export type AdvancedOptions =
  | VideoOptions
  | AudioOptions
  | ImageOptions
  | ArchiveOptions
  | DocumentOptions

export const DEFAULT_OPTIONS = {
  video: {
    kind: 'video',
    resolution: 'original',
    bitrateMode: 'auto',
    fps: 'original',
    codec: 'h264',
    hwaccel: 'auto'
  } as VideoOptions,
  audio: {
    kind: 'audio',
    bitrateMode: 'auto',
    sampleRate: 'original',
    channels: 'original',
    normalize: false
  } as AudioOptions,
  image: {
    kind: 'image',
    quality: 85,
    size: 'original',
    keepAspect: true,
    keepMetadata: false,
    background: '#ffffff'
  } as ImageOptions,
  archive: { kind: 'archive', level: 'normal' } as ArchiveOptions,
  document: { kind: 'document', rawSource: false } as DocumentOptions
} as const

/** ---------- 设置与历史 ---------- */

export interface SettingsData {
  theme: 'light' | 'dark' | 'system'
  motion: 'full' | 'reduced' | 'off' | 'system'
  outputDir: string
  concurrency: number
  notifyOnDone: boolean
  keepOriginal: boolean
  language: 'zh-CN' | 'en'
  autoStart: boolean
  /** 赞助弹窗是否已自动弹出过（只弹一次） */
  sponsorShown: boolean
  /** 成功完成的转换批次数（用于赞助弹窗触发） */
  doneBatches: number
}

export interface HistoryRecord {
  id: string
  name: string
  inputPath: string
  outputPath?: string
  from: string
  to: string
  size: number
  ok: boolean
  reason?: string
  /** ISO 时间串 */
  time: string
}

/** ---------- 转换任务 IPC 契约 ---------- */

export interface ConversionRequest {
  id: string
  inputPath: string
  target: string
  options: AdvancedOptions
  /** 空串表示由主进程用默认输出目录 */
  outputDir: string
}

export type TaskEvent =
  | { type: 'progress'; id: string; progress: number; speedX?: number; etaSec?: number }
  | { type: 'done'; id: string; outputPath: string }
  | { type: 'error'; id: string; message: string }
  | { type: 'canceled'; id: string }

/** 渲染进程可用的桥接 API（preload 实现，contextBridge 暴露为 window.flash） */
export interface FlashApi {
  windowControl(cmd: WindowCommand): void
  platform: string
  /** 打开系统文件选择器 */
  pickFiles(): Promise<PickedFile[]>
  /** 拖入的路径批量补全信息（过滤目录与不存在的） */
  statFiles(paths: string[]): Promise<PickedFile[]>
  /** 从拖拽的 File 对象拿绝对路径（Electron webUtils） */
  getFilePath(file: File): string
  /** 输入扩展名 → 引擎实测支持的目标格式（能力表） */
  getTargets(ext: string): Promise<string[]>
  /** 默认输出目录（下载/已转换） */
  getDefaultOutputDir(): Promise<string>
  startTasks(requests: ConversionRequest[]): Promise<void>
  cancelTask(id: string): void
  cancelAllTasks(): void
  /** 订阅任务事件，返回取消订阅函数 */
  onTaskEvent(cb: (e: TaskEvent) => void): () => void
  setConcurrency(n: number): void
  openPath(path: string): void
  showInFolder(path: string): void
  getSettings(): Promise<SettingsData>
  setSettings(patch: Partial<SettingsData>): void
  /** 打开目录选择器，取消返回 null */
  pickDirectory(): Promise<string | null>
  listHistory(): Promise<HistoryRecord[]>
  removeHistory(id: string): void
  clearHistory(): void
  /** 历史变化通知（主进程在任务落账后广播） */
  onHistoryChange(cb: () => void): () => void
}
