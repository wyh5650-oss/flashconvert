import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { stat, unlink } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type {
  ConversionRequest,
  PickedFile,
  SettingsData,
  TaskEvent,
  WindowCommand
} from '../shared/types'
import { targetsFor } from './engines/registry'
import type { EngineTask } from './engines/types'
import { TaskQueue } from './queue'
import { safeOutputPath } from './utils/naming'
import {
  addHistory,
  clearHistory,
  getSettings,
  listHistory,
  removeHistory,
  setSettings
} from './store'

interface TaskMeta {
  name: string
  inputPath: string
  from: string
  to: string
  size: number
}

const taskMeta = new Map<string, TaskMeta>()

function sendAll(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args)
  }
}

function recordOutcome(e: TaskEvent): void {
  if (e.type !== 'done' && e.type !== 'error') return
  const meta = taskMeta.get(e.id)
  if (!meta) return
  taskMeta.delete(e.id)
  addHistory({
    id: e.id,
    name: meta.name,
    inputPath: meta.inputPath,
    outputPath: e.type === 'done' ? e.outputPath : undefined,
    from: meta.from,
    to: meta.to,
    size: meta.size,
    ok: e.type === 'done',
    reason: e.type === 'error' ? e.message : undefined,
    time: new Date().toISOString()
  })
  if (e.type === 'done' && !getSettings().keepOriginal) {
    void unlink(meta.inputPath).catch(() => {})
  }
}

function broadcast(e: TaskEvent): void {
  try {
    recordOutcome(e)
  } catch (err) {
    console.error('recordOutcome failed', err)
  }
  sendAll('task:event', e)
}

export const queue = new TaskQueue(broadcast)

export async function toEngineTask(req: ConversionRequest): Promise<EngineTask> {
  const dir = req.outputDir || getSettings().outputDir
  const outputPath = await safeOutputPath(req.inputPath, dir, req.target)
  return {
    id: req.id,
    inputPath: req.inputPath,
    outputPath,
    inputExt: extname(req.inputPath).slice(1).toLowerCase(),
    target: req.target,
    options: req.options
  }
}

async function toPickedFile(path: string): Promise<PickedFile | null> {
  try {
    const s = await stat(path)
    if (!s.isFile()) return null
    return {
      path,
      name: basename(path),
      size: s.size,
      ext: extname(path).slice(1).toLowerCase()
    }
  } catch {
    return null
  }
}

export function registerIpc(): void {
  ipcMain.on('window:control', (event, cmd: WindowCommand) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    switch (cmd) {
      case 'close':
        win.close()
        break
      case 'minimize':
        win.minimize()
        break
      case 'maximize':
        if (win.isMaximized()) win.unmaximize()
        else win.maximize()
        break
    }
  })

  ipcMain.handle('dialog:pickFiles', async (event): Promise<PickedFile[]> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return []
    const result = await dialog.showOpenDialog(win, {
      title: '选择要转换的文件',
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled) return []
    const files = await Promise.all(result.filePaths.map(toPickedFile))
    return files.filter((f): f is PickedFile => f !== null)
  })

  ipcMain.handle('dialog:pickDirectory', async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: '选择输出文件夹',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('fs:statFiles', async (_event, paths: string[]): Promise<PickedFile[]> => {
    if (!Array.isArray(paths)) return []
    const files = await Promise.all(paths.slice(0, 500).map((p) => toPickedFile(String(p))))
    return files.filter((f): f is PickedFile => f !== null)
  })

  ipcMain.handle('caps:targets', (_event, ext: string): string[] => targetsFor(String(ext)))

  ipcMain.handle('app:defaultOutputDir', (): string => getSettings().outputDir)

  ipcMain.handle('settings:get', (): SettingsData => {
    const s = getSettings()
    queue.setConcurrency(s.concurrency)
    return s
  })

  ipcMain.on('settings:set', (_event, patch: Partial<SettingsData>) => {
    const merged = setSettings(patch ?? {})
    if (patch?.concurrency !== undefined) queue.setConcurrency(merged.concurrency)
  })

  ipcMain.handle('history:list', () => listHistory())
  ipcMain.on('history:remove', (_event, id: string) => removeHistory(String(id)))
  ipcMain.on('history:clear', () => clearHistory())

  ipcMain.handle('task:start', async (_event, requests: ConversionRequest[]): Promise<void> => {
    if (!Array.isArray(requests)) return
    const tasks: EngineTask[] = []
    for (const req of requests) {
      const s = await stat(req.inputPath).catch(() => null)
      taskMeta.set(req.id, {
        name: basename(req.inputPath),
        inputPath: req.inputPath,
        from: extname(req.inputPath).slice(1).toLowerCase(),
        to: req.target,
        size: s?.size ?? 0
      })
      try {
        tasks.push(await toEngineTask(req))
      } catch (e) {
        console.error('task prepare failed', e)
        broadcast({
          type: 'error',
          id: req.id,
          message: '无法创建输出文件：请检查输出目录是否存在且可写'
        })
      }
    }
    if (tasks.length > 0) queue.add(tasks)
  })

  ipcMain.on('task:cancel', (_event, id: string) => queue.cancel(String(id)))
  ipcMain.on('task:cancelAll', () => queue.cancelAll())
  ipcMain.on('task:setConcurrency', (_event, n: number) => queue.setConcurrency(Number(n)))

  ipcMain.on('shell:openPath', (_event, path: string) => {
    void shell.openPath(String(path))
  })
  ipcMain.on('shell:showInFolder', (_event, path: string) => {
    shell.showItemInFolder(String(path))
  })
}
