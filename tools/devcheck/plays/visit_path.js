// Path play-through for visit: the round holds every usable focus word, and the focus words are among the
// guests who introduce themselves; a wrong guest once, then right ones to the finale, which must offer the
// way back to the path. Run with --query="path=..&focus=..&level=..".
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(100); } };
const ready = () => until(() => g.finished || (g.target && !g.locked));
const q = new URLSearchParams(location.search), focus = (q.get('focus') || '').split(',').filter(Boolean);
await ready();
const missing = focus.filter((id) => !g.words.includes(id));
if (missing.length) throw new Error('focus words not in the round: ' + missing + ' (round: ' + g.words + ')');
const notIntroduced = focus.slice(0, 3).filter((id) => !g.known.includes(id));
if (notIntroduced.length) throw new Error('focus words not introduced: ' + notIntroduced + ' (known: ' + g.known + ')');
const atDoor = g.guests.length;
__shot('turn1');
g.choose(false); await wait(900); __shot('wrong');
let turns = 0, strangers = 0;
for (let k = 0; k < 40 && !g.finished; k++) {
  await ready();
  if (g.finished) break;
  turns++;
  if (g.targetIsStranger) strangers++;
  g.choose(true);
  await wait(600);
}
await until(() => g.finished, 30000); await wait(900); __shot('finale');
if (!document.querySelector('.path-btn')) throw new Error('no path button on the finale');
return `level ${q.get('level')} words ${g.words.join(',')} | at the door ${atDoor}, turns ${turns}, strangers named ${strangers}, clean ${g.clean}`;
