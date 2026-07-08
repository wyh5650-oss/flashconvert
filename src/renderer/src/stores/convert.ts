import { create } from 'zustand'
import type { AdvancedOptions, ConversionRequest, PickedFile, TaskEvent } from '@shared/types'
import { DEFAULT_OPTIONS } from '@shared/types'
import { detectCategory, type FileCategory } from '@shared/formats'
import { toast } from './toast'
import { useSettingsStore } from './settings'
import { useUiStore } from './ui'

export type ConvertPhase = 'pick' | 'converting' | 'done'
export type ItemStatus = 'idle' | 'queued' | 'converting' | 'done' | 'error' | 'canceled'

export interface ConvertItem {
  id: string
  file: PickedFile
  category: FileCategory
  /** 引擎实测能力表；空数组 = 该类型暂不支持（不参与转换） */
  targets: string[]
  target: string
  options: AdvancedOptions
  status: ItemStatus
  progress: number
  speed?: string
  etaSec?: number
  error?: string
  outputPath?: string
}

interface ConvertState {
  phase: ConvertPhase
  items: ConvertItem[]
  addPicked(files: PickedFile[]): Promise<void>
  remove(id: string): void
  setTarget(id: string, target: string): void
  /** 批量统一目标格式，返回实际应用的文件数（只影响支持该目标的文件） */
  setTargetAll(target: string): number
  setOptions(id: string, options: AdvancedOptions): void
  startAll(): Promise<void>
  cancel(id: string): void
  cancelAll(): void
  reset(): void
}

const targetsCache = new Map<string, string[]>()

async function targetsForExt(ext: string): Promise<string[]> {
  const cached = targetsCache.get(ext)
  if (cached) return cached
  const targets = await window.flash.getTargets(ext)
  targetsCache.set(ext, targets)
  return targets
}

export const useConvertStore = create<ConvertState>((set, get) => {
  function patchItem(id: string, patch: Partial<ConvertItem>): void {
    set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }))
  }

  function maybeFinish(): void {
    const { items, phase } = get()
    if (phase !== 'converting') return
    const active = items.some((it) => it.status === 'queued' || it.status === 'converting')
    if (active) return
    set({ phase: 'done' })
    const participated = items.filter((it) => it.status !== 'idle')
    const ok = participated.filter((it) => it.status === 'done').length
    toast.success(`全部完成：${ok}/${participated.length} 个文件`)
    if (useSettingsStore.getState().notifyOnDone) {
      try {
        new Notification('闪转', { body: `转换完成：${ok}/${participated.length} 个文件` })
      } catch {
        // 通知不可用时静默
      }
    }
    if (ok > 0) {
      const settings = useSettingsStore.getState()
      const batches = settings.doneBatches + 1
      settings.set('doneBatches', batches)
      if (!settings.sponsorShown && batches >= 3) {
        settings.set('sponsorShown', true)
        useUiStore.getState().setSponsorOpen(true)
      }
    }
  }

  function onEvent(e: TaskEvent): void {
    switch (e.type) {
      case 'progress':
        patchItem(e.id, {
          status: 'converting',
          progress: e.progress,
          speed: e.speedX !== undefined ? `${e.speedX.toFixed(1)}×` : undefined,
          etaSec: e.etaSec
        })
        break
      case 'done':
        patchItem(e.id, {
          status: 'done',
          progress: 1,
          speed: undefined,
          etaSec: undefined,
          outputPath: e.outputPath
        })
        maybeFinish()
        break
      case 'error':
        patchItem(e.id, { status: 'error', error: e.message, speed: undefined, etaSec: undefined })
        maybeFinish()
        break
      case 'canceled':
        patchItem(e.id, { status: 'canceled', speed: undefined, etaSec: undefined })
        maybeFinish()
        break
    }
  }

  // 模块级订阅一次即可（单窗口应用）
  window.flash.onTaskEvent(onEvent)

  return {
    phase: 'pick',
    items: [],

    async addPicked(files) {
      const additions: ConvertItem[] = []
      let unknown = 0
      for (const file of files) {
        const category = detectCategory(file.ext)
        if (!category) {
          unknown++
          continue
        }
        if (get().items.some((it) => it.file.path === file.path)) continue
        const targets = await targetsForExt(file.ext)
        additions.push({
          id: crypto.randomUUID(),
          file,
          category,
          targets,
          target: targets[0] ?? '',
          options: { ...DEFAULT_OPTIONS[category] },
          status: 'idle',
          progress: 0
        })
      }
      if (unknown > 0) toast.error(`已跳过 ${unknown} 个无法识别的文件`)
      if (additions.length > 0) set((s) => ({ items: [...s.items, ...additions], phase: 'pick' }))
    },

    remove(id) {
      set((s) => ({ items: s.items.filter((it) => it.id !== id) }))
    },

    setTarget(id, target) {
      patchItem(id, { target })
    },

    setTargetAll(target) {
      const count = get().items.filter((it) => it.targets.includes(target)).length
      if (count > 0) {
        set((s) => ({
          items: s.items.map((it) => (it.targets.includes(target) ? { ...it, target } : it))
        }))
      }
      return count
    },

    setOptions(id, options) {
      patchItem(id, { options })
    },

    async startAll() {
      const { items } = get()
      const supported = items.filter((it) => it.targets.length > 0 && it.target)
      if (supported.length === 0) return
      const outputDir = useSettingsStore.getState().outputDir
      set((s) => ({
        phase: 'converting',
        items: s.items.map((it) =>
          supported.some((x) => x.id === it.id)
            ? { ...it, status: 'queued' as const, progress: 0, error: undefined }
            : it
        )
      }))
      const requests: ConversionRequest[] = supported.map((it) => ({
        id: it.id,
        inputPath: it.file.path,
        target: it.target,
        options: it.options,
        outputDir
      }))
      try {
        await window.flash.startTasks(requests)
      } catch (e) {
        toast.error('任务启动失败，请重试')
        set((s) => ({
          phase: 'pick',
          items: s.items.map((it) => ({ ...it, status: 'idle' as const }))
        }))
        console.error(e)
      }
    },

    cancel(id) {
      window.flash.cancelTask(id)
    },

    cancelAll() {
      window.flash.cancelAllTasks()
    },

    reset() {
      set({ phase: 'pick', items: [] })
    }
  }
})

/** 总进度（0-1）：终态计满，进行中按进度；idle（不支持的）不参与 */
export function overallProgress(items: ConvertItem[]): number {
  const joined = items.filter((it) => it.status !== 'idle')
  if (joined.length === 0) return 0
  const sum = joined.reduce((acc, it) => {
    if (it.status === 'done' || it.status === 'canceled' || it.status === 'error') return acc + 1
    return acc + it.progress
  }, 0)
  return sum / joined.length
}
