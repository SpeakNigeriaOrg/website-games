// Flipbooks of Puppet Theatre: a free-play show (each choice says its word, the curtain opens on the pair), the
// teaching turn (the pair, the ghost hand taps the animal then the action), a right pair, a wrong pair (the chosen
// scene plays, then the asked pair again), and the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
const tap = (id) => g.pickEl(id).__tap();
await until(() => !g.locked && g.mode === 'free', 15000);
window.__burst('free', 7000, 350);
tap(g.subjects[0]); await until(() => !g.locked, 8000); tap(g.actions[0]);
await wait(7200);
for (let i = 1; i < 3; i++) { await until(() => !g.locked, 15000); tap(g.subjects[i % g.subjects.length]); await until(() => !g.locked, 8000); tap(g.actions[i % g.actions.length]); await until(() => g.showing, 8000); }
await until(() => g.want, 20000);
window.__burst('teach', 7000, 350); await wait(7200);
const ready = () => until(() => g.finished || (!g.locked && g.want));
await ready(); tap(g.want.subject); tap(g.want.action);
let rightDone = false, wrongDone = false;
for (let i = 0; i < 60 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  const w = g.want, turnNo = g.turnNo;
  if (!rightDone) { rightDone = true; window.__burst('right', 6000, 300); tap(w.subject); tap(w.action); await wait(6200); }
  else if (!wrongDone) { wrongDone = true; const b = g.wrongPair(); window.__burst('wrong', 8000, 350); tap(b.subject); tap(b.action); await wait(8200); continue; }
  else { tap(w.subject); tap(w.action); }
  await until(() => g.turnNo > turnNo || g.finished, 20000);
}
await until(() => g.finished, 30000);
window.__burst('finale', 2500, 250);
await wait(2600);
return 'clean ' + g.clean + '/' + g.total;
