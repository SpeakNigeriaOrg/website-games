// A child who only drags: never presses next or swipes. After each creature is collected the next one must walk
// in on its own, and the round must reach the finale. Run on a path stone too (--query=path=..&focus=..&level=1).
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 30000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout ' + g.mode + ' ' + g.word?.display); await wait(80); } };
const ready = () => until(() => g.mode === 'idle' && !document.body.classList.contains('locked'));
const ev = (type, target, x, y) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 3, pointerType: 'mouse', isPrimary: true, buttons: type === 'pointerup' ? 0 : 1 }));
const log = [];
for (let i = 0; i < 2 * g.total + 2 && !document.querySelector('.finale'); i++) {
  await ready();
  const before = g.word.id;
  const t = g.tail().getBoundingClientRect(), x0 = t.left + t.width / 2, y0 = t.top + t.height / 2;
  ev('pointerdown', g.tail(), x0, y0);
  let x = x0;
  while (g.played < g.n && x < innerWidth - 2) { x = Math.min(innerWidth - 2, x + 6); ev('pointermove', g.svg, x, y0); await wait(25); }
  await wait(300);
  ev('pointerup', g.svg, x, y0);
  await until(() => document.querySelector('.finale') || (g.word.id !== before && g.mode === 'idle'), 20000);
  log.push(`${before}->${document.querySelector('.finale') ? 'finale' : g.word.id} (${g.collected}/${g.total})`);
}
if (!document.querySelector('.finale')) throw new Error('no finale: ' + log.join(' '));
return log.join(' ');
