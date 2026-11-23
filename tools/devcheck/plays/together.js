// Play-through for together: the teaching turn, a part tapped to hear it again, one wrong pick, then right picks
// until the finale. Every turn shows two parts and two pictures, and the foil is never a part.
const g = window.__game;
const wait = async (cond, ms = 30000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 100)); } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(() => !g.locked);
if (!g.teaching) throw new Error('first turn is not the teaching turn');
window.__shot('teaching');
g.choose(g.want);
await pause(500); window.__shot('right');
let turns = 0, wrongs = 0;
const seen = new Set();
for (let i = 0; i < 40 && !g.finished; i++) {
  await wait(() => g.finished || !g.locked);
  if (g.finished) break;
  if (g.parts.length < 2 || g.choices.length !== 2 || !g.choices.includes(g.want)) throw new Error(`bad turn: parts ${g.parts} choices ${g.choices} want ${g.want}`);
  const foil = g.choices.find((c) => c !== g.want);
  if (g.parts.includes(foil)) throw new Error('foil is a part: ' + foil);
  seen.add(g.want);
  if (i === 0) {
    window.__shot('choices');
    g.hear(1); await pause(200); await wait(() => !g.locked);
  }
  if (i === 1) { g.choose(foil); wrongs++; await pause(400); window.__shot('wrong'); await pause(1800); window.__shot('wrong_shown'); continue; }
  g.choose(g.want); turns++;
  if (i === 2) { await pause(900); window.__shot('whole'); }
}
await wait(() => g.finished, 20000);
await pause(800);
window.__shot('finale');
return `words ${g.words.join(',')} | played ${[...seen].join(',')} | turns ${turns}, wrongs ${wrongs}, clean ${g.clean}`;
