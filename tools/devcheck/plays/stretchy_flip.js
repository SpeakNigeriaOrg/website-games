// Flipbook of Stretchy Word: a press-and-hold stretch (a bump per syllable, the creature joins the gallery),
// the spring back, walking to the next creature, and the last creature into the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 30000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout ' + g.mode); await wait(80); } };
const ready = () => until(() => g.mode === 'idle' && !document.body.classList.contains('locked'));
const ev = (type, target, x, y) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'mouse', isPrimary: true }));
const centreOf = (node) => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const filled = () => document.querySelectorAll('.progress-strip .slot.filled').length;
const svgBox = () => { const r = g.svg.getBoundingClientRect(); return `svg ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`; };
const log = [];
await ready(); log.push('rest ' + svgBox());
async function hold(tag) {
  const p = centreOf(g.body());
  if (tag) window.__burst(tag, 1200 + g.n * 700 + 2200, 300);
  ev('pointerdown', g.body(), p.x, p.y);
  await until(() => g.played === g.n, 15000); await wait(400);
  log.push(`${g.word.display} n=${g.n} bumps=${g.bumps} filled=${filled()}`);
  ev('pointerup', g.svg, p.x, p.y);
  await until(() => g.mode === 'idle' || document.querySelector('.finale'));
}
await hold('stretch');
await ready();
window.__burst('walk', 2400, 200); document.getElementById('next').click(); await wait(300); await ready();
log.push('after walk ' + svgBox() + ' ' + g.word.display);
for (let i = 0; i < 14 && g.collected < g.total; i++) {
  if (g.collected === g.total - 1) await hold('last'); else await hold();
  if (g.collected < g.total) { await ready(); document.getElementById('next').click(); await wait(300); await ready(); }
}
await wait(3500);
return log.join('\n') + ` | collected=${g.collected}/${g.total} finale=${!!document.querySelector('.finale')}`;
