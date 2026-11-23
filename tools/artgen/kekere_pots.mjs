// kékeré (small), second panel: a big clay pot and the same pot small beside it, on one ground line, the small one to
// be circled. Writes art_candidates/produce/kekere_pots.png (1024 x 512).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const INK = '#3a2412';
function pot(cx, base, s) {
  // a round-bellied clay pot with a short neck and rim, drawn s times its 100-unit size
  const W = 100 * s, H = 110 * s;
  return `<ellipse cx="${cx}" cy="${base - 2}" rx="${W * 0.6}" ry="${9 * s}" fill="#00000022"/>` +
    `<path d="M${cx - W * 0.32} ${base - H} Q${cx - W * 0.95} ${base - H * 0.55} ${cx - W * 0.42} ${base - 4 * s} Q${cx} ${base + 6 * s} ${cx + W * 0.42} ${base - 4 * s} Q${cx + W * 0.95} ${base - H * 0.55} ${cx + W * 0.32} ${base - H} Z" fill="#c8693a" stroke="${INK}" stroke-width="${Math.max(4, 3 * s)}" stroke-linejoin="round"/>` +
    `<path d="M${cx - W * 0.55} ${base - H * 0.55} Q${cx} ${base - H * 0.45} ${cx + W * 0.55} ${base - H * 0.55}" stroke="#9c4a24" stroke-width="${2.5 * s}" fill="none"/>` +
    `<rect x="${cx - W * 0.38}" y="${base - H - 14 * s}" width="${W * 0.76}" height="${16 * s}" rx="${6 * s}" fill="#b55c31" stroke="${INK}" stroke-width="${Math.max(4, 3 * s)}"/>` +
    `<path d="M${cx - W * 0.5} ${base - H * 0.75} Q${cx - W * 0.6} ${base - H * 0.5} ${cx - W * 0.45} ${base - H * 0.3}" stroke="#ffffff55" stroke-width="${6 * s}" fill="none" stroke-linecap="round"/>`;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512" viewBox="0 0 1024 512"><rect width="1024" height="512" fill="#fdfcf9"/>` +
  pot(600, 480, 3.0) + pot(250, 480, 1.0) + `</svg>`;
const out = path.resolve('dev/games/art_candidates/produce');
fs.mkdirSync(out, { recursive: true });
const html = path.join(os.tmpdir(), 'kekere_pots.html');
fs.writeFileSync(html, `<body style="margin:0">${svg}</body>`);
spawnSync(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--screenshot=${path.join(out, 'kekere_pots.png')}`, '--window-size=1024,512', `file:///${html}`], { stdio: 'ignore' });
console.log('wrote kekere_pots');
