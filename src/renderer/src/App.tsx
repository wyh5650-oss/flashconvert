import { useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ToastHost from './components/ToastHost'
import SponsorModal from './components/SponsorModal'
import ConvertPage from './pages/convert/ConvertPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import DevGallery from './pages/DevGallery'
import { useUiStore } from './stores/ui'
import { useSettingsStore } from './stores/settings'

const PAGES = {
  convert: ConvertPage,
  history: HistoryPage,
  settings: SettingsPage,
  gallery: DevGallery
} as const

export default function App(): React.JSX.Element {
  const page = useUiStore((s) => s.page)
  const Page = PAGES[page]

  useEffect(() => {
    let unsubUi: (() => void) | undefined
    void window.flash.getSettings().then((data) => {
      useSettingsStore.getState().hydrate(data)
      const ui = useUiStore.getState()
      ui.setTheme(data.theme)
      ui.setMotion(data.motion)
      window.flash.setConcurrency(data.concurrency)
      // 主题/动画改动回写持久化
      unsubUi = useUiStore.subscribe((s, prev) => {
        if (s.theme !== prev.theme) useSettingsStore.getState().set('theme', s.theme)
        if (s.motion !== prev.motion) useSettingsStore.getState().set('motion', s.motion)
      })
    })
    return () => unsubUi?.()
  }, [])
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="content">
        <header className="content-titlebar" />
        <div className="page-body">
          <Page />
        </div>
      </div>
      <ToastHost />
      <SponsorModal />
    </div>
  )
}
