import { StateField, type EditorState, type Extension, type Range } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view'
import { parseVizSpec } from '@shared/viz'
import { buildSrcDoc } from '../viz/srcdoc'

interface VizRegion {
  from: number
  to: number
  source: string
}

/** Locate ```viz fenced blocks, returning whole-line ranges and their JSON body. */
export function findRegions(state: EditorState): VizRegion[] {
  const regions: VizRegion[] = []
  const doc = state.doc
  for (let ln = 1; ln <= doc.lines; ln++) {
    const line = doc.line(ln)
    if (!/^```viz\s*$/.test(line.text)) continue
    let endLine = doc.lines
    for (let j = ln + 1; j <= doc.lines; j++) {
      if (/^```\s*$/.test(doc.line(j).text)) {
        endLine = j
        break
      }
      endLine = j
    }
    const body: string[] = []
    for (let j = ln + 1; j < endLine; j++) body.push(doc.line(j).text)
    regions.push({ from: line.from, to: doc.line(endLine).to, source: body.join('\n') })
    ln = endLine
  }
  return regions
}

class VizWidget extends WidgetType {
  private cleanup: (() => void) | null = null

  constructor(readonly source: string) {
    super()
  }

  eq(other: VizWidget): boolean {
    return other.source === this.source
  }

  // Let pointer events reach the iframe (sliders etc.) instead of the editor.
  ignoreEvent(): boolean {
    return true
  }

  toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('div')
    root.className = 'cm-viz'

    let spec
    try {
      spec = parseVizSpec(this.source)
    } catch (err) {
      root.classList.add('cm-viz--error')
      root.innerHTML = `<div class="cm-viz__bar">Błąd wizualizacji</div><pre class="cm-viz__err"></pre>`
      root.querySelector('.cm-viz__err')!.textContent = (err as Error).message
      return root
    }

    const bar = document.createElement('div')
    bar.className = 'cm-viz__bar'
    bar.innerHTML = `<span class="cm-viz__title"></span><button class="cm-viz__edit" title="Edytuj źródło">&lt;/&gt; edytuj</button>`
    bar.querySelector('.cm-viz__title')!.textContent = spec.title || 'wizualizacja'

    // Clicking "edytuj" puts the cursor inside the block, revealing the source.
    bar.querySelector('.cm-viz__edit')!.addEventListener('mousedown', (e) => {
      e.preventDefault()
      const pos = view.posAtDOM(root)
      view.dispatch({ selection: { anchor: pos + 1 }, scrollIntoView: true })
      view.focus()
    })

    const frame = document.createElement('iframe')
    frame.className = 'cm-viz__frame'
    frame.setAttribute('sandbox', 'allow-scripts')
    frame.setAttribute('title', spec.title || 'visualization')
    if (spec.caption) frame.setAttribute('aria-label', spec.caption)
    frame.srcdoc = buildSrcDoc(spec)

    const onMessage = (e: MessageEvent): void => {
      if (e.source !== frame.contentWindow) return
      const data = e.data as { type?: string; height?: number }
      if (data?.type === 'notevis:resize' && typeof data.height === 'number') {
        frame.style.height = Math.min(Math.max(data.height + 8, 60), 1400) + 'px'
        view.requestMeasure()
      }
    }
    window.addEventListener('message', onMessage)
    this.cleanup = () => window.removeEventListener('message', onMessage)

    root.appendChild(bar)
    root.appendChild(frame)

    if (spec.caption) {
      const cap = document.createElement('div')
      cap.className = 'cm-viz__caption'
      cap.textContent = spec.caption
      root.appendChild(cap)
    }
    return root
  }

  destroy(): void {
    this.cleanup?.()
    this.cleanup = null
  }
}

function buildDecorations(state: EditorState): DecorationSet {
  const ranges: Range<Decoration>[] = []
  for (const region of findRegions(state)) {
    // While the selection touches the block, show raw source so it stays editable.
    const editing = state.selection.ranges.some((r) => r.from <= region.to && r.to >= region.from)
    if (editing) continue
    ranges.push(
      Decoration.replace({
        widget: new VizWidget(region.source),
        block: true
      }).range(region.from, region.to)
    )
  }
  return Decoration.set(ranges, true)
}

const vizField = StateField.define<DecorationSet>({
  create: (state) => buildDecorations(state),
  update(deco, tr) {
    if (tr.docChanged || tr.selection) return buildDecorations(tr.state)
    return deco.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f)
})

export const vizWidgets: Extension = [vizField]
