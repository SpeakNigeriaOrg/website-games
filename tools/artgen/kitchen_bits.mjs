// The juice spill in the kitchen helper game, drawn in code (the picture model draws puddles as odd blobs): a puddle of
// spilled orange juice, to lie on the table. Same flat look as the generated sprites: solid colours, a dark outline. (A
// banana peel and a crumpled paper ball were tried here too and did not read; the paper ball is generated instead.)
// Writes art_candidates/kitchen/<name>.svg and .png (transparent, 768 x 512).
//   node tools/artgen/kitchen_bits.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const INK = '#3a2412';
const f = (n) => n.toFixed(1);

// a closed smooth blob through points around (cx, cy) at radii r(a), by Catmull-Rom turned into cubic Béziers
function blob(cx, cy, radii, sx = 1, sy = 1) {
  const pts = radii.map((r, i) => { const a = (i / radii.length) * Math.PI * 2; return [cx + Math.cos(a) * r * sx, cy + Math.sin(a) * r * sy]; });
  const n = pts.length; let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + ' Z';
}

function spill() {
  // flattened, as a puddle on a table top seen from the front and a little above
  const body = blob(384, 270, [210, 170, 230, 190, 160, 220, 180, 240, 200, 150], 1, 0.42);
  let o = `<path d="${body}" fill="#f7a21b" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>`;
  o += `<path d="${blob(330, 248, [70, 55, 80, 60, 50, 75], 1, 0.35)}" fill="#ffd36b"/>`;           // shine
  for (const [x, y, r] of [[640, 300, 22], [130, 232, 16], [600, 205, 12], [170, 318, 13]]) {
    o += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${f(r * 0.6)}" fill="#f7a21b" stroke="${INK}" stroke-width="7"/>`;   // drops
  }
  return o;
}

const out = path.resolve('dev/games/art_candidates/kitchen');
fs.mkdirSync(out, { recursive: true });
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
for (const [name, body] of [['spill', spill()]]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="512" viewBox="0 0 768 512">${body}</svg>`;
  fs.writeFileSync(path.join(out, `${name}.svg`), svg);
  const html = path.join(os.tmpdir(), `${name}.html`);
  fs.writeFileSync(html, `<body style="margin:0;background:transparent">${svg}</body>`);
  spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
    `--screenshot=${path.join(out, `${name}.png`)}`, '--window-size=768,512', `file:///${html}`], { stdio: 'ignore' });
  console.log('wrote', name);
}
