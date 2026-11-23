// Play-through for hungry: a few wrong choices, then right ones until the finale.
const g = window.__game;
const wait = async (cond, ms = 30000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 100)); } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let turns = 0, wrongs = 0;
await wait(() => !g.locked);
window.__shot('teaching');
await pause(1500);
g.choose(g.want);
await pause(700); window.__shot('munch');
for (let i = 0; i < 40 && !g.finished; i++) {
  await wait(() => g.finished || !g.locked);
  if (g.finished) break;
  if (i === 0) window.__shot('two');
  if (g.choices.length === 3 && !window.__s3) { window.__s3 = 1; window.__shot('three'); }
  if (g.choices.length === 4 && !window.__s4) { window.__s4 = 1; window.__shot('four'); }
  if (i === 1 || i === 5) {
    const wrong = g.choices.find((c) => c !== g.want);
    g.choose(wrong); wrongs++;
    await pause(500); window.__shot('wrong' + i);
    continue;
  }
  g.choose(g.want); turns++;
}
await wait(() => g.finished, 20000);
await pause(800);
window.__shot('finale');
return `turns ${turns}, wrongs ${wrongs}, clean ${g.clean}`;
