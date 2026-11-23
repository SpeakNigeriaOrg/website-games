// Flipbook of Who Came to Visit?: a right guest (walks in, waves from a window, strip fills, a new guest
// arrives), a wrong guest (says its name, the right one wobbles) and the recovery, and the last turn into the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
const ready = () => until(() => g.finished || (g.target && !g.locked));
const guests = () => [...document.querySelectorAll('.guest')].map((e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.left + r.width / 2)},${Math.round(r.top + r.height / 2)} op${(+getComputedStyle(e).opacity).toFixed(1)}`; }).join(' | ') + ' windows=' + document.querySelectorAll('.waving img').length;
const log = [];
await ready();
window.__burst('right', 5000, 250); g.choose(true); await wait(5200);
await ready(); log.push('after right ' + guests());
window.__burst('wrong', 4000, 250); g.choose(false); await wait(4200);
await ready(); log.push('after wrong ' + guests());
window.__burst('recover', 4000, 250); g.choose(true); await wait(4200);
for (let i = 0; i < 40 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  if (g.clean === 7 && !window.__fb) { window.__fb = 1; window.__burst('last', 6000, 300); }
  g.choose(true); await wait(300);
}
await until(() => g.finished, 30000); await wait(1000); window.__shot('finale');
return log.join('\n') + ' | clean ' + g.clean;
