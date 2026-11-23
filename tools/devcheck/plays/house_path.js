// Path play-through for Wake the House: the step's room holds the focus things (first), wake them all, the room
// dances, and the finale offers the way back to the path.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 20000) => { const t = Date.now(); while (!f() && Date.now() - t < ms) await wait(100); return f(); };
const { fit } = await import('./fit.js');
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean);
const kit = await (await fetch('../content/content.json')).json();
const gated = kit.words.some((w) => w.inclusion?.path); // the path gate profile, once the kit carries it
const usable = focus.filter((id) => { const w = kit.words.find((x) => x.id === id); return w && fit.canUse(w) && (!gated || !w.inclusion || w.inclusion.path === 'included'); });
await until(() => g.things.length);
const missing = usable.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the round: ' + missing.join(','));
await wait(300); __shot('demo');
await until(() => g.things[0].awake && !g.busy && !document.body.classList.contains('locked'));
for (const t of g.things.slice(1)) { g.tapThing(t); await until(() => !g.busy && g.tasks === 0); }
__shot('awake');
await until(() => document.querySelector('.finale'), 30000);
await wait(600); __shot('finale');
if (!document.querySelector('.finale .path-btn')) throw new Error('no path button on the finale');
return `level=${q.get('level')} room=${g.room} words=${g.words.join(',')} focus usable=${usable.join(',')}`;
