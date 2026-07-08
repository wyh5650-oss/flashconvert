/// <reference types="vite/client" />
import type { FlashApi } from '../../shared/types'

declare global {
  interface Window {
    flash: FlashApi
  }
}

export {}
