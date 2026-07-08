import styles from './ProgressBar.module.css'

interface ProgressBarProps {
  /** 0-1 */
  progress: number
  indeterminate?: boolean
}

export default function ProgressBar({ progress, indeterminate }: ProgressBarProps): React.JSX.Element {
  const clamped = Math.min(1, Math.max(0, progress))
  return (
    <div className={styles.track} role="progressbar" aria-valuenow={Math.round(clamped * 100)}>
      <div
        className={`${styles.fill} ${indeterminate ? styles.indeterminate : ''}`}
        style={indeterminate ? undefined : { transform: `scaleX(${clamped})` }}
      />
    </div>
  )
}
