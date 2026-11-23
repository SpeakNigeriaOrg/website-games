// Learning-path play-through: the round holds every focus word the drum can use; one wrong drumming (too few, or
// too many for a one-syllable word), the rest right, to the finale and the way back to the path.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 30000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(100); } };
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean);
const { fit } = await import(new URL('fit.js', location.href).href);
const kit = await (await fetch('../content/content.json')).json();
const ok = (w) => (w.person ?? 'Femi') === 'Femi' && (!w.inclusion || w.inclusion.pathTone === 'included') && fit.canUse(w);
const expected = focus.filter((id) => kit.words.some((w) => w.id === id && ok(w)));
const drumN = async (n) => { for (let i = 0; i < n; i++) { g.drum(); await wait(450); } };
await until(() => g.word);
const missing = expected.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the round: ' + missing.join(','));
let turns = 0, missed = false;
for (let k = 0; k < 30 && !g.finished; k++) {
  await until(() => g.finished || (g.word && !g.locked && g.taps === 0), 40000);
  if (g.finished) break;
  if (k === 0) window.__shot('turn');
  const n = g.word.syllables.length;
  if (k === 1 && !missed) { missed = true; await drumN(n > 1 ? n - 1 : n + 1); }
  else await drumN(n);
  turns++;
  await until(() => g.locked || g.finished);
  await until(() => g.finished || !g.locked, 40000);
}
await until(() => g.finished, 20000); await wait(800);
window.__shot('finale');
if (!document.querySelector('.path-btn')) throw new Error('no path button on the finale');
return `level=${q.get('level')} words=${g.words.join(',')} focus usable=${expected.length}/${focus.length} turns=${turns} joined=${g.joined} finished=${g.finished}`;
