import { useEffect, useState } from 'react'
import { useUiStore } from '../stores/ui'
import { toast } from '../stores/toast'
import Button from '../components/Button'
import Card from '../components/Card'
import Switch from '../components/Switch'
import SegmentedControl from '../components/SegmentedControl'
import Select from '../components/Select'
import Stepper from '../components/Stepper'
import ProgressBar from '../components/ProgressBar'
import ProgressRing from '../components/ProgressRing'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import styles from './DevGallery.module.css'

export default function DevGallery(): React.JSX.Element {
  const { theme, motion, setTheme, setMotion } = useUiStore()
  const [on, setOn] = useState(true)
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('b')
  const [sel, setSel] = useState<'mp4' | 'webm' | 'gif'>('mp4')
  const [num, setNum] = useState(2)
  const [progress, setProgress] = useState(0.1)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setProgress((p) => (p >= 1 ? 0 : p + 0.07)), 900)
    return () => clearInterval(t)
  }, [])

  return (
    <div className={styles.page}>
      <h1 className="t-headline-lg">组件演示</h1>

      <Card className={styles.section}>
        <div className="t-headline-md">主题与动画（M1 验收开关）</div>
        <div className={styles.row}>
          <span className={styles.label}>主题</span>
          <SegmentedControl
            options={[
              { value: 'light', label: '浅色' },
              { value: 'dark', label: '深色' },
              { value: 'system', label: '跟随系统' }
            ]}
            value={theme}
            onChange={setTheme}
          />
        </div>
        <div className={styles.row}>
          <span className={styles.label}>动画</span>
          <SegmentedControl
            options={[
              { value: 'full', label: '华丽' },
              { value: 'reduced', label: '简洁' },
              { value: 'off', label: '关闭' },
              { value: 'system', label: '跟随系统' }
            ]}
            value={motion}
            onChange={setMotion}
          />
        </div>
      </Card>

      <Card className={styles.section}>
        <div className="t-headline-md">按钮</div>
        <div className={styles.row}>
          <Button>主要按钮</Button>
          <Button variant="secondary">次要按钮</Button>
          <Button variant="quiet">安静按钮</Button>
          <Button variant="danger">危险按钮</Button>
          <Button icon="play_arrow">带图标</Button>
          <Button size="sm" variant="secondary">
            小尺寸
          </Button>
          <Button disabled>禁用</Button>
        </div>
      </Card>

      <Card className={styles.section}>
        <div className="t-headline-md">控件</div>
        <div className={styles.row}>
          <span className={styles.label}>开关</span>
          <Switch checked={on} onChange={setOn} aria-label="演示开关" />
          <span className={styles.label}>分段</span>
          <SegmentedControl
            options={[
              { value: 'a', label: '选项A' },
              { value: 'b', label: '选项B' },
              { value: 'c', label: '选项C' }
            ]}
            value={seg}
            onChange={(v) => setSeg(v)}
          />
        </div>
        <div className={styles.row}>
          <span className={styles.label}>下拉</span>
          <Select
            width={120}
            options={[
              { value: 'mp4', label: 'MP4' },
              { value: 'webm', label: 'WebM' },
              { value: 'gif', label: 'GIF' }
            ]}
            value={sel}
            onChange={(v) => setSel(v)}
          />
          <span className={styles.label}>步进器</span>
          <Stepper value={num} min={1} max={4} onChange={setNum} />
        </div>
      </Card>

      <Card className={styles.section}>
        <div className="t-headline-md">进度</div>
        <div className={styles.row} style={{ alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <ProgressBar progress={progress} />
          </div>
          <ProgressRing progress={progress} size={64} />
        </div>
        <ProgressBar indeterminate progress={0} />
      </Card>

      <Card className={styles.section}>
        <div className="t-headline-md">反馈</div>
        <div className={styles.row}>
          <Button variant="secondary" onClick={() => toast.success('转换完成')}>
            成功 Toast
          </Button>
          <Button variant="secondary" onClick={() => toast.error('源文件损坏')}>
            失败 Toast
          </Button>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            打开弹窗
          </Button>
        </div>
      </Card>

      <Card className={styles.section} padding={false}>
        <EmptyState
          icon="inbox"
          title="空状态示例"
          description="这里什么都没有，拖入文件即可开始。"
          action={<Button size="sm">选择文件</Button>}
        />
      </Card>

      <Card className={styles.section}>
        <div className="t-headline-md">字体阶梯</div>
        <div className="t-headline-lg">Headline LG 24 拖入文件，开始转换</div>
        <div className="t-headline-md">Headline MD 18 高级设置</div>
        <div className="t-body-lg">Body LG 15 支持视频、音频、图片、文档、压缩包</div>
        <div className="t-body-md">Body MD 13 输出到：下载/已转换</div>
        <div className="t-label-md">LABEL MD 12 开始转换</div>
        <div className="t-label-sm">LABEL SM 11 版本 0.1.0</div>
      </Card>

      <Modal
        open={modalOpen}
        title="高级设置 — 演示"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button onClick={() => setModalOpen(false)}>完成</Button>
          </>
        }
      >
        <p className="t-body-md" style={{ color: 'var(--color-text-2)' }}>
          弹窗内容示例。按 Esc 或点击遮罩关闭。
        </p>
      </Modal>
    </div>
  )
}
