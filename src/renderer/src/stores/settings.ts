import { create } from 'zustand'
import type { SettingsData } from '@shared/types'

/**
 * 应用设置：启动时从主进程 electron-store 水合，
 * 之后的每次修改都会持久化（hydrated 前的写入只改内存，避免覆盖磁盘值）。
 */
interface SettingsState extends SettingsData {
  hydrated: boolean
  hydrate(data: SettingsData): void
  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'system',
  motion: 'system',
  outputDir: '',
  concurrency: 2,
  notifyOnDone: true,
  keepOriginal: true,
  language: 'zh-CN',
  autoStart: false,
  gpuAccel: true,
  sponsorShown: false,
  doneBatches: 0,
  hydrated: false,

  hydrate(data) {
    set({ ...data, hydrated: true })
  },

  set(key, value) {
    set({ [key]: value } as Pick<SettingsData, typeof key>)
    if (get().hydrated) {
      window.flash.setSettings({ [key]: value } as Partial<SettingsData>)
    }
  }
}))
