import { unlink } from 'node:fs/promises'
import type { TaskEvent } from '../shared/types'
import { adapterFor } from './engines/registry'
import { CanceledError, ConversionError, type EngineTask } from './engines/types'

type Emit = (e: TaskEvent) => void

export class TaskQueue {
  private concurrency = 2
  private pending: EngineTask[] = []
  private active = new Map<string, AbortController>()

  constructor(private emit: Emit) {}

  setConcurrency(n: number): void {
    this.concurrency = Math.min(4, Math.max(1, Math.floor(n)))
    this.pump()
  }

  add(tasks: EngineTask[]): void {
    this.pending.push(...tasks)
    this.pump()
  }

  cancel(id: string): void {
    const ctl = this.active.get(id)
    if (ctl) {
      ctl.abort()
      return
    }
    const idx = this.pending.findIndex((t) => t.id === id)
    if (idx >= 0) {
      this.pending.splice(idx, 1)
      this.emit({ type: 'canceled', id })
    }
  }

  cancelAll(): void {
    const queued = this.pending.splice(0, this.pending.length)
    for (const t of queued) this.emit({ type: 'canceled', id: t.id })
    for (const ctl of this.active.values()) ctl.abort()
  }

  private pump(): void {
    while (this.active.size < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift()!
      void this.run(task)
    }
  }

  private async run(task: EngineTask): Promise<void> {
    const ctl = new AbortController()
    this.active.set(task.id, ctl)
    try {
      const adapter = adapterFor(task.inputExt, task.target)
      if (!adapter) {
        throw new ConversionError(
          `暂不支持 ${task.inputExt.toUpperCase()} → ${task.target.toUpperCase()}`
        )
      }
      this.emit({ type: 'progress', id: task.id, progress: 0 })
      await adapter.convert(
        task,
        (p) =>
          this.emit({
            type: 'progress',
            id: task.id,
            progress: Math.min(1, Math.max(0, p.progress ?? 0)),
            speedX: p.speedX,
            etaSec: p.etaSec
          }),
        ctl.signal
      )
      if (ctl.signal.aborted) {
        await unlink(task.outputPath).catch(() => {})
        this.emit({ type: 'canceled', id: task.id })
      } else {
        this.emit({ type: 'done', id: task.id, outputPath: task.outputPath })
      }
    } catch (e) {
      await unlink(task.outputPath).catch(() => {})
      if (e instanceof CanceledError || ctl.signal.aborted) {
        this.emit({ type: 'canceled', id: task.id })
      } else if (!task.retried) {
        // 非取消失败自动重试一次
        console.warn(`[task ${task.id}] failed, retrying once`, e)
        task.retried = true
        this.pending.unshift(task)
        this.emit({ type: 'progress', id: task.id, progress: 0 })
      } else {
        const message =
          e instanceof ConversionError
            ? e.friendly
            : '转换失败，请重试；若持续失败请查看日志'
        console.error(`[task ${task.id}]`, e)
        this.emit({ type: 'error', id: task.id, message })
      }
    } finally {
      this.active.delete(task.id)
      this.pump()
    }
  }
}
