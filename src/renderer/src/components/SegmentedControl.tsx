import styles from './SegmentedControl.module.css'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange(value: T): void
  size?: 'md' | 'sm'
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md'
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <div className={`${styles.group} ${size === 'sm' ? styles.sm : ''}`} role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={opt.value === value}
          className={`${styles.item} ${opt.value === value ? styles.active : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
