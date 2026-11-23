// Flipbook of Do It! (level 1: hold vs don't): a right action, a wrong one (the action plays, a star falls,
// the command repeats) and its retry, a double miss (ghost demo), and the last star into the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout ' + JSON.stringify(g.state)); await wait(60); } };
const ready = () => until(() => g.state.finished || (g.state.phase === 'act' && !g.state.locked));
const keys = ['hold', 'dont'];
const things = () => [...document.querySelectorAll('.thing')].map((t) => { const r = t.getBoundingClientRect(); return `${Math.round(r.left + r.width / 2)},${Math.round(r.top + r.height / 2)}${t.querySelector('.thing-inner').classList.contains('glow-on') ? '*' : ''}`; }).join(' ');
const log = [];
await ready(); log.push('level ' + g.state.level);
// skip lessons
while (g.state.teach) { g.act(g.state.cmd); await wait(300); await ready(); }
// a right "hold" (or whatever comes) with stars already present
g.act(g.state.cmd); await wait(300); await ready();
window.__burst('right', 3500, 200); g.act(g.state.cmd); await wait(3700);
await ready(); log.push('before miss stars ' + g.state.stars + ' ' + things());
window.__burst('miss', 5000, 250); g.act(keys.find((k) => k !== g.state.cmd)); await wait(5200);
await ready(); log.push('after miss stars ' + g.state.stars + ' attempts ' + g.state.attempts + ' ' + things());
window.__burst('retry', 3000, 250); g.act(g.state.cmd); await wait(3200);
await ready(); const c = g.state.cmd, w = keys.find((k) => k !== c);
window.__burst('double', 9000, 400); g.act(w); await ready(); g.act(w); await wait(9000);
log.push('after double ' + things());
for (let i = 0; i < 40 && !g.state.finished; i++) {
  await ready(); if (g.state.finished) break;
  if (g.state.stars === 5 && !window.__fb) { window.__fb = 1; window.__burst('last', 5000, 300); }
  g.act(g.state.cmd); await wait(300);
}
await until(() => g.state.finished, 30000); await wait(1000); window.__shot('finale');
return log.join('\n');
