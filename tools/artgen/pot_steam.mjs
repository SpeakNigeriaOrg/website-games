// Adds steam to the kitchen helper game's hot pot: the generated pot (art_candidates/kitchen/hot_pot/<pick>_matte.png)
// lost its white steam to the sprite cutout, and steam is what says "hot" at a glance. Three wavy white plumes with the
// sprites' dark outline (white alone vanishes against the light kitchen wall), drawn above the lid on a taller canvas.
//   node tools/artgen/pot_steam.mjs [v0]      -> art_candidates/kitchen/hot_pot_steam.png
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const pick = process.argv[2] || 'v0';
const dir = path.resolve('dev/games/art_candidates/kitchen');
const src = path.join(dir, 'hot_pot', `${pick}_matte.png`);
const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src], { encoding: 'utf8' });
const [w, h] = probe.stdout.trim().split(',').map(Number);
const top = Math.round(h * 0.55);                 // room above the pot for the steam
const W = w, H = h + top, INK = '#3a2412';
// a plume: an S-curve rising from the lid, drawn as a thick dark stroke under a thinner white one (an outlined line)
const plume = (x, amp, len, delay) => {
  const y0 = top + h * 0.16, step = len / 4;
  let d = `M${x} ${y0}`;
  for (let i = 1; i <= 4; i++) d += ` Q${x + (i % 2 ? amp : -amp)} ${y0 - step * (i - 0.5)} ${x} ${y0 - step * i}`;
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w * 0.05}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="${w * 0.028}" stroke-linecap="round"/>`;
};
const b64 = fs.readFileSync(src).toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  plume(W * 0.36, W * 0.05, top * 0.85) + plume(W * 0.5, W * 0.06, top * 0.98) + plume(W * 0.64, W * 0.05, top * 0.8) +
  `<image href="data:image/png;base64,${b64}" x="0" y="${top}" width="${w}" height="${h}"/></svg>`;
const html = path.join(os.tmpdir(), 'pot_steam.html');
fs.writeFileSync(html, `<body style="margin:0;background:transparent">${svg}</body>`);
const out = path.join(dir, 'hot_pot_steam.png');
spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--default-background-color=00000000', `--screenshot=${out}`, `--window-size=${W},${H}`, `file:///${html}`], { stdio: 'ignore' });
console.log(fs.existsSync(out) ? `wrote ${out} (${W} x ${H})` : 'failed');
