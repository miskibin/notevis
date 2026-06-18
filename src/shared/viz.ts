/**
 * The persisted form of an interactive visualization.
 *
 * Stored inside a note as a fenced code block tagged ```viz, with this JSON as the
 * body. This keeps notes portable plain-markdown: any other viewer shows the block
 * as syntax-highlighted JSON rather than breaking.
 *
 * `caption` is load-bearing and required: it is the natural-language description that
 * (a) is what a retrieval/agent layer indexes — never the raw code/spec, (b) doubles
 * as accessibility text and as the fallback shown if the engine fails to render.
 */
export type VizEngine = 'html' | 'p5' | 'mermaid' | 'vega-lite'

export interface VizSpec {
  engine: VizEngine
  title: string
  /** NL description — indexed for retrieval, used as a11y/fallback text. */
  caption: string
  /**
   * The renderable payload. Its meaning depends on `engine`:
   * - 'html': a self-contained HTML body fragment (may include <style>/<script>)
   * - 'p5': a p5.js sketch body (uses global-mode setup()/draw())
   * - 'mermaid': Mermaid diagram source
   * - 'vega-lite': a JSON string holding a Vega-Lite spec
   */
  code: string
  /** Optional initial parameter values, for documentation / future re-hydration. */
  params?: Record<string, unknown>
}

export const VIZ_FENCE_LANG = 'viz'

/** Parse a ```viz block body into a VizSpec, throwing a readable error on failure. */
export function parseVizSpec(source: string): VizSpec {
  let raw: unknown
  try {
    raw = JSON.parse(source)
  } catch (err) {
    throw new Error(`viz block is not valid JSON: ${(err as Error).message}`)
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('viz block must be a JSON object')
  }
  const obj = raw as Record<string, unknown>
  const engine = obj.engine
  if (engine !== 'html' && engine !== 'p5' && engine !== 'mermaid' && engine !== 'vega-lite') {
    throw new Error(`viz block has unknown engine: ${String(engine)}`)
  }
  if (typeof obj.code !== 'string') {
    throw new Error('viz block is missing a string "code" field')
  }
  return {
    engine,
    title: typeof obj.title === 'string' ? obj.title : '',
    caption: typeof obj.caption === 'string' ? obj.caption : '',
    code: obj.code,
    params:
      typeof obj.params === 'object' && obj.params !== null
        ? (obj.params as Record<string, unknown>)
        : undefined
  }
}

/** Serialize a VizSpec back into the text that lives inside a ```viz fence. */
export function serializeVizSpec(spec: VizSpec): string {
  return JSON.stringify(spec, null, 2)
}
