// Path play-through for Silly Parrot: the round holds every usable focus word and each is held up; one miss,
// then right answers to the finale, which must offer the way back to the path. At level 1 every silly word
// comes from another category. Run with --query="path=..&focus=..&level=..".
const g = window.__game;
const wait = async (cond, ms = 30000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error('timeout waiting; state ' + JSON.stringify(g.state)); await new Promise((r) => setTimeout(r, 100)); } };
const ready = () => wait(() => g.state.finished || !g.state.locked && (g.state.phase === 'answer' || g.state.phase === 'fix'));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean);
await ready();
const missing = focus.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the round: ' + missing + ' (round: ' + g.words + ')');
window.__shot('turn1');
const shown = new Set(), log = [];
let missed = false, turns = 0;
while (!g.state.finished && turns < 40) {
  await ready(); if (g.state.finished) break;
  const s = g.state;
  if (s.phase === 'fix') { g.tap(s.correct); await pause(600); continue; }
  turns++;
  shown.add(s.word);
  if (!g.words.includes(s.word)) throw new Error('picture outside the round: ' + s.word);
  let choice = s.correct;
  if (!missed && turns === 2) { missed = true; choice = s.correct === 'seed' ? 'hammer' : 'seed'; }
  log.push(`${s.word}${s.silly ? '<-' + s.said : ''}:${choice === s.correct ? 'ok' : 'MISS'}`);
  g.tap(choice);
  if (choice !== s.correct) { await pause(900); window.__shot('miss'); }
  await pause(400);
}
await wait(() => g.state.finished, 20000);
await pause(1200);
window.__shot('finale');
if (!document.querySelector('.path-btn')) throw new Error('no path button on the finale');
const unseen = focus.filter((id) => !shown.has(id));
if (unseen.length) throw new Error('focus words never held up: ' + unseen);
return `level ${q.get('level')} words ${g.words.join(',')} | turns ${turns}; ${log.join(' ')}`;
