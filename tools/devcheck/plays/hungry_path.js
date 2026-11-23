// Path play-through for hungry: the round holds every usable focus word; one miss, then right feeds to the
// finale, which must offer the way back to the path. Run with --query="path=..&focus=..&level=..".
const g = window.__game;
const wait = async (cond, ms = 30000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 100)); } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean);
await wait(() => g.words.length && !g.locked);
const missing = focus.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the round: ' + missing + ' (round: ' + g.words + ')');
window.__shot('teaching');
g.choose(g.want);
let turns = 0, wrongs = 0, maxPlates = 0;
for (let i = 0; i < 40 && !g.finished; i++) {
  await wait(() => g.finished || !g.locked);
  if (g.finished) break;
  maxPlates = Math.max(maxPlates, g.choices.length);
  if (i === 0) window.__shot('turn');
  if (i === 1) { g.choose(g.choices.find((c) => c !== g.want)); wrongs++; await pause(500); window.__shot('wrong'); continue; }
  g.choose(g.want); turns++;
}
await wait(() => g.finished, 20000);
await pause(800);
window.__shot('finale');
if (!document.querySelector('.path-btn')) throw new Error('no path button on the finale');
return `level ${q.get('level')} words ${g.words.join(',')} | turns ${turns}, wrongs ${wrongs}, clean ${g.clean}, most plates ${maxPlates}`;
