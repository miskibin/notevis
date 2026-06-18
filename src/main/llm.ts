import type { GenerateVizRequest, LlmStatus } from '../shared/api'
import { parseVizSpec, type VizSpec } from '../shared/viz'

/**
 * DeepSeek client. The API key lives only in the main process (never the renderer).
 * DeepSeek is OpenAI-compatible; note it has no embeddings endpoint, so this is
 * generation-only — the (future) retrieval layer uses a separate provider.
 */
const ENDPOINT = 'https://api.deepseek.com/chat/completions'
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'

function apiKey(): string | undefined {
  return process.env.DEEPSEEK_API_KEY?.trim() || undefined
}

export function llmStatus(): LlmStatus {
  return { configured: Boolean(apiKey()), model: DEFAULT_MODEL }
}

const SYSTEM_PROMPT = `You generate ONE interactive visualization to embed inline in a markdown note.

Respond with a SINGLE JSON object, no markdown fences, matching exactly:
{
  "engine": "html" | "p5" | "mermaid" | "vega-lite",
  "title": string,            // short title
  "caption": string,          // 1-3 sentence natural-language description of what the
                              // visualization shows and how to interact with it. Write it
                              // in the SAME LANGUAGE as the user's request. This is indexed
                              // for search and shown if rendering fails, so make it self-contained.
  "code": string,             // the renderable payload (see rules)
  "params": object            // optional initial values, e.g. {"f1": 1837}
}

Engine rules for "code":
- "html": a self-contained HTML body fragment. You MAY include <style> and <script>.
  For interactivity use plain DOM + <input type="range"> sliders wired with JS.
  External libraries are ONLY allowed from https://cdnjs.cloudflare.com . No network calls.
- "p5": a p5.js global-mode sketch defining setup() and draw(). Do NOT include <script> tags;
  p5 is injected for you. Use createCanvas; createSlider for interactivity.
- "mermaid": raw Mermaid diagram source (no fences).
- "vega-lite": a JSON string containing a valid Vega-Lite spec. Prefer "params" with
  {"bind": {"input": "range", ...}} for interactive sliders.

Prefer "html" or "p5" for physics/engineering/animated/slider-driven visualizations.
Prefer "vega-lite" for data charts, "mermaid" for flow/structure diagrams.
Keep it dependency-light and make sliders actually update the drawing.
Output ONLY the JSON object.`

function extractJsonObject(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced ? fenced[1] : trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('model response did not contain a JSON object')
  }
  return body.slice(start, end + 1)
}

export async function generateViz(req: GenerateVizRequest): Promise<VizSpec> {
  const key = apiKey()
  if (!key) {
    throw new Error('DEEPSEEK_API_KEY is not set in the app environment.')
  }
  const userContent = req.engine
    ? `${req.prompt}\n\n(Preferred engine: ${req.engine}.)`
    : req.prompt

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      stream: false
    })
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`DeepSeek error ${res.status}: ${detail.slice(0, 500)}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('DeepSeek returned an empty response')
  }
  // Validate/normalize against our schema (throws a readable error if malformed).
  return parseVizSpec(extractJsonObject(content))
}
