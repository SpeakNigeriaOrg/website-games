// Flipbooks of Where It Happens: the teaching turn (the verb, the ghost hand drags a see-through boy to the place),
// every right action shown in the round (asleep in the bed, eating on the mat, out through the gate, in the basin,
// sitting, drinking), a wrong place (puzzled, the place's own verb, back), and the finale. At the default level 3
// all six places are in the yard.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
const ready = () => until(() => g.finished || (!g.locked && g.want));
// the teaching demonstration starts right after the start tap: record it from the beginning
await until(() => g.want, 15000);
window.__burst('teach', 5200, 260); await wait(5400);
await ready(); g.choose(g.wantPlace);
const shown = new Set();
let wrongDone = false;
for (let i = 0; i < 60 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  if (!wrongDone && i >= 1) {
    wrongDone = true;
    window.__burst('wrong', 4200, 250); g.choose(g.wrongPlace()); await wait(4400);
    continue;
  }
  const p = g.wantPlace;
  if (!shown.has(p)) {
    shown.add(p);
    const ms = p === 'gate' ? 5400 : 4200;
    window.__burst('right-' + p, ms, 300); g.choose(p); await wait(ms + 200);
    continue;
  }
  g.choose(p); await wait(300);
}
await until(() => g.finished, 30000);
window.__burst('finale', 2500, 250);
await wait(2600);
window.__shot('finale');
return 'actions ' + [...shown].join(',') + ' | clean ' + g.clean + '/' + g.total;
