// Path play-through for Windows: every focus word the game can use is in the round, the level's number of windows,
// one miss, then right windows to the finale, which must offer the way back.
// Run with --query="path=..&focus=..&level=..".
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(80); } };
const { fit } = await import('./fit.js');
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean), level = +q.get('level') || 1;
const kit = await (await fetch('../content/content.json')).json();
const usable = focus.filter((id) => { const w = kit.words.find((x) => x.id === id); return w && fit.canUse(w); });
await until(() => g.words.length);
const missing = usable.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the round: ' + missing + ' (round: ' + g.words + ')');
const ready = () => until(() => g.finished || (!g.locked && g.want));
await ready();
const expect = { 1: 2, 2: 3, 3: 4 }[level];
if (g.windows.length !== expect) throw new Error(`level ${level}: ${g.windows.length} windows, expected ${expect}`);
const asked = new Set();
let turns = 0, wrongs = 0;
for (let i = 0; i < 40 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  const w = g.want, turnNo = g.turnNo;
  asked.add(w.subject); asked.add(w.action);
  if (i === 1) window.__shot('turn');
  if (i === 2) { g.wrongEl().__tap(); wrongs++; await wait(1500); window.__shot('wrong'); await ready(); }
  g.rightEl().__tap(); turns++;
  await until(() => g.turnNo > turnNo || g.finished, 20000);
}
await until(() => g.finished, 20000);
await wait(900); window.__shot('finale');
if (!document.querySelector('.finale .path-btn')) throw new Error('no path button on the finale');
const notAsked = usable.filter((id) => !asked.has(id));
if (notAsked.length) throw new Error('focus words never asked: ' + notAsked);
return `level ${level} words ${g.words} | turns ${turns}, wrongs ${wrongs}, clean ${g.clean}/${g.total}`;
