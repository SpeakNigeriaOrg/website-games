// Path play-through for Help Grandma: the round's commands include the step's, the lessons play, one miss, and real
// pointer taps on the right thing for every turn, to the finale and its path button. Never the same command twice
// running.
const g = window.__game;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const wait = async (cond, ms = 40000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error('timeout; state ' + JSON.stringify(g.state)); await pause(50); } };
const ready = () => wait(() => g.state.finished || (g.state.phase === 'act' && !g.state.locked));
const { fit } = await import('./fit.js');
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean);
const kit = await (await fetch('../content/content.json')).json();
const usable = focus.filter((id) => { const w = kit.words.find((x) => x.id === id); return w && fit.canUse(w); });
const missing = usable.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the round: ' + missing.join(','));
const tap = async (node) => {
  const r = node.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  for (const type of ['pointerdown', 'pointerup']) { node.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true })); await pause(80); }
};
const log = [], asked = [];
let n = 0, missed = false, repeats = 0;
await pause(2600); window.__shot('start');
while (!g.state.finished && n < 40) {
  await ready(); if (g.state.finished) break;
  const s = g.state; n++;
  if (asked.length && asked.at(-1) === s.cmd && !s.teach) repeats++;
  asked.push(s.cmd);
  if (s.teach) log.push(`(${s.cmd})`);
  if (!s.teach && !missed) {
    missed = true; const wrong = s.keys.find((k) => k !== s.cmd); log.push(`${s.cmd}:MISS(${wrong})`);
    await tap(g.card(wrong)); await pause(600); window.__shot('miss');
    await ready(); await tap(g.card(g.state.cmd)); await wait(() => g.state.phase !== 'act', 6000); continue;
  }
  log.push(s.cmd);
  await tap(g.card(s.cmd));
  if (n === 1) { await pause(700); window.__shot('act'); }
  await wait(() => g.state.phase !== 'act' || g.state.finished, 6000);
}
await wait(() => g.state.finished, 20000);
await pause(1000); window.__shot('finale');
if (!document.querySelector('.finale .path-btn')) throw new Error('no path button on the finale');
if (repeats) throw new Error(`the same command came twice running ${repeats} time(s): ${asked.join(' ')}`);
return `level=${g.state.level} words=${g.words.join(',')} ${n} turns: ${log.join(' ')}`;
