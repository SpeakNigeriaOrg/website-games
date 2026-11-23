// Flipbook of Silly Parrot: a right answer, a miss (hammer on a right word: offended parrot, the streak spills)
// and its fix, and the streak filling to the finale. Logs the parrot's transform while it is offended.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout ' + JSON.stringify(g.state)); await wait(60); } };
const ready = () => until(() => g.state.finished || (!g.state.locked && (g.state.phase === 'answer' || g.state.phase === 'fix')));
const parrot = document.getElementById('parrot');
const log = [];
await ready();
window.__burst('right', 3500, 200); g.tap(g.state.correct); await wait(3700);
// a clean one more so there is a streak to spill
await ready(); g.tap(g.state.correct); await wait(400);
while (true) { await ready(); if (g.state.correct === 'seed') break; g.tap('hammer'); await wait(400); }
log.push('streak before miss ' + g.state.streak);
window.__burst('miss', 4500, 250); g.tap('hammer');
await wait(1000); log.push('offended: class=' + parrot.className + ' transform=' + getComputedStyle(parrot).transform + ' inline=' + (parrot.style.transform || '-'));
await wait(3700);
await ready(); log.push('phase ' + g.state.phase + ' streak ' + g.state.streak);
window.__burst('fix', 2500, 250); g.tap(g.state.correct); await wait(2700);
for (let i = 0; i < 40 && !g.state.finished; i++) {
  await ready(); if (g.state.finished) break;
  if (g.state.phase === 'fix') { g.tap(g.state.correct); await wait(300); continue; }
  if (g.state.streak === 4 && !window.__fb) { window.__fb = 1; window.__burst('last', 5000, 300); }
  g.tap(g.state.correct); await wait(300);
}
await until(() => g.state.finished, 30000); await wait(1000); window.__shot('finale');
return log.join('\n');
