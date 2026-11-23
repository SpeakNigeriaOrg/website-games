// Flipbook of Gate Rally after a miss: a wrong gate, then no choice. Each time the kart halts at the gates, the
// right gate glows and says its syllable (or the word, in pictures mode), then the word plays again. Then one right
// gate, to check the next pair still comes. Pictures mode: --query=fix=pictures (the game ignores the parameter).
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, t = 40000) => { const s = Date.now(); while (!f()) { if (Date.now() - s > t) throw new Error('timeout ' + g.phase); await wait(50); } };
const mode = new URLSearchParams(location.search).get('fix') || 'syllables';
const right = () => document.querySelector('.gate.speaking');
const log = [];
await until(() => document.querySelector('.mode-btn'));
g.pickMode(mode);
// 1: the wrong gate
await until(() => g.phase === 'choose' && !g.locked);
const w1 = g.word, ans1 = g.answer;
window.__burst('wrong', 5000, 250);
const steering = g.steer(ans1 === 'left' ? 'right' : 'left');
await until(() => right(), 5000);
log.push(`wrong ${w1}: right gate glows on the ${right().dataset.choice} (answer ${ans1}) z=${g.z.toFixed(2)}`);
await steering;
// 2: no choice
await until(() => g.phase === 'choose' && !g.locked);
const w2 = g.word, ans2 = g.answer;
window.__burst('nochoice', 6000, 300);
await until(() => right(), 15000);
log.push(`no choice ${w2}: right gate glows on the ${right().dataset.choice} (answer ${ans2}) z=${g.z.toFixed(2)}`);
// 3: a right gate
await until(() => g.phase === 'choose' && !g.locked);
await g.steer(g.answer);
log.push(`right ${g.word}: clean=${g.clean}`);
await until(() => g.phase === 'prompt');
return log.join(' | ');
