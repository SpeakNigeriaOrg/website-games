const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 30000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
const log = [];
const act = async (right) => {
  await until(() => !g.locked && g.want);
  const id = right ? g.want : g.choices.find((c) => c !== g.want);
  g.choose(id); await wait(150);
  if (!right) { await until(() => !g.locked && g.want); g.choose(g.want); } // fix the turn after a miss
  await until(() => g.locked); 
};
await until(() => !g.locked && g.want);
if (g.teaching) { g.choose(g.want); await wait(2500); }
for (let i = 0; i < 3; i++) await act(true);
await until(() => g.size >= 1, 10000); log.push('after 3 right size=' + g.size); window.__shot('grown');
for (let i = 0; i < 3; i++) await act(false);
await until(() => g.size <= 0, 10000); log.push('after 3 misses size=' + g.size);
for (let i = 0; i < 3; i++) await act(false);
await until(() => g.size <= -1, 10000); log.push('after 6 misses size=' + g.size); window.__shot('hungry');
return log.join(' | ') + ' | scale=' + document.getElementById('goat').style.scale + ' hungry=' + document.getElementById('goat').classList.contains('hungry');
