import { useCallback, useEffect, useRef, useState } from 'react'
import type { NoteMeta } from '@shared/api'
import { Sidebar } from './components/Sidebar'
import { LiveEditor } from './components/LiveEditor'
import { GenerateDialog } from './components/GenerateDialog'

export function App(): JSX.Element {
  const [notes, setNotes] = useState<NoteMeta[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [genOpen, setGenOpen] = useState(false)
  const [saved, setSaved] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshNotes = useCallback(async (): Promise<NoteMeta[]> => {
    const list = await window.api.vault.list()
    setNotes(list)
    return list
  }, [])

  const openNote = useCallback(async (id: string): Promise<void> => {
    const text = await window.api.vault.read(id)
    setActiveId(id)
    setContent(text)
    setSaved(true)
  }, [])

  useEffect(() => {
    void (async () => {
      const list = await refreshNotes()
      if (list.length) await openNote(list[0].id)
    })()
  }, [refreshNotes, openNote])

  // Debounced autosave.
  const onChange = useCallback(
    (next: string) => {
      setContent(next)
      setSaved(false)
      if (!activeId) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        await window.api.vault.write(activeId, next)
        setSaved(true)
        void refreshNotes()
      }, 500)
    },
    [activeId, refreshNotes]
  )

  const createNote = useCallback(async (): Promise<void> => {
    const title = window.prompt('Tytuł nowej notatki:')
    if (!title) return
    const meta = await window.api.vault.create(title)
    await refreshNotes()
    await openNote(meta.id)
  }, [refreshNotes, openNote])

  const insertViz = useCallback(
    (fence: string) => {
      onChange(content.replace(/\s*$/, '') + '\n\n' + fence + '\n')
    },
    [content, onChange]
  )

  return (
    <div className="app">
      <Sidebar notes={notes} activeId={activeId} onSelect={openNote} onCreate={createNote} />
      <main className="main">
        <header className="toolbar">
          <span className={'dot' + (saved ? ' dot--saved' : '')} title={saved ? 'zapisano' : 'edytowanie…'} />
          <div className="toolbar__spacer" />
          <button className="ghost-btn" onClick={() => setGenOpen(true)}>
            + wizualizacja
          </button>
        </header>
        <div className="surface">
          <LiveEditor value={content} onChange={onChange} />
        </div>
      </main>
      <GenerateDialog open={genOpen} onClose={() => setGenOpen(false)} onInsert={insertViz} />
    </div>
  )
}
