import { useUiStore, type PageId } from '../stores/ui'
import TrafficLights from './TrafficLights'
import Icon from './Icon'
import styles from './Sidebar.module.css'

interface NavItem {
  id: PageId
  icon: string
  label: string
}

const TOP_ITEMS: NavItem[] = [
  { id: 'convert', icon: 'sync_alt', label: '转换' },
  { id: 'history', icon: 'history', label: '历史记录' }
]

export default function Sidebar(): React.JSX.Element {
  const page = useUiStore((s) => s.page)
  const setPage = useUiStore((s) => s.setPage)

  const renderItem = (item: NavItem): React.JSX.Element => (
    <button
      key={item.id}
      className={`${styles.item} ${page === item.id ? styles.active : ''}`}
      onClick={() => setPage(item.id)}
    >
      <Icon name={item.icon} size={20} />
      <span>{item.label}</span>
    </button>
  )

  return (
    <aside className={styles.sidebar}>
      <div className={styles.top}>
        <TrafficLights />
      </div>
      <div className={styles.logoRow}>
        <div className={styles.logoMark}>
          <Icon name="bolt" size={20} fill />
        </div>
        <div>
          <div className={styles.appName}>闪转</div>
          <div className={styles.appSub}>File Converter</div>
        </div>
      </div>
      <nav className={styles.nav}>
        {TOP_ITEMS.map(renderItem)}
        {import.meta.env.DEV &&
          renderItem({ id: 'gallery', icon: 'palette', label: '组件演示' })}
        <div className={styles.spacer} />
        {renderItem({ id: 'settings', icon: 'settings', label: '设置' })}
      </nav>
    </aside>
  )
}
