const g = window.__game;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 30000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout waiting; phase=' + g.phase); await wait(50); } };
const log = [];
const mode = new URLSearchParams(location.search).get('mode') || (window.__mode || 'syllables');
await wait(500);
window.__shot('picker'); await wait(600);
g.pickMode(window.__MODE || 'syllables');
await until(() => g.phase === 'prompt');
await wait(900);
window.__shot('approach');
let n = 0, wrongDone = false, idleChecked = false;
while (g.phase !== 'done' && n < 20) {
  await until(() => g.phase === 'choose' && !g.locked || g.phase === 'done', 40000);
  if (g.phase === 'done') break;
  if (n === 0) window.__shot('choose');
  if (n === 1 && !idleChecked) {
    // doing nothing never wins: wait, the gates stay put and the kart stays between lanes
    idleChecked = true;
    const z0 = g.z; await wait(2500);
    log.push('idle z ' + z0.toFixed(2) + '->' + g.z.toFixed(2) + ' phase ' + g.phase);
    await until(() => g.phase === 'choose' && !g.locked, 40000);
  }
  let side = g.answer;
  if (n === 2 && !wrongDone) { side = side === 'left' ? 'right' : 'left'; wrongDone = true; }
  // real pointer events on the left/right half
  const r = document.getElementById('road').getBoundingClientRect();
  const x = side === 'left' ? r.left + r.width * 0.2 : r.left + r.width * 0.8, y = r.top + r.height * 0.6;
  const road = document.getElementById('road');
  road.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }));
  road.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true }));
  await wait(400);
  if (n === 2) window.__shot('wrong');
  if (n === 0) { await wait(100); window.__shot('passing'); }
  log.push(`${g.word}:${side === g.answer || g.phase !== 'drive' ? '' : ''}${side}`);
  // steering stays open until the gates arrive: wait for the pass, then for it to finish
  await until(() => g.phase === 'drive' || g.phase === 'done', 30000);
  await until(() => g.phase !== 'drive', 20000);
  if (n === 3) window.__shot('afterright');
  n++;
}
await wait(1500);
window.__shot('finale');
return `mode ${g.mode} clean ${g.clean} turns ${n} phase ${g.phase} | ${log.join(' ')}`;
