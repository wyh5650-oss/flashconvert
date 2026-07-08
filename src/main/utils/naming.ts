import { mkdir, access } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

/** 生成不覆盖已有文件的输出路径：name.ext / name (1).ext / name (2).ext … */
export async function safeOutputPath(
  inputPath: string,
  outputDir: string,
  targetExt: string
): Promise<string> {
  await mkdir(outputDir, { recursive: true })
  const stem = basename(inputPath, extname(inputPath))
  let candidate = join(outputDir, `${stem}.${targetExt}`)
  let n = 1
  while (await exists(candidate)) {
    candidate = join(outputDir, `${stem} (${n}).${targetExt}`)
    n++
  }
  return candidate
}
