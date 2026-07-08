import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  ConversionRequest,
  FlashApi,
  HistoryRecord,
  PickedFile,
  SettingsData,
  TaskEvent,
  WindowCommand
} from '../shared/types'

const api: FlashApi = {
  windowControl(cmd: WindowCommand): void {
    ipcRenderer.send('window:control', cmd)
  },
  platform: process.platform,
  pickFiles(): Promise<PickedFile[]> {
    return ipcRenderer.invoke('dialog:pickFiles')
  },
  statFiles(paths: string[]): Promise<PickedFile[]> {
    return ipcRenderer.invoke('fs:statFiles', paths)
  },
  getFilePath(file: File): string {
    return webUtils.getPathForFile(file)
  },
  getTargets(ext: string): Promise<string[]> {
    return ipcRenderer.invoke('caps:targets', ext)
  },
  getDefaultOutputDir(): Promise<string> {
    return ipcRenderer.invoke('app:defaultOutputDir')
  },
  startTasks(requests: ConversionRequest[]): Promise<void> {
    return ipcRenderer.invoke('task:start', requests)
  },
  cancelTask(id: string): void {
    ipcRenderer.send('task:cancel', id)
  },
  cancelAllTasks(): void {
    ipcRenderer.send('task:cancelAll')
  },
  onTaskEvent(cb: (e: TaskEvent) => void): () => void {
    const listener = (_event: unknown, e: TaskEvent): void => cb(e)
    ipcRenderer.on('task:event', listener)
    return () => ipcRenderer.removeListener('task:event', listener)
  },
  setConcurrency(n: number): void {
    ipcRenderer.send('task:setConcurrency', n)
  },
  openPath(path: string): void {
    ipcRenderer.send('shell:openPath', path)
  },
  showInFolder(path: string): void {
    ipcRenderer.send('shell:showInFolder', path)
  },
  getSettings(): Promise<SettingsData> {
    return ipcRenderer.invoke('settings:get')
  },
  setSettings(patch: Partial<SettingsData>): void {
    ipcRenderer.send('settings:set', patch)
  },
  pickDirectory(): Promise<string | null> {
    return ipcRenderer.invoke('dialog:pickDirectory')
  },
  listHistory(): Promise<HistoryRecord[]> {
    return ipcRenderer.invoke('history:list')
  },
  removeHistory(id: string): void {
    ipcRenderer.send('history:remove', id)
  },
  clearHistory(): void {
    ipcRenderer.send('history:clear')
  },
  onHistoryChange(cb: () => void): () => void {
    const listener = (): void => cb()
    ipcRenderer.on('history:changed', listener)
    return () => ipcRenderer.removeListener('history:changed', listener)
  }
}

contextBridge.exposeInMainWorld('flash', api)
