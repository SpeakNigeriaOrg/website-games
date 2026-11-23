const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 30000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(100); } };
let moves = 0, missedOnce = false;
await until(() => g.word && !g.locked);
window.__shot('first-row');
while (!g.finished && moves < 60) {
  await until(() => !g.locked || g.finished);
  if (g.finished) break;
  const right = missedOnce || moves !== 1; // one deliberate miss on the second move
  if (!right) missedOnce = true;
  g.choose(right);
  moves++;
  if (moves === 2) { await wait(400); window.__shot('splash'); }
  await wait(200);
}
window.__shot('finale');
return `moves=${moves} clean=${g.clean} finished=${g.finished}`;
