// Flipbooks of Windows: the teaching turn (the pair, the ghost hand taps the right window), a right window (its
// animal jumps for joy, the pair again), a wrong window (it says its own pair, the right one glows, the asked pair
// again), and the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
await until(() => g.want, 15000);
window.__burst('teach', 7000, 350); await wait(7200);
const ready = () => until(() => g.finished || (!g.locked && g.want));
await ready(); g.rightEl().__tap();
let rightDone = false, wrongDone = false;
for (let i = 0; i < 60 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  const turnNo = g.turnNo;
  if (!rightDone) { rightDone = true; window.__burst('right', 4500, 300); g.rightEl().__tap(); await wait(4700); }
  else if (!wrongDone) { wrongDone = true; window.__burst('wrong', 7000, 350); g.wrongEl().__tap(); await wait(7200); await ready(); g.rightEl().__tap(); }
  else g.rightEl().__tap();
  await until(() => g.turnNo > turnNo || g.finished, 20000);
}
await until(() => g.finished, 30000);
window.__burst('finale', 2500, 250);
await wait(2600);
return 'clean ' + g.clean + '/' + g.total;
