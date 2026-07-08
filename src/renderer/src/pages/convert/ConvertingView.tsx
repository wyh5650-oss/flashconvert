import Button from '../../components/Button'
import Card from '../../components/Card'
import Icon from '../../components/Icon'
import ProgressBar from '../../components/ProgressBar'
import ProgressRing from '../../components/ProgressRing'
import { overallProgress, useConvertStore } from '../../stores/convert'
import { CATEGORY_ICON } from '@shared/formats'
import styles from './convert.module.css'

function fmtEta(sec?: number): string {
  if (sec === undefined) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function ConvertingView(): React.JSX.Element {
  const { items, cancel, cancelAll } = useConvertStore()
  const doneCount = items.filter((it) => it.status === 'done').length
  const activeCount = items.filter(
    (it) => it.status === 'converting' || it.status === 'queued'
  ).length

  return (
    <div className={styles.view}>
      <div className={styles.ringWrap}>
        <ProgressRing progress={overallProgress(items)} size={92} strokeWidth={7} />
        <span className={styles.ringText}>
          正在转换 {Math.min(doneCount + 1, items.length)} / {items.length} 个文件
        </span>
        <span className={styles.ringSub}>已完成 {doneCount} 个</span>
      </div>

      <div className={styles.rows}>
        {items.map((item) => (
          <Card key={item.id} padding={false} className={styles.row}>
            <div className={styles.fileIcon}>
              <Icon name={CATEGORY_ICON[item.category]} size={22} />
            </div>
            <div className={styles.fileMain}>
              <span className={styles.fileName}>{item.file.name}</span>
              {item.status === 'converting' && (
                <>
                  <ProgressBar progress={item.progress} />
                  <span className={styles.progressLine}>
                    {Math.round(item.progress * 100)}% · {item.speed ?? '—'} · 剩余{' '}
                    {fmtEta(item.etaSec)}
                  </span>
                </>
              )}
              {item.status === 'queued' && <span className={styles.statusTag}>排队中</span>}
              {item.status === 'done' && (
                <span className={styles.statusDone}>
                  <Icon name="check_circle" size={14} fill />
                  已完成
                </span>
              )}
              {item.status === 'canceled' && <span className={styles.statusTag}>已取消</span>}
              {item.status === 'error' && (
                <span className={styles.statusError}>{item.error ?? '转换失败'}</span>
              )}
            </div>
            <div className={styles.rowActions}>
              {(item.status === 'converting' || item.status === 'queued') && (
                <button
                  className={styles.iconBtn}
                  aria-label="取消"
                  onClick={() => cancel(item.id)}
                >
                  <Icon name="close" size={18} />
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {activeCount > 0 && (
        <div className={styles.bottomBar}>
          <span className={styles.outputPath} />
          <Button variant="quiet" onClick={cancelAll}>
            取消全部
          </Button>
        </div>
      )}
    </div>
  )
}
