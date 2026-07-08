import { useState } from 'react'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Select from '../../components/Select'
import SegmentedControl from '../../components/SegmentedControl'
import Input from '../../components/Input'
import Slider from '../../components/Slider'
import Switch from '../../components/Switch'
import { useConvertStore, type ConvertItem } from '../../stores/convert'
import type {
  AdvancedOptions,
  ArchiveOptions,
  AudioOptions,
  DocumentOptions,
  ImageOptions,
  VideoOptions
} from '@shared/types'
import styles from './advanced.module.css'

interface AdvancedModalProps {
  item: ConvertItem
  onClose(): void
}

export default function AdvancedModal({ item, onClose }: AdvancedModalProps): React.JSX.Element {
  const setOptions = useConvertStore((s) => s.setOptions)
  const [opts, setOpts] = useState<AdvancedOptions>(item.options)

  const save = (): void => {
    setOptions(item.id, opts)
    onClose()
  }

  return (
    <Modal
      open
      title={`高级设置 — ${item.file.name}`}
      onClose={onClose}
      width={460}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>完成</Button>
        </>
      }
    >
      <div className={styles.form}>
        {opts.kind === 'video' && <VideoForm value={opts} onChange={setOpts} />}
        {opts.kind === 'audio' && <AudioForm value={opts} onChange={setOpts} />}
        {opts.kind === 'image' && <ImageForm value={opts} onChange={setOpts} />}
        {opts.kind === 'archive' && <ArchiveForm value={opts} onChange={setOpts} />}
        {opts.kind === 'document' && <DocumentForm value={opts} onChange={setOpts} />}
      </div>
    </Modal>
  )
}

interface FormProps<T> {
  value: T
  onChange(value: T): void
}

function VideoForm({ value, onChange }: FormProps<VideoOptions>): React.JSX.Element {
  const patch = (p: Partial<VideoOptions>): void => onChange({ ...value, ...p })
  return (
    <>
      <div className={styles.row}>
        <label className={styles.label}>分辨率</label>
        <Select
          options={[
            { value: 'original', label: '原始' },
            { value: '3840x2160', label: '3840×2160 (4K)' },
            { value: '2560x1440', label: '2560×1440 (2K)' },
            { value: '1920x1080', label: '1920×1080' },
            { value: '1280x720', label: '1280×720' },
            { value: '854x480', label: '854×480' },
            { value: 'custom', label: '自定义' }
          ]}
          value={value.resolution}
          onChange={(v) => patch({ resolution: v })}
        />
        {value.resolution === 'custom' && (
          <div className={styles.inline}>
            <Input
              type="number"
              width={110}
              placeholder="宽"
              value={value.width ?? 1920}
              onChange={(e) => patch({ width: Number(e.target.value) || undefined })}
            />
            <span className={styles.times}>×</span>
            <Input
              type="number"
              width={110}
              placeholder="高"
              value={value.height ?? 1080}
              onChange={(e) => patch({ height: Number(e.target.value) || undefined })}
            />
          </div>
        )}
      </div>

      <div className={styles.row}>
        <label className={styles.label}>码率</label>
        <div className={styles.inline}>
          <SegmentedControl
            size="sm"
            options={[
              { value: 'auto', label: '自动' },
              { value: 'custom', label: '自定义' }
            ]}
            value={value.bitrateMode}
            onChange={(v) => patch({ bitrateMode: v })}
          />
          {value.bitrateMode === 'custom' && (
            <Input
              type="number"
              width={130}
              suffix="kbps"
              value={value.bitrateKbps ?? 8000}
              onChange={(e) => patch({ bitrateKbps: Number(e.target.value) || undefined })}
            />
          )}
        </div>
      </div>

      <div className={styles.rowPair}>
        <div className={styles.row}>
          <label className={styles.label}>帧率</label>
          <Select
            options={[
              { value: 'original', label: '原始' },
              { value: '60', label: '60 fps' },
              { value: '30', label: '30 fps' },
              { value: '24', label: '24 fps' }
            ]}
            value={value.fps}
            onChange={(v) => patch({ fps: v })}
          />
        </div>
        <div className={styles.row}>
          <label className={styles.label}>编码</label>
          <Select
            options={[
              { value: 'h264', label: 'H.264' },
              { value: 'hevc', label: 'H.265 (HEVC)' },
              { value: 'vp9', label: 'VP9' },
              { value: 'av1', label: 'AV1' }
            ]}
            value={value.codec}
            onChange={(v) => patch({ codec: v })}
          />
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>硬件加速</label>
        <Select
          options={[
            { value: 'auto', label: '自动' },
            { value: 'nvenc', label: 'NVIDIA NVENC' },
            { value: 'qsv', label: 'Intel QSV' },
            { value: 'amf', label: 'AMD AMF' },
            { value: 'off', label: '关闭（软件编码）' }
          ]}
          value={value.hwaccel}
          onChange={(v) => patch({ hwaccel: v })}
        />
        <span className={styles.caption}>自动模式会探测可用的硬件编码器，失败时回退软件编码</span>
      </div>
    </>
  )
}

function AudioForm({ value, onChange }: FormProps<AudioOptions>): React.JSX.Element {
  const patch = (p: Partial<AudioOptions>): void => onChange({ ...value, ...p })
  return (
    <>
      <div className={styles.row}>
        <label className={styles.label}>码率</label>
        <div className={styles.inline}>
          <SegmentedControl
            size="sm"
            options={[
              { value: 'auto', label: '自动' },
              { value: 'custom', label: '自定义' }
            ]}
            value={value.bitrateMode}
            onChange={(v) => patch({ bitrateMode: v })}
          />
          {value.bitrateMode === 'custom' && (
            <Input
              type="number"
              width={120}
              suffix="kbps"
              value={value.bitrateKbps ?? 320}
              onChange={(e) => patch({ bitrateKbps: Number(e.target.value) || undefined })}
            />
          )}
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>采样率</label>
        <Select
          options={[
            { value: 'original', label: '原始' },
            { value: '44100', label: '44100 Hz' },
            { value: '48000', label: '48000 Hz' },
            { value: '96000', label: '96000 Hz' }
          ]}
          value={value.sampleRate}
          onChange={(v) => patch({ sampleRate: v })}
        />
      </div>

      <div className={styles.row}>
        <label className={styles.label}>声道</label>
        <SegmentedControl
          size="sm"
          options={[
            { value: 'original', label: '原始' },
            { value: 'mono', label: '单声道' },
            { value: 'stereo', label: '立体声' }
          ]}
          value={value.channels}
          onChange={(v) => patch({ channels: v })}
        />
      </div>

      <div className={styles.switchRow}>
        <div>
          <div className={styles.label}>音量标准化</div>
          <span className={styles.caption}>将响度统一到 -14 LUFS</span>
        </div>
        <Switch
          checked={value.normalize}
          onChange={(v) => patch({ normalize: v })}
          aria-label="音量标准化"
        />
      </div>
    </>
  )
}

function ImageForm({ value, onChange }: FormProps<ImageOptions>): React.JSX.Element {
  const patch = (p: Partial<ImageOptions>): void => onChange({ ...value, ...p })
  return (
    <>
      <div className={styles.row}>
        <div className={styles.inlineBetween}>
          <label className={styles.label}>质量</label>
          <span className={styles.value}>{value.quality}</span>
        </div>
        <Slider value={value.quality} min={1} max={100} onChange={(v) => patch({ quality: v })} />
        <span className={styles.caption}>质量越高，文件越大</span>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>尺寸</label>
        <Select
          options={[
            { value: 'original', label: '原始' },
            { value: '3840x2160', label: '3840×2160' },
            { value: '1920x1080', label: '1920×1080' },
            { value: 'custom', label: '自定义' }
          ]}
          value={value.size}
          onChange={(v) => patch({ size: v })}
        />
        {value.size === 'custom' && (
          <div className={styles.inline}>
            <Input
              type="number"
              width={110}
              placeholder="宽"
              value={value.width ?? 1920}
              onChange={(e) => patch({ width: Number(e.target.value) || undefined })}
            />
            <span className={styles.times}>×</span>
            <Input
              type="number"
              width={110}
              placeholder="高"
              value={value.height ?? 1080}
              onChange={(e) => patch({ height: Number(e.target.value) || undefined })}
            />
          </div>
        )}
      </div>

      <div className={styles.switchRow}>
        <div className={styles.label}>保持宽高比</div>
        <Switch
          checked={value.keepAspect}
          onChange={(v) => patch({ keepAspect: v })}
          aria-label="保持宽高比"
        />
      </div>

      <div className={styles.switchRow}>
        <div className={styles.label}>保留元数据 (EXIF)</div>
        <Switch
          checked={value.keepMetadata}
          onChange={(v) => patch({ keepMetadata: v })}
          aria-label="保留元数据"
        />
      </div>

      <div className={styles.switchRow}>
        <div>
          <div className={styles.label}>透明背景填充</div>
          <span className={styles.caption}>转为不支持透明的格式时使用</span>
        </div>
        <input
          type="color"
          className={styles.color}
          value={value.background}
          onChange={(e) => patch({ background: e.target.value })}
          aria-label="背景填充色"
        />
      </div>
    </>
  )
}

function DocumentForm({ value, onChange }: FormProps<DocumentOptions>): React.JSX.Element {
  return (
    <div className={styles.switchRow}>
      <div>
        <div className={styles.label}>保留 Markdown 原始代码样式</div>
        <span className={styles.caption}>
          默认输出排版后的阅读样式；开启后以原始代码形式呈现
        </span>
      </div>
      <Switch
        checked={value.rawSource}
        onChange={(v) => onChange({ ...value, rawSource: v })}
        aria-label="保留 Markdown 原始代码样式"
      />
    </div>
  )
}

function ArchiveForm({ value, onChange }: FormProps<ArchiveOptions>): React.JSX.Element {
  const patch = (p: Partial<ArchiveOptions>): void => onChange({ ...value, ...p })
  return (
    <>
      <div className={styles.row}>
        <label className={styles.label}>压缩级别</label>
        <SegmentedControl
          size="sm"
          options={[
            { value: 'store', label: '仅存储' },
            { value: 'fast', label: '快速' },
            { value: 'normal', label: '标准' },
            { value: 'max', label: '极限' }
          ]}
          value={value.level}
          onChange={(v) => patch({ level: v })}
        />
        <span className={styles.caption}>级别越高体积越小，耗时越长</span>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>加密密码</label>
        <Input
          type="password"
          placeholder="不加密"
          value={value.password ?? ''}
          onChange={(e) => patch({ password: e.target.value || undefined })}
        />
      </div>
    </>
  )
}
