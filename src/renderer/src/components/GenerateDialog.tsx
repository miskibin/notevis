import { useEffect, useState } from 'react'
import type { LlmStatus } from '@shared/api'
import { serializeVizSpec, VIZ_FENCE_LANG, type VizEngine } from '@shared/viz'

const ENGINES: VizEngine[] = ['html', 'p5', 'mermaid', 'vega-lite']

export function GenerateDialog({
  open,
  onClose,
  onInsert
}: {
  open: boolean
  onClose: () => void
  onInsert: (fence: string) => void
}): JSX.Element | null {
  const [prompt, setPrompt] = useState('')
  const [engine, setEngine] = useState<'auto' | VizEngine>('auto')
  const [status, setStatus] = useState<LlmStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      void window.api.llm.status().then(setStatus)
      setError(null)
    }
  }, [open])

  if (!open) return null

  const generate = async (): Promise<void> => {
    if (!prompt.trim()) return
    setBusy(true)
    setError(null)
    try {
      const spec = await window.api.llm.generateViz({
        prompt,
        engine: engine === 'auto' ? undefined : engine
      })
      const fence = '```' + VIZ_FENCE_LANG + '\n' + serializeVizSpec(spec) + '\n```'
      onInsert(fence)
      setPrompt('')
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">Generuj wizualizację</h2>
        {status && !status.configured && (
          <div className="modal__warn">
            Brak klucza DeepSeek. Ustaw <code>DEEPSEEK_API_KEY</code> w środowisku aplikacji.
          </div>
        )}
        <textarea
          className="modal__textarea"
          placeholder="Opisz wizualizację, np. „wykres tłumienia filtra dolnoprzepustowego z suwakiem częstotliwości odcięcia”"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          autoFocus
        />
        <div className="modal__row">
          <label>
            Silnik:&nbsp;
            <select value={engine} onChange={(e) => setEngine(e.target.value as 'auto' | VizEngine)}>
              <option value="auto">auto</option>
              {ENGINES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
          {status && <span className="modal__model">model: {status.model}</span>}
        </div>
        {error && <pre className="modal__error">{error}</pre>}
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Anuluj
          </button>
          <button
            className="btn btn--primary"
            onClick={generate}
            disabled={busy || !prompt.trim() || (status ? !status.configured : false)}
          >
            {busy ? 'Generuję…' : 'Generuj'}
          </button>
        </div>
      </div>
    </div>
  )
}
