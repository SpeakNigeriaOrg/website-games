// Play-through for Windows with real pointer taps, as a finger would: the teaching turn, one wrong window (it says
// its own pair, the right one glows, nothing counted, the same pair asked again, then tapped), then right windows to
// the finale. Checks every turn's other windows share the animal or the action with the asked pair (at level 1:
// the action, another animal). Works in portrait and --landscape.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(80); } };
const pe = (type, target, x, y) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, buttons: type === 'pointerup' ? 0 : 1 }));
async function tap(node) {
  if (!node) throw new Error('nothing to tap');
  const r = node.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const hit = document.elementFromPoint(x, y);
  if (!node.contains(hit)) throw new Error('the window is covered by ' + (hit?.className || hit?.tagName));
  pe('pointerdown', hit, x, y); await wait(60); pe('pointerup', hit, x, y);
}
const level = +new URLSearchParams(location.search).get('level') || 3;
const ready = () => until(() => g.finished || (!g.locked && g.want));
const seen = new Set();
function checkFoils() {
  const w = g.want, ws = g.windows;
  if (ws.filter((x) => x.subject === w.subject && x.action === w.action).length !== 1) throw new Error('the asked pair is not in exactly one window');
  for (const x of ws) {
    seen.add(x.name + (x.video ? '(video)' : ''));
    if (x.subject === w.subject && x.action === w.action) continue;
    const shares = (x.subject === w.subject) !== (x.action === w.action);
    if (!shares) throw new Error(`window ${x.name} shares neither or both words with ${w.subject} ${w.action}`);
    if (level === 1 && x.action !== w.action) throw new Error('level 1: a window differs in the action');
  }
}
await ready();
if (!g.teaching) throw new Error('first turn is not the teaching turn');
const n = g.windows.length;
window.__shot('teaching');
checkFoils();
await tap(g.rightEl());
let turns = 0, wrongs = 0;
for (let i = 0; i < 60 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  checkFoils();
  const want = g.want, turnNo = g.turnNo, clean = g.clean;
  if (i === 0) window.__shot('turn');
  if (i === 1) {
    await tap(g.wrongEl()); wrongs++;
    await wait(1600); window.__shot('wrong');
    await ready();
    if (g.clean !== clean || g.turnNo !== turnNo || g.want.subject !== want.subject) throw new Error('a wrong window changed progress or the asked pair');
    if (!g.rightEl().classList.contains('glow')) throw new Error('the right window does not glow after a miss');
  }
  await tap(g.rightEl()); turns++;
  await until(() => g.turnNo > turnNo || g.finished, 20000);
}
await until(() => g.finished, 20000);
await wait(900);
window.__shot('finale');
if (g.clean !== g.total) throw new Error(`clean ${g.clean} of ${g.total}`);
if (g.windows.length !== n) throw new Error('window count changed');
return `windows ${n} | turns ${turns}, wrongs ${wrongs}, clean ${g.clean}/${g.total} | seen ${[...seen].join(',')}`;
