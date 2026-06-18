# NoteVis — Research: Notes as a Knowledge Base for Your Agent

*Research date: 2026-06-12. Companion to `2026-06-12-initial-research.md`.
Added because of a new requirement: the notes should accumulate into a personal
knowledge base that the user can later "give to their agent" (an AI agent queries
the notes). Compiled from a large parallel research pass — chunking strategies,
mixed-content RAG, code/table/widget handling, MCP servers, embeddable vector
stores, embedding models, GraphRAG cost/benefit, and prior-art projects.*

## The headline

This second requirement is not a bolt-on — it **reshapes the data model**, and it
should be designed in from day one. The good news: it aligns almost perfectly with
the core app, and there is mature prior art (notably **basic-memory**) doing exactly
"local markdown → knowledge base → MCP server" today. The single most important
design rule falls directly out of the research and is restated below.

---

## 1. The core tension and its resolution (the load-bearing decision)

The whole point of the app is **interactive visualizations** — but to a retrieval
system, a ` ```viz ` block full of p5.js code or a Vega JSON spec is **noise**. An
agent cannot reason over a chart from its canvas code; embedding raw code/JSON
produces semantically useless vectors and pollutes the index.

**Resolution (strongly validated by the research): index a natural-language
description of each visualization, never the raw code/spec.** Every viz block must
carry an LLM-written `caption`. That caption is what gets embedded and served to the
agent; the code/spec is kept only for rendering to humans.

This is the documented best practice across multimodal-RAG work:
- NVIDIA's multimodal RAG and DataCamp's tutorial both generate an NL caption per
  figure and embed the **caption**, not the image/data
  (e.g. *"a line chart showing patient heart rate rising from 70 to 90 bpm over 5
  min"*). [NVIDIA](https://developer.nvidia.com/blog/an-easy-introduction-to-multimodal-retrieval-augmented-generation/), [DataCamp](https://www.datacamp.com/tutorial/multimodal-rag)
- Meta-RAG (arXiv 2508.02611) stores LLM **summaries instead of raw code** for code
  retrieval — ~79.8% compression with *better* retrieval than raw-code RAG.
- No source documents a "embed the raw Vega/JSON spec" approach; the universal
  pattern for structured visual content is "describe in NL, then embed the text."

**The serendipity:** when DeepSeek generates a visualization it *already* produces an
explanation. Today that explanation is thrown away in chat. Here it is persisted as
the `caption` and becomes the exact knowledge unit the agent consumes. One generation
act serves both goals — rendering for humans, retrieval for the agent. This actually
*strengthens* the original product thesis.

### Resulting block format

````markdown
```viz
{
  "engine": "p5",
  "title": "Produkty intermodulacji w odbiorniku",
  "caption": "Dwa sygnały f1, f2 w paśmie TX generują produkty intermodulacji nieparzystego rzędu (IM3 = 2·f1 − f2, IM5, IM7) wpadające w pasmo RX. IM3 leży najbliżej i dominuje. Suwaki sterują f1 i f2.",
  "code": "...",
  "params": { "f1": 1837, "f2": 1880 }
}
```
````

`caption` does triple duty: (1) embedded for retrieval, (2) accessibility / alt-text,
(3) graceful fallback when the note is opened in a plain markdown viewer.

---

## 2. Chunking & indexing markdown that contains non-prose blocks

### Structural, header-aware chunking is the base layer
- **Header-aware split first** (LangChain `MarkdownHeaderTextSplitter` /
  llama-index `MarkdownNodeParser`): each section becomes a chunk carrying its header
  path as metadata (e.g. `"Topic/Subtopic"`), usable as a retrieval pre-filter. Then
  a second size-capping pass (`split_documents`, ~400–512 tokens, 10–20% overlap)
  while **preserving** the header metadata.
- Crucially, `MarkdownNodeParser` **skips headers inside code fences**, so a `#`
  inside a ` ```viz ` block is never mistaken for a section boundary. Good for us.

### Handling the embedded blocks (validated rules)
- **Viz blocks** → replace the block with its `caption` in the text stream that gets
  embedded; keep raw code out of the index (§1).
- **Code blocks** → never split mid-block; keep the function/block atomic and keep the
  paragraph immediately after it attached (it usually explains the code). For large
  code, store an NL summary for retrieval + raw code for display (dual-store).
- **Tables** → never split across chunks; LLM-generate a one-line description and
  embed *description + table*, not raw rows. BM25 matters a lot here (exact numeric
  terms). (Table structure mismatch is the #1 mixed-content RAG failure mode —
  T2-RAGBench attributes 73% of failures to it.)

### Two retrieval upgrades that pay off the most
1. **Hybrid search (vector + BM25) + reranking.** This is the single biggest quality
   lever: reranking alone ≈ +40% MRR@3 (T2-RAGBench); BM25 *beats* dense retrieval on
   tabular/numeric content. Architecture: dense + BM25 fused with Reciprocal Rank
   Fusion → top ~50 → cross-encoder rerank → top ~5.
2. **Contextual Retrieval (Anthropic).** Prepend a 50–100 token LLM-generated context
   sentence to each chunk before embedding ("This passage is from the note on X,
   discussing Y…"). Reduces retrieval failures ~49% with BM25, ~67% with reranking;
   ~$1/M tokens one-time. [Anthropic](https://www.anthropic.com/news/contextual-retrieval)

(Avoid HyDE on numeric/table queries — it invents plausible-but-wrong numbers.)

---

## 3. Local-first vector store (embeddable, no server)

For an Electron app bundling a local index, the realistic field narrows fast — Chroma
(JS is HTTP-only) and txtai (Python) are **disqualified** for in-process use.

| Store | Runtime | Electron packaging | Hybrid (vec+BM25) | Notes |
|-------|---------|--------------------|--------------------|-------|
| **Orama** ⭐ | Pure TS, zero native deps | Drops in, no config | First-class (`mode: 'hybrid'`) | ~512 MB single-file persistence cap; in-memory model. Production at scale (nodejs.org search) |
| **sqlite-vec** ⭐ | C ext in SQLite (`.node`) | `asarUnpack` (handled by `@photostructure/sqlite-vec`) | Composable via FTS5 + RRF (manual SQL) | Best if app already ships SQLite (`better-sqlite3`); single `.db` file. Pre-v1 |
| **LanceDB** | Rust + NAPI `.node` | `asarUnpack` (auto via Electron Forge `AutoUnpackNatives`; NAPI-RS needs no per-ABI rebuild) | Best-in-class native BM25+vector | Highest performance/scale; **shipped Electron precedent: Continue.dev** (also AnythingLLM); 5ire migrated *away* citing complexity; Reor used it |
| **PGlite + pgvector** | WASM Postgres | No native modules (~3 MB) | Manual SQL (`tsvector` + pgvector) | Full Postgres semantics; 5ire migrated *to* it from LanceDB |
| Vectra / hnswlib-node | Pure TS / C++ | easy / `asarUnpack` | none/partial | Only for small or low-level use |

**Recommendation:**
- **Start with sqlite-vec** if the app stores its data in SQLite anyway (likely) — the
  index lives in the same `.db` file, hybrid search via FTS5 + RRF, and Electron
  packaging is a solved problem via `@photostructure/sqlite-vec`. This also matches
  **basic-memory's** proven stack (SQLite + sqlite-vec).
- **Orama** is the lowest-friction alternative (pure TS, true hybrid API) if you want
  zero native modules and stay under the ~512 MB ceiling.
- **LanceDB** only if/when scale or multimodal needs justify the packaging cost.

---

## 4. Embedding model (offline-first default + cloud upgrade)

Prior art converges hard here: local, in-process embeddings via **Transformers.js /
ONNX** or **FastEmbed**, with **bge-small-en-v1.5** (384-dim) or **all-MiniLM-L6-v2**
as the de-facto default. Reor (Transformers.js), Obsidian Smart Connections
(Transformers.js, built-in, no API key), and basic-memory (FastEmbed, bge-small) all
ship this way — it's "good enough" for a personal vault and fully offline.

| Model | MTEB (EN avg) | Params | Dim | Max tokens | Multilingual | Notes |
|-------|---------------|--------|-----|------------|--------------|-------|
| all-MiniLM-L6-v2 | ~56 | 22M | 384 | 256 | no | smallest/fastest; the classic baseline |
| **bge-small-en-v1.5** | 62.17 | 33M | 384 | 512 | no | best size/quality default for EN; basic-memory's choice |
| gte-small | 61.36 | 33M | 384 | 512 | no | comparable to bge-small |
| nomic-embed-text-v1.5 | 62.28 | 137M | 768 (Matryoshka→64) | 8192 | partial | long context; truncatable dims |
| mxbai-embed-large-v1 | 64.68 | 335M | 1024 | 512 | no | heavier; via Ollama |
| **jina-embeddings-v3** | 65.52 | 570M | 1024 | 8192 | **yes** | top quality + multilingual + long ctx |
| OpenAI text-embedding-3-small | ~62 | — (cloud) | 1536 | 8191 | yes | cloud baseline |

- **Default (offline, EN-leaning):** `bge-small-en-v1.5` via Transformers.js,
  in-process, no Python. Best size/quality tradeoff and matches proven prior art.
- **For Polish/mixed-language notes (your case):** strongly prefer a **multilingual**
  model. Best local Apache-licensed multilingual options that run in-process or via
  Ollama: **`Qwen3-Embedding-0.6B`** (Apache 2.0, ~639 MB, multilingual, 40k context)
  and **`bge-m3`** (~1.2 GB, multilingual, 8192 context). For cloud,
  **`jina-embeddings-v3`** (MTEB 65.52, multilingual, 8192 context, OpenAI-compatible)
  is the standout. The EN-only bge-small will under-retrieve on Polish prose, so test a
  multilingual model early.
- **Optional local upgrade:** Ollama (`nomic-embed-text`, `mxbai-embed-large 64.68`,
  `qwen3-embedding`) for higher quality if the user already runs Ollama. (Ollama can't
  be a *bundled* default — it requires a separate install — but its `/v1/embeddings`
  endpoint is OpenAI-compatible, so it slots into the same provider abstraction.)
- **Optional cloud upgrade:** OpenAI `text-embedding-3-small` (~$0.02/M, $0.01 batch),
  or Jina v3 (~$0.02/M, multilingual, highest MTEB). Avoid Cohere (512-token cap).
- **DeepSeek note (confirmed):** DeepSeek's API is chat-only; it offers **no**
  embeddings endpoint (the `/models` list shows only `deepseek-v4-flash`/`-pro`, and
  three feature requests were closed as not-planned). So the generation provider
  (DeepSeek) and the embedding provider are necessarily separate — design two
  independent provider slots from the start.
- **Hard constraint:** the *same* embedding model must be used for indexing and
  querying. Switching models = full reindex. Store the model id/version in the index
  and trigger reindex on change.

---

## 5. "Giving it to your agent": the integration surface = MCP server

The cleanest answer to "I'd give this to my agent" is to expose the KB as an **MCP
server**. Any MCP-speaking client (the user's own agent, Claude, Cursor, ChatGPT,
VS Code) connects with no bespoke API. It also cleanly separates the app (authoring +
rendering) from consumption (agent reads), so you're not locked to one agent
framework. There is abundant prior art to copy:

| Project | Stack | Retrieval | Why it matters here |
|---------|-------|-----------|----------------------|
| **basic-memory** ⭐ | Python, SQLite + sqlite-vec + FastEmbed (bge-small), MCP (FastMCP) | hybrid FTS + vector + wikilink graph | Closest blueprint: plain `.md` as source of truth, observations/typed relations, MCP tools (`write_note`, `read_note`, `search_notes`, `build_context`, …). Read its design before building. |
| **mcp-local-rag** ⭐ | **TypeScript**, LanceDB, Transformers.js (all-MiniLM) | hybrid vector + keyword | All-local, zero server; has `read_chunk_neighbors` (expand context around a hit) and `query_documents`. Most directly reusable for a TS/Electron app. |
| **qmd** | TS/Node, sqlite-vec + FTS5, node-llama-cpp | BM25 + vector + LLM rerank, fully local | Reference for a sophisticated all-local pipeline (embeddings + reranker + query expansion, no API). |
| **cyanheads/obsidian-mcp-server** | TS, via Obsidian REST API | text/JSONLogic/BM25 | Most feature-complete tool surface (14 tools): get/list/search/patch/frontmatter/tags. Good API design reference. |
| **knowledge-base-mcp-server** | TS/Node | hybrid FAISS+BM25+rerank, multi-KB | Reference for hybrid + reranking + multi-KB. |

Recommended tool surface to expose: `search_notes(query, filters)` (hybrid +
rerank), `get_note(id)`, `read_chunk_neighbors(chunk_id)`, `list_notes`,
`list_links/build_context(note)` (graph traversal). Add MCP behavior hints
(`readOnlyHint`, `destructiveHint`) as basic-memory does.

(Alternative/inferior surfaces: a local REST API, or exporting a static corpus —
both reinvent what MCP standardizes.)

### Don't over-engineer: the "LLM-wiki" / direct-filesystem option

A genuinely important counterpoint from the research (Karpathy's "LLM wiki" pattern):
for a *personal-scale* vault (up to a few hundred pages / ~50–100k tokens), letting the
agent **read the markdown files directly** — plain filesystem access + `ripgrep`
keyword search, no embeddings, no vector DB — often *outperforms* RAG and needs zero
infrastructure. The retrieval flakiness of RAG (missing the right chunk) simply
disappears when the agent can list and read whole notes. The cost is a hard ceiling
(context window) and no semantic ranking.

Implication for sequencing: because the notes are canonical `.md` files anyway, the
**cheapest first version of "give it to my agent" is just filesystem MCP + ripgrep over
the vault.** Add the embedded vector index / hybrid retrieval only once the vault
outgrows what fits comfortably in context (or when semantic recall over Polish prose
clearly beats keyword search). This lets you defer the entire index/embedding stack
until it earns its place — while the `caption`-on-viz rule (§1) is the one thing still
worth doing from day one regardless, since it makes the raw files agent-legible.

---

## 6. Knowledge-graph layer: worth it? — Not at first.

Honest cost/benefit from the research for a *personal* KB (hundreds–few thousand
notes):

- **Plain vector RAG wins on single-hop / factual queries** ("what did I write about
  X?") — which are the majority of personal-KB queries. GraphRAG only wins on
  **multi-hop** questions ("connect what I learned from A with project B"), and even
  then modestly (e.g. HotpotQA 64.6% vs 63.9%); plain RAG actually beats GraphRAG on
  single-hop NQ (68.2% vs 65.4%). (arXiv 2502.11371)
- Microsoft GraphRAG's cost has fallen (~$1–5 to index ~1k notes with GPT-4o-mini in
  2025, down from absurd 2024 numbers) but setup is heavy and indexing is ~40× slower
  than vector RAG; entity-graph completeness is itself a quality risk.
- **You get a cheap graph for free anyway:** Obsidian-style `[[wikilinks]]` /
  backlinks give you a usable entity/relation graph at zero LLM cost — this is exactly
  what basic-memory does (typed relations + observations parsed from markdown).

**Recommendation:** ship **hybrid (vector + BM25) + reranking + Contextual Retrieval**
first; add a **cheap wikilink/backlink graph** for `build_context`-style traversal.
Only if you find recurring multi-hop needs, add a real graph layer — and prefer
**LightRAG** (HKUDS, EMNLP 2025, 36.7k★, incremental updates, works with local
models, no expensive community-summary step) over Microsoft GraphRAG. Microsoft
GraphRAG / LlamaIndex PropertyGraph are overkill for a single-user vault.

---

## 7. Cross-cutting lessons from prior art (and one warning)

- **Reor** — local AI markdown notes on **exactly the candidate stack** (Electron +
  LanceDB + Transformers.js) — was **archived in March 2026** after ~14 months. The
  lesson repeated across the field: a cross-platform Electron app with embedded ML is
  *hard to sustain solo*. A lighter shape (CLI/library + MCP server, like
  basic-memory; or web app + optional local model, like Khoj) is more durable.
- **Plain markdown as source of truth** (basic-memory, Khoj-Obsidian) avoids lock-in
  and lets human + agent co-edit the same files. Keep the `.md` files canonical and
  the index derived/disposable (rebuildable).
- **Active (agent-controlled) memory > passive RAG injection** (Letta/MemGPT): exposing
  search/read as explicit MCP tool calls the agent decides to invoke is more
  debuggable and controllable than silently stuffing context.
- **Extract-then-store beats store-raw** for memory quality (Mem0, Cognee): an LLM
  pass that distills facts/observations produces a cleaner KB than dumping raw chunks.
  This dovetails with the `caption` idea — the app is already doing LLM distillation at
  authoring time.
- **Pluggable backends, sensible local defaults** (Cognee, Mem0): default to
  zero-setup local (sqlite-vec + Transformers.js), allow upgrading to
  Postgres/Ollama/cloud embeddings.

---

## 8. Updated recommendation (knowledge-base layer)

```
Source of truth:   plain .md files (canonical); ```viz blocks carry an LLM `caption`
Index (derived):   sqlite-vec inside the app's SQLite db  (Orama if going pure-JS)
Embeddings:        Transformers.js bge-small (or multilingual variant for PL),
                   in-process/offline; optional Ollama / OpenAI text-embedding-3-small
Chunking:          markdown header-aware → size cap; viz→caption, code atomic+summary,
                   table→description; metadata = header path + content_type
Retrieval:         hybrid (vector + BM25) + RRF + cross-encoder rerank
                   + Contextual Retrieval (prepended chunk context)
Graph:             cheap wikilink/backlink graph now; LightRAG later only if multi-hop
Agent surface:     MCP server (search_notes, get_note, read_chunk_neighbors,
                   build_context, list_notes) — model on basic-memory + mcp-local-rag
```

**Design-in-from-day-one items** (retrofitting these later means a reindex / format
change): the `caption` field in the viz envelope, the separation of generation vs
embedding provider, the markdown-as-source-of-truth + disposable-index split, and
storing the embedding-model id in the index.

### Suggested phasing (cheap → only-as-needed)

The research points to a clear sequence that avoids building infrastructure before it
earns its place:

- **Phase 0 — filesystem MCP + ripgrep.** Expose the `.md` folder to the agent with
  read + keyword search, no embeddings. For a few-hundred-note vault this often beats
  RAG (the LLM-wiki pattern) and is near-zero effort. Only hard requirement carried
  forward: the `caption`-on-viz rule, so the raw files are agent-legible.
- **Phase 1 — hybrid retrieval.** Add the embedded index (sqlite-vec/Orama),
  multilingual embeddings, BM25 + vector fused with RRF, and a cross-encoder reranker.
  Reference architecture: **Obsidian Copilot's three-retriever fanout** (BM25 +
  lexical + semantic, fused) — the most mature open implementation. Expose via MCP
  (`search_notes`, `get_note`, `read_chunk_neighbors`).
- **Phase 1b (cheap, concurrent) — wikilinks as the graph.** On note save, one
  background LLM call extracts typed observations + `[[wikilinks]]` into the markdown
  itself (the basic-memory pattern); expose a `build_context` MCP tool that traverses
  those links. This is "the graph" — stored in the files, git-versioned, no graph DB,
  and it pre-synthesizes relationships at ingest so multi-hop queries are cheap.
- **Phase 2 — real graph, only if needed.** When the vault exceeds ~3–5k notes *and*
  multi-hop queries visibly fail, evaluate **LightRAG** (MIT, ~$0.50/500 pages, local
  models OK). Skip Microsoft GraphRAG (enterprise-scale cost/complexity) and Cognee
  (whole-platform overhead) for a single-user app.

Supporting numbers: on the "when to use graphs" benchmark (arXiv 2506.05690), plain
vector wins single-hop fact retrieval (~83% recall) while graph wins multi-hop /
summarization (~88–91%); per-query token cost ranges from ~880 (vanilla RAG) to
~100k (LightRAG) to ~331k (MS-GraphRAG global) — i.e. the graph is not free at query
time either, which is another reason to defer it.

## Key links

- Anthropic Contextual Retrieval: https://www.anthropic.com/news/contextual-retrieval
- Multimodal RAG (caption-then-embed): https://developer.nvidia.com/blog/an-easy-introduction-to-multimodal-retrieval-augmented-generation/ · https://www.datacamp.com/tutorial/multimodal-rag
- Meta-RAG (summaries instead of raw code): https://arxiv.org/html/2508.02611v1
- T2-RAGBench (table failure modes, rerank gains): https://arxiv.org/html/2604.01733v1
- basic-memory (markdown→KB→MCP blueprint): https://github.com/basicmachines-co/basic-memory
- mcp-local-rag (TS/LanceDB/Transformers.js): https://github.com/shinpr/mcp-local-rag
- qmd (all-local TS pipeline): https://github.com/tobi/qmd
- cyanheads/obsidian-mcp-server (tool surface ref): https://github.com/cyanheads/obsidian-mcp-server
- knowledge-base-mcp-server (hybrid+rerank+multi-KB): https://github.com/jeanibarz/knowledge-base-mcp-server
- Orama: https://github.com/oramasearch/orama · sqlite-vec: https://github.com/asg017/sqlite-vec · `@photostructure/sqlite-vec` (Electron): https://github.com/photostructure/sqlite-vec
- LanceDB: https://github.com/lancedb/lancedb · PGlite: https://github.com/electric-sql/pglite
- Reor (archived — cautionary): https://github.com/reorproject/reor
- Khoj: https://github.com/khoj-ai/khoj · Mem0: https://github.com/mem0ai/mem0 · Cognee: https://github.com/topoteretes/cognee · Letta/MemGPT: https://github.com/cpacker/MemGPT · Smart Connections: https://github.com/brianpetro/obsidian-smart-connections
- RAG vs GraphRAG systematic eval: https://arxiv.org/html/2502.11371v2 · LightRAG: https://github.com/HKUDS/LightRAG
- LangChain MarkdownHeaderTextSplitter: https://docs.langchain.com/oss/python/integrations/splitters/markdown_header_metadata_splitter · llama-index MarkdownNodeParser: https://developers.llamaindex.ai/python/framework-api-reference/node_parsers/markdown/
