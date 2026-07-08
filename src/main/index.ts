import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc'
import { initLogger } from './logger'
import { runSelfTest } from './selftest'

const isSmokeTest = process.argv.includes('--smoke-test')
const testConvertIdx = process.argv.indexOf('--test-convert')

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1120,
    height: 740,
    minWidth: 880,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: '#F5F5F7',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
    if (isSmokeTest) {
      console.log('SMOKE_OK')
      setTimeout(() => app.quit(), 300)
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

app.whenReady().then(() => {
  initLogger()
  if (testConvertIdx >= 0) {
    void runSelfTest(process.argv[testConvertIdx + 1])
    return
  }
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // 自测试模式会创建/销毁 PDF 打印用的隐藏窗口，不能因此退出
  if (testConvertIdx >= 0) return
  app.quit()
})
