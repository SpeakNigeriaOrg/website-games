// Flipbook of Tickle the Giant: a right tickle (the part bulges, the giant squirms, a star fills), a wrong tap
// and its recovery, the move to a close view, and the speed round's collapse into the finale. Probes the giant.
const g = window.__game;
const wait = async (cond, ms = 40000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 80)); } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const giant = document.getElementById('giant');
const probe = (tag) => { const r = giant.getBoundingClientRect(); return `${tag}: view=${g.view} giant ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} tf=${getComputedStyle(giant).transform} inline=[${giant.style.transform}] collapsed=${giant.classList.contains('collapsed')} stars=${document.querySelectorAll('.progress-strip .slot.filled').length}`; };
const log = [];
await wait(() => !g.locked); log.push(probe('teach'));
g.tap(g.target); await pause(200); await wait(() => g.finished || g.speed || !g.locked);
window.__burst('right', 3000, 250);
g.tap(g.target); await pause(200); await wait(() => !g.locked); log.push(probe('after right'));
window.__burst('wrong', 4000, 300);
const other = ['hair', 'leg', 'eye', 'palm'].find((p) => p !== g.target && !(g.target === 'leg' && p === 'knee'));
g.tap(other); await pause(200); await wait(() => !g.locked); log.push(probe('after wrong'));
let closeShot = false;
for (let i = 0; i < 40; i++) {
  await wait(() => g.finished || g.speed || !g.locked);
  if (g.finished || g.speed) break;
  if (g.view !== 'whole' && !closeShot) { closeShot = true; log.push(probe('close')); }
  g.tap(g.target);
  await pause(200);
}
if (g.speed) {
  while (g.speed && !g.finished) {
    await wait(() => g.finished || !g.speed || !g.locked || giant.classList.contains('collapsed'), 20000);
    if (!g.speed || g.finished || !g.target || giant.classList.contains('collapsed')) break;
    if (!window.__collapseBurst && g.view === 'whole') { /* noop */ }
    g.tap(g.target); await pause(150);
  }
  window.__burst('collapse', 6000, 400);
  await wait(() => giant.classList.contains('collapsed'), 20000); await pause(1200); log.push(probe('collapsed'));
}
await wait(() => g.finished, 20000); await pause(1500);
return log.join('\n');
