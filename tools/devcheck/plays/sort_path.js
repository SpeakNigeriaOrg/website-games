// Path play-through for Sort It: every focus word Sort It can use is a parcel in the round; one miss, then right
// placements (by tapping the place) to the finale, which must offer the way back to the path.
// Run with --query="path=..&focus=..&level=..".
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(80); } };
const { fit } = await import('./fit.js');
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean);
const kit = await (await fetch('../content/content.json')).json();
const usable = focus.filter((id) => { const w = kit.words.find((x) => x.id === id); return w && fit.canUse(w) && (!w.inclusion || w.inclusion.path === 'included'); });
await until(() => g.words.length);
const missing = usable.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the round: ' + missing + ' (round: ' + g.words + ')');
const ready = () => until(() => g.finished || (!g.locked && g.want));
await ready();
let turns = 0, wrongs = 0;
for (let i = 0; i < 30 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  if (i === 0) window.__shot('turn');
  if (i === 1) { g.choose(g.wrongPlace()); wrongs++; await wait(700); window.__shot('wrong'); await until(() => g.locked, 3000); continue; }
  g.choose(g.wantPlace); turns++; await until(() => g.locked, 3000);
}
await until(() => g.finished, 20000);
await wait(900); window.__shot('finale');
if (!document.querySelector('.finale .path-btn')) throw new Error('no path button on the finale');
return `level ${q.get('level')} places ${g.places} words ${g.words.join(',')} | turns ${turns}, wrongs ${wrongs}, clean ${g.clean}/${g.total}`;
