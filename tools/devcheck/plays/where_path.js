// Path play-through for Where It Happens: every focus verb the game can use has its place in the yard, the level's
// number of places, one miss, then right places (tapping them) to the finale, which must offer the way back.
// Run with --query="path=..&focus=..&level=..".
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(80); } };
const { fit } = await import('./fit.js');
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean), level = +q.get('level') || 1;
const kit = await (await fetch('../content/content.json')).json();
const usable = focus.filter((id) => { const w = kit.words.find((x) => x.id === id); return w && fit.canUse(w); });
await until(() => g.words.length);
const missing = usable.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus verbs not in the yard: ' + missing + ' (yard: ' + g.words + ')');
const expect = Math.max({ 1: 2, 2: 4, 3: 6 }[level], usable.length);
if (g.places.length !== expect) throw new Error(`level ${level}: ${g.places.length} places, expected ${expect}`);
const ready = () => until(() => g.finished || (!g.locked && g.want));
await ready();
const asked = new Set();
let turns = 0, wrongs = 0;
for (let i = 0; i < 40 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  asked.add(g.want);
  if (i === 1) window.__shot('turn');
  if (i === 2) { g.choose(g.wrongPlace()); wrongs++; await wait(700); window.__shot('wrong'); await until(() => !g.locked, 15000); continue; }
  g.choose(g.wantPlace); turns++; await until(() => g.locked, 3000);
}
await until(() => g.finished, 20000);
await wait(900); window.__shot('finale');
if (!document.querySelector('.finale .path-btn')) throw new Error('no path button on the finale');
const notAsked = usable.filter((id) => !asked.has(id));
if (notAsked.length) throw new Error('focus verbs never asked: ' + notAsked);
return `level ${level} places ${g.places} | turns ${turns}, wrongs ${wrongs}, clean ${g.clean}/${g.total}`;
