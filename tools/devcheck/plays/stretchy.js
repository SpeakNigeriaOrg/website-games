// Play-through for devcheck: demo, a real pointer drag on the tail, a plain tap, a mouse press-and-hold,
// swipes to the next creatures, and collecting every creature to reach the gallery finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 30000) => { const t = Date.now(); while (!f() && Date.now() - t < ms) await wait(80); return f(); };
const ready = () => until(() => g.mode === 'idle' && !document.body.classList.contains('locked'));
const log = [];
const ev = (type, target, x, y, pointerType = 'touch') => target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType, isPrimary: true }));
const centreOf = (node) => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
await wait(1500); __shot('demo'); await wait(700);
await ready(); __shot('rest'); await wait(600);
// 1: drag the tail with pointer events, notch by notch
const scale = g.svg.getBoundingClientRect().width / g.svg.viewBox.baseVal.width; // screen px per creature unit
let p = centreOf(g.tail());
ev('pointerdown', g.tail(), p.x, p.y);
for (let k = 1; k <= g.n; k++) {
  ev('pointermove', g.svg, p.x + k * g.notch() * scale, p.y);
  await wait(700);
  if (k === g.n - 1 || g.n === 2 && k === 1) { __shot('stretching'); await wait(500); }
}
log.push(`drag n=${g.n} played=${g.played} bumps=${g.bumps}`);
__shot('stretched'); await wait(700);
ev('pointerup', g.svg, p.x + g.n * g.notch() * scale, p.y);
await wait(150); __shot('snap'); await wait(400);
await ready(); log.push(`collected=${g.collected}`);
// 2: a plain tap on the body
p = centreOf(g.body()); ev('pointerdown', g.body(), p.x, p.y, 'mouse'); await wait(80); ev('pointerup', g.svg, p.x, p.y, 'mouse');
await wait(300); log.push(`tap mode=${g.mode}`); await ready();
// 3: next creature by swipe on the meadow
const m = document.getElementById('meadow');
ev('pointerdown', m, 300, 120); ev('pointerup', m, 120, 130);
await wait(400); __shot('walking'); await wait(500);
await ready(); log.push(`next=${g.word.display}`);
// 4: mouse press-and-hold stretches by itself
p = centreOf(g.body()); ev('pointerdown', g.body(), p.x, p.y, 'mouse');
await until(() => g.played === g.n, 15000); await wait(400); __shot('hold'); await wait(500);
ev('pointerup', g.svg, p.x, p.y, 'mouse'); log.push(`hold played=${g.played}`);
await ready();
// the rest: arrow button, then hold to collect
for (let i = 0; i < 12 && g.collected < g.total; i++) {
  document.getElementById('next').click(); await wait(300); await ready();
  p = centreOf(g.body()); ev('pointerdown', g.body(), p.x, p.y, 'mouse');
  await until(() => g.played === g.n, 15000); await wait(200);
  ev('pointerup', g.svg, p.x, p.y, 'mouse');
  if (g.n === 4 && !log.includes('four')) { log.push('four'); }
  await until(() => g.mode === 'idle' || document.querySelector('.finale'));
}
await until(() => document.querySelector('.finale'), 8000); await wait(700); __shot('finale'); await wait(800);
return log.join(' | ') + ` | collected=${g.collected}/${g.total} finale=${!!document.querySelector('.finale')}`;
