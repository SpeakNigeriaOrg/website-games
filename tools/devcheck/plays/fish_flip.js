// Flipbooks of Fishing with Grandma: the teaching turn (ghost wags "no" at a wrong fish, taps the right one, the
// net shows the catch), a wrong fish (says its word, shakes, splashes back), a clean catch (net, thing, basket
// fills), a blocked catch after spam-tapping (thing pops out, nothing fills, ear pulses) and the last catch into
// the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 60000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout ' + g.phase); await wait(40); } };
const tapReal = () => { const b = g.tapEl(); if (!b) return; const r = b.getBoundingClientRect(); const o = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true }; b.dispatchEvent(new PointerEvent('pointerdown', o)); b.dispatchEvent(new PointerEvent('pointerup', o)); };
const log = [];
await until(() => g.phase !== 'idle' && g.phase !== 'guide');
window.__burst('teach', 14000, 500);
await until(() => g.phase === 'fish', 40000);
await wait(500);
let wrongDone = false, blocked = false, rounds = g.words.length;
while (g.phase !== 'done') {
  await until(() => g.fish || g.phase === 'done' || g.phase === 'between');
  if (g.phase === 'done') break;
  if (g.phase === 'between') { await until(() => g.phase !== 'between'); continue; }
  const f = g.fish, el = g.tapEl(), round = g.round, before = g.caught;
  if (round === 0) {
    if (!f.isTarget && !wrongDone) { wrongDone = true; window.__burst('wrong', 2400, 200); tapReal(); log.push('wrong ' + f.word); }
    else if (f.isTarget) { window.__burst('catch', 5400, 300); tapReal(); log.push('catch ' + f.word); }
  } else if (round >= 1 && !blocked) {
    // spam every fish until a right one is blocked
    const willBlock = f.isTarget && !g.stats.fair;
    if (willBlock) window.__burst('blocked', 5000, 300);
    tapReal(); log.push('spam ' + f.word + (f.isTarget ? '*' : ''));
    if (willBlock) { blocked = true; await until(() => !el.isConnected, 9000); if (g.caught !== before) throw new Error('blocked catch filled a place'); log.push('blocked'); }
  } else if (f.isTarget) {
    if (round === rounds - 1) window.__burst('last', 7000, 400);
    tapReal(); log.push('catch ' + f.word + ' r' + round);
  }
  await until(() => !g.fish || g.tapEl() !== el || g.phase !== 'fish', 9000);
  await wait(100);
}
await wait(7200);
return log.join(' | ') + ' caught ' + g.caught;
