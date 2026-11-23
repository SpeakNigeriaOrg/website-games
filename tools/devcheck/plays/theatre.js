// Play-through for Puppet Theatre with real pointer taps, as a finger would. Free play first (three shows: each
// choice says its word, the curtain opens on that pair), then the game: the teaching turn, one wrong pair (the
// chosen scene plays, nothing counted, the same pair asked again), one turn set up action first, then right pairs
// to the finale. Works in portrait and --landscape.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(80); } };
const pe = (type, target, x, y) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, buttons: type === 'pointerup' ? 0 : 1 }));
async function tap(node) {
  if (!node) throw new Error('nothing to tap');
  const r = node.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const hit = document.elementFromPoint(x, y);
  if (!node.contains(hit)) throw new Error('the choice is covered by ' + (hit?.className || hit?.tagName));
  pe('pointerdown', hit, x, y); await wait(60); pe('pointerup', hit, x, y);
}
const shows = new Set();
const watch = setInterval(() => { if (g.showing) shows.add(g.showing + (g.showingVideo ? '(video)' : '')); }, 100);
const ready = () => until(() => g.finished || (!g.locked && (g.mode === 'free' || g.want)));

// free play
let free = 0;
await ready();
if (g.mode !== 'free') throw new Error('the round did not start with free play');
window.__shot('free');
for (let i = 0; i < 3; i++) {
  await ready();
  const s = g.subjects[i % g.subjects.length], a = g.actions[(i + 1) % g.actions.length];
  await tap(g.pickEl(s)); await wait(100);
  await until(() => !g.locked, 8000);
  await tap(g.pickEl(a));
  await until(() => g.showing, 8000);
  if (i === 0) { await wait(1500); window.__shot('free-show'); }
  free++;
  await until(() => !g.showing, 15000);
}
await until(() => g.mode === 'game' && g.want, 15000);
await ready();
if (!g.teaching) throw new Error('first asked turn is not the teaching turn');
window.__shot('teaching');
let turns = 0, wrongs = 0, actionFirst = 0;
for (let i = 0; i < 60 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  const want = g.want, turnNo = g.turnNo, clean = g.clean;
  if (i === 1) {
    const bad = g.wrongPair();
    await tap(g.pickEl(bad.subject)); await wait(150); await tap(g.pickEl(bad.action)); wrongs++;
    await until(() => g.showing, 8000); await wait(1200); window.__shot('wrong');
    await ready();
    if (g.clean !== clean || g.turnNo !== turnNo || g.want.subject !== want.subject || g.want.action !== want.action) throw new Error('a wrong pair changed progress or the asked pair');
    if (g.selected.subject || g.selected.action) throw new Error('the choices were not cleared after a wrong pair');
    continue;
  }
  if (i === 2) { await tap(g.pickEl(want.action)); await wait(150); await tap(g.pickEl(want.subject)); actionFirst++; }
  else { await tap(g.pickEl(want.subject)); await wait(150); await tap(g.pickEl(want.action)); }
  turns++;
  if (i === 3) { await until(() => g.showing, 8000); await wait(1500); window.__shot('right'); }
  await until(() => g.turnNo > turnNo || g.finished, 20000);
}
await until(() => g.finished, 20000);
clearInterval(watch);
await wait(900);
window.__shot('finale');
if (g.clean !== g.total) throw new Error(`clean ${g.clean} of ${g.total}`);
return `grid ${g.subjects.length}x${g.actions.length} | free ${free}, turns ${turns}, wrongs ${wrongs}, action-first ${actionFirst}, clean ${g.clean}/${g.total} | shows ${[...shows].join(',')}`;
