// Flipbook of Hide and Seek: a right find (pop out, joy, hop to another bush, dive), a wrong animal (peeks,
// says its name, the right bush rustles) and its recovery, and the last find into the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
const ready = () => until(() => g.finished || !g.locked);
const animals = () => [...document.querySelectorAll('.animal')].map((a) => { const r = a.getBoundingClientRect(); return `${Math.round(r.left + r.width / 2)},${Math.round(r.top + r.height / 2)} op${(+getComputedStyle(a).opacity).toFixed(1)}`; }).join(' | ');
const log = [];
await ready(); g.tap(g.target); // teaching
await ready(); log.push('turn1 ' + animals());
window.__burst('right', 3600, 200); g.tap(g.target); await wait(3800);
await ready(); log.push('after right ' + animals());
const b = g.bushes; const wrong = b.findIndex((x, k) => x && k !== g.target);
window.__burst('wrong', 4500, 250); g.tap(wrong); await wait(4700);
await ready(); log.push('after wrong ' + animals() + ' strip=' + document.querySelectorAll('.slot.filled').length);
window.__burst('recover', 3000, 250); g.tap(g.target); await wait(3200);
for (let i = 0; i < 30 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  if (g.clean === 5 && !window.__fb) { window.__fb = 1; window.__burst('last', 5000, 300); }
  g.tap(g.target); await wait(300);
}
await until(() => g.finished, 30000); await wait(1000); window.__shot('finale');
return log.join('\n') + ' | clean ' + g.clean;
