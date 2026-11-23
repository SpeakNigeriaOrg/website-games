// Keyboard play for Sort It: the places are the choices (two: Left/Right pick directly; more: the arrows move the
// highlight and Enter picks). Three turns right by keys and one wrong, each must register.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const ready = () => until(() => !g.locked && g.want);
const visible = () => [...document.querySelectorAll('[data-choice]')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.05 && getComputedStyle(e).pointerEvents !== 'none')
  .sort((a, b) => { const p = a.getBoundingClientRect(), q = b.getBoundingClientRect(); return Math.abs(p.left - q.left) > 8 ? p.left - q.left : p.top - q.top; });
async function pick(el) {
  const els = visible(), i = els.indexOf(el);
  if (i < 0) throw new Error('place is not a visible data-choice (' + els.length + ' visible)');
  if (els.length === 2) key(i ? 'ArrowRight' : 'ArrowLeft');
  else { for (let k = 0; k <= i; k++) key('ArrowRight'); await wait(150); if (!el.classList.contains('key-focus')) throw new Error('highlight not on the place'); key('Enter'); }
  return els.length;
}
const log = [];
for (let t = 0; t < 4; t++) {
  await ready();
  const right = t !== 2, id = right ? g.wantPlace : g.wrongPlace(), want = g.want, place = g.wantPlace, before = g.filled[place].length;
  const n = await pick(g.placeEl(id));
  await until(() => g.locked, 8000).catch(() => { throw new Error('key answer did not register on turn ' + t); });
  if (right) await until(() => g.filled[place].length === before + 1, 8000);
  else await until(() => g.want !== want, 15000);
  log.push((right ? 'right' : 'wrong') + ' of ' + n + ' ok');
}
return log.join(', ') + ' | clean ' + g.clean;
