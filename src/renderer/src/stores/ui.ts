import { create } from 'zustand'

export type ThemePref = 'light' | 'dark' | 'system'
export type MotionPref = 'full' | 'reduced' | 'off' | 'system'
export type PageId = 'convert' | 'history' | 'settings' | 'gallery'

interface UiState {
  theme: ThemePref
  motion: MotionPref
  page: PageId
  sponsorOpen: boolean
  setTheme(theme: ThemePref): void
  setMotion(motion: MotionPref): void
  setPage(page: PageId): void
  setSponsorOpen(open: boolean): void
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  return pref === 'system' ? (darkQuery.matches ? 'dark' : 'light') : pref
}

export function resolveMotion(pref: MotionPref): 'full' | 'reduced' | 'off' {
  return pref === 'system' ? (reduceQuery.matches ? 'reduced' : 'full') : pref
}

function applyToDom(theme: ThemePref, motion: MotionPref): void {
  document.documentElement.setAttribute('data-theme', resolveTheme(theme))
  document.documentElement.setAttribute('data-motion', resolveMotion(motion))
}

const startPage = (import.meta.env.VITE_START_PAGE as PageId | undefined) ?? 'convert'

export const useUiStore = create<UiState>((set, get) => ({
  theme: 'system',
  motion: 'system',
  page: startPage,
  sponsorOpen: import.meta.env.VITE_OPEN_SPONSOR === '1',
  setTheme(theme) {
    set({ theme })
    applyToDom(theme, get().motion)
  },
  setMotion(motion) {
    set({ motion })
    applyToDom(get().theme, motion)
  },
  setPage(page) {
    set({ page })
  },
  setSponsorOpen(sponsorOpen) {
    set({ sponsorOpen })
  }
}))

// 跟随系统实时变化
darkQuery.addEventListener('change', () => {
  const { theme, motion } = useUiStore.getState()
  applyToDom(theme, motion)
})
reduceQuery.addEventListener('change', () => {
  const { theme, motion } = useUiStore.getState()
  applyToDom(theme, motion)
})

applyToDom(useUiStore.getState().theme, useUiStore.getState().motion)
