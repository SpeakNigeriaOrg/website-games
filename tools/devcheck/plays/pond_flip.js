// Flipbook of Frog Pond: a wrong frog (says its word, blinks, sinks), a catch (frog turns into the thing, which
// flies to the strip), the guide's next round, and the last catch into the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 60000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout ' + g.phase); await wait(40); } };
const tapReal = () => { const b = g.tapEl(); if (!b) return; const r = b.getBoundingClientRect(); const o = { clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.6, bubbles: true }; b.dispatchEvent(new PointerEvent('pointerdown', o)); b.dispatchEvent(new PointerEvent('pointerup', o)); };
const log = [];
let wrongDone = false, rounds = g.words.length;
while (g.phase !== 'done') {
  await until(() => g.frog || g.phase === 'done' || g.phase === 'between');
  if (g.phase === 'done') break;
  if (g.phase === 'between') { await until(() => g.phase !== 'between'); continue; }
  const f = g.frog, el = g.tapEl(), round = g.round;
  if (!f.isTarget && !wrongDone) { wrongDone = true; window.__burst('wrong', 2400, 200); tapReal(); log.push('wrong ' + f.word); }
  else if (f.isTarget) {
    if (round === 0) window.__burst('catch', 4800, 300);
    if (round === 0) setTimeout(() => window.__burst('guide', 5000, 350), 4900);
    if (round === rounds - 1) window.__burst('last', 6000, 400);
    tapReal(); log.push('catch ' + f.word + ' r' + round);
  }
  await until(() => !g.frog || g.tapEl() !== el || g.phase !== 'frogs', 9000);
  await wait(100);
}
await wait(6200);
return log.join(' | ') + ' caught ' + g.caught;
