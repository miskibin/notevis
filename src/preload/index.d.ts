import type { NotevisApi } from '../shared/api'

declare global {
  interface Window {
    api: NotevisApi
  }
}

export {}
