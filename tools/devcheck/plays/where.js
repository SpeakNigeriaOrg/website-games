// Play-through for Where It Happens with real pointer drags, as a finger would: grab the boy, move him in small
// steps onto the place, let go. The teaching turn, one wrong place (he must come back, nothing counted), one drop
// on bare ground (back to the middle, the turn goes on), one tap on a place, then right drags to the finale.
// Works in portrait and --landscape.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(80); } };
const ready = () => until(() => g.finished || (!g.locked && g.want));
const ev = (type, target, x, y) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, buttons: type === 'pointerup' ? 0 : 1 }));
const c = (n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
async function dragTo(to) {
  const a = c(g.kid);
  ev('pointerdown', g.kid, a.x, a.y);
  const steps = 18;
  for (let i = 1; i <= steps; i++) { const x = a.x + (to.x - a.x) * i / steps, y = a.y + (to.y - a.y) * i / steps; ev('pointermove', document.elementFromPoint(x, y) || document.body, x, y); await wait(30); }
  ev('pointerup', document.elementFromPoint(to.x, to.y) || document.body, to.x, to.y);
}
const atHome = () => { const o = g.offset; return Math.abs(o.x) < 1 && Math.abs(o.y) < 1; };
let drags = 0, taps = 0, wrongs = 0, dropped = 0;
const acted = new Set();
const watch = setInterval(() => { if (g.acting) acted.add(g.acting); }, 50);

await ready();
if (!g.teaching) throw new Error('first turn is not the teaching turn');
const n = g.places.length;
window.__shot('teaching');
await dragTo(c(g.placeEl(g.wantPlace))); drags++;
await until(() => g.acting, 5000); await wait(500); window.__shot('acting');
for (let i = 0; i < 60 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  if (i === 0) window.__shot('turn');
  if (i === 1) {
    // a wrong place: he goes, looks puzzled, comes back; nothing counted, the same verb is asked again
    const want = g.want, clean = g.clean;
    await dragTo(c(g.placeEl(g.wrongPlace()))); wrongs++;
    await wait(700); window.__shot('wrong');
    await ready();
    if (!atHome()) throw new Error('after a wrong place the boy is not back in the middle');
    if (g.clean !== clean || g.want !== want) throw new Error('a wrong place changed progress or the verb');
    continue;
  }
  if (i === 2) {
    // let go on bare ground: back to the middle, nothing happens
    const want = g.want, clean = g.clean, k = c(g.kid);
    await dragTo({ x: k.x, y: k.y - 50 }); dropped++;
    await wait(700);
    if (!atHome() || g.clean !== clean || g.want !== want || g.locked) throw new Error('a drop on the ground counted or stuck');
  }
  if (i === 3) { g.placeEl(g.wantPlace).__tap(); taps++; continue; }
  await dragTo(c(g.placeEl(g.wantPlace))); drags++;
}
await until(() => g.finished, 20000);
clearInterval(watch);
await wait(900);
window.__shot('finale');
if (g.clean !== g.total) throw new Error(`clean ${g.clean} of ${g.total}`);
if (n !== g.places.length) throw new Error('places changed');
return `places ${g.places.join(',')} | acted ${[...acted].join(',')} | drags ${drags}, taps ${taps}, wrongs ${wrongs}, dropped ${dropped}, clean ${g.clean}/${g.total}`;
