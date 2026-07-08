import { create } from 'zustand'

export interface ToastItem {
  id: number
  kind: 'success' | 'error' | 'info'
  text: string
}

interface ToastState {
  toasts: ToastItem[]
  push(kind: ToastItem['kind'], text: string): void
  remove(id: number): void
}

let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push(kind, text) {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 3200)
  },
  remove(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  }
}))

export const toast = {
  success: (text: string): void => useToastStore.getState().push('success', text),
  error: (text: string): void => useToastStore.getState().push('error', text),
  info: (text: string): void => useToastStore.getState().push('info', text)
}
