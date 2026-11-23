// Each new zone of Tickle the Giant, seen: for every part, the view it is asked in, a still with that part's
// rects outlined, then a tickle there (a flipbook of the bulge, so you can see it reacts on the right spot).
// Plays no round; it drives the giant's own views and tickles between turns.
const g = window.__game;
const wait = async (cond, ms = 40000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 80)); } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const parts = (new URLSearchParams(location.search).get('parts') || 'ear,navel,nail,chest,thigh').split(',');
const giant = document.getElementById('giant');
function outline(part) {
  const r = giant.getBoundingClientRect(), k = r.width / g.IMG_W, out = [];
  for (const [a, b, c, d] of g.zones.find((z) => z.part === part).rects) {
    const e = document.createElement('div');
    Object.assign(e.style, { position: 'fixed', zIndex: 99, pointerEvents: 'none', left: r.left + a * k + 'px', top: r.top + b * k + 'px', width: (c - a) * k + 'px', height: (d - b) * k + 'px', border: '3px solid magenta', background: 'rgba(255,0,255,.18)' });
    document.body.appendChild(e); out.push(e);
  }
  return () => out.forEach((e) => e.remove());
}
await wait(() => !g.locked);
const log = [];
for (const part of parts) {
  await g.show(part);                     // the view the part is asked in
  await pause(300);
  const off = outline(part); window.__shot('zone-' + part); await pause(600); off();
  window.__burst('tickle-' + part, 1200, 150);
  await pause(100);
  const got = await g.tickleAt(part);
  await pause(1300);
  if (got !== part) throw new Error(`a tap on the middle of ${part} hit ${got}`);
  log.push(`${part}:${g.view}`);
}
return log.join(' ');
