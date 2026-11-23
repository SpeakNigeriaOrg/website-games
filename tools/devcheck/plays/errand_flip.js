// Flipbooks of Grandma's Errand: the teaching turn (Grandma asks, the ghost hand drags a copy to her), a right fetch
// (taken, smile, into the bag, a new one appears in its place, the strip fills), a wrong one (it says its word and
// goes back), a double request, and the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
const ready = () => until(() => g.finished || (!g.locked && g.want.length));
const log = [];
// the teaching turn: its first demonstration plays right after the start tap; left idle, Grandma asks again and the
// ghost hand drags the copy again (6 s idle): record that one
await ready(); await wait(5600);
window.__burst('teach', 4200, 250); await wait(4400);
await ready(); g.choose(g.want[0]);
await ready();
window.__burst('right', 4500, 250); g.choose(g.want[0]); await wait(4700);
await ready();
window.__burst('wrong', 4500, 250); g.choose(g.things.find((id) => !g.want.includes(id))); await wait(4700);
for (let i = 0; i < 60 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  if (g.double && !window.__db) {
    window.__db = 1;
    window.__burst('double', 9000, 350);
    await wait(200); g.choose(g.want[1]); await ready(); g.choose(g.want[0]); await wait(4000);
    continue;
  }
  g.choose(g.want[0]); await wait(300);
}
await until(() => g.finished, 30000);
window.__burst('finale', 2500, 250);
await wait(2600);
window.__shot('finale');
return 'clean ' + g.clean + '/' + g.requests;
