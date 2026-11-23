// Flipbook of River Crossing: a right hop, a wrong stone (sink, climb back), the far bank.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 30000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
await until(() => !g.locked);
window.__burst('hop', 1500, 150); g.choose(true); await wait(1700);
await until(() => !g.locked);
window.__burst('miss', 3000, 250); g.choose(false); await wait(3200);
await until(() => !g.locked);
window.__burst('bank', 3500, 300); g.choose(true); await wait(3700);
return 'ok';
