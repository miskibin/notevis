# NoteVis

Markdown notes with **LLM-generated inline interactive visualizations**, rendered
borderlessly inside the document. Desktop app (Electron + React + TypeScript).

See the design research in [`docs/research/`](docs/research/).

## What works in this first cut

- Electron app with a notes vault (plain `.md` files; seeded with samples on first run).
- Split view: **CodeMirror 6** markdown editor (left) + **live preview** (right) with
  debounced autosave.
- Interactive visualizations stored as `` ```viz `` fenced blocks (JSON) and rendered
  inline as **sandboxed, auto-sized iframes** (`sandbox="allow-scripts"` + CSP,
  `ResizeObserver`→`postMessage` for the borderless look). Engines: `html`, `p5`,
  `mermaid`, `vega-lite` (libraries loaded from cdnjs only).
- **Generate visualization** via DeepSeek: a prompt → a validated `VizSpec` inserted
  into the note. The API key stays in the main process.

The `viz` envelope carries a required `caption` (NL description) from day one — the
field a future retrieval/agent layer will index, per the research.

## Develop

```bash
npm install
npm run dev          # launch the app (needs a desktop session)
npm run build        # build main + preload + renderer
npm run typecheck    # tsc for node + web projects
```

## Use the LLM generator

Set a DeepSeek key in the environment the app is launched from:

```bash
export DEEPSEEK_API_KEY=sk-...
# optional: export DEEPSEEK_MODEL=deepseek-chat
npm run dev
```

DeepSeek is generation-only (no embeddings endpoint); the retrieval/agent layer in the
research roadmap will use a separate embedding provider.

## The `viz` block format

````markdown
```viz
{
  "engine": "p5",
  "title": "Interferencja dwóch fal",
  "caption": "Dwie fale sinusoidalne nakładają się…",
  "code": "function setup(){ createCanvas(680,240); } function draw(){ ... }",
  "params": { "delta": 6 }
}
```
````

Any plain markdown viewer shows this as a JSON code block, so notes stay portable.

## Roadmap (next)

- CodeMirror 6 live-preview widget decoration (true inline editing, not split-pane).
- Streaming generation + validate/retry loop.
- Filesystem MCP server over the vault (the cheap first "give it to your agent" step).
