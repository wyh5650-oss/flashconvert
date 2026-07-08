import styles from './Switch.module.css'

interface SwitchProps {
  checked: boolean
  onChange(checked: boolean): void
  disabled?: boolean
  'aria-label'?: string
}

export default function Switch({ checked, onChange, disabled, ...rest }: SwitchProps): React.JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={rest['aria-label']}
      disabled={disabled}
      className={`${styles.track} ${checked ? styles.on : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  )
}
