// Real pointer drags on the tail, as a mouse user would: grab the tuft, sweep right in small steps until the goal
// flag waves (or the pointer reaches the edge of the screen), let go. Every creature must be collectable this way,
// and the creature must keep its size while it stretches. Flipbook of the first drag. Works in portrait and --landscape.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 30000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout ' + g.mode); await wait(80); } };
const ready = () => until(() => g.mode === 'idle' && !document.body.classList.contains('locked'));
const ev = (type, target, x, y) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 3, pointerType: 'mouse', isPrimary: true, buttons: type === 'pointerup' ? 0 : 1 }));
const badge = () => document.querySelector('#creature image').getBoundingClientRect();
const log = [];
for (let i = 0; i < 12 && g.collected < g.total; i++) {
  await ready();
  const t = g.tail().getBoundingClientRect(), x0 = t.left + t.width / 2, y0 = t.top + t.height / 2;
  const b0 = badge();
  if (i === 0) window.__burst('drag', 1200 + g.n * 900, 200);
  ev('pointerdown', g.tail(), x0, y0);
  let x = x0;
  while (g.played < g.n && x < innerWidth - 2) { x = Math.min(innerWidth - 2, x + 6); ev('pointermove', g.svg, x, y0); await wait(25); }
  await wait(500);
  const b1 = badge(), flag = document.querySelector('.goal.reached');
  log.push(`${g.word.display} n=${g.n} played=${g.played} pointer ${Math.round(x0)}->${Math.round(x)}/${innerWidth} badge ${Math.round(b0.width)}->${Math.round(b1.width)}px flag=${!!flag}`);
  if (g.played < g.n) throw new Error('full stretch not reached: ' + log.at(-1));
  if (Math.abs(b1.width - b0.width) > 2) throw new Error('creature changed size: ' + log.at(-1));
  ev('pointerup', g.svg, x, y0);
  await until(() => g.mode === 'idle' || document.querySelector('.finale'));
  if (document.querySelector('.finale')) break;
  await ready(); document.getElementById('next').click(); await wait(300);
}
await until(() => document.querySelector('.finale'), 8000);
return log.join('\n') + ` | collected=${g.collected}/${g.total}`;
