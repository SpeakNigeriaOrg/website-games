// Play-check for Do It!: three rounds (levels 1, 2, 3 via the finale's "again" button). Each round sits
// through the ghost lessons, then plays one single miss, one double miss (ghost demo), and real pointer
// gestures through the game's own handlers for every correct action.
const g = window.__game;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const wait = async (cond, ms = 40000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error('timeout; state ' + JSON.stringify(g.state)); await pause(50); } };
const ready = () => wait(() => g.state.finished || (g.state.phase === 'act' && !g.state.locked));
const LEVELS = { 1: ['hold', 'dont'], 2: ['wipe', 'throw', 'dont'], 3: ['hold', 'wipe', 'throw', 'put', 'dont'] };
const ev = (node, type, x, y) => node.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true }));
const mid = (n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const real = {
  async hold(n) { const c = mid(n); ev(n, 'pointerdown', c.x, c.y); await pause(1000); ev(n, 'pointerup', c.x, c.y); },
  async wipe(n) { const c = mid(n); ev(n, 'pointerdown', c.x, c.y); for (let i = 0; i < 6; i++) { for (const dx of [-35, 35]) { ev(n, 'pointermove', c.x + dx, c.y); await pause(40); } } ev(n, 'pointerup', c.x, c.y); },
  async throw(n) { const c = mid(n), b = mid(g.binEl()); ev(n, 'pointerdown', c.x, c.y); for (let i = 1; i <= 8; i++) { ev(n, 'pointermove', c.x + (b.x - c.x) * i / 8, c.y + (b.y - c.y) * i / 8); await pause(30); } ev(n, 'pointerup', b.x, b.y); },
  async put(n) { const c = mid(n), m = mid(g.matEl()); ev(n, 'pointerdown', c.x, c.y); for (let i = 1; i <= 15; i++) { ev(n, 'pointermove', c.x + (m.x - c.x) * i / 15, c.y + (m.y - c.y) * i / 15); await pause(60); } await pause(200); ev(n, 'pointerup', m.x, m.y); },
  async dont() { await pause(4400); },
};
const results = [];
async function playRound() {
  const level = g.state.level, keys = LEVELS[level], log = [];
  const seen = new Set();
  let n = 0, singleMiss = false, doubleMiss = false;
  while (!g.state.finished && n < 50) {
    await ready(); if (g.state.finished) break;
    const s = g.state;
    n++;
    if (s.teach) log.push(`(${s.cmd})`);
    const wrong = keys.find((k) => k !== s.cmd);
    if (!s.teach && !singleMiss && s.attempts === 0 && n > 3) {
      singleMiss = true; log.push(`${s.cmd}@${s.thing}:MISS(${wrong})`); g.act(wrong); await pause(600); window.__shot(`L${level}-miss`);
      await ready(); log.push('retry'); await real[g.state.cmd](g.thingEl()); await wait(() => g.state.phase !== 'act', 6000); continue;
    }
    if (!s.teach && singleMiss && !doubleMiss && s.attempts === 0) {
      doubleMiss = true; log.push(`${s.cmd}@${s.thing}:MISS2`); g.act(wrong); await ready(); g.act(wrong); await pause(4300); window.__shot(`L${level}-ghost`); continue;
    }
    log.push(`${s.cmd}@${s.thing}`);
    const shoot = !seen.has(s.cmd); seen.add(s.cmd);
    const p = real[s.cmd](g.thingEl());
    if (shoot) { await pause(s.cmd === 'dont' ? 2000 : s.cmd === 'put' ? 900 : 350); window.__shot(`L${level}-${s.cmd}`); }
    await p;
    await wait(() => g.state.phase !== 'act' || g.state.finished, 6000);
  }
  await wait(() => g.state.finished, 20000);
  results.push(`L${level} ${n} turns: ${log.join(' ')}`);
}
for (let r = 0; r < 3; r++) {
  await pause(r ? 500 : 2600); window.__shot(`L${g.state.level}-start`);
  await playRound();
  await pause(1000); window.__shot('finale');
  if (r < 2) { document.querySelector('.again-btn').click(); await pause(300); }
}
return results.join(' || ');
