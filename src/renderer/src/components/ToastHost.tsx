import { createPortal } from 'react-dom'
import { useToastStore } from '../stores/toast'
import styles from './ToastHost.module.css'
import Icon from './Icon'

const ICONS = { success: 'check_circle', error: 'error', info: 'info' } as const

export default function ToastHost(): React.JSX.Element {
  const toasts = useToastStore((s) => s.toasts)
  const remove = useToastStore((s) => s.remove)
  return createPortal(
    <div className={styles.host}>
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.kind]}`} onClick={() => remove(t.id)}>
          <Icon name={ICONS[t.kind]} size={16} fill />
          <span>{t.text}</span>
        </div>
      ))}
    </div>,
    document.body
  )
}
