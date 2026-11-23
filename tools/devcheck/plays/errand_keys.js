// Keyboard play for Grandma's Errand: the things are data-choice; the arrows move the highlight, Space brings the
// highlighted thing to Grandma. Plays the teaching turn and three turns by keys (one wrong), checks they register.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const ready = () => until(() => !g.locked && g.want.length);
const visible = () => [...document.querySelectorAll('[data-choice]')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.05 && getComputedStyle(e).pointerEvents !== 'none')
  .sort((a, b) => { const p = a.getBoundingClientRect(), q = b.getBoundingClientRect(); return Math.abs(p.left - q.left) > 8 ? p.left - q.left : p.top - q.top; });
async function pick(el) {
  const els = visible(), i = els.indexOf(el);
  if (i < 0) throw new Error('thing is not a visible data-choice (' + els.length + ' visible)');
  for (let k = 0; k <= i; k++) key('ArrowRight');
  await wait(150);
  if (!el.classList.contains('key-focus')) throw new Error('highlight is not on the chosen thing');
  if (i === 2) window.__shot('highlight');
  key(' ');
  return els.length;
}
const log = [];
for (let t = 0; t < 4; t++) {
  await ready();
  const right = t !== 2, clean = g.clean;
  const n = await pick(g.choiceEl(right));
  await until(() => g.locked, 8000).catch(() => { throw new Error('key answer did not register on turn ' + t); });
  if (right) await until(() => g.teaching || g.clean > clean || g.want.length === 0 || !g.locked, 15000);
  log.push((right ? 'right' : 'wrong') + ' of ' + n + ' ok');
  await wait(400);
}
await ready();
return log.join(', ') + ' | progress ' + g.clean;
