import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px', background: 'transparent' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: '1.7' },
  '.cm-content': { padding: '24px 28px' },
  '.cm-gutters': { display: 'none' },
  '&.cm-focused': { outline: 'none' }
})

export function Editor({
  value,
  onChange
}: {
  value: string
  onChange: (next: string) => void
}): JSX.Element {
  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={oneDark}
      extensions={[
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.lineWrapping,
        theme
      ]}
      onChange={onChange}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        bracketMatching: false
      }}
    />
  )
}
