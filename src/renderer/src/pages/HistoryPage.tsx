import { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import Icon from '../components/Icon'
import Button from '../components/Button'
import Input from '../components/Input'
import SegmentedControl from '../components/SegmentedControl'
import EmptyState from '../components/EmptyState'
import { toast } from '../stores/toast'
import { useConvertStore } from '../stores/convert'
import { useUiStore } from '../stores/ui'
import { CATEGORY_ICON, detectCategory, formatBytes } from '@shared/formats'
import type { HistoryRecord } from '@shared/types'
import styles from './HistoryPage.module.css'

type HistoryFilter = 'all' | 'ok' | 'fail'

function groupLabel(iso: string): '今天' | '昨天' | '更早' {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - that.getTime()) / 86400000)
  if (diffDays <= 0) return '今天'
  if (diffDays === 1) return '昨天'
  return '更早'
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function HistoryPage(): React.JSX.Element {
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const [query, setQuery] = useState('')
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const addPicked = useConvertStore((s) => s.addPicked)
  const setPage = useUiStore((s) => s.setPage)

  useEffect(() => {
    const load = (): void => {
      void window.flash.listHistory().then(setRecords)
    }
    load()
    return window.flash.onHistoryChange(load)
  }, [])

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        if (filter === 'ok' && !r.ok) return false
        if (filter === 'fail' && r.ok) return false
        if (query && !r.name.toLowerCase().includes(query.toLowerCase())) return false
        return true
      }),
    [records, filter, query]
  )

  const groups = useMemo(() => {
    const map = new Map<string, HistoryRecord[]>()
    for (const r of filtered) {
      const g = groupLabel(r.time)
      const list = map.get(g) ?? []
      list.push(r)
      map.set(g, list)
    }
    return [...map.entries()]
  }, [filtered])

  const reconvert = async (r: HistoryRecord): Promise<void> => {
    const files = await window.flash.statFiles([r.inputPath])
    if (files.length === 0) {
      toast.error('源文件已不存在，无法再次转换')
      return
    }
    await addPicked(files)
    setPage('convert')
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className="t-headline-lg">历史记录</h1>
        <div className={styles.tools}>
          <SegmentedControl
            size="sm"
            options={[
              { value: 'all', label: '全部' },
              { value: 'ok', label: '成功' },
              { value: 'fail', label: '失败' }
            ]}
            value={filter}
            onChange={(v) => setFilter(v)}
          />
          <Input
            width={180}
            placeholder="搜索文件…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {records.length > 0 && (
            <Button
              variant="quiet"
              size="sm"
              icon="delete_sweep"
              onClick={() => window.flash.clearHistory()}
            >
              清空历史
            </Button>
          )}
        </div>
      </div>

      {groups.length === 0 && (
        <EmptyState icon="history" title="暂无记录" description="完成一次转换后会出现在这里。" />
      )}

      {groups.map(([group, list]) => (
        <div key={group}>
          <div className={styles.groupTitle}>{group}</div>
          <div className={styles.rows}>
            {list.map((r) => (
              <Card key={r.id} padding={false} className={styles.row}>
                <div className={styles.fileIcon}>
                  <Icon name={CATEGORY_ICON[detectCategory(r.from) ?? 'document']} size={20} />
                </div>
                <div className={styles.main}>
                  <div className={styles.nameLine}>
                    <span className={styles.name}>{r.name}</span>
                    <span className={styles.badge}>
                      {r.from.toUpperCase()} → {r.to.toUpperCase()}
                    </span>
                  </div>
                  <div className={styles.meta}>
                    <span className={`${styles.dot} ${r.ok ? styles.okDot : styles.failDot}`} />
                    {r.ok ? '成功' : `失败 · ${r.reason ?? '未知原因'}`}
                    <span>· {formatBytes(r.size)}</span>
                    <span>· {timeLabel(r.time)}</span>
                  </div>
                </div>
                <div className={styles.actions}>
                  {r.ok && r.outputPath && (
                    <>
                      <button
                        className={styles.action}
                        onClick={() => window.flash.openPath(r.outputPath!)}
                      >
                        打开文件
                      </button>
                      <button
                        className={styles.action}
                        onClick={() => window.flash.showInFolder(r.outputPath!)}
                      >
                        打开文件位置
                      </button>
                    </>
                  )}
                  <button className={styles.action} onClick={() => void reconvert(r)}>
                    再次转换
                  </button>
                  <button
                    className={`${styles.action} ${styles.danger}`}
                    onClick={() => window.flash.removeHistory(r.id)}
                  >
                    删除
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
