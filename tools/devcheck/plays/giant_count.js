// How long is a round, as a child experiences it? Counts every request ("tickle the …") until the finale,
// answering right except one miss in each phase, and reports scored vs speed-round requests.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 30000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(60); } };
const t0 = Date.now(); let asks = 0, speedAsks = 0, last = null, missedScored = false, missedSpeed = false;
while (!document.querySelector('.finale') && Date.now() - t0 < 240000) {
  await until(() => document.querySelector('.finale') || (!g.locked && g.target), 30000);
  if (document.querySelector('.finale')) break;
  const speedy = document.body.classList.contains('speedy');
  speedy ? speedAsks++ : asks++;
  const wrong = speedy ? !missedSpeed : (!missedScored && asks === 3);
  if (wrong) { speedy ? (missedSpeed = true) : (missedScored = true); g.tap(['hair', 'eye', 'leg', 'palm', 'teeth', 'finger'].find((p) => p !== g.target && !(g.target === 'leg' && p === 'knee'))); }
  else g.tap(g.target);
  await wait(400);
  await until(() => document.querySelector('.finale') || g.locked || g.target !== last, 8000).catch(() => {});
  last = g.target;
}
return `finale=${!!document.querySelector('.finale')} scored asks=${asks} speed-round asks=${speedAsks} clean=${g.clean} seconds=${Math.round((Date.now() - t0) / 1000)}`;
