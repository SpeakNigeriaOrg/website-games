// Path play-through for Puppet Theatre: every focus word the game can use is on show, the level's grid, no free
// warm-up (the game starts asking), one miss, then right pairs (taps) to the finale, which must offer the way back.
// Run with --query="path=..&focus=..&level=..".
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(80); } };
const { fit } = await import('./fit.js');
const { GRID_BY_LEVEL } = await import('../combo.js');
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean), level = +q.get('level') || 1;
const kit = await (await fetch('../content/content.json')).json();
const usable = focus.filter((id) => { const w = kit.words.find((x) => x.id === id); return w && fit.canUse(w); });
await until(() => g.words.length);
const missing = usable.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not on show: ' + missing + ' (round: ' + g.words + ')');
const [ns, na] = GRID_BY_LEVEL[level - 1];
if (g.subjects.length < ns || g.actions.length < na) throw new Error(`level ${level}: grid ${g.subjects.length}x${g.actions.length}, expected ${ns}x${na}`);
if (g.mode !== 'game') throw new Error('on the path the round should start asking, not with free play');
const ready = () => until(() => g.finished || (!g.locked && g.want));
const tap = (id) => g.pickEl(id).__tap();
const asked = new Set();
let turns = 0, wrongs = 0;
for (let i = 0; i < 40 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  const w = g.want, turnNo = g.turnNo;
  asked.add(w.subject); asked.add(w.action);
  if (i === 1) window.__shot('turn');
  if (i === 2) { const b = g.wrongPair(); tap(b.subject); tap(b.action); wrongs++; await wait(1500); window.__shot('wrong'); await ready(); continue; }
  tap(w.subject); tap(w.action); turns++;
  await until(() => g.turnNo > turnNo || g.finished, 20000);
}
await until(() => g.finished, 20000);
await wait(900); window.__shot('finale');
if (!document.querySelector('.finale .path-btn')) throw new Error('no path button on the finale');
const notAsked = usable.filter((id) => !asked.has(id));
if (notAsked.length) throw new Error('focus words never asked: ' + notAsked);
return `level ${level} grid ${g.subjects}|${g.actions} | turns ${turns}, wrongs ${wrongs}, clean ${g.clean}/${g.total}`;
