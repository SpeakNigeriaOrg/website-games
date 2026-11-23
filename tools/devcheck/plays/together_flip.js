// Flipbook of Put It Together: a right pick (the whole grows over the pot, the parts nod, strip fills, next
// turn's parts arrive), a wrong pick (the foil wobbles and fades, the right one glows and moves over the pot),
// and the last turn into the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
const ready = () => until(() => g.finished || !g.locked);
const cards = () => [...document.querySelectorAll('.card')].map((c) => { const r = c.getBoundingClientRect(); return `${c.classList.contains('part') ? 'P' : 'C'} ${Math.round(r.left + r.width / 2)},${Math.round(r.top + r.height / 2)} op${(+getComputedStyle(c).opacity).toFixed(1)}`; }).join(' | ');
const log = [];
await ready(); g.choose(g.want); // teaching
await ready();
window.__burst('right', 6000, 300); g.choose(g.want); await wait(6200);
await ready(); log.push('turn ' + cards());
window.__burst('wrong', 6000, 300); g.choose(g.choices.find((c) => c !== g.want)); await wait(1800); log.push('mid wrong ' + cards()); await wait(4400);
for (let i = 0; i < 40 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  if (g.clean === g.words.length - 1 && !window.__fb) { window.__fb = 1; window.__burst('last', 5000, 300); }
  g.choose(g.want); await wait(300);
}
await until(() => g.finished, 30000); await wait(1000); window.__shot('finale');
return log.join('\n') + ' | clean ' + g.clean + '/' + g.words.length;
