import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'
import Icon from './Icon'

interface EmptyStateProps {
  icon: string
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({
  icon,
  title,
  description,
  action
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className={styles.wrap}>
      <div className={styles.iconWrap}>
        <Icon name={icon} size={30} />
      </div>
      <div className="t-headline-md">{title}</div>
      {description && <p className={styles.desc}>{description}</p>}
      {action}
    </div>
  )
}
