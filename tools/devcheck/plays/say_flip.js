// Flipbook of Say the Right Thing: a right balloon (the scene resumes, hearts, strip fills, next scene's lead-in),
// a wrong balloon (huh?, the balloons swap and speak again) and its recovery, and the last scene into the finale.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
const ready = () => until(() => g.finished || (g.scene && !g.locked));
const balloons = () => [...document.querySelectorAll('.balloon')].map((b) => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return `${Math.round(r.left + r.width / 2)},${Math.round(r.top + r.height / 2)} op${(+cs.opacity).toFixed(1)} ${cs.visibility[0]}`; }).join(' | ');
const log = [];
await ready(); g.choose(true); // teaching scene
await ready();
window.__burst('right', 5500, 300); g.choose(true); await wait(5700);
await ready(); log.push('next scene ' + balloons());
window.__burst('wrong', 7000, 300); g.choose(false); await wait(7200);
await ready(); log.push('after wrong ' + balloons());
window.__burst('recover', 4000, 300); g.choose(true); await wait(4200);
for (let i = 0; i < 20 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  if (g.clean === g.words.length - 1 && !window.__fb) { window.__fb = 1; window.__burst('last', 5000, 300); }
  g.choose(true); await wait(300);
}
await until(() => g.finished, 30000); await wait(1000); window.__shot('finale');
return log.join('\n') + ' | clean ' + g.clean + '/' + g.words.length;
