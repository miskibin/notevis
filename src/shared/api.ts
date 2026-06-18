import type { VizSpec } from './viz'

/** A note file in the vault. */
export interface NoteMeta {
  /** Path relative to the vault root, e.g. "ideas/rf.md". Stable id. */
  id: string
  title: string
  modifiedMs: number
}

export interface GenerateVizRequest {
  prompt: string
  /** Optional engine hint; the model may override based on the request. */
  engine?: VizSpec['engine']
}

export interface LlmStatus {
  configured: boolean
  model: string
}

/**
 * The surface exposed to the renderer via contextBridge (window.api).
 * Mirrored by the preload implementation and src/preload/index.d.ts.
 */
export interface NotevisApi {
  vault: {
    path: () => Promise<string>
    list: () => Promise<NoteMeta[]>
    read: (id: string) => Promise<string>
    write: (id: string, content: string) => Promise<void>
    create: (title: string) => Promise<NoteMeta>
  }
  llm: {
    status: () => Promise<LlmStatus>
    generateViz: (req: GenerateVizRequest) => Promise<VizSpec>
  }
}
