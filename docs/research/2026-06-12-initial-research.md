# NoteVis — Initial Research: Markdown Notes with LLM-Generated Inline Interactive Visualizations

*Research date: 2026-06-12. Compiled from three parallel deep-research passes:
(1) LLM-generated UI technology, (2) markdown editors with inline live widgets,
(3) desktop shell + LLM provider stack.*

## The idea

A desktop markdown note-taking app where an LLM (DeepSeek) generates interactive
visualizations that render **inline** in the note — no visible iframe/canvas borders,
just live interactive components mixed with prose, like Claude's inline interactive
visualizations. The note stays a portable `.md` file on disk.

**Verdict: the idea is sound and very buildable in 2026.** Every piece exists and is
proven; the hard part is the editor UX (seamless inline widgets while *editing*), not
the LLM or rendering side.

---

## 1. How "borderless inline visualizations" actually work

Claude's inline visualizations (community-documented, not official):

- Claude generates a **self-contained HTML document** (Chart.js / D3 / p5.js / SVG /
  Mermaid, routed by content type at inference time).
- It renders in an `<iframe srcdoc="...">` with `sandbox="allow-scripts"` (no
  `allow-same-origin`) → null origin, no access to parent cookies/DOM/storage.
- CSP restricts external scripts to `cdnjs.cloudflare.com` only. CSP `<meta>` tags
  inside `srcdoc` cannot be removed by sandboxed JS (verified by Simon Willison,
  Apr 2026) — this makes meta-tag CSP a reliable sandbox hardener.
- A `ResizeObserver` inside the iframe reports height to the parent via
  `postMessage` → the iframe auto-sizes with no border/scrollbar → "no visible
  canvas" effect. That's the whole trick.

So the borderless look is **styling + auto-resize on a sandboxed iframe**, fully
reproducible in Electron.

## 2. The core architectural decision: spec vs. code

Two fundamental approaches for what the LLM emits:

### A. Constrained JSON spec → trusted component library renders it
Examples: json-render (Vercel Labs), Google A2UI, Vega-Lite, Mermaid.

- ✅ No code execution → no sandbox needed; trivially safe
- ✅ High first-pass validity from mid-tier models (~85–90% for standard Vega-Lite;
  VegaChat benchmark: 83.9% with GPT-4o-mini + repair loop)
- ✅ Streaming partial JSON → progressive rendering
- ❌ Expressiveness ceiling: only what the catalog/spec language supports
- ❌ Custom physics visualizations need custom schema + few-shot teaching
  (first-pass accuracy drops to ~50–70% for complex Vega specs with custom signals)

### B. LLM emits actual code (HTML/JS) → sandboxed iframe executes it
This is Claude Artifacts' approach.

- ✅ Arbitrary expressiveness — exactly the intermodulation-diagram use case
- ✅ Counter-intuitively *more* reliable for custom physics viz: DeepSeek already
  knows p5.js/D3/Canvas patterns from training data; it does NOT know your custom
  schema. ~75–85% first-pass functional code for slider-driven canvas visualizations
- ❌ Needs sandboxing (solved: `sandbox="allow-scripts"` + CSP meta tags)
- ❌ Runtime errors need a re-prompt-with-error repair loop
- ❌ Can't progressively render partial code; must wait for complete output

### ➜ Recommendation: tiered hybrid (this is also what Claude effectively does)

| Tier | Spec language | Use for | Execution risk |
|------|--------------|---------|----------------|
| 1 | **Mermaid** fenced block | Flow/sequence/structure diagrams | None |
| 1 | **Vega-Lite** fenced block (`params` + `bind: {input: "range"}` gives declarative sliders!) | Statistical charts, simple parameter sweeps | None |
| 2 | **Sandboxed HTML** (p5.js / D3 / Canvas) | Physics sims, spectrum/IM diagrams, anything custom | Sandboxed iframe |

Vega-Lite's `params` + `bind` natively produces slider-driven reactive charts from
pure JSON — worth knowing — but for the intermodulation-products diagram with
formula-driven IM3/IM5/IM7 lobes, Tier 2 (p5.js or D3 + range inputs) is the right
tool and well within DeepSeek's abilities.

## 3. The generative-UI library landscape (so we don't reinvent it blindly)

| Tool | What | License | Fit |
|------|------|---------|-----|
| [json-render](https://github.com/vercel-labs/json-render) (Vercel Labs, Jan 2026) | Zod-defined component catalog → LLM emits constrained JSON → progressive React rendering ("SpecStream") | Apache 2.0 | Great pattern reference; built-ins are generic (cards/tables/4 chart types) — physics viz would need custom catalog entries |
| [OpenUI](https://github.com/thesysdev/openui) (Thesys) | Streaming-first UI language, claims 52.8% fewer tokens than JSON | MIT | Watch; younger |
| [Google A2UI](https://a2ui.org) | Cross-agent UI protocol, has a Slider component | Apache 2.0 | Protocol-level, overkill here |
| [llm-ui](https://llm-ui.com) | React lib for mixed streaming output: markdown prose + embedded validated JSON blocks | MIT | Directly relevant for the chat/generation panel |
| [CopilotKit OpenGenerativeUI](https://github.com/CopilotKit/OpenGenerativeUI) | Reference impl of all 3 patterns incl. sandboxed-iframe streaming (`css → html → js` phases) | MIT | Best open reference for Tier 2 streaming |
| Vercel AI SDK `streamUI` (RSC) | Old generative-UI approach | — | Paused; superseded by json-render |
| Thesys C1 | Commercial generative-UI API middleware | SaaS | Not for a local-first app |

## 4. Editor: the actually-hard part

### Precedents
- **Obsidian** proves the whole pattern: `registerMarkdownCodeBlockProcessor`
  renders custom fenced blocks as live React widgets in ~1 function call (reading
  mode). Existing plugins: Dataview/Datacore (reactive Preact views), **Emera**
  (full JSX components inline, in-browser Babel — closest prior art, abandoned),
  ObsidGet (HTML widgets w/ state persisted back into the fence), Vega/Charts
  plugins, **Grafika** (AI-generated charts — closest precedent to this exact idea).
- **Observable Framework** is the gold standard for reactive `.md` documents
  (` ```js ` cells + `${...}` inline expressions, reactive cascade) — but it's a
  static-site build tool, not an editable notes app.
- **MarkView** (https://github.com/scos-lab/markview): Tauri markdown app already
  rendering Vega-Lite + Mermaid from fenced blocks. Study it.
- Idyll/Tangle.js (explorable-explanations lineage): inspiring, unmaintained.
- Notion/Typora/Logseq/Zettlr: no good extension path for custom live blocks.

### Editor framework comparison (build-from-scratch)

| Framework | Inline React widgets | MD round-trip | Notes |
|-----------|---------------------|---------------|-------|
| **CodeMirror 6** ⭐ | `Decoration.replace` + `WidgetType.toDOM()` → `createRoot().render()` | Perfect (file = source of truth, widget is visual overlay) | How Obsidian live-preview works. MIT. Hardest parts: cursor re-entry into widget, block-height scroll jitter. Decorations for multi-line blocks must come from a `StateField`, not a `ViewPlugin` |
| TipTap (ProseMirror) | `addNodeView()` → React component, first-class | Good, but first-party markdown ext is **paid** (community `tiptap-markdown` is free, rougher) | Best WYSIWYG option |
| Milkdown | ProseMirror + Remark plugins | Best spec compliance (Remark) | Steeper learning curve, smaller community |
| Lexical | `DecoratorNode` (elegant) | Transformers | Pre-1.0 API churn — risky |
| BlockNote | `createReactBlockSpec` | **Lossy** markdown export | Disqualified: breaks the portable-`.md` requirement |

### Persistence format — clear community convergence

**Custom-language fenced code block with a JSON body:**

````markdown
```viz
{ "engine": "p5", "title": "Intermodulation products", "code": "...", "params": {...} }
```
````

Portable (renders as a plain code block anywhere else), git-diffable, CommonMark-valid,
and what Mermaid/Vega/Chart.js/Dataview all converged on. MDX is the alternative but
forces a build step and `.mdx` extension — rejected.

## 5. Desktop shell

- **Electron** (Vite + React + TS): one Chromium everywhere → zero cross-platform
  rendering surprises for canvas-heavy widgets; pure-TS stack; ~100 MB bundle premium.
- **Tauri 2.x**: 3–15 MB bundles, better default security (capability files), but
  Rust tax + per-platform WebView rendering differences (WebKitGTK on Linux varies).
- **PWA + File System Access API: not viable** — Firefox & Safari still don't support
  real-folder access (~27% global support).
- References: **Zettlr** (GPL, study-only — best CM6 integration reference),
  **MarkText** (MIT — reusable WYSIWYG UX code, but project is sluggish),
  Notesnook/AppFlowy (AGPL, architecture references only).

➜ **Electron for a solo TS dev.** Re-evaluate Tauri later if bundle size matters.

## 6. LLM side (DeepSeek)

As of June 2026 (verified against api-docs.deepseek.com):

- Current gen: **DeepSeek V4** (released 2026-04-24). `deepseek-chat`/`deepseek-reasoner`
  aliases deprecated 2026-07-24 → route to V4-Flash.
- **V4-Flash**: 1M context, 384K max output, $0.14/M input (cache miss; $0.0028 cache
  hit), $0.28/M output. A typical viz-spec generation ≈ **$0.0005 → ~2,000 generations
  per dollar**.
- Structured output: JSON mode (syntax only) and **function calling with `strict: true`
  (Beta)** — schema-enforced. Tool calls now work in thinking mode (new in V4).
- Recommended pattern: **tool calling (strict) + Zod validation + 2-retry loop with
  the validation error fed back**. Libraries: Instructor-TS or BAML (Schema-Aligned
  Parsing, 92–94% on BFCL) — both work via DeepSeek's OpenAI-compatible endpoint.
- Streaming: **Vercel AI SDK `streamObject`/`useObject`** (works with
  `createOpenAI({baseURL: 'https://api.deepseek.com'})`) or the `partial-json` npm
  package for manual control → render the widget progressively as the spec streams.
- Offline option: **Ollama + Qwen3-32B / Qwen2.5-Coder-32B** (~24 GB VRAM) generate
  decent Vega-Lite/JS on first pass for simple cases. Abstract the provider behind
  one function (`provider: 'deepseek' | 'ollama'`) from day one.

## 7. Recommended stack

```
Shell:        Electron + Vite + React 18 + TypeScript
Editor:       CodeMirror 6 (source-mode markdown + live-preview widget replacement)
Widgets:      React mounted in CM6 WidgetType.toDOM()
Tier 1 viz:   Mermaid + Vega-Lite (vega-embed), rendered directly — no sandbox
Tier 2 viz:   sandboxed <iframe srcdoc sandbox="allow-scripts"> + CSP meta tag,
              auto-resize via ResizeObserver + postMessage, p5.js/D3 from CDN
Persistence:  ```viz fenced blocks (JSON envelope: engine + spec/code + params)
LLM:          DeepSeek V4-Flash via tool-calling strict mode
              + Zod validation + retry loop; Vercel AI SDK streamObject for streaming
              + provider abstraction for Ollama offline mode
```

Estimated solo-dev timeline to a polished prototype: **6–10 weeks**, dominated by
CM6 live-preview edge cases (cursor re-entry, scroll jitter, widget↔source sync).

## 8. Strategic question: own app vs. Obsidian plugin first

Honest assessment from the research:

- An **Obsidian plugin (reading mode only)** delivers ~70% of end-user value in
  **2–3 weeks**: `registerMarkdownCodeBlockProcessor` + React + the same LLM
  pipeline. Validates whether LLM-generated inline viz is actually useful in a real
  note-taking workflow, in front of an existing user base.
- But the **"no visible borders, seamless while editing"** quality — arguably the
  whole product insight — is exactly what's hard in Obsidian: live-preview requires
  a fragile CM6 editor extension against Obsidian's bundled CM6 (4–8 extra weeks,
  documented pain in the Emera post-mortem).
- Reasonable path: plugin as a 2–3 week validation spike (the LLM pipeline, viz
  envelope format, and React widgets all transfer 1:1 to the standalone app), then
  build the Electron app around CM6 if the concept proves out.

## Key links

- json-render: https://json-render.dev · https://github.com/vercel-labs/json-render
- CopilotKit OpenGenerativeUI (sandboxed streaming reference): https://github.com/CopilotKit/OpenGenerativeUI
- llm-ui: https://llm-ui.com/docs/blocks/json/
- Vega-Lite slider bindings: https://vega.github.io/vega-lite/docs/bind.html
- MarkView (Tauri + Vega-Lite/Mermaid in md): https://github.com/scos-lab/markview
- Emera plugin + build post-mortem: https://github.com/OlegWock/obsidian-emera · https://sinja.io/blog/how-i-built-notebook-in-obisidian-emera
- Obsidian code block API: https://docs.obsidian.md/Reference/TypeScript+API/Plugin/registerMarkdownCodeBlockProcessor
- CM6 decorations: https://codemirror.net/examples/decoration/
- NYT react-prosemirror: https://github.com/nytimes/react-prosemirror
- CSP-in-sandboxed-iframe verification: https://simonwillison.net/2026/Apr/3/test-csp-iframe-escape/
- DeepSeek function calling: https://api-docs.deepseek.com/guides/function_calling
- DeepSeek pricing: https://api-docs.deepseek.com/quick_start/pricing
- Vercel AI SDK streamObject: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-object
- partial-json parser: https://github.com/promplate/partial-json-parser-js
- Observable Framework reactive md: https://observablehq.com/framework/javascript
- Zettlr (CM6 architecture reference): https://github.com/Zettlr/Zettlr
- Editor framework comparison 2025: https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025
