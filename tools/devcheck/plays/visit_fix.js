// Who Came to Visit?: the guests let in wave from the windows, in front of the bars. Lets guests in until four wave (at most seven), then a
// still and a short flipbook of the waving; logs each window guest's size and whether it overlaps the door or a
// waiting guest.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
const ready = () => until(() => g.finished || (g.target && !g.locked));
const hits = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
for (let i = 0; i < 7 && (i < 3 || document.querySelectorAll(".peek").length < 4); i++) {
  await ready();
  if (i === 0) window.__burst('first-in', 4500, 300);
  g.choose(true); await wait(i === 0 ? 4600 : 300);
}
await ready();
window.__shot('windows');
window.__burst('waving', 1800, 150);
await wait(2000);
const door = document.getElementById('doorway').getBoundingClientRect(), guests = [...document.querySelectorAll('.guest')].map((e) => e.getBoundingClientRect());
const peeks = [...document.querySelectorAll('.peek')].map((p) => { const r = p.getBoundingClientRect(); return `${Math.round(r.width)}px${hits(r, door) ? ' DOOR' : ''}${guests.some((q) => hits(r, q)) ? ' GUEST' : ''}`; });
return `window guests: ${peeks.join(', ')}`;
