// Flipbook of Sort It: the teaching parcel carried by the ghost hand, a right placement (opens, the thing finds its
// spot and stays), a wrong one (head shake, bump home, peek, leaves) and the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(60); } };
const ready = () => until(() => g.finished || (!g.locked && g.want));
window.__burst('teach', 7000, 350);
await until(() => g.teaching, 5000);
await ready(); await wait(300);
window.__burst('right', 3600, 200); g.choose(g.wantPlace); await wait(3800);
await ready();
window.__burst('wrong', 4800, 250); g.choose(g.wrongPlace()); await wait(5000);
for (let i = 0; i < 30 && !g.finished; i++) { await ready(); if (g.finished) break; g.choose(g.wantPlace); await wait(300); }
window.__burst('finale', 3000, 300);
await until(() => g.finished, 30000); await wait(3200);
return 'places ' + g.places + ' filled ' + JSON.stringify(g.filled);
