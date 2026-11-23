// Play-check for Help Grandma: three rounds (levels 1, 2, 3 through the finale's "again" button). Each round sits
// through the lessons (every new command shown first), then plays one single miss, one double miss (the ghost hand
// shows it), and taps the right thing for the rest. Checks the order rule: never the same command twice running.
const g = window.__game;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const wait = async (cond, ms = 40000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error('timeout; state ' + JSON.stringify(g.state)); await pause(50); } };
const ready = () => wait(() => g.state.finished || (g.state.phase === 'act' && !g.state.locked));
const results = [];
for (let round = 0; round < 3; round++) {
  const keys = g.state.keys, log = [], asked = [];
  let n = 0, single = false, double = false, repeats = 0;
  while (!g.state.finished && n < 60) {
    await ready(); if (g.state.finished) break;
    const s = g.state; n++;
    if (asked.length && asked.at(-1) === s.cmd && s.attempts === 0 && !s.teach) repeats++;
    asked.push(s.cmd);
    if (s.teach) log.push(`(${s.cmd})`);
    const wrong = keys.find((k) => k !== s.cmd);
    if (!s.teach && !single && n > keys.length) {
      single = true; log.push(`${s.cmd}:MISS`); await g.act(wrong); await ready(); await g.act(s.cmd); if (n === keys.length + 1) __shot(`L${s.level}-miss`); continue;
    }
    if (!s.teach && single && !double && n > keys.length + 2) {
      double = true; log.push(`${s.cmd}:MISS2`); await g.act(wrong); await ready(); await g.act(wrong);
      await wait(() => g.state.cmd !== s.cmd || g.state.phase === 'listen' || g.state.finished); continue;
    }
    if (n === 2) { const p = g.act(s.cmd); await pause(700); __shot(`L${s.level}-act`); await p; continue; }
    log.push(s.cmd); await g.act(s.cmd);
  }
  await wait(() => g.state.finished, 30000);
  results.push(`L${g.state.level} keys ${keys.join(',')} | turns ${n}, stars ${g.state.stars}/${g.state.goal}, back-to-back repeats ${repeats} | ${log.join(' ')}`);
  __shot(`L${g.state.level}-finale`);
  if (round < 2) { document.querySelector('.again-btn').click(); await pause(800); }
}
return results.join(' || ');
