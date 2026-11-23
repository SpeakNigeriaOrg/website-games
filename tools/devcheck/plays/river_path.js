// Learning-path play-through: the round holds every focus word River can use, then cross to the finale
// (one deliberate splash) and find the way back to the path.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 30000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(100); } };
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean);
const { fit } = await import(new URL('fit.js', location.href).href);
const kit = await (await fetch('../content/content.json')).json();
const ok = (w) => (w.person ?? 'Femi') === 'Femi' && (!w.inclusion || w.inclusion.pathTone === 'included') && fit.canUse(w);
const expected = focus.filter((id) => kit.words.some((w) => w.id === id && ok(w)));
await until(() => g.word && !g.locked);
const missing = expected.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the round: ' + missing.join(','));
window.__shot('first-row');
let moves = 0, missedOnce = false;
while (!g.finished && moves < 60) {
  await until(() => !g.locked || g.finished);
  if (g.finished) break;
  const right = missedOnce || moves !== 1; // one deliberate splash on the second move
  if (!right) missedOnce = true;
  g.choose(right);
  moves++;
  await wait(200);
}
await wait(600);
window.__shot('finale');
if (!document.querySelector('.path-btn')) throw new Error('no path button on the finale');
return `level=${q.get('level')} words=${g.words.join(',')} focus usable=${expected.length}/${focus.length} moves=${moves} clean=${g.clean} finished=${g.finished}`;
