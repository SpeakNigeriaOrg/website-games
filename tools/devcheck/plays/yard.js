// Play-through for yard: teaching turn, a wrong animal, an empty bush, then right taps to the finale.
const g = window.__game;
const wait = async (cond, ms = 40000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 80)); } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// catch the peek on the first turns
const peekShot = async (name) => { await wait(() => document.querySelector('.animal') && [...document.querySelectorAll('.animal')].some((a) => a.style.transform.includes('scale') && !g.locked) || false, 100).catch(() => {}); };
await wait(() => !g.locked);
window.__shot('teaching');
await pause(1200);
g.tap(g.target);
await pause(600); window.__shot('found');
let wrongAnimal = false, wrongEmpty = false, turns = 0, peeked = false;
for (let i = 0; i < 40; i++) {
  if (!peeked) {
    // screenshot mid-peek on the first two-animal turn
    await wait(() => g.finished || document.querySelectorAll('.animal').length >= 2 && g.bushes.filter(Boolean).length >= 2);
    await wait(() => [...document.querySelectorAll('.animal')].filter((a) => /scale\((?!1\))/.test(a.style.transform) || a.getAnimations().length).length >= 2, 20000).catch(() => {});
    await pause(450); window.__shot('peek'); peeked = true;
  }
  await wait(() => g.finished || !g.locked);
  if (g.finished) break;
  const b = g.bushes;
  if (!wrongAnimal && b.filter(Boolean).length >= 2) {
    const w = b.findIndex((x, k) => x && k !== g.target);
    g.tap(w); wrongAnimal = true; await pause(500); window.__shot('wrong-animal'); continue;
  }
  if (!wrongEmpty && b.some((x) => !x)) {
    g.tap(b.findIndex((x) => !x)); wrongEmpty = true; await pause(300); window.__shot('wrong-empty'); continue;
  }
  if (b.filter(Boolean).length === 3 && !window.__s3) { window.__s3 = 1; window.__shot('three'); }
  g.tap(g.target); turns++;
}
await wait(() => g.finished, 30000);
await pause(900); window.__shot('finale');
return `turns ${turns}, clean ${g.clean}`;
