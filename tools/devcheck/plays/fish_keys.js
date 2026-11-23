// Keyboard play for Fishing with Grandma: the fish that is up is the one choice; an arrow highlights it, Space catches it.
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
await until(() => g.phase === 'fish', 60000); // after the teaching turn
while (g.caught < 2) {
  await until(() => (g.fish && g.fish.isTarget && !g.locked && g.stats.fair) || g.phase === 'done', 90000);
  if (g.phase === 'done') break;
  const before = g.caught;
  log.push(await pickByKeys(g.tapEl()));
  await until(() => g.caught > before, 10000);
}
return 'caught ' + g.caught + ' | ' + log.join(' ');
