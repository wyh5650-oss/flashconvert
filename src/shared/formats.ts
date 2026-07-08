export type FileCategory = 'video' | 'audio' | 'image' | 'document' | 'archive'

export const CATEGORY_LABEL: Record<FileCategory, string> = {
  video: '视频',
  audio: '音频',
  image: '图片',
  document: '文档',
  archive: '压缩包'
}

export const CATEGORY_ICON: Record<FileCategory, string> = {
  video: 'movie',
  audio: 'audio_file',
  image: 'image',
  document: 'description',
  archive: 'folder_zip'
}

const EXT_CATEGORY: Record<string, FileCategory> = {
  // video
  mp4: 'video', mkv: 'video', webm: 'video', mov: 'video', avi: 'video',
  flv: 'video', wmv: 'video', m4v: 'video', ts: 'video', mpg: 'video', mpeg: 'video',
  // audio
  mp3: 'audio', wav: 'audio', flac: 'audio', aac: 'audio', ogg: 'audio',
  m4a: 'audio', wma: 'audio', opus: 'audio', aiff: 'audio',
  // image
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', avif: 'image',
  gif: 'image', bmp: 'image', tiff: 'image', tif: 'image', heic: 'image',
  heif: 'image', psd: 'image', svg: 'image', ico: 'image',
  // document
  md: 'document', markdown: 'document', html: 'document', htm: 'document',
  docx: 'document', doc: 'document', odt: 'document', rtf: 'document',
  epub: 'document', txt: 'document', xlsx: 'document', pptx: 'document', pdf: 'document',
  // archive
  zip: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
  tgz: 'archive', rar: 'archive', bz2: 'archive', xz: 'archive'
}

export function detectCategory(ext: string): FileCategory | null {
  return EXT_CATEGORY[ext.toLowerCase()] ?? null
}

/**
 * M2 占位能力表：每类可选目标格式（M3 起由主进程引擎能力表接管）。
 * 只放"计划支持"的目标；引擎实测跑不通的会被移除。
 */
export const TARGETS_BY_CATEGORY: Record<FileCategory, string[]> = {
  video: ['mp4', 'mkv', 'webm', 'mov', 'gif', 'mp3', 'aac', 'wav'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'],
  image: ['jpg', 'png', 'webp', 'avif', 'gif', 'bmp', 'tiff'],
  document: ['md', 'html', 'docx', 'epub', 'pdf', 'txt'],
  archive: ['zip', '7z', 'tar', 'gz']
}

export function defaultTarget(category: FileCategory, sourceExt: string): string {
  const list = TARGETS_BY_CATEGORY[category].filter((t) => t !== sourceExt.toLowerCase())
  return list[0] ?? TARGETS_BY_CATEGORY[category][0]
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes
  let i = -1
  do {
    v /= 1024
    i++
  } while (v >= 1024 && i < units.length - 1)
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`
}
