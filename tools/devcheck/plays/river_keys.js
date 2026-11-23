// Keyboard play: Left/Right pick the row's stones; the frog hops. Up to 6 key presses, logging each.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 15000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout'); await wait(60); } };
const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
const log = [];
for (let i = 0; i < 6; i++) {
  await until(() => !g.locked);
  const row = g.word.rows[g.rowIndex], right = row.stones.find((s) => s.right), other = row.stones.find((s) => !s.right);
  const k = right.x < other.x ? 'ArrowLeft' : 'ArrowRight';
  const before = `${g.word.display}:${g.rowIndex}`;
  const choices = document.querySelectorAll('[data-choice]').length;
  key(k);
  await wait(1200);
  log.push(`${before} ${k} (choices ${choices}) -> ${g.word.display}:${g.rowIndex} locked=${g.locked}`);
}
return log.join(' | ');
