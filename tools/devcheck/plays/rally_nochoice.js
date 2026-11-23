const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(50); } };
await until(() => document.querySelector('.mode-btn'));
g.pickMode('pictures');
await until(() => g.phase === 'choose');
const first = g.word, t0 = Date.now();
let minV = Infinity; const zs = [];
// do nothing: the kart must keep moving and pass between the gates
while (g.word === first && Date.now() - t0 < 30000) { zs.push(g.z); await wait(200); }
window.__shot('after-nochoice');
const moving = zs.every((z, i) => i === 0 || z <= zs[i - 1] + 1e-6 || !isFinite(z));
return `first=${first} next=${g.word} took ${Date.now() - t0}ms clean=${g.clean} gate z kept falling=${moving}`;
