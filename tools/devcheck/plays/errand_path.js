// Path play-through for Grandma's Errand: the room holds every usable focus word, every focus word is asked for,
// one miss, then right fetches to the finale, which must offer the way back to the path.
// Run with --query="path=..&focus=..&level=..".
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(80); } };
const ready = () => until(() => g.finished || (!g.locked && g.want.length));
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean), level = +q.get('level') || 1;
await ready();
const missing = focus.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the room: ' + missing + ' (room: ' + g.words + ')');
const expect = { 1: [5, 4], 2: [7, 6], 3: [9, 8] }[level];
// a step with more focus and review words than the level holds gets a fuller room (up to 9) and one request per focus word
if (g.words.length < Math.min(9, Math.max(expect[0], focus.length)) || g.words.length > 9 || g.requests < expect[1]) throw new Error(`level ${level}: ${g.words.length} things, ${g.requests} requests`);
window.__shot('teaching');
g.choose(g.want[0]);
const asked = new Set();
let turns = 0, wrongs = 0, doubles = 0;
for (let i = 0; i < 60 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  if (i === 0) window.__shot('turn');
  g.want.forEach((id) => asked.add(id));
  if (g.double && g.want.length === 2) doubles++;
  if (i === 1) { g.choose(g.things.find((id) => !g.want.includes(id))); wrongs++; await wait(500); window.__shot('wrong'); continue; }
  g.choose(g.want[0]); turns++;
}
await until(() => g.finished, 20000);
await wait(900);
window.__shot('finale');
if (!document.querySelector('.path-btn')) throw new Error('no path button on the finale');
const notAsked = focus.filter((id) => !asked.has(id));
if (notAsked.length) throw new Error('focus words never asked for: ' + notAsked);
return `level ${level} things ${g.words.join(',')} | turns ${turns}, wrongs ${wrongs}, doubles ${doubles}, clean ${g.clean}/${g.requests}`;
