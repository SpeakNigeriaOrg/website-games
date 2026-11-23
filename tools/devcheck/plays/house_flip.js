// Flipbook of Wake the House: the demo wake, a second (slow) tap, and the last wake into the room's dance and
// the finale. Probes each thing's position, size and filter state.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 30000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(100); } };
await until(() => g.things.length);
window.__burst('demo', 4000, 300);
await until(() => g.things[0].awake && !g.busy && !document.body.classList.contains('locked'));
const probe = () => g.things.map((t) => { const r = t.el.getBoundingClientRect(); const c = t.el.querySelector('.card'); return `${t.word.display}${t.awake ? '*' : ''} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}px ${getComputedStyle(c).filter.slice(0, 12)}`; }).join(' | ');
const log = [probe()];
window.__burst('slow', 3500, 250); g.tapThing(g.things[0]); await wait(200); await until(() => !g.busy);
for (const t of g.things.slice(1, -1)) { g.tapThing(t); await until(() => !g.busy); }
log.push(probe());
window.__burst('last', 12000, 600);
g.tapThing(g.things[g.things.length - 1]);
await until(() => document.querySelector('.finale'), 40000); await wait(1500);
return log.join('\n');
