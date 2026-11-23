// Flipbook of Frog Pond's two forgiveness rules: round 1, one honest miss then the target (the catch counts);
// later rounds, spam-tapping every frog until the anti-spam rule blocks a right frog (it turns into the thing and
// says its word, no slot fills, the ear pulses). Fails if spam ever fills a slot after a blocked catch.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 60000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout ' + g.phase); await wait(40); } };
const tapReal = () => { const b = g.tapEl(); if (!b) return; const r = b.getBoundingClientRect(); const o = { clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.6, bubbles: true }; b.dispatchEvent(new PointerEvent('pointerdown', o)); b.dispatchEvent(new PointerEvent('pointerup', o)); };
const log = [];
let honestMiss = false, blocked = 0, spamWins = 0;
while (g.phase !== 'done') {
  await until(() => g.frog || g.phase === 'done' || g.phase === 'between');
  if (g.phase === 'done') break;
  if (g.phase === 'between') { await until(() => g.phase !== 'between'); continue; }
  const f = g.frog, el = g.tapEl(), round = g.round, before = g.caught, st = g.stats;
  if (round === 0) {
    if (!f.isTarget && !honestMiss) { honestMiss = true; tapReal(); log.push('honest miss ' + f.word); }
    else if (f.isTarget) {
      window.__burst('forgive', 4800, 300);
      tapReal();
      await wait(4000);
      log.push(`r0 catch after miss (shown ${st.shown}, wrong ${st.wrong}, old rule ${st.wrong < st.shown / 2 ? "passes" : "blocks"}) caught ${before}->${g.caught}`);
      if (g.caught !== before + 1) throw new Error('honest miss was not forgiven');
    }
  } else if (blocked && !f.isTarget) { /* after the block: play cleanly */ }
  else {
    // spam: tap every frog
    if (f.isTarget && !g.stats.fair && !blocked) window.__burst('blocked', 4200, 250);
    const willBlock = f.isTarget && !g.stats.fair;
    tapReal();
    if (f.isTarget) {
      await wait(3800); // the catch (or the blocked catch) plays out
      if (willBlock) { blocked++; log.push(`r${round} blocked caught ${before}->${g.caught}`); if (g.caught !== before) throw new Error('blocked catch filled a slot'); }
      else if (g.caught > before && !blocked) { spamWins++; log.push(`r${round} spam won (target 2nd frog)`); }
    }
  }
  await until(() => !g.frog || g.tapEl() !== el || g.phase !== 'frogs', 9000);
  await wait(100);
}
await wait(5000);
return log.join(' | ') + ` | blocked ${blocked} spamWins ${spamWins} caught ${g.caught}`;
