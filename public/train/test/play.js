// Play-through for devcheck: Missing Carriage (wrong then right), the coupled teaching turn, an order turn
// placed wrong (pop-off) then right, a drag, then everything right to the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f() && Date.now() - t < ms) await wait(100); return f(); };
const ready = () => until(() => g.finished || (g.word && !g.locked && g.looseCount > 0));
const log = [];
await wait(1500); __shot('rolling-in');
await ready(); __shot('missing-turn'); log.push(`${g.level}:${g.word.display}`);
// 1: Missing Carriage, wrong first
g.tap(false); await wait(900); __shot('missing-wrong-placed');
await until(() => g.locked); await wait(1800); __shot('missing-wrong-wobble');
await ready(); log.push(`after wrong misses=${g.misses} loose=${g.looseCount}`);
g.tap(true); await wait(1200); __shot('missing-right');
await until(() => g.level !== 'missing' || g.word.display !== log[0].split(':')[1], 20000);
// play on: do one wrong order turn, one drag, rest right
let didWrongOrder = false, didDrag = false, sawCoupled = false, saw3 = false;
for (let k = 0; k < 40 && !g.finished; k++) {
  await ready();
  if (g.finished) break;
  if (g.level === 'coupled' && !sawCoupled) { sawCoupled = true; __shot('coupled-teach'); log.push(`coupled:${g.word.display}`); }
  if (g.level === 'order' && g.word.syllables.length === 3 && !saw3) { saw3 = true; __shot('three'); }
  if (g.level === 'order' && !didWrongOrder && g.looseCount === g.word.syllables.length) {
    didWrongOrder = true; log.push(`order-wrong:${g.word.display}`);
    while (g.looseCount > 0) { await until(() => !g.locked); if (g.looseCount === 0) break; g.tap(g.looseCount === 1); await wait(700); }
    await wait(1500); __shot('order-wrong'); await until(() => g.locked); await wait(2300); __shot('order-popped');
    continue;
  }
  if (g.level === 'order' && !didDrag) {
    didDrag = true;
    const c = g.carEls[0]; const r = c.getBoundingClientRect();
    const opt = (x, y) => ({ clientX: x, clientY: y, pointerId: 1, bubbles: true });
    const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
    c.dispatchEvent(new PointerEvent('pointerdown', opt(x0, y0)));
    for (let i = 1; i <= 8; i++) { c.dispatchEvent(new PointerEvent('pointermove', opt(x0, y0 - i * 40))); await wait(30); }
    __shot('dragging');
    c.dispatchEvent(new PointerEvent('pointerup', opt(x0, y0 - 320)));
    await wait(900); log.push(`drag -> loose=${g.looseCount}`);
    continue;
  }
  g.tap(true); await wait(700);
}
await until(() => g.finished, 30000); await wait(900); __shot('finale');
return log.join(' | ') + ` | clean=${g.clean} finished=${g.finished}`;
