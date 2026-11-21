// Play-through for devcheck: teaching model, a right drumming, too few, too many, then the rest right to the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 30000) => { const t = Date.now(); while (!f() && Date.now() - t < ms) await wait(100); return f(); };
const turn = () => until(() => g.word && !g.locked && g.taps === 0);
const drumN = async (n) => { for (let i = 0; i < n; i++) { g.drum(); await wait(450); } };
const log = [];
await wait(1200); __shot('prompt'); await wait(800);
await turn(); __shot('turn'); await wait(500);
// 1: right
let w = g.word; await drumN(w.syllables.length); await wait(300); __shot('drumming');
await until(() => g.joined === 1); await wait(400); __shot('joined'); await wait(600);
log.push(`${w.display}:${w.syllables.length} joined=${g.joined}`);
// 2: too few, then right
await turn(); w = g.word; await drumN(w.syllables.length - 1);
await wait(1700); __shot('too-few'); await wait(600);
await turn(); log.push(`few attempts=${g.attempts}`); await drumN(w.syllables.length);
await until(() => g.word !== w || g.attempts === 0); log.push(`after retry joined=${g.joined}`);
// 3: too many, then right
await turn(); w = g.word; await drumN(w.syllables.length + 2); __shot('too-many'); await wait(600);
await turn(); log.push(`many attempts=${g.attempts}`); await drumN(w.syllables.length);
// the rest right
for (let k = 0; k < 20 && !g.finished; k++) {
  await until(() => g.finished || (g.word && !g.locked && g.taps === 0));
  if (g.finished) break;
  if (g.word.syllables.length >= 3 && !log.some((l) => l.startsWith('long'))) { log.push(`long ${g.word.display}`); __shot('long-word'); await wait(500); }
  await drumN(g.word.syllables.length);
  await until(() => g.locked); await until(() => g.finished || !g.locked || g.taps === 0);
  if (g.joined >= 5 && !log.includes('party')) { log.push('party'); await wait(300); __shot('party'); await wait(700); }
}
await until(() => g.finished, 20000); await wait(800); __shot('finale'); await wait(800);
return log.join(' | ') + ` | joined=${g.joined} finished=${g.finished}`;
