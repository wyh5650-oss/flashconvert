import styles from './Stepper.module.css'
import Icon from './Icon'

interface StepperProps {
  value: number
  min: number
  max: number
  onChange(value: number): void
}

export default function Stepper({ value, min, max, onChange }: StepperProps): React.JSX.Element {
  return (
    <div className={styles.group}>
      <button
        className={styles.btn}
        aria-label="减少"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Icon name="remove" size={16} />
      </button>
      <span className={styles.value}>{value}</span>
      <button
        className={styles.btn}
        aria-label="增加"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Icon name="add" size={16} />
      </button>
    </div>
  )
}
