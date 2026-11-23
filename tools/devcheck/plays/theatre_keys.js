// Keyboard play for Puppet Theatre: the animals and actions are data-choice; the arrows move the highlight, Space
// picks. One free show by keys, then the teaching turn and three turns by keys (one wrong); checks they register.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const visible = () => [...document.querySelectorAll('[data-choice]')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.05 && getComputedStyle(e).pointerEvents !== 'none')
  .sort((a, b) => { const p = a.getBoundingClientRect(), q = b.getBoundingClientRect(); return Math.abs(p.left - q.left) > 8 ? p.left - q.left : p.top - q.top; });
let shot = false;
async function pick(el) {
  await until(() => !g.locked, 15000);
  const els = visible(), i = els.indexOf(el);
  if (i < 0) throw new Error('choice is not a visible data-choice (' + els.length + ' visible)');
  for (let k = 0; k <= i; k++) key('ArrowRight');
  await wait(120);
  if (!el.classList.contains('key-focus')) throw new Error('highlight is not on the chosen choice');
  if (!shot) { shot = true; window.__shot('highlight'); }
  key(' ');
  await wait(150);
}
const log = [];
await until(() => !g.locked && g.mode === 'free', 15000);
await pick(g.pickEl(g.subjects[0]));
if (g.selected.subject !== g.subjects[0]) throw new Error('the key did not choose the animal');
await pick(g.pickEl(g.actions[0]));
await until(() => g.showing, 8000).catch(() => { throw new Error('the free show did not start by keys'); });
log.push('free show ok');
// the rest of the warm-up by taps
for (let i = 1; i < 3; i++) {
  await until(() => !g.locked && g.mode === 'free', 15000);
  g.pickEl(g.subjects[i % g.subjects.length]).__tap(); await until(() => !g.locked, 8000);
  g.pickEl(g.actions[i % g.actions.length]).__tap(); await until(() => g.showing, 8000);
}
for (let t = 0; t < 4; t++) {
  await until(() => !g.locked && g.want, 30000);
  const right = t !== 2, turnNo = g.turnNo, w = right ? g.want : g.wrongPair();
  await pick(g.pickEl(w.subject));
  await pick(g.pickEl(w.action));
  await until(() => g.showing, 8000).catch(() => { throw new Error('key answer did not register on turn ' + t); });
  if (right) await until(() => g.turnNo > turnNo || g.finished, 20000);
  else await until(() => !g.showing, 20000);
  log.push((right ? 'right' : 'wrong') + ' ok');
}
return log.join(', ') + ' | progress ' + g.clean;
