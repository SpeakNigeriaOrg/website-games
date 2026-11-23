// Tone stone: the parrot holds up only the pair's pictures, and every silly turn says the picture's tone
// partner (the same syllables, other tones). Plays to the finale. Run with --query="path=..&pairs=a~b&focus=a,b&level=1".
const g = window.__game;
const wait = async (cond, ms = 30000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error('timeout; state ' + JSON.stringify(g.state)); await new Promise((r) => setTimeout(r, 100)); } };
const ready = () => wait(() => g.state.finished || !g.state.locked && (g.state.phase === 'answer' || g.state.phase === 'fix'));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const pairs = new URLSearchParams(location.search).get('pairs').split(',').map((p) => p.split('~'));
const partner = new Map(pairs.flatMap(([a, b]) => [[a, b], [b, a]]));
await ready();
const log = []; let turns = 0, silly = 0;
while (!g.state.finished && turns < 40) {
  await ready(); if (g.state.finished) break;
  const s = g.state;
  if (s.phase === 'fix') { g.tap(s.correct); await pause(600); continue; }
  turns++;
  if (!partner.has(s.word)) throw new Error('picture outside the pairs: ' + s.word);
  if (s.silly) { silly++; if (s.said !== partner.get(s.word)) throw new Error(`silly word ${s.said} is not the tone partner of ${s.word}`); }
  log.push(`${s.word}${s.silly ? '<-' + s.said : ''}`);
  if (turns === 1) window.__shot('tone-turn');
  g.tap(s.correct);
  await pause(400);
}
await wait(() => g.state.finished, 20000);
await pause(1000);
if (!document.querySelector('.path-btn')) throw new Error('no path button');
return `turns ${turns}, silly ${silly}: ${log.join(' ')}`;
