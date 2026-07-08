import Button from '../../components/Button'
import Card from '../../components/Card'
import Icon from '../../components/Icon'
import { useConvertStore } from '../../stores/convert'
import { useSettingsStore } from '../../stores/settings'
import { useUiStore } from '../../stores/ui'
import { CATEGORY_ICON } from '@shared/formats'
import styles from './convert.module.css'

export default function DoneView(): React.JSX.Element {
  const { items, reset } = useConvertStore()
  const outputDir = useSettingsStore((s) => s.outputDir)
  const done = items.filter((it) => it.status === 'done')
  const failed = items.filter((it) => it.status === 'error' || it.status === 'canceled')

  return (
    <div className={styles.view}>
      <div className={styles.doneHero}>
        <div className={styles.doneCheck}>
          <Icon name="check" size={44} />
        </div>
        <h1 className="t-headline-lg">全部完成</h1>
        <span className={styles.doneSub}>
          {done.length} 个文件已保存到 {outputDir}
          {failed.length > 0 && `（${failed.length} 个未完成）`}
        </span>
        <div className={styles.doneBtns}>
          <Button icon="folder_open" onClick={() => window.flash.openPath(outputDir)}>
            打开文件夹
          </Button>
          <Button variant="secondary" onClick={reset}>
            继续转换
          </Button>
        </div>
        <button
          className={styles.quietLink}
          onClick={() => useUiStore.getState().setSponsorOpen(true)}
        >
          制作不易，赞助一下作者 qwq ❤
        </button>
      </div>

      <div className={styles.rows}>
        {done.map((item) => (
          <Card key={item.id} padding={false} className={styles.row}>
            <div className={styles.fileIcon}>
              <Icon name={CATEGORY_ICON[item.category]} size={22} />
            </div>
            <div className={styles.fileMain}>
              <span className={styles.fileName}>{item.file.name}</span>
              <span className={styles.fileMeta}>
                <span className={styles.badge}>
                  {item.file.ext.toUpperCase()} → {item.target.toUpperCase()}
                </span>
              </span>
            </div>
            <div className={styles.rowActions}>
              <button
                className={styles.quietLink}
                disabled={!item.outputPath}
                onClick={() => item.outputPath && window.flash.openPath(item.outputPath)}
              >
                打开文件
              </button>
              <span className={styles.dot}>·</span>
              <button
                className={styles.quietLink}
                disabled={!item.outputPath}
                onClick={() => item.outputPath && window.flash.showInFolder(item.outputPath)}
              >
                打开文件位置
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
