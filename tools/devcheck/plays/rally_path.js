// Learning-path play-through: straight into a lap (no picker) holding every focus word Rally can use in that mode,
// one wrong gate, then to the finale and the way back to the path. The mode is the query's mode= (default syllables):
//   --query="path=t1&focus=..&level=1&mode=pictures"  (or mode=sequence: one wrong gate mid-word)
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout waiting; phase=' + g.phase); await wait(50); } };
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean);
const { modes } = await import(new URL('fit.js', location.href).href);
const want = q.get('mode') || 'syllables', spec = modes.find((m) => m.mode === want);
const level = Math.min(3, Math.max(1, Number(q.get('level')) || 1));
// sequence: the level sets the most syllables (2, 3, 4)
const canUse = (w) => spec.canUse(w) && (want !== 'sequence' || w.syllables.length <= [2, 3, 4][level - 1]);
const kit = await (await fetch('../content/content.json')).json();
const ok = (w) => (w.person ?? 'Femi') === 'Femi' && (!w.inclusion || w.inclusion.pathTone === 'included') && canUse(w);
const expected = focus.filter((id) => kit.words.some((w) => w.id === id && ok(w)));
await until(() => g.phase === 'prompt' || g.phase === 'choose');
if (document.querySelector('.mode-picker')) throw new Error('mode picker shown on the path');
if (g.mode !== want) throw new Error('mode ' + g.mode + ', wanted ' + want);
const missing = expected.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the lap: ' + missing.join(','));
await wait(600); window.__shot('approach');
const road = document.getElementById('road');
let n = 0, wrongDone = false;
while (g.phase !== 'done' && n < 20) {
  await until(() => (g.phase === 'choose' && !g.locked) || g.phase === 'done');
  if (g.phase === 'done') break;
  let side = g.answer;
  if (n === 1 && !wrongDone) { side = side === 'left' ? 'right' : 'left'; wrongDone = true; }
  const r = road.getBoundingClientRect();
  const x = side === 'left' ? r.left + r.width * 0.2 : r.left + r.width * 0.8, y = r.top + r.height * 0.6;
  road.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }));
  road.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true }));
  await wait(400);
  // steering stays open until the gates arrive: wait for the pass, then for it to finish
  await until(() => g.phase === 'drive' || g.phase === 'done', 30000);
  await until(() => g.phase !== 'drive', 20000);
  n++;
}
await wait(1500);
window.__shot('finale');
if (!document.querySelector('.path-btn')) throw new Error('no path button on the finale');
return `mode=${g.mode} level=${q.get('level')} words=${g.words.join(',')} focus usable=${expected.length}/${focus.length} turns=${n} clean=${g.clean} phase=${g.phase}`;
