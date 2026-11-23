// Keyboard play for hungry: answers through real key events (Left/Right pick one of two directly; with more, the
// arrows move the highlight and Enter picks). Plays three turns right by keys, one wrong, and checks they register.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const ready = () => until(() => !g.locked && g.want);
const visible = () => [...document.querySelectorAll('[data-choice]')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.05 && getComputedStyle(e).pointerEvents !== 'none')
  .sort((a, b) => { const p = a.getBoundingClientRect(), q = b.getBoundingClientRect(); return Math.abs(p.left - q.left) > 8 ? p.left - q.left : p.top - q.top; });
async function pick(el) {
  const els = visible(), i = els.indexOf(el);
  if (i < 0) throw new Error('answer is not a visible data-choice (' + els.length + ' visible)');
  if (els.length === 2) key(i ? 'ArrowRight' : 'ArrowLeft');
  else { for (let k = 0; k <= i; k++) key('ArrowRight'); await wait(150); key('Enter'); }
  return els.length;
}
const progress = () => g.clean;
const log = [];
for (let t = 0; t < 4; t++) {
  await ready();
  const right = t !== 2, before = progress();
  const target = g.choiceEl(right);
  const n = await pick(target);
  await until(() => g.locked, 8000).catch(() => { throw new Error('key answer did not register on turn ' + t); });
  log.push((right ? 'right' : 'wrong') + ' of ' + n + ' ok');
  await wait(400);
}
return log.join(', ') + ' | progress ' + progress();
