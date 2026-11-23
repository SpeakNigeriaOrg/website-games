// Flipbook of Word Train: a Missing Carriage turn placed wrong (wobble, pop-off) then right (the train says the
// word and chugs off, a new train rolls in), an order turn placed wrong then right, and the last turn into the
// finale. Probes where the train and the carriages are, and their inline transforms.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(100); } };
const ready = () => until(() => g.finished || (g.word && !g.locked && g.looseCount > 0));
const train = document.getElementById('train');
const probe = (tag) => { const t = train.getBoundingClientRect(); const cars = [...document.querySelectorAll('.car')].map((c) => { const r = c.getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.top)} op${(+getComputedStyle(c).opacity).toFixed(1)} [${c.style.transform || '-'}]`; }); return `${tag}: train x=${Math.round(t.left)} tf=[${train.style.transform || '-'}] cars ${cars.join(' | ')}`; };
const log = [];
await ready(); log.push(probe('missing ready'));
window.__burst('missing-wrong', 6500, 350);
g.tap(false); await until(() => g.locked); await ready(); log.push(probe('after pop-off'));
window.__burst('missing-right', 6500, 350);
g.tap(true); await until(() => g.locked);
let didOrder = false;
for (let k = 0; k < 40 && !g.finished; k++) {
  await ready(); if (g.finished) break;
  if (k === 0) log.push(probe('next turn ready'));
  if (g.level === 'order' && !didOrder && g.looseCount === g.word.syllables.length) {
    didOrder = true; window.__burst('order-wrong', 9000, 450);
    while (g.looseCount > 0) { await until(() => !g.locked); if (g.looseCount === 0) break; g.tap(g.looseCount === 1); await wait(700); }
    await until(() => g.locked); await ready(); log.push(probe('order after pop'));
    continue;
  }
  const last = g.clean === 5 && g.looseCount === 1;
  if (last) window.__burst('last', 6000, 400);
  g.tap(true); await wait(700);
}
await until(() => g.finished, 30000); await wait(1500);
return log.join('\n') + ` | clean=${g.clean}`;
