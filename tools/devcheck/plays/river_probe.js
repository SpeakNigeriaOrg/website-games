// Where is the frog, really? Its on-screen position and opacity after each move: right hops, one miss (it
// should sink, then reappear on the last safe place), and the start of the next word (back on the near bank).
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 30000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
const frog = document.getElementById('frog');
const where = (tag) => { const r = frog.getBoundingClientRect(); return `${tag}: y=${Math.round((r.top + r.height / 2) / innerHeight * 100)}% op=${(+getComputedStyle(frog).opacity).toFixed(1)}`; };
const log = [where('start')];
for (let move = 0; move < 9 && !g.finished; move++) {
  await until(() => !g.locked || g.finished);
  if (g.finished) break;
  const w = g.word.display, row = g.rowIndex;
  log.push(where(`[${w} row${row}] before`));
  g.choose(move !== 1);
  await wait(250); log.push(where(`  ${move !== 1 ? 'right' : 'WRONG'} mid-hop`));
  await until(() => !g.locked || g.finished, 30000);
  log.push(where(`  after`));
  if (move === 1) window.__shot('after-miss');
}
return log.join('\n');
