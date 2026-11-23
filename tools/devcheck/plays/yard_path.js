// Path play-through for yard: the yard holds every usable focus word; a wrong bush once, then right taps to
// the finale, which must offer the way back to the path. Run with --query="path=..&focus=..&level=..".
const g = window.__game;
const wait = async (cond, ms = 40000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 80)); } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean);
await wait(() => g.words.length && !g.locked);
const missing = focus.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the round: ' + missing + ' (round: ' + g.words + ')');
window.__shot('teaching');
g.tap(g.target);
let turns = 0, wrong = false, most = 0;
for (let i = 0; i < 40; i++) {
  await wait(() => g.finished || !g.locked);
  if (g.finished) break;
  const b = g.bushes;
  most = Math.max(most, b.filter(Boolean).length);
  if (!wrong && b.filter(Boolean).length >= 2) { g.tap(b.findIndex((x, k) => x && k !== g.target)); wrong = true; await pause(500); window.__shot('wrong'); continue; }
  if (i === 2) window.__shot('turn');
  g.tap(g.target); turns++;
}
await wait(() => g.finished, 30000);
await pause(900); window.__shot('finale');
if (!document.querySelector('.path-btn')) throw new Error('no path button on the finale');
return `level ${q.get('level')} words ${g.words.join(',')} | turns ${turns}, clean ${g.clean}, most in yard ${most}`;
