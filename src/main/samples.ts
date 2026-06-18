import { serializeVizSpec, VIZ_FENCE_LANG, type VizSpec } from '../shared/viz'

function note(prose: string, specs: VizSpec[]): string {
  // Prose may contain a {{viz:N}} placeholder; otherwise specs are appended.
  let body = prose
  specs.forEach((spec, i) => {
    const fence = '```' + VIZ_FENCE_LANG + '\n' + serializeVizSpec(spec) + '\n```'
    const placeholder = `{{viz:${i}}}`
    if (body.includes(placeholder)) {
      body = body.replace(placeholder, fence)
    } else {
      body += '\n\n' + fence
    }
  })
  return body
}

const intermodSpec: VizSpec = {
  engine: 'html',
  title: 'Produkty intermodulacji w odbiorniku',
  caption:
    'Dwa silne sygnały nadawcze f1 i f2 (pasmo TX) generują w nieliniowym torze produkty intermodulacji nieparzystego rzędu: IM3 = 2·f1 − f2, IM5 = 3·f1 − 2·f2, IM7 = 4·f1 − 3·f2. Wraz ze wzrostem rzędu produkty przesuwają się w dół, wpadając w pasmo odbiorcze (RX). Suwaki sterują częstotliwościami f1 i f2 i pokazują, jak przesuwają się prążki zakłócające.',
  params: { f1: 1837, f2: 1880 },
  code: `<style>
  .imd { font: 13px system-ui, sans-serif; color: #e8e8ea; }
  .imd canvas { width: 100%; height: 260px; display: block; }
  .imd .ctrl { display: grid; grid-template-columns: 2em 1fr 6em; gap: 10px; align-items: center; margin-top: 8px; }
  .imd input[type=range] { width: 100%; }
  .imd .val { text-align: right; font-variant-numeric: tabular-nums; color: #b9b3ff; }
</style>
<div class="imd">
  <canvas id="c" width="900" height="260"></canvas>
  <div class="ctrl"><label>f₁</label><input id="f1" type="range" min="1805" max="1880" value="1837"><span class="val"><span id="f1v">1837</span> MHz</span></div>
  <div class="ctrl"><label>f₂</label><input id="f2" type="range" min="1805" max="1880" value="1880"><span class="val"><span id="f2v">1880</span> MHz</span></div>
</div>
<script>
  const cv = document.getElementById('c'), ctx = cv.getContext('2d');
  const F1 = document.getElementById('f1'), F2 = document.getElementById('f2');
  const FMIN = 1700, FMAX = 1920;
  const RX = [1710, 1785], TX = [1805, 1880];
  function x(f, w){ return ((f - FMIN) / (FMAX - FMIN)) * (w - 40) + 20; }
  function draw(){
    const w = cv.width, h = cv.height, base = h - 36;
    ctx.clearRect(0,0,w,h);
    // bands
    ctx.fillStyle = 'rgba(80,130,255,0.18)';
    ctx.fillRect(x(RX[0],w), base-150, x(RX[1],w)-x(RX[0],w), 150);
    ctx.fillStyle = 'rgba(160,160,160,0.18)';
    ctx.fillRect(x(TX[0],w), base-150, x(TX[1],w)-x(TX[0],w), 150);
    ctx.fillStyle = '#9aa0a6';
    ctx.fillText('pasmo RX (uplink)', x((RX[0]+RX[1])/2,w)-50, base+22);
    ctx.fillText('pasmo TX (downlink)', x((TX[0]+TX[1])/2,w)-55, base+22);
    // axis
    ctx.strokeStyle = '#666'; ctx.beginPath(); ctx.moveTo(15, base); ctx.lineTo(w-10, base); ctx.stroke();
    const f1 = +F1.value, f2 = +F2.value;
    // IM products (odd order), amplitude decreasing with order
    const prods = [
      { f: 2*f1 - f2,   label: 'IM3', a: 110 },
      { f: 3*f1 - 2*f2, label: 'IM5', a: 78  },
      { f: 4*f1 - 3*f2, label: 'IM7', a: 52  }
    ];
    for (const p of prods){
      if (p.f < FMIN || p.f > FMAX) continue;
      const px = x(p.f, w);
      const grad = ctx.createLinearGradient(0, base-p.a, 0, base);
      grad.addColorStop(0, 'rgba(230,120,60,0.85)'); grad.addColorStop(1, 'rgba(230,120,60,0.05)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(px-26, base);
      ctx.quadraticCurveTo(px, base-p.a*1.4, px+26, base); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8e8ea'; ctx.fillText(p.label, px-9, base-p.a-6);
    }
    // carriers
    for (const [f,lab] of [[f1,'f₁'],[f2,'f₂']]){
      const px = x(f, w);
      ctx.fillStyle = '#8a7dff'; ctx.fillRect(px-5, base-150, 10, 150);
      ctx.fillStyle = '#cfc9ff'; ctx.fillText(lab, px-6, base-156);
    }
  }
  function sync(){ document.getElementById('f1v').textContent=F1.value; document.getElementById('f2v').textContent=F2.value; draw(); }
  F1.addEventListener('input', sync); F2.addEventListener('input', sync);
  draw();
</script>`
}

const p5Spec: VizSpec = {
  engine: 'p5',
  title: 'Interferencja dwóch fal',
  caption:
    'Dwie fale sinusoidalne nakładają się na siebie; suwak steruje różnicą ich częstotliwości, pokazując powstawanie dudnień (beat). Górne dwie krzywe to fale składowe, dolna to ich suma.',
  params: { delta: 6 },
  code: `let s;
function setup(){ createCanvas(680, 240); s = createSlider(0, 20, 6, 1); s.position(10, height+8); colorMode(RGB); noFill(); }
function draw(){
  background(20);
  const t = frameCount * 0.03, d = s.value();
  const f1 = 0.06, f2 = 0.06 + d*0.004;
  stroke(120,160,255); beginShape();
  for (let x=0;x<width;x++) vertex(x, 50 + 22*sin(x*f1 + t)); endShape();
  stroke(255,150,90); beginShape();
  for (let x=0;x<width;x++) vertex(x, 110 + 22*sin(x*f2 + t)); endShape();
  stroke(180,255,180); strokeWeight(1.6); beginShape();
  for (let x=0;x<width;x++) vertex(x, 190 + 30*(sin(x*f1 + t)+sin(x*f2 + t))/2); endShape();
  strokeWeight(1); noStroke(); fill(200); text('różnica częstotliwości: ' + d, 12, height-2);
}`
}

const mermaidSpec: VizSpec = {
  engine: 'mermaid',
  title: 'Pipeline generowania wizualizacji',
  caption:
    'Schemat przepływu: prompt użytkownika trafia do DeepSeek, który zwraca specyfikację viz (JSON), zapisywaną w notatce jako blok ```viz i renderowaną w piaskownicy.',
  code: `flowchart LR
  U[Prompt] --> L[DeepSeek]
  L --> S["VizSpec (JSON)"]
  S --> N["Notatka .md (blok viz)"]
  N --> R[Render w sandboxie iframe]
  R --> V[Interaktywna wizualizacja]`
}

export const sampleNotes: { id: string; content: string }[] = [
  {
    id: 'witaj.md',
    content: note(
      `# Witaj w NoteVis

To notatki w **Markdown** z **interaktywnymi wizualizacjami** osadzonymi bezpośrednio
w treści — bez widocznych ramek, jak naturalna część dokumentu.

Każda wizualizacja to zwykły blok \`\`\`viz (JSON) w pliku \`.md\`, więc notatka pozostaje
przenośna. Poniżej prosty przykład — przesuń suwak:

{{viz:0}}

Edytuj źródło po lewej, podgląd po prawej aktualizuje się na żywo. Naciśnij
**Generuj wizualizację**, aby poprosić model o nową (wymaga klucza DeepSeek).`,
      [p5Spec]
    )
  },
  {
    id: 'intermodulacja.md',
    content: note(
      `# Intermodulacja w odbiorniku

Gdy dwa silne sygnały nadawcze trafiają do nieliniowego elementu toru odbiorczego,
powstają **produkty intermodulacji**. Te nieparzystego rzędu (IM3, IM5, IM7) leżą
blisko sygnałów oryginalnych i mogą wpaść w **pasmo odbiorcze (RX)**, zakłócając odbiór.

Przesuń \`f₁\` i \`f₂\`, aby zobaczyć, jak prążki zakłócające przesuwają się względem pasma RX:

{{viz:0}}

Produkt rzędu *n* powstaje jako kombinacja \`m·f₁ ± k·f₂\`. Im wyższy rząd, tym
słabszy, ale tym dalej sięga od nośnych.`,
      [intermodSpec]
    )
  },
  {
    id: 'jak-to-dziala.md',
    content: note(
      `# Jak to działa

Potok generowania i renderowania wizualizacji:

{{viz:0}}

Renderowanie odbywa się w **sandboxowanym \`<iframe srcdoc>\`** (\`sandbox="allow-scripts"\`,
CSP ograniczające sieć), a wysokość ramki dopasowuje się automatycznie przez
\`ResizeObserver\` + \`postMessage\` — stąd efekt „bez ramek".`,
      [mermaidSpec]
    )
  }
]
