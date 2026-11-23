// The ending: after the stars fill, three quick tickles, each making the giant bounce harder, then the collapse.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 30000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(60); } };
let speedAsks = 0, shot = false;
while (!document.querySelector('.finale')) {
  await until(() => document.querySelector('.finale') || (!g.locked && g.target), 30000);
  if (document.querySelector('.finale')) break;
  if (g.speed) { speedAsks++; if (!shot) { shot = true; window.__burst('speed', 12000, 400); } }
  g.tap(g.target); await wait(500);
}
return `speed-round asks ${speedAsks}`;
