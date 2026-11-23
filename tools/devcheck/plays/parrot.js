// Play-check for Silly Parrot: watch the ghost demos, miss once of each kind, then answer right to the end.
const g = window.__game;
const wait = async (cond, ms = 30000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error('timeout waiting; state ' + JSON.stringify(g.state)); await new Promise((r) => setTimeout(r, 100)); } };
const ready = () => wait(() => g.state.finished || !g.state.locked && (g.state.phase === 'answer' || g.state.phase === 'fix'));
const log = [];
await new Promise((r) => setTimeout(r, 1500));
window.__shot('demo');
await ready();
window.__shot('turn1');
let missedSilly = false, missedRight = false, turns = 0;
while (!g.state.finished && turns < 40) {
  await ready(); if (g.state.finished) break;
  const s = g.state;
  if (s.phase === 'fix') { g.tap(s.correct === 'seed' ? 'hammer' : 'seed'); await new Promise((r) => setTimeout(r, 300)); await ready(); g.tap(g.state.correct); log.push('fix'); await new Promise((r) => setTimeout(r, 600)); continue; }
  turns++;
  // a silly turn: the said word differs from the picture's word
  if (s.silly !== (s.said !== s.word)) throw new Error('silly flag disagrees with words ' + JSON.stringify(s));
  let choice = s.correct;
  if (s.silly && !missedSilly) { missedSilly = true; choice = 'seed'; }
  else if (!s.silly && !missedRight) { missedRight = true; choice = 'hammer'; }
  log.push(`${s.word}${s.silly ? '<-' + s.said : ''}:${choice === s.correct ? 'ok' : 'MISS'}`);
  g.tap(choice);
  if (choice !== s.correct) { await new Promise((r) => setTimeout(r, 900)); window.__shot(s.silly ? 'miss-silly' : 'miss-right'); }
  else if (turns === 4) { await new Promise((r) => setTimeout(r, 700)); window.__shot('reaction'); }
  await new Promise((r) => setTimeout(r, 400));
}
await wait(() => g.state.finished, 20000);
await new Promise((r) => setTimeout(r, 1200));
window.__shot('finale');
return `turns ${turns}; ${log.join(' ')}`;
