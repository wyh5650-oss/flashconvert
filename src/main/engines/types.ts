import type { AdvancedOptions } from '../../shared/types'

export interface EngineProgress {
  progress?: number
  speedX?: number
  etaSec?: number
}

export interface EngineTask {
  id: string
  inputPath: string
  outputPath: string
  inputExt: string
  target: string
  options: AdvancedOptions
  /** 失败自动重试标记（队列内部使用，一次为限） */
  retried?: boolean
}

export interface EngineAdapter {
  name: string
  canConvert(inputExt: string, target: string): boolean
  convert(
    task: EngineTask,
    onProgress: (p: EngineProgress) => void,
    signal: AbortSignal
  ): Promise<void>
}

export class ConversionError extends Error {
  /** 面向用户的中文提示（含解决建议） */
  friendly: string
  constructor(friendly: string, detail?: string) {
    super(detail ?? friendly)
    this.friendly = friendly
  }
}

export class CanceledError extends Error {
  constructor() {
    super('canceled')
  }
}
