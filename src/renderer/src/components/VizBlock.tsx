import { useEffect, useMemo, useRef, useState } from 'react'
import { parseVizSpec } from '@shared/viz'
import { buildSrcDoc } from '../viz/srcdoc'

/**
 * Renders one ```viz block as a borderless, auto-sized sandboxed iframe.
 * Falls back to the spec's caption (and the error) if the block can't be parsed.
 */
export function VizBlock({ source }: { source: string }): JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(120)

  const result = useMemo(() => {
    try {
      const spec = parseVizSpec(source)
      return { spec, srcDoc: buildSrcDoc(spec), error: null as string | null }
    } catch (err) {
      return { spec: null, srcDoc: '', error: (err as Error).message }
    }
  }, [source])

  useEffect(() => {
    function onMessage(e: MessageEvent): void {
      if (e.source !== iframeRef.current?.contentWindow) return
      const data = e.data as { type?: string; height?: number }
      if (data?.type === 'notevis:resize' && typeof data.height === 'number') {
        setHeight(Math.min(Math.max(data.height + 8, 60), 1200))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (result.error || !result.spec) {
    return (
      <div className="viz-block viz-block--error">
        <div className="viz-block__title">Nie udało się odczytać wizualizacji</div>
        <pre className="viz-block__err">{result.error}</pre>
      </div>
    )
  }

  const { spec } = result
  return (
    <figure className="viz-block">
      {spec.title && <figcaption className="viz-block__title">{spec.title}</figcaption>}
      <iframe
        ref={iframeRef}
        className="viz-block__frame"
        title={spec.title || 'visualization'}
        aria-label={spec.caption || spec.title}
        sandbox="allow-scripts"
        srcDoc={result.srcDoc}
        style={{ height }}
      />
      {spec.caption && <figcaption className="viz-block__caption">{spec.caption}</figcaption>}
    </figure>
  )
}
