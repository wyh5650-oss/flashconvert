import type { SelectHTMLAttributes } from 'react'
import styles from './Select.module.css'
import Icon from './Icon'

export interface SelectOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

interface SelectProps<T extends string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  options: SelectOption<T>[]
  value: T
  onChange(value: T): void
  width?: number
}

export default function Select<T extends string>({
  options,
  value,
  onChange,
  width,
  className,
  ...rest
}: SelectProps<T>): React.JSX.Element {
  return (
    <span className={`${styles.wrap} ${className ?? ''}`} style={width ? { width } : undefined}>
      <select
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      <Icon name="unfold_more" size={16} className={styles.chevron} />
    </span>
  )
}
