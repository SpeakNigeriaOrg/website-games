// Play-through for devcheck: the lead-in, a wrong balloon (swap and speak again), the right one, then the rest
// right to the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f() && Date.now() - t < ms) await wait(100); return f(); };
const ready = () => until(() => g.finished || (g.scene && !g.locked));
const log = [];
await wait(700); __shot('lead-in'); await wait(1800); __shot('cue');
await ready(); __shot('balloons'); log.push(`${g.scene}: ${g.phrases.join(' / ')}`);
g.choose(false); await wait(2600); __shot('wrong');
await ready(); log.push(`misses=${g.misses}`);
g.choose(true); await wait(2600); __shot('reaction');
const seen = new Set();
for (let k = 0; k < 20 && !g.finished; k++) {
  await ready();
  if (g.finished) break;
  if (!seen.has(g.scene)) { seen.add(g.scene); __shot('scene-' + g.scene); log.push(`${g.scene}: ${g.phrases.join(' / ')}`); }
  g.choose(true); await wait(800);
}
await until(() => g.finished, 30000); await wait(900); __shot('finale');
return log.join(' | ') + ` | clean=${g.clean} finished=${g.finished}`;
