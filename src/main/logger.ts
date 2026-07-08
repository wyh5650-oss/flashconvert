import { app } from 'electron'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { inspect } from 'node:util'

/** 把 console.error/warn 与未捕获异常追加写入 userData/logs/main.log */
export function initLogger(): void {
  let file: string
  try {
    const dir = join(app.getPath('userData'), 'logs')
    mkdirSync(dir, { recursive: true })
    file = join(dir, 'main.log')
  } catch {
    return
  }

  const fmt = (args: unknown[]): string =>
    args.map((a) => (typeof a === 'string' ? a : inspect(a, { depth: 3 }))).join(' ')

  const write = (level: string, args: unknown[]): void => {
    try {
      appendFileSync(file, `[${new Date().toISOString()}] [${level}] ${fmt(args)}\n`)
    } catch {
      // 日志写入失败不影响主流程
    }
  }

  const origError = console.error.bind(console)
  const origWarn = console.warn.bind(console)
  console.error = (...args: unknown[]) => {
    write('ERROR', args)
    origError(...args)
  }
  console.warn = (...args: unknown[]) => {
    write('WARN', args)
    origWarn(...args)
  }
  process.on('uncaughtException', (e) => {
    write('FATAL', [e?.stack ?? String(e)])
    origError(e)
  })
  process.on('unhandledRejection', (reason) => {
    write('REJECTION', [String(reason)])
  })
}
