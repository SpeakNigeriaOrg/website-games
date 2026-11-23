// Keyboard play for Word Train: the loose carriages are the choices (two: Left/Right; three: highlight, Space).
const g = window.__game;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error("timeout"); await wait(60); } };
const key = (k) => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
// the choices as the engine sees them (visible data-choice elements, left to right)
const choices = (extra = () => true) => [...document.querySelectorAll("[data-choice]")].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden" && +getComputedStyle(e).opacity > 0.05 && getComputedStyle(e).pointerEvents !== "none" && extra(e))
  .sort((a, b) => { const p = a.getBoundingClientRect(), q = b.getBoundingClientRect(); return Math.abs(p.left - q.left) > 8 ? p.left - q.left : p.top - q.top; });
/** Pick an element with keys only: Left/Right when there are two choices, else move the highlight and press Space. */
async function pickByKeys(target, extra) {
  const els = choices(extra), i = els.indexOf(target);
  if (i < 0) throw new Error("target is not a keyboard choice (" + els.length + " choices)");
  if (els.length === 1) { key(" "); return "single"; } // one choice: any key picks it
  if (els.length === 2) { key(i ? "ArrowRight" : "ArrowLeft"); return "arrow"; }
  for (let k = 0; k <= i; k++) { key("ArrowRight"); await wait(60); }
  if (!target.classList.contains("key-focus")) throw new Error("highlight not on the target");
  key(" "); return "highlight+space x" + (i + 1) + "/" + els.length;
}

const log = [];
await until(() => g.word && !g.locked && g.looseCount > 0);
const startClean = g.clean;
for (let k = 0; k < 12 && g.clean < startClean + 3; k++) {
  await until(() => g.finished || (g.word && !g.locked && g.looseCount > 0));
  const before = g.looseCount, right = g.correctEl();
  log.push(g.level + ':' + await pickByKeys(right));
  await until(() => g.looseCount < before || g.locked, 8000);
  await wait(800);
}
if (g.clean < startClean + 3) throw new Error('keys did not complete turns: ' + log.join(' '));
return 'clean ' + g.clean + ' | ' + log.join(' ');
