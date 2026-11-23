// Changing your mind, and steady timing. For each pair: steer to the WRONG lane during the prompt, then to the right
// lane after it; the right lane must count. Logs how far out the gates are when the prompt ends (should be steady)
// and how long input was blocked between pairs.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 30000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout ' + g.phase); await wait(30); } };
if (g.mode === null) { g.pickMode('syllables'); }
const ends = [], blocked = [], log = [];
for (let i = 0; i < 6; i++) {
  const t0 = Date.now();
  await until(() => g.phase === 'prompt');
  blocked.push(Date.now() - t0);
  const before = g.clean, right = g.answer, wrongSide = right === 'left' ? 'right' : 'left';
  await wait(200);
  g.steer(wrongSide);                       // during the prompt: allowed
  await until(() => g.phase === 'choose');  // the prompt has ended
  ends.push(g.z.toFixed(2));
  await wait(300);
  const done = g.steer(right);              // change of mind
  await done;
  log.push(`${g.word}: ${g.clean > before ? 'counted' : 'MISSED'}`);
}
if (log.some((l) => l.includes('MISSED'))) throw new Error(log.join(' '));
return `gates out when the prompt ends: ${ends.join(', ')} | wait before each pair (ms): ${blocked.join(', ')} | ${log.join(' ')}`;
