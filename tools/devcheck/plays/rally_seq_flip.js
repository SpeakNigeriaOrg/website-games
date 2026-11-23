// Flipbooks of Gate Rally's sequence mode: a word being built (a right gate lights the first stone), the word
// completed (it plays, the stones light in turn, the track transforms into the next scene), and a miss on the next
// word (the right gate glows and speaks while the kart crawls on; the same pair comes again).
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout ' + g.phase); await wait(40); } };
const kart = document.getElementById('kartWrap'), road = document.getElementById('road');
const kx = () => { const r = kart.getBoundingClientRect(), c = road.getBoundingClientRect(); return Math.round(((r.left + r.width / 2) - c.left) / c.width * 100); };
const log = [];
await until(() => document.querySelector('.mode-btn'));
await wait(500);
g.pickMode('sequence');
let words = 0, missed = false;
while (words < 2) {
  await until(() => g.phase === 'choose' && !g.locked);
  const s = g.seq, target = g.target, last = s.i === s.n - 1;
  const wrong = words === 1 && s.i === 0 && !missed;
  if (words === 0 && s.i === 0) window.__burst('build', 3600, 240);
  if (wrong) window.__burst('miss', 6000, 300);
  if (words === 0 && last) window.__burst('complete', 14000, 500);
  const side = wrong ? (g.answer === 'left' ? 'right' : 'left') : g.answer;
  const track = g.track.split('/').pop();
  await g.steer(side);
  log.push(`${g.word} ${s.i + 1}/${s.n} ${target} ${wrong ? 'WRONG' : 'right'} lit=${g.seq ? g.seq.lit : 'done'} x=${kx()} on ${track}`);
  if (wrong) { missed = true; log.push(`  next pair: ${g.seq.i + 1}/${g.seq.n} ${g.target}`); }
  if (!wrong && last) {
    words++;
    await until(() => g.phase === 'prompt' || g.phase === 'done', 30000);
    log.push(`  track now ${g.track.split('/').pop()}`);
  }
}
await wait(1500);
return log.join('\n');
