// Plays every game on a real stone of the learning path (path.json), one after another: for each game, its
// first and last stone (different units and levels), with the game's path play script. Then the path page.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const plan = JSON.parse(fs.readFileSync('dev/games/path/path.json', 'utf8'));
const stones = plan.units.flatMap((u) => u.meetings.flatMap((m) => m.stones));
const byGame = {};
for (const s of stones) (byGame[s.job === 'tone' ? `${s.game}_tone` : s.mode ? `${s.game}~${s.mode}` : s.game] ??= []).push(s);
const results = [];
for (const [key, list] of Object.entries(byGame)) {
  const game = key.split(/[_~]/)[0], mode = key.split('~')[1];
  // a mode's own path script if there is one (rally_pictures_path.js), else the game's
  const modeScript = mode && fs.existsSync(`tools/devcheck/plays/${game}_${mode}_path.js`) ? `${game}_${mode}_path` : null;
  const script = key.endsWith('_tone') ? `${game}_tone` : modeScript ?? `${game}_path`;
  for (const s of [...new Set([list[0], list[list.length - 1]])]) {
    const q = new URLSearchParams({ path: s.id, focus: s.focus.join(','), review: s.review.join(','), level: s.level, ...(s.mode ? { mode: s.mode } : {}), ...(s.pairs ? { pairs: s.pairs.map((p) => p.join('~')).join(',') } : {}) }).toString();
    let out, ok;
    try { out = execFileSync('node', ['tools/devcheck/check.mjs', game, `tools/devcheck/plays/${script}.js`, `--query=${q}`, `--tag=sweep-${s.id}`], { encoding: 'utf8', timeout: 240000 }); ok = true; }
    catch (e) { out = (e.stdout || '') + (e.stderr || ''); ok = false; }
    const line = `${ok ? 'PASS' : 'FAIL'} ${game} ${s.id} L${s.level} [${s.focus.join(',')}] ${out.match(/script result: (.*)/)?.[1]?.slice(0, 120) ?? out.trim().split('\n').slice(-3).join(' | ')}`;
    console.log(line); results.push(line);
  }
}
console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} pass`);
