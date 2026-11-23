// Renders number pictures (dev/games/numbers.js) to PNG with headless Chrome, for the kit's picture games:
//   node tools/artgen/render_numbers.mjs 20=ogun_twenty [n=word_id ...]
// writes dev/games/art_candidates/numbers/<word_id>.png (512 x 512, white).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { svg } from '../../dev/games/numbers.js';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const out = path.resolve('dev/games/art_candidates/numbers');
fs.mkdirSync(out, { recursive: true });
for (const arg of process.argv.slice(2)) {
  const [n, id] = arg.split('=');
  const html = path.join(os.tmpdir(), `number_${id}.html`);
  fs.writeFileSync(html, `<body style="margin:0;background:#fff">${svg(+n, { size: 512 })}</body>`);
  const png = path.join(out, `${id}.png`);
  spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--screenshot=${png}`, '--window-size=512,512', `file:///${html}`], { stdio: 'ignore' });
  console.log(fs.existsSync(png) ? `${n} -> ${png}` : `${n}: failed`);
}
