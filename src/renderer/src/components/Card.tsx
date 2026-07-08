import type { HTMLAttributes, ReactNode } from 'react'
import styles from './Card.module.css'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean
  hoverable?: boolean
  children: ReactNode
}

export default function Card({
  padding = true,
  hoverable = false,
  children,
  className,
  ...rest
}: CardProps): React.JSX.Element {
  return (
    <div
      className={`${styles.card} ${padding ? styles.pad : ''} ${hoverable ? styles.hover : ''} ${className ?? ''}`}
      {...rest}
    >
      {children}
    </div>
  )
}
