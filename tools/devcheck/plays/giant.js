// Play-through for giant: zone overlays in both views, teaching turn, a few wrong taps, the speed round, the finale.
const g = window.__game;
const wait = async (cond, ms = 40000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error('timeout ' + JSON.stringify({ locked: g.locked, target: g.target, view: g.view, speed: g.speed, clean: g.clean, body: document.body.className })); await new Promise((r) => setTimeout(r, 80)); } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
function overlay() {
  const r = document.getElementById('giant').getBoundingClientRect(), k = r.width / g.IMG_W;
  const cols = { eye: 'blue', nose: 'purple', teeth: 'red', knee: 'orange', finger: 'magenta', palm: 'green', hair: 'cyan', leg: 'brown', ear: 'gold', navel: 'lime', nail: 'deeppink', chest: 'navy', thigh: 'teal' };
  const out = [];
  for (const z of g.zones) for (const [a, b, c, d] of z.rects) {
    const e = document.createElement('div');
    Object.assign(e.style, { position: 'fixed', zIndex: 99, pointerEvents: 'none', left: r.left + a * k + 'px', top: r.top + b * k + 'px', width: (c - a) * k + 'px', height: (d - b) * k + 'px', border: `2px solid ${cols[z.part]}`, font: '10px sans-serif', color: cols[z.part] });
    e.textContent = z.part; document.body.appendChild(e); out.push(e);
  }
  return () => out.forEach((e) => e.remove());
}
await wait(() => !g.locked);
let off = overlay(); window.__shot('zones-whole'); await pause(700); off();
window.__shot('teaching');
await pause(1500);
g.tap(g.target);
await pause(450); window.__shot('tickle');
let wrongs = 0, turns = 0, closeShot = false;
for (let i = 0; i < 40; i++) {
  await wait(() => g.finished || g.speed || !g.locked);
  if (g.finished || g.speed) break;
  if (g.view !== 'whole' && !(window.__views ||= {})[g.view]) { window.__views[g.view] = 1; await pause(200); off = overlay(); window.__shot('zones-' + g.view); await pause(700); off(); }
  if (i === 1) { // tap the nose: no word
    const p = g.point('nose'); g.tapAt(p.x, p.y); wrongs++; await pause(300); window.__shot('wrong-nose'); continue;
  }
  if (i === 3) { // tap another of our parts: it says its own name
    const other = ['hair', 'leg', 'eye', 'palm'].find((p) => p !== g.target && !(g.target === 'leg' && p === 'knee'));
    g.tap(other); wrongs++; await pause(300); window.__shot('wrong-part'); continue;
  }
  g.tap(g.target); turns++;
}
await wait(() => g.speed || g.finished);
let speedTaps = 0;
if (g.speed) {
  await wait(() => !g.locked || g.finished);
  window.__shot('speed');
  while (g.speed && !g.finished) {
    await wait(() => g.finished || !g.speed || !g.locked || document.querySelector('.giant.collapsed'), 20000);
    if (!g.speed || g.finished || !g.target || document.querySelector('.giant.collapsed')) break;
    g.tap(g.target); speedTaps++;
    await pause(150);
  }
  await wait(() => document.querySelector('.giant.collapsed'), 20000); await pause(1100); window.__shot('collapse');
}
await wait(() => g.finished, 20000);
await pause(800); window.__shot('finale');
return `turns ${turns}, wrongs ${wrongs}, clean ${g.clean}, speed taps ${speedTaps}`;
