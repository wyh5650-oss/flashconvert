import Icon from '../../components/Icon'
import Button from '../../components/Button'
import { CATEGORY_ICON, CATEGORY_LABEL, type FileCategory } from '@shared/formats'
import styles from './DropZone.module.css'

const CATEGORIES: FileCategory[] = ['video', 'audio', 'image', 'document', 'archive']

interface DropZoneProps {
  dragOver: boolean
  onPick(): void
}

/** 主页空态：大拖放区 + 分类标签（对照 01/08 稿） */
export default function DropZone({ dragOver, onPick }: DropZoneProps): React.JSX.Element {
  return (
    <div className={styles.wrap}>
      <div
        className={`${styles.zone} ${dragOver ? styles.over : ''}`}
        onClick={onPick}
        role="button"
        aria-label="拖入文件或点击选择"
      >
        <div className={styles.iconCircle}>
          <Icon name="arrow_downward" size={32} />
        </div>
        <h2 className="t-headline-lg">拖入文件，开始转换</h2>
        <p className={styles.sub}>支持视频、音频、图片、文档、压缩包</p>
        <Button
          onClick={(e) => {
            e.stopPropagation()
            onPick()
          }}
        >
          选择文件
        </Button>
      </div>
      <div className={styles.chips}>
        {CATEGORIES.map((c) => (
          <div key={c} className={styles.chip}>
            <Icon name={CATEGORY_ICON[c]} size={14} />
            {CATEGORY_LABEL[c]}
          </div>
        ))}
      </div>
    </div>
  )
}
