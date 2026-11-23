// Path play-through for Tickle the Giant: the round asks the step's parts (focus first, taught by the ghost
// hand), one wrong tap, then right taps to the finale (with the speed round above level 1) and the path button.
const g = window.__game;
const wait = async (cond, ms = 40000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error('timeout ' + JSON.stringify({ locked: g.locked, target: g.target, view: g.view, speed: g.speed, clean: g.clean })); await new Promise((r) => setTimeout(r, 80)); } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const { fit } = await import('./fit.js');
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean);
const kit = await (await fetch('../content/content.json')).json();
const gated = kit.words.some((w) => w.inclusion?.path); // the path gate profile, once the kit carries it
const usable = focus.filter((id) => { const w = kit.words.find((x) => x.id === id); return w && fit.canUse(w) && (!gated || !w.inclusion || w.inclusion.path === 'included'); });
const missing = usable.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the round: ' + missing.join(','));
await wait(() => !g.locked);
const taught = g.target;
window.__shot('teaching');
await pause(1500);
g.tap(g.target);
const asked = new Set(), log = [];
let wrong = false;
for (let i = 0; i < 40; i++) {
  await wait(() => g.finished || g.speed || !g.locked);
  if (g.finished || g.speed) break;
  asked.add(g.target);
  if (i === 2 && !wrong) { // a wrong part: it says its own name, the target comes back
    const other = ['hair', 'leg', 'eye'].find((p) => p !== g.target && !(g.target === 'leg' && p === 'knee'));
    wrong = true; g.tap(other); await pause(300); window.__shot('wrong'); continue;
  }
  g.tap(g.target);
}
await wait(() => g.speed || g.finished);
if (g.speed) {
  window.__shot('speed');
  while (g.speed && !g.finished && !document.querySelector('.giant.collapsed')) {
    await wait(() => g.finished || !g.speed || !g.locked || document.querySelector('.giant.collapsed'), 20000);
    if (!g.speed || g.finished || !g.target || document.querySelector('.giant.collapsed')) break;
    g.tap(g.target); await pause(150);
  }
}
await wait(() => g.finished, 30000);
await pause(800); window.__shot('finale');
if (!document.querySelector('.finale .path-btn')) throw new Error('no path button on the finale');
return `level=${q.get('level')} words=${g.words.join(',')} taught=${taught} asked=${[...asked].join(',')} clean=${g.clean} focus usable=${usable.join(',')}`;
