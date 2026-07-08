import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import Store from 'electron-store'
import type { HistoryRecord, SettingsData } from '../shared/types'

interface Schema {
  settings: SettingsData
  history: HistoryRecord[]
}

const HISTORY_CAP = 500

const SETTINGS_DEFAULTS: SettingsData = {
  theme: 'system',
  motion: 'system',
  outputDir: '',
  concurrency: 2,
  notifyOnDone: true,
  keepOriginal: true,
  language: 'zh-CN',
  autoStart: false,
  sponsorShown: false,
  doneBatches: 0
}

let store: Store<Schema> | null = null

function getStore(): Store<Schema> {
  if (!store) {
    store = new Store<Schema>({
      defaults: {
        settings: { ...SETTINGS_DEFAULTS },
        history: []
      }
    })
  }
  return store
}

export function getSettings(): SettingsData {
  // 旧版本配置可能缺少新增字段，取值时统一回填缺省
  const s = { ...SETTINGS_DEFAULTS, ...getStore().get('settings') }
  if (!s.outputDir) {
    s.outputDir = join(app.getPath('downloads'), '已转换')
  }
  return s
}

export function setSettings(patch: Partial<SettingsData>): SettingsData {
  const merged = { ...getSettings(), ...patch }
  getStore().set('settings', merged)
  if (patch.autoStart !== undefined) {
    app.setLoginItemSettings({ openAtLogin: merged.autoStart })
  }
  return merged
}

function broadcastHistoryChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('history:changed')
  }
}

export function listHistory(): HistoryRecord[] {
  return getStore().get('history')
}

export function addHistory(record: HistoryRecord): void {
  const history = [record, ...getStore().get('history')].slice(0, HISTORY_CAP)
  getStore().set('history', history)
  broadcastHistoryChanged()
}

export function removeHistory(id: string): void {
  getStore().set(
    'history',
    getStore()
      .get('history')
      .filter((r) => r.id !== id)
  )
  broadcastHistoryChanged()
}

export function clearHistory(): void {
  getStore().set('history', [])
  broadcastHistoryChanged()
}
