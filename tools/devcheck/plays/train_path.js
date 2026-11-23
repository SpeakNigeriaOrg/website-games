// Learning-path play-through: the round holds every focus word the train can use; one wrong carriage, the rest
// right, to the finale and the way back to the path. Level 1 must be Missing Carriage only.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f() && Date.now() - t < ms) await wait(100); return f(); };
const ready = () => until(() => g.finished || (g.word && !g.locked && g.looseCount > 0));
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean);
const { fit } = await import(new URL('fit.js', location.href).href);
const kit = await (await fetch('../content/content.json')).json();
const ok = (w) => (w.person ?? 'Femi') === 'Femi' && (!w.inclusion || w.inclusion.pathTone === 'included') && fit.canUse(w);
const expected = focus.filter((id) => kit.words.some((w) => w.id === id && ok(w)));
await until(() => g.word);
const missing = expected.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the round: ' + missing.join(','));
const levels = new Set();
let wrong = false;
for (let k = 0; k < 40 && !g.finished; k++) {
  await ready();
  if (g.finished) break;
  levels.add(g.level);
  if (k === 0) window.__shot('first-turn');
  if (!wrong && g.looseCount >= 2) { wrong = true; g.tap(false); await wait(900); continue; }
  g.tap(true); await wait(700);
}
await until(() => g.finished, 30000); await wait(900);
window.__shot('finale');
if (q.get('level') === '1' && [...levels].some((l) => l !== 'missing')) throw new Error('level 1 played ' + [...levels]);
if (!document.querySelector('.path-btn')) throw new Error('no path button on the finale');
return `level=${q.get('level')} words=${g.words.join(',')} focus usable=${expected.length}/${focus.length} kinds=${[...levels]} clean=${g.clean} finished=${g.finished}`;
