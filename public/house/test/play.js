// Play-through for devcheck: demo, wake each thing, a second (slow) tap, queued taps, the room's dance.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 20000) => { const t = Date.now(); while (!f() && Date.now() - t < ms) await wait(100); return f(); };
await until(() => g.things.length);
await wait(300); __shot('demo'); await wait(900);
await until(() => g.things[0].awake && !g.busy && !document.body.classList.contains('locked'));
__shot('first-awake'); await wait(900);
// queue three taps at once: wake 2, wake 3, slow 2
g.tapThing(g.things[1]); g.tapThing(g.things[2]); g.tapThing(g.things[1]);
const queued = g.tasks;
await wait(500); __shot('queued'); await wait(900);
await until(() => !g.busy && g.tasks === 0);
for (const t of g.things.slice(3, -1)) { g.tapThing(t); await until(() => !g.busy); }
__shot('almost'); await wait(900);
g.tapThing(g.things[g.things.length - 1]);
await until(() => g.celebrating);
await wait(1500); __shot('dance'); await wait(900);
await until(() => document.querySelector('.finale'), 30000);
await wait(600); __shot('finale'); await wait(900);
document.querySelector('.again-btn').click();
await wait(800); __shot('room2'); await wait(900);
return `things=${g.things.length} queuedAtOnce=${queued} room=${g.room}`;
