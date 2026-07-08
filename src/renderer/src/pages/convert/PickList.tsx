import { useState } from 'react'
import Button from '../../components/Button'
import Card from '../../components/Card'
import Icon from '../../components/Icon'
import Select from '../../components/Select'
import { toast } from '../../stores/toast'
import { useConvertStore, type ConvertItem } from '../../stores/convert'
import { useSettingsStore } from '../../stores/settings'
import { CATEGORY_ICON, formatBytes } from '@shared/formats'
import AdvancedModal from './AdvancedModal'
import styles from './convert.module.css'

interface PickListProps {
  onPick(): void
}

export default function PickList({ onPick }: PickListProps): React.JSX.Element {
  const { items, remove, setTarget, setTargetAll, startAll } = useConvertStore()
  const outputDir = useSettingsStore((s) => s.outputDir)
  const [editing, setEditing] = useState<ConvertItem | null>(null)
  const supportedCount = items.filter((it) => it.targets.length > 0).length
  // 批量目标 = 所有文件能力表的并集（应用时只改支持该格式的文件）
  const batchTargets = [...new Set(items.flatMap((it) => it.targets))]

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <h1 className="t-headline-lg">转换</h1>
        <span style={{ display: 'flex', gap: 8 }}>
          {items.length > 1 && batchTargets.length > 0 && (
            <Select
              width={150}
              aria-label="批量设置目标格式"
              value=""
              options={[
                { value: '', label: '批量设置格式…', disabled: true },
                ...batchTargets.map((t) => ({ value: t, label: `全部转为 ${t.toUpperCase()}` }))
              ]}
              onChange={(v) => {
                if (!v) return
                const n = setTargetAll(v)
                toast.success(`已将 ${n} 个文件的目标设为 ${v.toUpperCase()}`)
              }}
            />
          )}
          <Button variant="secondary" size="sm" icon="add" onClick={onPick}>
            添加文件
          </Button>
        </span>
      </div>

      <div className={styles.rows}>
        {items.map((item) => (
          <Card key={item.id} padding={false} className={styles.row}>
            <div className={styles.fileIcon}>
              <Icon name={CATEGORY_ICON[item.category]} size={22} />
            </div>
            <div className={styles.fileMain}>
              <span className={styles.fileName}>{item.file.name}</span>
              <span className={styles.fileMeta}>
                <span className={styles.badge}>{item.file.ext.toUpperCase()}</span>
                {formatBytes(item.file.size)}
              </span>
            </div>
            <Icon name="arrow_forward" size={16} className={styles.arrow} />
            {item.targets.length > 0 ? (
              <Select
                width={104}
                aria-label="目标格式"
                options={item.targets.map((t) => ({ value: t, label: t.toUpperCase() }))}
                value={item.target}
                onChange={(v) => setTarget(item.id, v)}
              />
            ) : (
              <span className={styles.badge}>即将支持</span>
            )}
            <div className={styles.rowActions}>
              {item.targets.length > 0 &&
                (item.category !== 'document' ||
                  ['md', 'markdown', 'txt'].includes(item.file.ext)) && (
                  <button
                    className={styles.iconBtn}
                    aria-label="高级设置"
                    onClick={() => setEditing(item)}
                  >
                    <Icon name="tune" size={18} />
                  </button>
                )}
              <button className={styles.iconBtn} aria-label="移除" onClick={() => remove(item.id)}>
                <Icon name="close" size={18} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.outputPath}>
          <Icon name="folder" size={16} />
          <span>输出到：</span>
          <b>{outputDir}</b>
          <Button
            variant="quiet"
            size="sm"
            onClick={async () => {
              const dir = await window.flash.pickDirectory()
              if (dir) useSettingsStore.getState().set('outputDir', dir)
            }}
          >
            更改
          </Button>
        </div>
        <Button icon="bolt" disabled={supportedCount === 0} onClick={() => void startAll()}>
          开始转换（{supportedCount}）
        </Button>
      </div>

      {editing && (
        <AdvancedModal
          item={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
