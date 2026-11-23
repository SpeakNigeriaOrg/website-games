// Every room of Wake the House, seen: each room asleep, then woken (the second tap on the first thing too), so the
// background and the things can be checked in portrait and landscape. No dance; it moves room by room.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 20000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(100); } };
await until(() => g.things.length && g.things[0].awake && !g.busy && !document.body.classList.contains('locked'));
const from = +(new URLSearchParams(location.search).get('from') || 0), log = [];
for (let i = from; i < g.rooms; i++) {
  g.showRoom(i); await wait(900);
  __shot('room' + i + '-asleep'); await wait(700);
  for (const t of g.things.slice(0, -1)) { g.tapThing(t); await until(() => !g.busy && g.tasks === 0); }
  g.tapThing(g.things[0]); await until(() => !g.busy && g.tasks === 0); // second tap: slowly, or said again
  __shot('room' + i + '-awake'); await wait(700);
  log.push(`${i}:${g.words.join(',')}`);
}
return log.join(' | ');
