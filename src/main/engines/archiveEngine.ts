import { mkdir, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { path7za } from '7zip-bin'
import type { ArchiveOptions } from '../../shared/types'
import { DEFAULT_OPTIONS } from '../../shared/types'
import { runProcess } from '../utils/proc'
import { CanceledError, ConversionError, type EngineAdapter, type EngineProgress } from './types'

/**
 * 压缩包互转：7za 解压到临时目录再按目标格式重新压缩。
 * rar 仅 7-Zip 完整版可解，7za 不支持，故不列入。
 * gz/tgz 输入支持（嵌套 tar 自动二次解包）；输出目标为 zip/7z/tar。
 */
const INPUTS = ['zip', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz']
const OUTPUTS = ['zip', '7z', 'tar']

const LEVEL_MAP: Record<ArchiveOptions['level'], string> = {
  store: '-mx0',
  fast: '-mx3',
  normal: '-mx5',
  max: '-mx9'
}

export function get7za(): string {
  return path7za.replace('app.asar', 'app.asar.unpacked')
}

function archiveOptions(options: { kind: string }): ArchiveOptions {
  return options.kind === 'archive' ? (options as ArchiveOptions) : DEFAULT_OPTIONS.archive
}

/** 解析 7za -bsp1 的百分比输出 */
function percentParser(from: number, to: number, onProgress: (p: EngineProgress) => void) {
  return (line: string): void => {
    const m = line.match(/(\d{1,3})%/)
    if (!m) return
    const pct = Math.min(100, Number(m[1]))
    onProgress({ progress: from + ((to - from) * pct) / 100 })
  }
}

export const archiveEngine: EngineAdapter = {
  name: '7zip',
  canConvert(inputExt, target) {
    return INPUTS.includes(inputExt) && OUTPUTS.includes(target)
  },
  async convert(task, onProgress, signal) {
    const workDir = join(tmpdir(), `flashconvert-arc-${task.id}`)
    await rm(workDir, { recursive: true, force: true })
    await mkdir(workDir, { recursive: true })
    try {
      // 1) 解压（0 → 0.45）
      const ex = await runProcess(
        get7za(),
        ['x', task.inputPath, `-o${workDir}`, '-y', '-bsp1', '-bso0'],
        signal,
        undefined,
        percentParser(0, 0.45, onProgress)
      )
      if (ex.code !== 0) {
        throw new ConversionError(
          '解压失败，压缩包可能已损坏或带密码',
          ex.stderr.slice(-600)
        )
      }

      // 1b) gz/tgz/bz2/xz 常见嵌套：目录里只剩一个 .tar 时再解一层
      const entries = await readdir(workDir)
      if (entries.length === 1 && entries[0].toLowerCase().endsWith('.tar')) {
        const innerTar = join(workDir, entries[0])
        const ex2 = await runProcess(
          get7za(),
          ['x', innerTar, `-o${workDir}`, '-y', '-bso0'],
          signal
        )
        if (ex2.code !== 0) throw new ConversionError('解压内层 tar 失败', ex2.stderr.slice(-600))
        await rm(innerTar, { force: true })
      }
      if (signal.aborted) throw new CanceledError()

      // 2) 重新压缩（0.45 → 1）
      const opts = archiveOptions(task.options)
      const typeArg = `-t${task.target === '7z' ? '7z' : task.target}`
      const args = ['a', typeArg, task.outputPath, join(workDir, '*'), '-y', '-bsp1', '-bso0']
      if (task.target !== 'tar') args.push(LEVEL_MAP[opts.level])
      if (opts.password && task.target !== 'tar') {
        args.push(`-p${opts.password}`)
        if (task.target === 'zip') args.push('-mem=AES256')
        if (task.target === '7z') args.push('-mhe=on')
      }
      const cp = await runProcess(
        get7za(),
        args,
        signal,
        undefined,
        percentParser(0.45, 1, onProgress)
      )
      if (cp.code !== 0) {
        throw new ConversionError('重新压缩失败，请检查磁盘空间', cp.stderr.slice(-600))
      }
      onProgress({ progress: 1 })
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => {})
    }
  }
}
