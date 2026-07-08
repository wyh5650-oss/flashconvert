import type { InputHTMLAttributes } from 'react'
import styles from './Input.module.css'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  width?: number
  suffix?: string
}

export default function Input({ width, suffix, className, ...rest }: InputProps): React.JSX.Element {
  return (
    <span className={styles.wrap} style={width ? { width } : undefined}>
      <input className={`${styles.input} ${className ?? ''}`} {...rest} />
      {suffix && <span className={styles.suffix}>{suffix}</span>}
    </span>
  )
}
