import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

/**
 * A calm, document-like theme: a proportional font and a centered column so the
 * single editing surface reads like a Notion page rather than a code editor.
 */
export const editorTheme = EditorView.theme(
  {
    '&': { color: '#ececec', backgroundColor: 'transparent', height: '100%' },
    '.cm-scroller': {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      lineHeight: '1.75',
      overflow: 'auto'
    },
    '.cm-content': {
      maxWidth: '740px',
      margin: '0 auto',
      padding: '48px 28px 280px',
      caretColor: '#8a7dff'
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#8a7dff', borderLeftWidth: '2px' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(138, 125, 255, 0.22) !important'
    },
    '.cm-gutters': { display: 'none' }
  },
  { dark: true }
)

export const mdHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.heading1, fontSize: '1.85em', fontWeight: '700', lineHeight: '1.3' },
    { tag: t.heading2, fontSize: '1.45em', fontWeight: '700', lineHeight: '1.3' },
    { tag: t.heading3, fontSize: '1.18em', fontWeight: '600' },
    { tag: [t.heading4, t.heading5, t.heading6], fontWeight: '600' },
    { tag: t.strong, fontWeight: '700', color: '#f3f3f3' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through', color: '#8a8a8a' },
    { tag: t.link, color: '#8a7dff', textDecoration: 'underline' },
    { tag: t.url, color: '#6b6b6b' },
    { tag: t.monospace, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.9em', color: '#d2c9ff' },
    { tag: t.list, color: '#cfcfcf' },
    { tag: t.quote, color: '#9aa0a6', fontStyle: 'italic' },
    // Markup punctuation (#, *, -, ```): keep visible but dim, like a live-preview.
    { tag: t.processingInstruction, color: '#5e5e63' },
    { tag: t.contentSeparator, color: '#5e5e63' }
  ])
)
