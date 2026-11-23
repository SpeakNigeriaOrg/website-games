// Flipbook of Gate Rally: a right gate (lane change, coin to the strip), a wrong gate (skid, word again, next
// pair starts between the lanes), and the last gate into the finale. Logs the kart's position after each.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout ' + g.phase); await wait(50); } };
const kart = document.getElementById('kartWrap'), road = document.getElementById('road');
const kx = () => { const r = kart.getBoundingClientRect(), c = road.getBoundingClientRect(); return Math.round(((r.left + r.width / 2) - c.left) / c.width * 100); };
const stars = () => document.querySelectorAll('.progress-strip .slot.filled').length;
const log = [];
await wait(500); g.pickMode('syllables');
let n = 0;
while (g.phase !== 'done' && n < 20) {
  await until(() => (g.phase === 'choose' && !g.locked) || g.phase === 'done');
  if (g.phase === 'done') break;
  const right = n !== 1;
  const side = right ? g.answer : (g.answer === 'left' ? 'right' : 'left');
  const last = g.clean === 7 && right;
  if (n === 0) window.__burst('right', 2800, 200);
  if (n === 1) window.__burst('wrong', 4500, 300);
  if (last) window.__burst('last', 4500, 300);
  log.push(`t${n} ${right ? 'R' : 'W'} before x=${kx()} z=${g.z.toFixed(1)}`);
  await g.steer(side);
  log.push(`  after x=${kx()} stars=${stars()} clean=${g.clean}`);
  await until(() => g.phase === 'prompt' || g.phase === 'done');
  log.push(`  next x=${kx()}`);
  n++;
}
await wait(4600);
window.__shot('end');
return log.join('\n');
