// Flipbook of You're Hungry!: a right food (flies to the mouth, chomp, strip fills), a wrong food (sniffed,
// named, pushed back) and its recovery, the goat growing after three clean feeds, and the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
const ready = () => until(() => g.finished || (!g.locked && g.want));
const plates = () => [...document.querySelectorAll('.plate')].map((p) => { const r = p.getBoundingClientRect(); return `${Math.round(r.left + r.width / 2)},${Math.round(r.top + r.height / 2)} op${(+getComputedStyle(p).opacity).toFixed(1)} ${getComputedStyle(p).visibility[0]} tf=${p.style.transform || '-'}`; }).join(' | ');
const log = [];
await ready(); g.choose(g.want); // teaching
await ready();
window.__burst('right', 3800, 200); g.choose(g.want); await wait(4000);
await ready(); log.push('before wrong ' + plates());
window.__burst('wrong', 4500, 250); g.choose(g.choices.find((c) => c !== g.want)); await wait(4700);
await ready(); log.push('after wrong ' + plates());
window.__burst('recover', 3500, 250); g.choose(g.want); await wait(3700);
for (let i = 0; i < 40 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  if (g.clean === 2 && !window.__gb) { window.__gb = 1; window.__burst('grow', 4500, 300); }
  if (g.clean === 7 && !window.__fb) { window.__fb = 1; window.__burst('last', 5000, 300); }
  g.choose(g.want); await wait(300);
}
await until(() => g.finished, 30000); await wait(1000); window.__shot('finale');
return log.join('\n') + ' | clean ' + g.clean + ' size ' + g.size;
