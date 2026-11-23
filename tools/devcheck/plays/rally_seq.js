// Gate Rally, sequence mode (build the word): a full lap from the picker's third button. Every pair must offer the
// word's next syllable, in order; one wrong gate mid-word (word 2, syllable 2) must bring the same syllable's pair
// back without lighting a stone; the track must change between words; the lap ends in the finale. The missed word
// is not clean, so it comes back later in the lap.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout; phase=' + g.phase); await wait(40); } };
const fail = (m) => { throw new Error(m + ' | ' + log.join(' ')); };
const log = [];
await until(() => document.querySelector('.mode-btn[data-mode="sequence"]'));
await wait(700); window.__shot('picker'); await wait(700);
g.pickMode('sequence');
const tracks = [], built = [];
let wordNo = -1, lastWord = null, missDone = false, retry = null, pairs = 0;
while (pairs < 40) {
  await until(() => (g.phase === 'choose' && !g.locked) || g.phase === 'done', 60000);
  if (g.phase === 'done') break;
  const s = g.seq, syl = g.syllables;
  if (s.i === 0 && s.lit === 0 && !retry && (lastWord === null || built.at(-1).done)) {
    wordNo++; lastWord = g.word; tracks.push(g.track); built.push({ word: g.word, n: s.n, done: false, missed: false });
    log.push(`[${g.word} ${syl.join('-')} on ${g.track.split('/').pop()}]`);
    if (wordNo === 0) window.__shot('word1');
  }
  // the pair must be the word's next syllable, in order
  if (g.target !== syl[s.i]) fail(`pair offers ${g.target}, expected syllable ${s.i} ${syl[s.i]}`);
  if (s.lit !== s.i) fail(`lit stones ${s.lit} != built ${s.i}`);
  if (retry) {
    if (s.i !== retry.i || g.target !== retry.target) fail(`after the miss the pair is ${s.i}:${g.target}, not ${retry.i}:${retry.target} again`);
    log.push('again:' + g.target);
    retry = null;
  }
  const target = g.target, wrong = !missDone && wordNo === 1 && s.i === 1;
  const side = wrong ? (g.answer === 'left' ? 'right' : 'left') : g.answer;
  if (wrong) { window.__shot('before-miss'); retry = { i: s.i, target: g.target }; missDone = true; built.at(-1).missed = true; }
  await g.steer(side);
  pairs++;
  if (wrong) {
    if (g.seq.i !== retry.i || g.seq.lit !== retry.i) fail('a wrong gate advanced the word');
    log.push('miss:' + retry.target);
  } else log.push(target + (s.i === s.n - 1 ? ' =' : ''));
  // the last syllable: the word plays and blends, then the track turns
  if (!wrong && s.i === s.n - 1) {
    built.at(-1).done = true;
    await until(() => g.phase === 'celebrate' || g.phase === 'done', 10000);
    if (wordNo === 0) { await wait(1200); window.__shot('blend'); }
  }
}
await until(() => g.phase === 'done', 60000);
await wait(1800);
window.__shot('finale');
if (!document.querySelector('.finale')) fail('no finale');
if (!missDone) fail('the miss never happened');
// the track changed between consecutive words
for (let i = 1; i < tracks.length; i++) if (tracks[i] === tracks[i - 1]) fail(`track did not change between words ${i - 1} and ${i}`);
const missedWord = built.find((b) => b.missed)?.word;
const cameBack = built.filter((b) => b.word === missedWord).length > 1;
if (!cameBack) fail('the missed word did not come back');
return `words built ${built.length} (${built.map((b) => b.word + (b.missed ? '*' : '')).join(', ')}) clean ${g.clean} | tracks ${new Set(tracks).size} distinct, ${tracks.length} words | missed word came back: ${cameBack} | ${log.join(' ')}`;
