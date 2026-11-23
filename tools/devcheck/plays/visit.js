// Play-through for devcheck: the introductions, a wrong guest then the right one, a stranger named by
// elimination, then right answers to the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f() && Date.now() - t < ms) await wait(100); return f(); };
const ready = () => until(() => g.finished || (g.target && !g.locked));
const log = [];
await wait(1800); __shot('intro');
await ready(); __shot('turn1'); log.push(`known=${g.known.length}`);
// wrong first
const wrongId = g.choose(false); await wait(900); __shot('wrong-says-name');
await ready(); log.push(`wrong ${wrongId} misses=${g.misses}`);
g.choose(true); await wait(700); __shot('going-in'); await wait(1300); __shot('inside');
let sawStranger = false, strangerNamed = 0, turns = 0;
for (let k = 0; k < 40 && !g.finished; k++) {
  await ready();
  if (g.finished) break;
  turns++;
  if (g.guests.some((x) => x?.stranger) && !sawStranger) { sawStranger = true; __shot('stranger-waiting'); }
  if (g.targetIsStranger) { strangerNamed++; if (strangerNamed === 1) { log.push(`stranger named after waiting ${g.guests.find((x) => x?.stranger).waited} turns`); } }
  g.choose(true);
  if (g.targetIsStranger && strangerNamed === 1) { await wait(2600); __shot('stranger-inside'); }
  await wait(600);
}
await until(() => g.finished, 30000); await wait(900); __shot('finale');
return log.join(' | ') + ` | turns=${turns} strangersNamed=${strangerNamed} known=${g.known.length} clean=${g.clean} finished=${g.finished}`;
