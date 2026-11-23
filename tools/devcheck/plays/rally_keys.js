// Keyboard play for Gate Rally: Left/Right arrows steer through the gates (the two gates are the choices).
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

await wait(500); g.pickMode('syllables');
const log = [];
for (let n = 0; n < 4; n++) {
  await until(() => g.phase === 'choose' && !g.locked);
  const before = g.clean, gate = [...document.querySelectorAll('.gate')].find((e) => e.dataset.choice === g.answer);
  log.push(await pickByKeys(gate));
  await until(() => g.phase !== 'choose' && g.phase !== 'drive', 20000);
  if (g.clean !== before + 1) throw new Error('key steer did not score: ' + log.join(' '));
}
return 'clean ' + g.clean + ' | ' + log.join(' ');
