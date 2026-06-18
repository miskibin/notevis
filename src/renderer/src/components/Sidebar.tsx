import type { NoteMeta } from '@shared/api'

export function Sidebar({
  notes,
  activeId,
  onSelect,
  onCreate
}: {
  notes: NoteMeta[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
}): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="sidebar__head">
        <span className="sidebar__brand">notevis</span>
        <button className="icon-btn" onClick={onCreate} title="Nowa notatka">
          +
        </button>
      </div>
      <nav className="sidebar__list">
        {notes.map((n) => (
          <button
            key={n.id}
            className={'note-item' + (n.id === activeId ? ' note-item--active' : '')}
            onClick={() => onSelect(n.id)}
          >
            {n.title}
          </button>
        ))}
      </nav>
    </aside>
  )
}
