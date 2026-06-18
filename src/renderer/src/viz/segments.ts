export type Segment =
  | { type: 'md'; text: string }
  | { type: 'viz'; source: string }

/**
 * Split note content into markdown runs and ```viz blocks.
 *
 * Rendering viz blocks ourselves (rather than via a react-markdown code override)
 * avoids invalid <figure> inside <pre> nesting and keeps the iframe out of the
 * markdown AST entirely.
 */
export function splitSegments(content: string): Segment[] {
  const lines = content.split('\n')
  const segments: Segment[] = []
  let md: string[] = []
  let viz: string[] | null = null

  const flushMd = (): void => {
    if (md.length) {
      segments.push({ type: 'md', text: md.join('\n') })
      md = []
    }
  }

  for (const line of lines) {
    const fence = line.match(/^```(\w*)\s*$/)
    if (viz !== null) {
      // Inside a viz block: a closing fence ends it.
      if (fence) {
        segments.push({ type: 'viz', source: viz.join('\n') })
        viz = null
      } else {
        viz.push(line)
      }
      continue
    }
    if (fence && fence[1] === 'viz') {
      flushMd()
      viz = []
      continue
    }
    md.push(line)
  }

  // Unterminated viz fence: treat collected lines as a viz block anyway.
  if (viz !== null) segments.push({ type: 'viz', source: viz.join('\n') })
  flushMd()
  return segments
}
