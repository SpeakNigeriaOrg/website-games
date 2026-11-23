// Path play-through for Say the Right Thing: the round's scenes include the step's phrases, one wrong balloon
// (swap and speak again), then the right one in every scene to the finale and its path button.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f() && Date.now() - t < ms) await wait(100); return f(); };
const ready = () => until(() => g.finished || (g.scene && !g.locked));
const { fit } = await import('./fit.js');
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean);
const kit = await (await fetch('../content/content.json')).json();
const gated = kit.words.some((w) => w.inclusion?.path); // the path gate profile, once the kit carries it
const usable = focus.filter((id) => { const w = kit.words.find((x) => x.id === id); return w && fit.canUse(w) && (!gated || !w.inclusion || w.inclusion.path === 'included'); });
const missing = usable.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the round: ' + missing.join(','));
const log = [];
await ready(); __shot('balloons'); log.push(`${g.scene}: ${g.phrases.join(' / ')}`);
g.choose(false); await wait(2600); __shot('wrong');
await ready(); g.choose(true); await wait(800);
for (let k = 0; k < 20 && !g.finished; k++) {
  await ready();
  if (g.finished) break;
  log.push(`${g.scene}: ${g.phrases.join(' / ')}`);
  g.choose(true); await wait(800);
}
await until(() => g.finished, 30000); await wait(900); __shot('finale');
if (!document.querySelector('.finale .path-btn')) throw new Error('no path button on the finale');
return `level=${q.get('level')} words=${g.words.join(',')} | ${log.join(' | ')} | clean=${g.clean}`;
