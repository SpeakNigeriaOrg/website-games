// Flipbook of clean crossings: the frog reaches the far bank and a hut is built where it lands.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 30000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
for (let word = 0; word < 3; word++) {
  const w = g.word;
  while (g.word === w && !g.finished) {
    await until(() => !g.locked || g.word !== w);
    if (g.word !== w) break;
    if (word === 1 && g.rowIndex === g.word.rows.length - 1) { window.__burst('bank', 3600, 300); }
    g.choose(true); await wait(400);
  }
}
await wait(3800);
window.__shot('village');
if (g.huts < 2) throw new Error('huts ' + g.huts);
return 'huts ' + g.huts;
