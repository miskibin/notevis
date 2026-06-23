import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate
} from '@codemirror/view'
import { findRegions } from './vizWidget'

/**
 * Live-preview: conceal markdown markup (#, **, *, `, ~~) so text reads as rendered,
 * but reveal it on the line the cursor is on (or any line the selection touches) so
 * it stays directly editable — the Obsidian/Notion feel.
 */
const HIDE = new Set(['HeaderMark', 'EmphasisMark', 'CodeMark', 'StrikethroughMark'])
const hidden = Decoration.replace({})

function buildHidden(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const state = view.state
  const sel = state.selection.main
  const activeLine = state.doc.lineAt(sel.head).number
  const vizRegions = findRegions(state)
  const inViz = (from: number, to: number): boolean =>
    vizRegions.some((r) => from <= r.to && to >= r.from)

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        if (!HIDE.has(node.name)) return
        if (inViz(node.from, node.to)) return
        // Reveal markup on the active line / under the selection.
        if (state.doc.lineAt(node.from).number === activeLine) return
        if (sel.from <= node.to && sel.to >= node.from) return
        // For ATX headings, also swallow the single space after the hashes.
        let end = node.to
        if (node.name === 'HeaderMark' && state.doc.sliceString(end, end + 1) === ' ') end += 1
        builder.add(node.from, end, hidden)
      }
    })
  }
  return builder.finish()
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildHidden(view)
    }
    update(u: ViewUpdate): void {
      if (u.docChanged || u.selectionSet || u.viewportChanged) {
        this.decorations = buildHidden(u.view)
      }
    }
  },
  { decorations: (v) => v.decorations }
)
