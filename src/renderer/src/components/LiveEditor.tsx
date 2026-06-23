import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorView } from '@codemirror/view'
import { editorTheme, mdHighlight } from '../editor/theme'
import { vizWidgets } from '../editor/vizWidget'
import { livePreview } from '../editor/livePreview'

/**
 * A single editing surface (Notion-style): markdown stays editable text with
 * live typographic styling, and ```viz blocks render inline as live widgets.
 */
export function LiveEditor({
  value,
  onChange
}: {
  value: string
  onChange: (next: string) => void
}): JSX.Element {
  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      editorTheme,
      mdHighlight,
      vizWidgets,
      livePreview
    ],
    []
  )

  return (
    <CodeMirror
      value={value}
      height="100%"
      extensions={extensions}
      onChange={onChange}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        bracketMatching: false,
        syntaxHighlighting: false,
        autocompletion: false,
        searchKeymap: false
      }}
    />
  )
}
