// Path play-through for Do It!: the round's commands include the step's, the ghost lessons play, one miss and
// real pointer gestures for every correct action, to the finale and its path button.
const g = window.__game;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const wait = async (cond, ms = 40000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error('timeout; state ' + JSON.stringify(g.state)); await pause(50); } };
const ready = () => wait(() => g.state.finished || (g.state.phase === 'act' && !g.state.locked));
const { fit, CMDS } = await import('./fit.js');
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean);
const kit = await (await fetch('../content/content.json')).json();
const gated = kit.words.some((w) => w.inclusion?.path); // the path gate profile, once the kit carries it
const usable = focus.filter((id) => { const w = kit.words.find((x) => x.id === id); return w && fit.canUse(w) && (!gated || !w.inclusion || w.inclusion.path === 'included'); });
const missing = usable.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the round: ' + missing.join(','));
const keys = Object.keys(CMDS).filter((k) => g.words.includes(CMDS[k]));
const ev = (node, type, x, y) => node.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true }));
const mid = (n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const real = {
  async hold(n) { const c = mid(n); ev(n, 'pointerdown', c.x, c.y); await pause(1000); ev(n, 'pointerup', c.x, c.y); },
  async wipe(n) { const c = mid(n); ev(n, 'pointerdown', c.x, c.y); for (let i = 0; i < 6; i++) { for (const dx of [-35, 35]) { ev(n, 'pointermove', c.x + dx, c.y); await pause(40); } } ev(n, 'pointerup', c.x, c.y); },
  async throw(n) { const c = mid(n), b = mid(g.binEl()); ev(n, 'pointerdown', c.x, c.y); for (let i = 1; i <= 8; i++) { ev(n, 'pointermove', c.x + (b.x - c.x) * i / 8, c.y + (b.y - c.y) * i / 8); await pause(30); } ev(n, 'pointerup', b.x, b.y); },
  async put(n) { const c = mid(n), m = mid(g.matEl()); ev(n, 'pointerdown', c.x, c.y); for (let i = 1; i <= 15; i++) { ev(n, 'pointermove', c.x + (m.x - c.x) * i / 15, c.y + (m.y - c.y) * i / 15); await pause(60); } await pause(200); ev(n, 'pointerup', m.x, m.y); },
  async dont() { await pause(4400); },
};
const log = [], seen = new Set();
let n = 0, missed = false;
await pause(2600); window.__shot('start');
while (!g.state.finished && n < 40) {
  await ready(); if (g.state.finished) break;
  const s = g.state;
  n++;
  if (s.teach) log.push(`(${s.cmd})`);
  if (!s.teach && !missed && s.attempts === 0) {
    missed = true; const wrong = keys.find((k) => k !== s.cmd); log.push(`${s.cmd}:MISS(${wrong})`); g.act(wrong); await pause(600); window.__shot('miss');
    await ready(); await real[g.state.cmd](g.thingEl()); await wait(() => g.state.phase !== 'act', 6000); continue;
  }
  log.push(`${s.cmd}@${s.thing}`);
  const shoot = !seen.has(s.cmd); seen.add(s.cmd);
  const p = real[s.cmd](g.thingEl());
  if (shoot) { await pause(s.cmd === 'dont' ? 2000 : 350); window.__shot(s.cmd); }
  await p;
  await wait(() => g.state.phase !== 'act' || g.state.finished, 6000);
}
await wait(() => g.state.finished, 20000);
await pause(1000); window.__shot('finale');
if (!document.querySelector('.finale .path-btn')) throw new Error('no path button on the finale');
return `level=${g.state.level} words=${g.words.join(',')} ${n} turns: ${log.join(' ')}`;
