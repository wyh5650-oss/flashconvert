import { spawn } from 'node:child_process'
import { CanceledError, ConversionError } from '../engines/types'

interface RunResult {
  code: number
  stderr: string
  stdout: string
}

/** 运行子进程；signal 触发时在 Windows 上用 taskkill 杀整棵进程树 */
export function runProcess(
  bin: string,
  args: string[],
  signal: AbortSignal,
  onStderrLine?: (line: string) => void,
  onStdoutLine?: (line: string) => void
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new CanceledError())
      return
    }
    const child = spawn(bin, args, { windowsHide: true })
    let stderr = ''
    let stdout = ''
    let stderrBuf = ''
    let stdoutBuf = ''

    const kill = (): void => {
      if (!child.pid) return
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
      } else {
        try {
          child.kill('SIGKILL')
        } catch {
          // 进程可能已退出
        }
      }
    }
    signal.addEventListener('abort', kill, { once: true })

    child.stdout.on('data', (d: Buffer) => {
      const text = d.toString()
      stdout += text
      if (onStdoutLine) {
        stdoutBuf += text
        const lines = stdoutBuf.split(/\r\n|\r|\n/)
        stdoutBuf = lines.pop() ?? ''
        for (const line of lines) if (line.trim()) onStdoutLine(line)
      }
    })
    child.stderr.on('data', (d: Buffer) => {
      const text = d.toString()
      stderr += text
      if (onStderrLine) {
        stderrBuf += text
        const lines = stderrBuf.split(/\r\n|\r|\n/)
        stderrBuf = lines.pop() ?? ''
        for (const line of lines) if (line.trim()) onStderrLine(line)
      }
    })
    child.on('error', (err) => {
      signal.removeEventListener('abort', kill)
      reject(new ConversionError('无法启动转换组件，请重装应用', err.message))
    })
    child.on('close', (code) => {
      signal.removeEventListener('abort', kill)
      if (signal.aborted) reject(new CanceledError())
      else resolve({ code: code ?? -1, stderr, stdout })
    })
  })
}
