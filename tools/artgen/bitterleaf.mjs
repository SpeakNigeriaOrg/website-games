// Ewúro (bitterleaf, Vernonia amygdalina) drawn in code, as clip art closer to the real plant than the picture model
// managed: a bunch of long, narrow, pointed, finely toothed dark leaves on upright stems (right), and a bunch of
// broader, coarsely toothed, puckered leaves with pale veins on long pale stems (left), as bitterleaf is sold.
// Writes art_candidates/bitterleaf/bitterleaf.svg (and .png with --png).
//   node tools/artgen/bitterleaf.mjs --png
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const f = (n) => n.toFixed(1);

/** A leaf as an outline path along its own axis (base at 0,0, tip at 0,-L), then rotated and placed.
 * w(t): half-width at t (0 base .. 1 tip); teeth: count per side; depth: tooth size. */
function leaf({ x, y, angle, L, W, teeth, depth, fill, edge, vein, veins = 7, pucker = 0, shape, gloss = false, palmate = false }) {
  const half = shape || ((t) => W * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.85) * (1 - 0.25 * t));
  const N = teeth * 2;
  const side = (s) => {
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const tooth = i % 2 === 1 && t > 0.08 && t < 0.96 ? depth * (1 - 0.5 * t) : 0;
      // teeth point forward: the outer point sits a little towards the tip
      pts.push([s * (half(t) + tooth), -L * (t + (tooth ? 0.012 : 0))]);
    }
    return pts;
  };
  const right = side(1), left = side(-1).reverse();
  const outline = [...right, ...left];
  const d = 'M0 0 ' + outline.map(([px, py]) => `L${f(px)} ${f(py)}`).join(' ') + ' Z';
  let veinsSvg = `<path d="M0 ${f(L * 0.06)} L0 ${f(-L * 0.97)}" stroke="${vein}" stroke-width="${f(W * 0.07)}" fill="none" stroke-linecap="round"/>`;
  for (let k = 1; k <= veins; k++) {
    const t = k / (veins + 1);
    for (const s of [1, -1]) {
      const w = half(t) * 0.88;
      veinsSvg += `<path d="M0 ${f(-L * t)} Q${f(s * w * 0.5)} ${f(-L * t - L * 0.03)} ${f(s * w)} ${f(-L * (t + 0.08))}" stroke="${vein}" stroke-width="${f(W * 0.035)}" fill="none" stroke-linecap="round"/>`;
    }
  }
  // palmate: two more main veins spreading from the base into the lower lobes
  if (palmate) for (const s of [1, -1]) veinsSvg += `<path d="M0 0 Q${f(s * half(0.2) * 0.5)} ${f(-L * 0.12)} ${f(s * half(0.3) * 0.95)} ${f(-L * 0.34)}" stroke="${vein}" stroke-width="${f(W * 0.05)}" fill="none" stroke-linecap="round"/>`;
  // gloss: a pale highlight along one side of the midrib
  const shine = gloss ? `<path d="M${f(-W * 0.35)} ${f(-L * 0.25)} Q${f(-W * 0.45)} ${f(-L * 0.5)} ${f(-W * 0.2)} ${f(-L * 0.75)}" stroke="#fff" stroke-width="${f(W * 0.12)}" fill="none" opacity=".18" stroke-linecap="round"/>` : '';
  // puckered surface: a few short pale crinkle marks between the veins
  let crinkle = '';
  for (let k = 0; k < pucker; k++) {
    const t = 0.15 + 0.75 * rnd(), s = rnd() < 0.5 ? 1 : -1, w = half(t) * (0.3 + 0.5 * rnd());
    crinkle += `<path d="M${f(s * w)} ${f(-L * t)} q${f(s * W * 0.08)} ${f(-L * 0.02)} ${f(s * W * 0.16)} 0" stroke="${vein}" stroke-width="${f(W * 0.02)}" fill="none" opacity=".55"/>`;
  }
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})"><path d="${d}" fill="${fill}" stroke="${edge}" stroke-width="${f(Math.max(1.6, W * 0.05))}" stroke-linejoin="round"/>${crinkle}${veinsSvg}${shine}</g>`;
}

const stem = (x1, y1, x2, y2, bend, color, w) =>
  `<path d="M${f(x1)} ${f(y1)} Q${f((x1 + x2) / 2 + bend)} ${f((y1 + y2) / 2)} ${f(x2)} ${f(y2)}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;

// Right bunch: narrow lance-shaped leaves, finely toothed, glossy dark green, packed on a tall, tight bundle of
// upright stems (taller than wide, most leaves pointing up)
// widest a third of the way up, tapering to a long sharp point
const lance = (W) => (t) => W * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.75) * (1 - 0.6 * t);

function narrowBunch(cx, base) {
  const layers = [[], [], []]; // back to front
  let stems = '';
  const n = 44;
  for (let i = 0; i < n; i++) {
    const spread = (rnd() - 0.5) * 2;                     // -1 .. 1 across the bunch
    const a = spread * 24 + (rnd() - 0.5) * 6;            // a narrow fan: mostly upward
    const reach = 150 + rnd() * 250 * (1 - 0.35 * Math.abs(spread));
    const rad = (a * Math.PI) / 180;
    const sx = cx + spread * 10, ex = cx + Math.sin(rad) * reach, ey = base - Math.cos(rad) * reach;
    stems += stem(sx, base, ex, ey, spread * 8, i % 2 ? '#4a7a2a' : '#557f2f', 3);
    const L = 80 + rnd() * 50, W = 13 + rnd() * 6;
    const fill = ['#2a5f22', '#2f6b26', '#367a2c'][i % 3];
    const layer = layers[Math.floor(rnd() * 3)];
    layer.push(leaf({ x: ex, y: ey + L * 0.1, angle: a * 1.3 + (rnd() - 0.5) * 18, L, W, teeth: 18, depth: 2.4, fill, edge: '#173a13', vein: '#6c9c46', veins: 9, gloss: true, shape: lance(W) }));
    // leaves along the stem, angled upward
    for (const t of [0.45, 0.7]) {
      if (rnd() < 0.7) {
        const px = sx + (ex - sx) * t, py = base + (ey - base) * t, s = rnd() < 0.5 ? 1 : -1;
        layers[0].push(leaf({ x: px, y: py, angle: a + s * (22 + rnd() * 18), L: L * 0.75, W: W * 0.85, teeth: 15, depth: 2.1, fill: '#2c6424', edge: '#173a13', vein: '#6c9c46', veins: 7, gloss: true, shape: lance(W * 0.85) }));
      }
    }
  }
  return stems + layers.flat().join('');
}

// Left bunch: broad, lobed, coarsely toothed leaves with a puckered surface and pale veins spreading from the base,
// overlapping in a dense pile, on thick pale stems gathered together and looping below
function broadBunch(cx, base) {
  const shape = (W) => (t) => {
    const body = W * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.9) * (1 - 0.45 * t);
    const lobe = (c, h) => W * h * Math.pow(Math.max(0, 1 - Math.abs(t - c) / 0.09), 2);
    return body + lobe(0.3, 0.42) + lobe(0.54, 0.28);
  };
  let stems = '', leaves = '';
  const n = 14;
  const items = [];
  for (let i = 0; i < n; i++) {
    const spread = (i / (n - 1) - 0.5) * 2;
    const a = spread * 36 + (rnd() - 0.5) * 12;
    const reach = 40 + rnd() * 80;                         // varied depth: a pile, not a single row
    const rad = (a * Math.PI) / 180;
    items.push({ a, ex: cx + Math.sin(rad) * reach * 1.1, ey: base + 10 - Math.cos(rad) * reach, depth: reach, spread });
  }
  // the bundle: thick pale stems running together, then looping below the leaves
  for (const it of items) stems += stem(cx + it.spread * 6, base + 40, it.ex, it.ey, it.spread * 30, '#a6c964', 7);
  // a few long stems hang below the bundle and loop loosely back on themselves, as in a bunch fresh from market
  for (const [dx, w, h, c] of [[-24, 62, 70, '#a6c964'], [6, 78, 88, '#94b955']]) {
    const x = cx + dx, y = base + 40;
    stems += `<path d="M${x} ${y} C ${x - w * 0.4} ${y + h}, ${x + w} ${y + h}, ${x + w * 0.55} ${y + h * 0.35} S ${x + w * 0.1} ${y + h * 0.2}, ${x + w * 0.25} ${y + h * 0.5}" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  }
  // leaves further back (shorter reach) first, so nearer leaves overlap them
  for (const it of items.sort((p, q) => p.depth - q.depth)) {
    const W = 40 + rnd() * 10, L = 150 + rnd() * 40;
    const fill = ['#4f8f2e', '#5a9a35', '#468428'][Math.floor(rnd() * 3)];
    leaves += leaf({ x: it.ex, y: it.ey, angle: it.a, L, W, teeth: 24, depth: 6.5, fill, edge: '#24491a', vein: '#cbe6a0', veins: 6, pucker: 34, shape: shape(W), palmate: true });
  }
  return stems + leaves;
}

// square, as the games show pictures: the two bunches side by side, slightly overlapping
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="30 175 760 760"><rect x="30" y="175" width="760" height="760" fill="#fff"/>` +
  broadBunch(275, 660) + narrowBunch(585, 810) + `</svg>`;

const out = path.resolve('dev/games/art_candidates/bitterleaf');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'bitterleaf.svg'), svg);
if (process.argv.includes('--png')) {
  const html = path.join(os.tmpdir(), 'bitterleaf.html');
  fs.writeFileSync(html, `<body style="margin:0;background:#fff">${svg}</body>`);
  const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--screenshot=${path.join(out, 'bitterleaf.png')}`, '--window-size=1024,1024', `file:///${html}`], { stdio: 'ignore' });
}
console.log('wrote', out);
