// Put It Together with bound pieces (owner, 2026-11-22): a compound such as ẹkùn (ẹ- + kùn) shows its prefix as a
// written bubble beside the picture parts. Every turn of the step's compounds: the written part exists, shows its
// text, has no picture, and every card stays on screen without overlapping another. Right picks to the finale.
const g = window.__game;
const wait = async (cond, ms = 30000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 100)); } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const boxes = () => [...document.querySelectorAll('#cards .card')].map((c) => ({ c, r: c.getBoundingClientRect() }));
const overlap = (a, b) => a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2;
const report = [];
let shots = 0;
for (let i = 0; i < 30 && !g.finished; i++) {
  await wait(() => g.finished || !g.locked);
  if (g.finished) break;
  const texts = [...document.querySelectorAll('#cards .card.text')];
  for (const t of texts) {
    if (t.querySelector('img')) throw new Error('written part has a picture');
    if (!t.textContent.trim().endsWith('-')) throw new Error('written part text: ' + t.textContent);
  }
  const b = boxes();
  for (const { r } of b) if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) throw new Error(`card off screen in ${g.want}`);
  for (let x = 0; x < b.length; x++) for (let y = x + 1; y < b.length; y++) if (overlap(b[x].r, b[y].r)) throw new Error(`cards overlap in ${g.want}`);
  report.push(`${g.want}: ${g.parts.join('+')}${texts.length ? ' [written ' + texts.map((t) => t.textContent).join(',') + ']' : ''}`);
  if (texts.length && shots < 2) { window.__shot('bound' + shots++); }
  g.choose(g.want);
}
await wait(() => g.finished, 30000);
await pause(800);
window.__shot('finale');
return report.join(' | ');
