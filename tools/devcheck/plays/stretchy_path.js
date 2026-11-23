// Learning-path play-through: the round holds every focus word Stretchy can use; stretch every creature (hold)
// to the gallery finale and the way back to the path.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 30000) => { const t = Date.now(); while (!f() && Date.now() - t < ms) await wait(80); return f(); };
const ready = () => until(() => g.mode === 'idle' && !document.body.classList.contains('locked'));
const ev = (type, target, x, y) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'mouse', isPrimary: true }));
const centreOf = (node) => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean);
const { fit } = await import(new URL('fit.js', location.href).href);
const kit = await (await fetch('../content/content.json')).json();
const ok = (w) => (w.person ?? 'Femi') === 'Femi' && (!w.inclusion || w.inclusion.pathTone === 'included') && fit.canUse(w);
const expected = focus.filter((id) => kit.words.some((w) => w.id === id && ok(w)));
await until(() => g && g.words);
const missing = expected.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the round: ' + missing.join(','));
await ready(); window.__shot('rest');
for (let i = 0; i < 12 && g.collected < g.total; i++) {
  if (i) { document.getElementById('next').click(); await wait(300); await ready(); }
  const p = centreOf(g.body()); ev('pointerdown', g.body(), p.x, p.y);
  await until(() => g.played === g.n, 15000); await wait(200);
  if (i === 0) window.__shot('stretched');
  ev('pointerup', g.svg, p.x, p.y);
  await until(() => g.mode === 'idle' || document.querySelector('.finale'));
}
await until(() => document.querySelector('.finale'), 8000); await wait(700);
window.__shot('finale');
if (!document.querySelector('.path-btn')) throw new Error('no path button on the finale');
return `level=${q.get('level')} words=${g.words.join(',')} focus usable=${expected.length}/${focus.length} collected=${g.collected}/${g.total}`;
