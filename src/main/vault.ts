import { app } from 'electron'
import { promises as fs } from 'fs'
import { join, normalize, sep, relative, isAbsolute, dirname } from 'path'
import type { NoteMeta } from '../shared/api'
import { sampleNotes } from './samples'

/**
 * A flat-ish folder of .md files is the source of truth (per the research:
 * markdown is canonical, any index is derived/disposable). Default location is
 * a "vault" folder under the OS user-data dir, seeded with samples on first run.
 */
export class Vault {
  readonly root: string

  constructor(root?: string) {
    this.root = root ?? join(app.getPath('userData'), 'vault')
  }

  async ensure(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true })
    const existing = await this.list()
    if (existing.length === 0) {
      for (const note of sampleNotes) {
        await this.write(note.id, note.content)
      }
    }
  }

  /** Resolve a vault-relative id to an absolute path, refusing traversal. */
  private resolve(id: string): string {
    const clean = normalize(id).replace(/^(\.\.(\/|\\|$))+/, '')
    const abs = join(this.root, clean)
    const rel = relative(this.root, abs)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error(`path escapes vault: ${id}`)
    }
    return abs
  }

  async list(): Promise<NoteMeta[]> {
    const out: NoteMeta[] = []
    const walk = async (dir: string): Promise<void> => {
      let entries: import('fs').Dirent[]
      try {
        entries = await fs.readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        const abs = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(abs)
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const stat = await fs.stat(abs)
          const id = relative(this.root, abs).split(sep).join('/')
          out.push({ id, title: titleFor(id, await readFirstHeading(abs)), modifiedMs: stat.mtimeMs })
        }
      }
    }
    await walk(this.root)
    out.sort((a, b) => b.modifiedMs - a.modifiedMs)
    return out
  }

  async read(id: string): Promise<string> {
    return fs.readFile(this.resolve(id), 'utf8')
  }

  async write(id: string, content: string): Promise<void> {
    const abs = this.resolve(id)
    await fs.mkdir(dirname(abs), { recursive: true })
    await fs.writeFile(abs, content, 'utf8')
  }

  async create(title: string): Promise<NoteMeta> {
    const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'untitled'
    let id = `${slug}.md`
    let n = 1
    // Avoid clobbering an existing file.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await fs.access(this.resolve(id))
        id = `${slug}-${++n}.md`
      } catch {
        break
      }
    }
    const content = `# ${title}\n\n`
    await this.write(id, content)
    const stat = await fs.stat(this.resolve(id))
    return { id, title, modifiedMs: stat.mtimeMs }
  }
}

function titleFor(id: string, heading: string | null): string {
  if (heading) return heading
  const base = id.split('/').pop() ?? id
  return base.replace(/\.md$/, '')
}

async function readFirstHeading(abs: string): Promise<string | null> {
  try {
    const content = await fs.readFile(abs, 'utf8')
    const match = content.match(/^#\s+(.+)$/m)
    return match ? match[1].trim() : null
  } catch {
    return null
  }
}
