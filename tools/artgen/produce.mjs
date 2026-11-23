// Market produce drawn in code, where the picture model keeps drawing a Western stand-in whatever the prompt says:
//   ata     - a market tray heaped with small wrinkled red scotch bonnets (ata rodo) and a few long red tatashe,
//             not sweet bell peppers;
//   plantain - a hand of long, thick, angular green plantains with dark tips, a ripe black-spotted one and fried dodo
//             slices, with no yellow banana beside them.
// Writes art_candidates/produce/<name>.svg and .png (1024 x 1024).
//   node tools/artgen/produce.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const f = (n) => n.toFixed(1);
const INK = '#3a2412';

// a scotch bonnet: squat and wider than tall, smooth glossy skin, a dimpled top where a short stem sits, and three
// rounded bumps underneath (the "bonnet")
function bonnet(x, y, s, rot, color) {
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    let ry = sn > 0 ? 0.62 + 0.14 * Math.pow(Math.abs(Math.sin(a * 3)), 0.6) : 0.5;   // bumps below, flat shoulders above
    if (sn < 0 && Math.abs(c) < 0.25) ry -= 0.1 * (1 - Math.abs(c) / 0.25);           // the dimple at the stem
    pts.push([x + s * 0.62 * c, y + s * ry * sn]);
  }
  const d = "M" + pts.map(([px, py]) => f(px) + " " + f(py)).join(" L") + " Z";
  return `<g transform="rotate(${f(rot)} ${f(x)} ${f(y)})"><path d="${d}" fill="${color}" stroke="${INK}" stroke-width="${f(s * 0.07)}" stroke-linejoin="round"/>` +
    `<path d="M${f(x - s * 0.18)} ${f(y + s * 0.15)} Q${f(x - s * 0.1)} ${f(y + s * 0.45)} ${f(x - s * 0.05)} ${f(y + s * 0.6)} M${f(x + s * 0.2)} ${f(y + s * 0.15)} Q${f(x + s * 0.14)} ${f(y + s * 0.45)} ${f(x + s * 0.1)} ${f(y + s * 0.6)}" stroke="#00000033" stroke-width="${f(s * 0.05)}" fill="none"/>` +
    `<ellipse cx="${f(x - s * 0.28)}" cy="${f(y - s * 0.18)}" rx="${f(s * 0.16)}" ry="${f(s * 0.07)}" fill="#fff" opacity=".55" transform="rotate(-20 ${f(x - s * 0.28)} ${f(y - s * 0.18)})"/>` +
    `<path d="M${f(x - s * 0.13)} ${f(y - s * 0.4)} Q${f(x)} ${f(y - s * 0.5)} ${f(x + s * 0.13)} ${f(y - s * 0.4)} Z" fill="#3f7d24" stroke="${INK}" stroke-width="${f(s * 0.05)}"/>` +
    `<path d="M${f(x)} ${f(y - s * 0.46)} q${f(s * 0.04)} ${f(-s * 0.16)} ${f(s * 0.16)} ${f(-s * 0.2)}" stroke="#3f7d24" stroke-width="${f(s * 0.08)}" fill="none" stroke-linecap="round"/></g>`;
}

// a tatashe: a long, tapering, slightly curved red pepper
function tatashe(x, y, len, rot) {
  const w = len * 0.2;
  const d = `M0 0 C ${f(w)} ${f(len * 0.05)}, ${f(w * 1.05)} ${f(len * 0.5)}, ${f(w * 0.25)} ${f(len)} C ${f(-w * 0.2)} ${f(len * 0.9)}, ${f(-w * 0.9)} ${f(len * 0.5)}, ${f(-w * 0.85)} ${f(len * 0.1)} Z`;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><path d="${d}" fill="#d9261c" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>` +
    `<path d="M${f(-w * 0.45)} ${f(len * 0.2)} Q${f(-w * 0.55)} ${f(len * 0.5)} ${f(-w * 0.1)} ${f(len * 0.8)}" stroke="#fff" stroke-width="${f(w * 0.18)}" fill="none" opacity=".4" stroke-linecap="round"/>` +
    `<path d="M${f(-w * 0.7)} 0 Q0 ${f(-w * 0.45)} ${f(w * 0.75)} 0 Z" fill="#4c8a2a" stroke="${INK}" stroke-width="4"/><path d="M0 ${f(-w * 0.3)} q ${f(w * 0.2)} ${f(-w * 0.6)} ${f(w * 0.6)} ${f(-w * 0.75)}" stroke="#4c8a2a" stroke-width="${f(w * 0.28)}" fill="none" stroke-linecap="round"/></g>`;
}

function ata() {
  // a round woven tray (a market seller's), heaped with scotch bonnets, two tatashe lying across the front
  let out = `<ellipse cx="512" cy="660" rx="400" ry="150" fill="#c98b45" stroke="${INK}" stroke-width="8"/>` +
    `<ellipse cx="512" cy="645" rx="360" ry="122" fill="#e2a95c" stroke="${INK}" stroke-width="5"/>`;
  for (let k = 0; k < 9; k++) out += `<ellipse cx="512" cy="645" rx="${360 - k * 38}" ry="${122 - k * 13}" fill="none" stroke="#b97a37" stroke-width="3" opacity=".6"/>`;
  const peppers = [];
  for (let row = 0; row < 4; row++) {
    const n = 6 - row, y = 650 - row * 70, width = 600 - row * 120;
    for (let i = 0; i < n; i++) {
      const x = 512 - width / 2 + (i + 0.5) * (width / n) + (rnd() - 0.5) * 20;
      const col = rnd() < 0.15 ? "#f08a1c" : rnd() < 0.08 ? "#f2c218" : ["#e32b1c", "#d42416", "#ee3a20", "#c91f14"][Math.floor(rnd() * 4)];
      peppers.push(bonnet(x, y + (rnd() - 0.5) * 14, 118 + rnd() * 18, (rnd() - 0.5) * 40, col));
    }
  }
  out += peppers.join('');
  out += tatashe(250, 700, 230, -78) + tatashe(800, 690, 220, 75);
  return out;
}

// a plantain: long, thick and gently curved, both ends tapering (a blunt dark tip, a woody stalk), with a ridge
// along its length; drawn along a curved centre line with its width tapering towards each end
function plantain(x, y, len, rot, ripe = false) {
  const W = len * 0.085, bend = len * 0.16, N = 40;
  const centre = (t) => [len * t, -bend * 4 * t * (1 - t) - bend * 0.6 * t];
  const width = (t) => W * Math.pow(Math.sin(Math.PI * (0.06 + 0.88 * t)), 0.55);
  const up = [], down = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, [cx, cy] = centre(t), [nx, ny] = centre(Math.min(1, t + 0.01)), [px, py] = centre(Math.max(0, t - 0.01));
    const dx = nx - px, dy = ny - py, l = Math.hypot(dx, dy), ox = -dy / l, oy = dx / l, w = width(t);
    up.push([cx + ox * w, cy + oy * w]); down.push([cx - ox * w, cy - oy * w]);
  }
  const outline = "M" + [...up, ...down.reverse()].map(([px, py]) => f(px) + " " + f(py)).join(" L") + " Z";
  const ridge = "M" + Array.from({ length: N - 7 }, (_, i) => { const t = (i + 4) / N, [cx, cy] = centre(t); return f(cx) + " " + f(cy + width(t) * 0.25); }).join(" L");
  let spots = "";
  if (ripe) for (let k = 0; k < 16; k++) { const t = 0.12 + rnd() * 0.76, [cx, cy] = centre(t); spots += `<ellipse cx="${f(cx)}" cy="${f(cy + (rnd() - 0.5) * width(t))}" rx="${f(4 + rnd() * 7)}" ry="${f(3 + rnd() * 3)}" fill="#3b2410"/>`; }
  const [tx, ty] = centre(1);
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><path d="${outline}" fill="${ripe ? "#e8b923" : "#5f9e2c"}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>` +
    `<path d="${ridge}" stroke="${ripe ? "#b98a12" : "#3f7a1c"}" stroke-width="5" fill="none" stroke-linecap="round"/>${spots}` +
    `<circle cx="${f(tx)}" cy="${f(ty)}" r="${f(W * 0.32)}" fill="#2d1c0c"/>` +
    `<rect x="${f(-W * 0.9)}" y="${f(-W * 0.32)}" width="${f(W * 1.1)}" height="${f(W * 0.64)}" rx="6" fill="#6b4422" stroke="${INK}" stroke-width="5"/></g>`;
}

function plantains() {
  let out = '';
  // a hand of green plantains joined at a woody crown
  for (const [dy, rot, len] of [[-60, -16, 560], [10, -10, 600], [80, -4, 580], [150, 2, 540]]) out += plantain(170, 440 + dy, len, rot);
  out += `<path d="M140 350 Q 185 510 145 670 L 105 670 Q 140 510 100 350 Z" fill="#6b4422" stroke="${INK}" stroke-width="6"/>`;
  // one ripe, black-spotted plantain lying in front
  out += plantain(130, 800, 500, -10, true);
  // a plate of fried dodo: diagonal oval slices, golden with dark caramelised edges
  out += `<ellipse cx="780" cy="860" rx="210" ry="76" fill="#f2efe8" stroke="${INK}" stroke-width="7"/>`;
  for (const [x, y] of [[660, 850], [730, 830], [800, 845], [870, 830], [700, 885], [775, 885], [850, 880]]) {
    out += `<g transform="rotate(-25 ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="44" ry="26" fill="#b4561a" stroke="${INK}" stroke-width="5"/><ellipse cx="${x}" cy="${y}" rx="34" ry="18" fill="#f0a63a"/></g>`;
  }
  return out;
}

// wàrà: a soft round white disc of fresh Fulani cheese with a red (sorghum-dyed) rind on a plate; small holes, no
// yellow (a cut slice drawn beside it read as a muddle at game size)
function wara() {
  const cx = 512, top = 440, rx = 340, ry = 120, h = 150;
  let o = `<ellipse cx="${cx}" cy="${top + h + 40}" rx="440" ry="170" fill="#f2efe8" stroke="${INK}" stroke-width="8"/>`;
  // the side: soft red rind (slightly bulging), then the white top with small holes
  o += `<path d="M${cx - rx} ${top} C ${cx - rx - 12} ${top + h * 0.5}, ${cx - rx - 6} ${top + h * 0.8}, ${cx - rx} ${top + h} A${rx} ${ry} 0 0 0 ${cx + rx} ${top + h} C ${cx + rx + 6} ${top + h * 0.8}, ${cx + rx + 12} ${top + h * 0.5}, ${cx + rx} ${top} Z" fill="#c8261b" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>`;
  o += `<path d="M${cx - rx + 30} ${top + 40} Q ${cx - rx + 26} ${top + 90} ${cx - rx + 40} ${top + 120}" stroke="#ffffff55" stroke-width="10" fill="none" stroke-linecap="round"/>`;
  o += `<ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${ry}" fill="#fffdf7" stroke="${INK}" stroke-width="8"/>`;
  for (const [x, y, r] of [[-180, -10, 12], [-80, -50, 8], [-30, 30, 11], [-140, 50, 7], [70, -30, 9], [160, 20, 12], [60, 60, 7], [220, -50, 6], [-240, 30, 6]]) o += `<ellipse cx="${cx + x}" cy="${top + y}" rx="${r}" ry="${r * 0.55}" fill="#e9e1cc"/>`;
  return o;
}

// póò: a toddler potty, seen from the front and a little above: a low, one-piece plastic chair with a broad base, a
// seat ring with the removable bowl showing inside, a raised splash guard at the front, a backrest and two armrests
// (checked against product pages: BabyBjörn Potty Chair, Summer My Size Potty, Fisher-Price potty trainer)
function potty() {
  const C1 = "#7cc4e8", C2 = "#4f9fcb", W = "#ffffff";
  let o = `<ellipse cx="512" cy="840" rx="330" ry="46" fill="#e8e4dc"/>`;
  // backrest, behind the seat
  o += `<path d="M310 560 L310 450 Q310 390 380 390 L644 390 Q714 390 714 450 L714 560 Z" fill="${C1}" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>`;
  o += `<path d="M345 450 Q345 422 380 422 L644 422 Q679 422 679 450 L679 470 L345 470 Z" fill="#a9daf2"/>`;
  // the base: a wide tub, narrower at the top
  o += `<path d="M250 600 L290 820 Q512 870 734 820 L774 600 Z" fill="${C2}" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>`;
  // armrests
  o += `<path d="M215 470 Q205 600 250 610 L300 600 L300 470 Q260 450 215 470 Z" fill="${C1}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/><path d="M809 470 Q819 600 774 610 L724 600 L724 470 Q764 450 809 470 Z" fill="${C1}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>`;
  // seat ring with the white bowl inside
  o += `<ellipse cx="512" cy="600" rx="262" ry="92" fill="${C1}" stroke="${INK}" stroke-width="9"/>`;
  o += `<ellipse cx="512" cy="604" rx="168" ry="54" fill="${W}" stroke="${INK}" stroke-width="7"/><ellipse cx="512" cy="616" rx="120" ry="34" fill="#eef2f4"/>`;
  // splash guard at the front of the seat
  o += `<path d="M455 676 Q512 610 569 676 Q512 700 455 676 Z" fill="${C1}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>`;
  // a highlight and a little star sticker, as toddler potties have
  o += `<path d="M290 640 Q300 740 320 800" stroke="#ffffff88" stroke-width="12" fill="none" stroke-linecap="round"/>`;
  o += `<path d="M512 735 l13 26 29 4 -21 20 5 29 -26 -14 -26 14 5 -29 -21 -20 29 -4 Z" fill="#ffd34d" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
  return o;
}

// pa ("kill"), the root verb, not paná: a fly swatter has just come down on a fly on a table. The fly lies flat on
// its back, legs up, cartoon X eyes, with a little splat star; the swatter is lifting away, motion lines above it.
function swat() {
  // drawn at 1.8x around the fly, so it fills the picture
  const k = 1.8, cx = 470, cy = 780;
  let o = `<rect x="0" y="520" width="1024" height="504" fill="#e7c08a"/><path d="M0 520 H1024" stroke="${INK}" stroke-width="8"/>`;
  for (const y of [660, 790, 930]) o += `<path d="M0 ${y} Q512 ${y - 16} 1024 ${y}" stroke="#c99a5c" stroke-width="5" fill="none"/>`;
  let star = "";
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = (i % 2 ? 70 : 125) * k; star += (i ? "L" : "M") + (cx + r * Math.cos(a)).toFixed(1) + " " + (cy + r * 0.42 * Math.sin(a)).toFixed(1) + " "; }
  o += `<path d="${star}Z" fill="#fff3c4" stroke="#e0a23a" stroke-width="6" stroke-linejoin="round"/>`;
  o += `<g transform="translate(${cx} ${cy}) scale(${k})">`;
  o += `<ellipse cx="-60" cy="-4" rx="58" ry="22" fill="#cfe8f7" stroke="${INK}" stroke-width="4" transform="rotate(-12 -60 -4)"/><ellipse cx="60" cy="-4" rx="58" ry="22" fill="#cfe8f7" stroke="${INK}" stroke-width="4" transform="rotate(12 60 -4)"/>`;
  for (const [dx, lean] of [[-24, -14], [0, 0], [24, 14]]) for (const side of [-1, 1]) o += `<path d="M${dx + side * 5} -12 l${lean * 0.6 + side * 9} -30 l${side * 10} -12" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  o += `<ellipse cx="0" cy="0" rx="46" ry="30" fill="#3a3f4a" stroke="${INK}" stroke-width="5"/><circle cx="52" cy="-4" r="24" fill="#3a3f4a" stroke="${INK}" stroke-width="5"/>`;
  for (const ex of [44, 62]) o += `<path d="M${ex - 6} -14 l12 12 M${ex + 6} -14 l-12 12" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`;
  o += `</g>`;
  // the swatter lifting away up and to the right: the handle runs out of the picture from the top edge of the head
  o += `<g transform="rotate(32 690 250)"><rect x="690" y="-200" width="26" height="380" rx="11" fill="#f2c94c" stroke="${INK}" stroke-width="7"/>`;
  o += `<rect x="603" y="170" width="200" height="210" rx="28" fill="#e23d33" stroke="${INK}" stroke-width="8"/>`;
  for (let i = 1; i < 6; i++) o += `<path d="M${603 + i * 33} 176 V374" stroke="#a5241c" stroke-width="4"/><path d="M609 ${170 + i * 35} H797" stroke="#a5241c" stroke-width="4"/>`;
  o += `</g>`;
  for (const [x1, y1, x2, y2] of [[520, 330, 480, 430], [580, 360, 545, 450], [460, 320, 430, 410]]) o += `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#666" stroke-width="8" stroke-linecap="round"/>`;
  return o;
}

const out = path.resolve('dev/games/art_candidates/produce');
fs.mkdirSync(out, { recursive: true });
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
for (const [name, body] of [['ata_pepper', ata()], ['ogede_agbagba_plantain', plantains()], ['wara_milk', wara()], ['poo_potty', potty()], ['pa_kill', swat()]]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#fff"/>${body}</svg>`;
  fs.writeFileSync(path.join(out, `${name}.svg`), svg);
  const html = path.join(os.tmpdir(), `${name}.html`);
  fs.writeFileSync(html, `<body style="margin:0;background:#fff">${svg}</body>`);
  spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--screenshot=${path.join(out, `${name}.png`)}`, '--window-size=1024,1024', `file:///${html}`], { stdio: 'ignore' });
  console.log('wrote', name);
}
