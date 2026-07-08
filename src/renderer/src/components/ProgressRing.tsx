import styles from './ProgressRing.module.css'

interface ProgressRingProps {
  /** 0-1 */
  progress: number
  size?: number
  strokeWidth?: number
  showLabel?: boolean
}

export default function ProgressRing({
  progress,
  size = 72,
  strokeWidth = 6,
  showLabel = true
}: ProgressRingProps): React.JSX.Element {
  const clamped = Math.min(1, Math.max(0, progress))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          className={styles.track}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className={styles.fill}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {showLabel && (
        <span className={styles.label} style={{ fontSize: size / 4.2 }}>
          {Math.round(clamped * 100)}%
        </span>
      )}
    </div>
  )
}
