const g = window.__game;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 60000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout; phase=' + g.phase); await wait(40); } };
const log = [];
const tapReal = () => { const b = g.tapEl(); if (!b) return; const r = b.getBoundingClientRect(); const o = { clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.6, bubbles: true }; b.dispatchEvent(new PointerEvent('pointerdown', o)); b.dispatchEvent(new PointerEvent('pointerup', o)); };
await wait(1200);
(async () => { await until(() => g.round === 1 && g.phase === 'guide', 200000); await wait(1300); window.__shot('guide'); })();
await until(() => g.phase === 'frogs');
let shotFrog = false, wrongTapped = false;
// round 1: tap one wrong frog, then the target
// round 2: spam (tap every frog) for a while and check that no catch counts, then play properly
// round 3: play properly
let spamTargets = 0, skipped = 0;
while (g.phase !== 'done') {
  await until(() => g.frog || g.phase === 'done' || g.phase === 'between');
  if (g.phase === 'done') break;
  if (g.phase === 'between') { await until(() => g.phase === 'frogs' || g.phase === 'done'); continue; }
  const f = g.frog, fel = g.tapEl();
  if (!shotFrog) { window.__shot('frog'); shotFrog = true; await wait(300); }
  const round = g.round, before = g.caught;
  if (round === 1 && spamTargets < 2) {
    if (f.isTarget) spamTargets++;
    tapReal();
    log.push(`spam:${f.word}${f.isTarget ? '*' : ''}`);
    if (f.isTarget) { await wait(300); window.__shot('spam'); await wait(1000); if (g.caught !== before) return 'FAIL: spam caught a target ' + log.join(' '); }
  } else if (f.isTarget && round === 0 && skipped < 2) {
    skipped++; log.push(`missed:${f.word}`);
  } else if (f.isTarget) {
    if (round === 0) { await wait(500); window.__shot("ghost"); }
    const st = g.stats, blocked = st.wrong >= st.shown / 2;
    tapReal();
    log.push(`${blocked ? 'blocked' : 'catch'}:${f.word}(${st.wrong}/${st.shown})`);
    if (!blocked) {
      await wait(500); if (round === 0) window.__shot('catch');
      await until(() => g.caught > before || g.phase === 'done', 8000);
    } else { await wait(1500); if (g.caught !== before) return 'FAIL: blocked catch counted'; }
  } else if (round === 0 && !wrongTapped) {
    wrongTapped = true; tapReal(); log.push(`wrong:${f.word}`); await wait(300); window.__shot('wrong');
  } else {
    log.push(`skip:${f.word}`);
  }
  await until(() => !g.frog || g.tapEl() !== fel || g.phase !== 'frogs', 8000);
  await wait(100);
}
await wait(1500);
window.__shot('finale');
return `caught ${g.caught} | ${log.join(' ')}`;
