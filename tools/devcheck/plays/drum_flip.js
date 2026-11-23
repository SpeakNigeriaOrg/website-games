// Flipbook of Beat the Drum: a right drumming (the dancer joins the party), too few beats (the dancer waits,
// a ghost hand models it, the child drums again), and the last word into the finale. Probes the waiter.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(80); } };
const turn = () => until(() => g.finished || (g.word && !g.locked && g.taps === 0));
const drumN = async (n) => { for (let i = 0; i < n; i++) { g.drum(); await wait(450); } };
const waiter = document.getElementById('waiter');
const probe = (tag) => { const r = waiter.getBoundingClientRect(), cs = getComputedStyle(waiter); return `${tag}: waiter vis=${cs.visibility} op=${(+cs.opacity).toFixed(1)} x=${Math.round(r.left)} y=${Math.round(r.top)} h=${Math.round(r.height)} src=${waiter.src.split('/').pop()} dancers=${document.querySelectorAll('.party .dancer').length}`; };
const log = [];
await turn(); log.push(probe('t0'));
let w = g.word; window.__burst('right', 4500, 300); await drumN(w.syllables.length);
await until(() => g.joined === 1); await turn(); log.push(probe('t1'));
// too few needs a word of two or more syllables: drum the monosyllables right until one comes
while (g.word.syllables.length < 2) { const m = g.word; await drumN(1); await until(() => g.word !== m); await turn(); }
w = g.word; window.__burst('few', 9000, 450); await drumN(w.syllables.length - 1);
await turn(); log.push(probe('retry'));
await drumN(w.syllables.length);
await until(() => g.word !== w); await turn(); log.push(probe('t2'));
for (let k = 0; k < 20 && !g.finished; k++) {
  await turn(); if (g.finished) break;
  const last = g.queue.clean === g.queue.cleanToWin - 1;
  if (last) window.__burst('last', 6000, 400);
  await drumN(g.word.syllables.length);
  await until(() => g.locked); await until(() => g.finished || (!g.locked));
  log.push(probe('k' + k));
}
await wait(6200);
return log.join('\n');
