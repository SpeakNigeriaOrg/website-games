// Accept a Who-does-what clip after looking at its frame strip: copies art_candidates/combo_videos/<name>/s<seed>.mp4
// to art/combo/<name>.mp4 without its generated sound (the games play it muted; the only Yorùbá audio is the kit's
// words) and adds <name> to VIDEOS in dev/games/combo.js, so both games switch that combination from its still.
//   node tools/artgen/accept_combo_video.mjs dog_sleep 0 [cat_eat 1 ...]
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const games = new URL('../../dev/games/', import.meta.url);
const args = process.argv.slice(2);
const file = new URL('combo.js', games);
let src = readFileSync(file, 'utf8');
const m = src.match(/export const VIDEOS = new Set\(\[(.*?)\]\);/);
const names = new Set(m[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean));
for (let i = 0; i < args.length; i += 2) {
  const [name, seed] = [args[i], args[i + 1]];
  const from = new URL(`art_candidates/combo_videos/${name}/s${seed}.mp4`, games), to = new URL(`art/combo/${name}.mp4`, games);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', from.pathname.replace(/^\/(\w:)/, '$1'), '-an', '-c:v', 'copy', '-movflags', '+faststart', to.pathname.replace(/^\/(\w:)/, '$1')]);
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${name}: ${r.stderr}`);
  names.add(name);
  console.log('accepted', name, 's' + seed);
}
src = src.replace(m[0], `export const VIDEOS = new Set([${[...names].sort().map((n) => `'${n}'`).join(', ')}]);`);
writeFileSync(file, src);
