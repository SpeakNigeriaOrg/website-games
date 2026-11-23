// Play-through for Grandma's Errand with real pointer drags, as a mouse or finger would: grab the thing Grandma
// asked for, move it in small steps onto her, let go. One wrong thing (dragged to her: it must come back to its
// place), one drop on the floor (back to its place, nothing counted), one tap delivery, both things of each
// double request, through to the finale. Works in portrait and --landscape.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(80); } };
const ready = () => until(() => g.finished || (!g.locked && g.want.length));
const ev = (type, target, x, y) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, buttons: type === 'pointerup' ? 0 : 1 }));
const c = (n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
async function dragTo(id, to) {
  const node = g.thingEl(id), a = c(node);
  ev('pointerdown', node, a.x, a.y);
  const steps = 18;
  for (let i = 1; i <= steps; i++) { const x = a.x + (to.x - a.x) * i / steps, y = a.y + (to.y - a.y) * i / steps; ev('pointermove', document.elementFromPoint(x, y) || document.body, x, y); await wait(30); }
  ev('pointerup', document.elementFromPoint(to.x, to.y) || document.body, to.x, to.y);
}
const toGrandma = () => c(g.grandma);
const home = (id) => { const r = g.thingEl(id).getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.top)}`; };
const log = [];
let drags = 0, taps = 0, wrongs = 0, doubles = 0, dropped = 0;

await ready();
if (!g.teaching) throw new Error('first turn is not the teaching turn');
window.__shot('teaching');
await dragTo(g.want[0], toGrandma()); drags++;
await wait(400); window.__shot('taken');
for (let i = 0; i < 60 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  if (i === 0) window.__shot('room');
  if (i === 1) {
    // a wrong thing dragged to Grandma: it says its word and goes back to its place
    const wrong = g.things.find((id) => !g.want.includes(id)), before = home(wrong), clean = g.clean;
    await dragTo(wrong, toGrandma()); wrongs++;
    await wait(700); window.__shot('wrong');
    await ready();
    if (home(wrong) !== before) throw new Error(`wrong thing did not go home: ${before} -> ${home(wrong)}`);
    if (g.clean !== clean) throw new Error('a wrong thing changed progress');
    continue;
  }
  if (i === 2) {
    // dropped on the floor, not on Grandma: back to its place, the turn goes on
    const id = g.want[0], before = home(id), clean = g.clean;
    await dragTo(id, { x: innerWidth * 0.3, y: innerHeight * 0.5 }); dropped++;
    await wait(600);
    if (home(id) !== before || g.clean !== clean || !g.want.includes(id)) throw new Error('a drop beside Grandma counted or moved the thing');
  }
  if (g.double) {
    doubles++;
    if (doubles === 1) window.__shot('double');
    const [a, b] = [...g.want].reverse(); // the second-named first: either order is fine
    await dragTo(a, toGrandma()); drags++;
    await ready();
    if (g.want.length !== 1 || g.want[0] !== b) throw new Error('double: after one, the other should be left: ' + g.want);
    await dragTo(b, toGrandma()); drags++;
    continue;
  }
  if (i % 4 === 3) { g.thingEl(g.want[0]).__tap(); taps++; continue; } // keyboard/tap path too
  await dragTo(g.want[0], toGrandma()); drags++;
}
await until(() => g.finished, 20000);
await wait(900);
window.__shot('finale');
if (g.clean !== g.requests) throw new Error(`clean ${g.clean} of ${g.requests}`);
if (!doubles && g.requests === 8) throw new Error('no double request at level 3');
return `things ${g.words.join(',')} | drags ${drags}, taps ${taps}, wrongs ${wrongs}, dropped ${dropped}, doubles ${doubles}, clean ${g.clean}/${g.requests}`;
