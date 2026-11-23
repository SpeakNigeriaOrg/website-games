// Fishing with Grandma, played through: the teaching turn plays itself; request 1, one wrong fish, then let the
// right fish fall back once (a miss: the request goes on), then catch it; request 2, tap every fish until the
// anti-spam rule blocks a right fish (nothing fills), then play properly; the rest cleanly, to the finale.
const g = window.__game;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 60000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout; phase=' + g.phase); await wait(40); } };
const tapReal = () => { const b = g.tapEl(); if (!b) return; const r = b.getBoundingClientRect(); const o = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true }; b.dispatchEvent(new PointerEvent('pointerdown', o)); b.dispatchEvent(new PointerEvent('pointerup', o)); };
const log = [];
await until(() => g.phase !== 'idle');
if (g.phase === 'guide') { await wait(1300); window.__shot('guide'); }
await until(() => g.phase === 'teach' || g.phase === 'fish');
if (g.phase === 'teach') { await until(() => document.querySelector('.ghost-hand') || g.phase === 'fish', 20000); window.__shot('teach-no'); }
await until(() => g.phase === 'fish', 40000);
if (g.caught !== 0) throw new Error('the demonstration filled a place');
let wrongTapped = false, missed = 0, spamTargets = 0, blocked = 0, shotFish = false;
while (g.phase !== 'done') {
  await until(() => g.fish || g.phase === 'done' || g.phase === 'between');
  if (g.phase === 'done') break;
  if (g.phase === 'between') { await until(() => g.phase === 'fish' || g.phase === 'done'); continue; }
  const f = g.fish, fel = g.tapEl(), round = g.round, before = g.caught;
  if (!shotFish) { window.__shot('fish'); shotFish = true; }
  if (round >= 1 && !blocked) {
    // spam: tap every fish
    const willBlock = f.isTarget && !g.stats.fair;
    tapReal(); log.push(`spam:${f.word}${f.isTarget ? '*' : ''}`);
    if (f.isTarget) {
      spamTargets++;
      if (willBlock) { await wait(1200); window.__shot('blocked'); }
      await until(() => !fel.isConnected, 9000); await wait(300);
      if (willBlock) { blocked++; log.push('blocked'); if (g.caught !== before) return 'FAIL: blocked catch filled a place ' + log.join(' '); }
      else { await until(() => g.caught > before, 6000); log.push('(spam won: target second)'); }
    }
  } else if (f.isTarget && round === 0 && missed < 1) {
    missed++; log.push(`missed:${f.word}`);
  } else if (f.isTarget) {
    tapReal(); log.push(`catch:${f.word}`);
    await wait(1400); if (round === 0) window.__shot('catch');
    await until(() => g.caught > before || g.phase === 'done', 9000);
  } else if (round === 0 && !wrongTapped) {
    wrongTapped = true; tapReal(); log.push(`wrong:${f.word}`); await wait(300); window.__shot('wrong');
  } else log.push(`skip:${f.word}`);
  await until(() => !g.fish || g.tapEl() !== fel || g.phase !== 'fish', 9000);
  await wait(100);
}
await wait(1500);
window.__shot('finale');
if (!document.querySelector('.finale')) throw new Error('no finale');
if (g.caught !== g.words.length) throw new Error(`caught ${g.caught} of ${g.words.length}`);
return `caught ${g.caught}/${g.words.length}${blocked ? "" : " (no block seen: the target came second each time)"} | ${log.join(" ")}`;
