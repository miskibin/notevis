import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
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
      basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
    />
  )
}
