import Card from '../components/Card'
import Icon from '../components/Icon'
import Button from '../components/Button'
import authorAvatar from '../assets/author.jpg'
import Switch from '../components/Switch'
import Select from '../components/Select'
import Stepper from '../components/Stepper'
import SegmentedControl from '../components/SegmentedControl'
import { useUiStore, type MotionPref } from '../stores/ui'
import { useSettingsStore } from '../stores/settings'
import { toast } from '../stores/toast'
import styles from './SettingsPage.module.css'

const MOTION_CARDS: { value: MotionPref; title: string; caption: string; icon: string }[] = [
  { value: 'full', title: '华丽', caption: '完整动画与毛玻璃', icon: 'auto_awesome' },
  { value: 'reduced', title: '简洁', caption: '仅基础过渡', icon: 'motion_photos_on' },
  { value: 'off', title: '关闭', caption: '无动画', icon: 'block' },
  { value: 'system', title: '跟随系统', caption: '读取系统偏好', icon: 'contrast' }
]

export default function SettingsPage(): React.JSX.Element {
  const { theme, motion, setTheme, setMotion } = useUiStore()
  const settings = useSettingsStore()

  return (
    <div className={styles.page}>
      <h1 className="t-headline-lg">设置</h1>

      <div className={styles.groupTitle}>外观</div>
      <Card padding={false}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>主题</span>
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
        <div className={styles.divider} />
        <div className={styles.rowColumn}>
          <span className={styles.rowLabel}>动画效果</span>
          <div className={styles.motionCards}>
            {MOTION_CARDS.map((c) => (
              <button
                key={c.value}
                className={`${styles.motionCard} ${motion === c.value ? styles.motionActive : ''}`}
                onClick={() => setMotion(c.value)}
              >
                {motion === c.value && (
                  <span className={styles.motionCheck}>
                    <Icon name="check_circle" size={16} fill />
                  </span>
                )}
                <Icon name={c.icon} size={22} />
                <span className={styles.motionTitle}>{c.title}</span>
                <span className={styles.motionCaption}>{c.caption}</span>
              </button>
            ))}
          </div>
          <span className={styles.caption}>配置较低的设备建议选择简洁或关闭</span>
        </div>
      </Card>

      <div className={styles.groupTitle}>转换</div>
      <Card padding={false}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>输出文件夹</span>
          <span className={styles.rowValue}>
            <span className={styles.path}>{settings.outputDir}</span>
            <Button
              variant="quiet"
              size="sm"
              onClick={async () => {
                const dir = await window.flash.pickDirectory()
                if (dir) settings.set('outputDir', dir)
              }}
            >
              更改
            </Button>
          </span>
        </div>
        <div className={styles.divider} />
        <div className={styles.row}>
          <span className={styles.rowLabel}>同时转换任务数</span>
          <Stepper
            value={settings.concurrency}
            min={1}
            max={4}
            onChange={(v) => {
              settings.set('concurrency', v)
              window.flash.setConcurrency(v)
            }}
          />
        </div>
        <div className={styles.divider} />
        <div className={styles.row}>
          <span className={styles.rowLabel}>完成后系统通知</span>
          <Switch
            checked={settings.notifyOnDone}
            onChange={(v) => settings.set('notifyOnDone', v)}
            aria-label="完成后系统通知"
          />
        </div>
        <div className={styles.divider} />
        <div className={styles.row}>
          <span className={styles.rowLabel}>保留原始文件</span>
          <Switch
            checked={settings.keepOriginal}
            onChange={(v) => settings.set('keepOriginal', v)}
            aria-label="保留原始文件"
          />
        </div>
      </Card>

      <div className={styles.groupTitle}>通用</div>
      <Card padding={false}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>语言</span>
          <Select
            width={140}
            options={[
              { value: 'zh-CN', label: '简体中文' },
              { value: 'en', label: 'English（后续提供）', disabled: true }
            ]}
            value={settings.language}
            onChange={(v) => settings.set('language', v)}
          />
        </div>
        <div className={styles.divider} />
        <div className={styles.row}>
          <span className={styles.rowLabel}>开机自启</span>
          <Switch
            checked={settings.autoStart}
            onChange={(v) => settings.set('autoStart', v)}
            aria-label="开机自启"
          />
        </div>
      </Card>

      <div className={styles.groupTitle}>关于</div>
      <Card padding={false}>
        <div className={styles.row}>
          <span className={styles.aboutLeft}>
            <span className={styles.aboutLogo}>
              <Icon name="bolt" size={18} fill />
            </span>
            <span>
              <span className={styles.rowLabel}>闪转</span>
              <span className={styles.caption} style={{ display: 'block' }}>
                版本 0.1.0
              </span>
            </span>
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.info('当前已是最新版本')}
          >
            检查更新
          </Button>
        </div>
        <div className={styles.divider} />
        <div className={styles.row}>
          <span className={styles.aboutLeft}>
            <img src={authorAvatar} alt="win96 头像" className={styles.avatar} />
            <span>
              <span className={styles.rowLabel}>作者 win96</span>
              <span className={styles.caption} style={{ display: 'block' }}>
                感谢使用闪转
              </span>
            </span>
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="secondary"
              size="sm"
              icon="open_in_new"
              onClick={() => window.open('https://space.bilibili.com/543206049')}
            >
              哔哩哔哩主页
            </Button>
            <Button size="sm" icon="favorite" onClick={() => useUiStore.getState().setSponsorOpen(true)}>
              赞助作者
            </Button>
          </span>
        </div>
      </Card>
    </div>
  )
}
