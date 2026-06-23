import type { VizSpec } from '@shared/viz'

/**
 * Build the full HTML document loaded into a sandboxed <iframe srcdoc>.
 *
 * Security model (mirrors how Claude renders inline visualizations):
 * - the iframe uses sandbox="allow-scripts" WITHOUT allow-same-origin => null origin,
 *   so the viz cannot touch the host page, cookies, or localStorage.
 * - a CSP <meta> restricts subresources to cdnjs only and blocks all network
 *   connections (connect-src 'none'), so a generated viz can't phone home.
 * - inline script/style are allowed because the generated viz is inline; that is safe
 *   given the origin isolation above (the viz can only harm itself).
 *
 * The injected resize script reports content height to the host via postMessage so the
 * iframe can be auto-sized with no scrollbar or border — the "borderless" effect.
 */

const CDN = 'https://cdnjs.cloudflare.com'

// Pinned cdnjs library URLs (only used by their respective engines).
const LIB = {
  p5: `${CDN}/ajax/libs/p5.js/1.11.1/p5.min.js`,
  mermaid: `${CDN}/ajax/libs/mermaid/11.4.1/mermaid.min.js`,
  vega: `${CDN}/ajax/libs/vega/5.30.0/vega.min.js`,
  vegaLite: `${CDN}/ajax/libs/vega-lite/5.21.0/vega-lite.min.js`,
  vegaEmbed: `${CDN}/ajax/libs/vega-embed/6.26.0/vega-embed.min.js`
}

const RESIZE_SCRIPT = `<script>
  (function () {
    function h() {
      var b = document.body, e = document.documentElement;
      return Math.max(b.scrollHeight, b.offsetHeight, e.scrollHeight, e.offsetHeight);
    }
    var last = 0;
    function report() {
      var v = h();
      if (v !== last) { last = v; parent.postMessage({ type: 'notevis:resize', height: v }, '*'); }
    }
    new ResizeObserver(report).observe(document.documentElement);
    window.addEventListener('load', report);
    setInterval(report, 500);
    report();
  })();
</script>`

function csp(): string {
  const policy = [
    `default-src 'none'`,
    `script-src 'unsafe-inline' ${CDN}`,
    `style-src 'unsafe-inline' ${CDN}`,
    `img-src data: blob:`,
    `font-src ${CDN} data:`,
    `connect-src 'none'`
  ].join('; ')
  return `<meta http-equiv="Content-Security-Policy" content="${policy}">`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * For CDN-backed engines, degrade gracefully: if nothing renders within a few
 * seconds (e.g. cdnjs unreachable offline), reveal the caption instead of a
 * blank frame — the caption is the indexed NL description, so it's a meaningful
 * fallback.
 */
function fallback(spec: VizSpec): string {
  const msg = spec.caption || 'Nie udało się załadować wizualizacji (brak połączenia z CDN).'
  return `<div id="nv-fb" style="display:none;color:#9aa0a6;font-size:13px;line-height:1.5"></div>
<script>
(function () {
  var fb = document.getElementById('nv-fb');
  fb.textContent = ${JSON.stringify(msg)};
  setTimeout(function () { if (!document.querySelector('canvas, svg')) fb.style.display = 'block'; }, 2800);
})();
</script>`
}

function body(spec: VizSpec): string {
  switch (spec.engine) {
    case 'html':
      return spec.code

    case 'p5':
      return `<main id="p5-host"></main>
<script src="${LIB.p5}"></script>
<script>
try { ${spec.code} } catch (e) {
  var fb = document.getElementById('nv-fb'); if (fb) fb.style.display = 'block';
}
</script>
${fallback(spec)}`

    case 'mermaid':
      return `<pre class="mermaid">${escapeHtml(spec.code)}</pre>
<script src="${LIB.mermaid}"></script>
<script>
try { mermaid.initialize({ startOnLoad: true, theme: 'dark' }); } catch (e) {
  var fb = document.getElementById('nv-fb'); if (fb) fb.style.display = 'block';
}
</script>
${fallback(spec)}`

    case 'vega-lite':
      return `<div id="vega-host"></div>
<script src="${LIB.vega}"></script>
<script src="${LIB.vegaLite}"></script>
<script src="${LIB.vegaEmbed}"></script>
<script>
try {
  var spec = JSON.parse(${JSON.stringify(spec.code)});
  vegaEmbed('#vega-host', spec, { actions: false, theme: 'dark' });
} catch (e) {
  var fb = document.getElementById('nv-fb'); if (fb) fb.style.display = 'block';
}
</script>
${fallback(spec)}`

    default:
      return `<pre class="viz-error">unknown engine</pre>`
  }
}

export function buildSrcDoc(spec: VizSpec): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
${csp()}
<style>
  html, body { margin: 0; padding: 0; background: transparent; color: #e8e8ea;
    font: 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif; overflow: hidden; }
  body { padding: 4px; box-sizing: border-box; }
  .viz-error { color: #ff8a8a; white-space: pre-wrap; font-size: 12px; }
  .mermaid { display: flex; justify-content: center; }
</style>
</head>
<body>
${body(spec)}
${RESIZE_SCRIPT}
</body>
</html>`
}
