// Path play-through for Frog Pond: the targets include every usable focus word; one wrong frog, then catch
// each target to the finale, which must offer the way back to the path. Run with --query="path=..&focus=..&level=..".
const g = window.__game;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 60000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout; phase=' + g.phase); await wait(40); } };
const tapReal = () => { const b = g.tapEl(); if (!b) return; const r = b.getBoundingClientRect(); const o = { clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.6, bubbles: true }; b.dispatchEvent(new PointerEvent('pointerdown', o)); b.dispatchEvent(new PointerEvent('pointerup', o)); };
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean);
await until(() => g.words.length);
const missing = focus.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the round: ' + missing + ' (round: ' + g.words + ')');
await until(() => g.phase === 'frogs');
const log = [];
let wrongTapped = false, shot = false, blocks = 0;
while (g.phase !== 'done') {
  await until(() => g.frog || g.phase === 'done' || g.phase === 'between');
  if (g.phase === 'done') break;
  if (g.phase === 'between') { await until(() => g.phase === 'frogs' || g.phase === 'done'); continue; }
  const f = g.frog, fel = g.tapEl(), before = g.caught;
  if (!shot) { window.__shot('frog'); shot = true; }
  if (f.isTarget) {
    const st = g.stats, blocked = st.wrong >= st.shown / 2;
    tapReal();
    log.push(`${blocked ? 'blocked' : 'catch'}:${f.word}(${st.wrong}/${st.shown})`);
    if (!blocked) await until(() => g.caught > before || g.phase === 'done', 8000);
    else { blocks++; await wait(1500); if (g.caught !== before) throw new Error('blocked catch counted'); }
  } else if (!wrongTapped) {
    wrongTapped = true; tapReal(); log.push(`wrong:${f.word}`); await wait(300); window.__shot('wrong');
  } else log.push(`skip:${f.word}`);
  await until(() => !g.frog || g.tapEl() !== fel || g.phase !== 'frogs', 8000);
  await wait(100);
}
await wait(1500);
window.__shot('finale');
if (!document.querySelector('.path-btn')) throw new Error('no path button on the finale');
return `level ${q.get('level')} targets ${g.words.join(',')} | caught ${g.caught} | ${log.join(' ')}`;
