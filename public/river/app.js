// River Crossing: hear a word, then hop across the river one stone per syllable.
// Each row offers two identical stones that speak their syllables in turn; the frog jumps onto the
// tapped one. A wrong stone sinks, the frog climbs back, and the row comes again with the stones swapped.
// Only crossings with no splash build the village. Demand: hearing (which syllable is in the word).
import { loadContent, path, createShell, audio, sfx, onTap, Queue, memory, progressStrip, animate, confetti, ghost, finale, shuffle, pick, sleep, el } from '../engine/engine.js';
import { fit } from './fit.js';

// Crossings per round; on the learning path, level 1 (first meeting) is a short round of 4.
const ROUND = path.pickLevel([4, 5, 6]);
const READING = new URLSearchParams(location.search).has('read'); // adult-enabled reading mode
const $ = (id) => document.getElementById(id);
const river = $('river'), rowsEl = $('rows'), frog = $('frog'), goal = $('goal');

// Syllable shape, for choosing distractors: onset consonants and the vowel, ignoring tone marks.
const toneless = (s) => s.normalize('NFD').replace(/[̀́̄]/g, '').normalize('NFC').toLowerCase();
const VOWELS = /[aeiouẹọ]/;
function shape(s) {
  const t = toneless(s);
  const i = t.search(VOWELS);
  return { onset: i < 0 ? t : t.slice(0, i), vowel: i < 0 ? '' : t[i] };
}

let content, pool, queue, strip, word, rowIndex, safeY, isTeaching = true, current = null, roundWords = [];

// The village on the far bank: every clean crossing builds a hut there, beside the word's picture, and the frog
// lands at it. A crossing with a splash lands beside the picture with no hut. Spots in % of the column.
const HUT_SPOTS = [[18, 19], [82, 19], [8, 25], [92, 25], [28, 27], [72, 27]];
const HUTS = ['hut0', 'hut2', 'hut3', 'hut4'];
let huts = 0;
const village = river.insertBefore(el('div', 'village'), rowsEl);

const wordsForRiver = () => content.words.filter(fit.canUse);

/** A distractor syllable that differs from the target in both onset and vowel (level 1 of the ladder). */
function distractor(target, word) {
  const t = shape(target.text);
  const own = new Set(word.syllables.map((s) => toneless(s.text)));
  const options = pool.filter((s) => !own.has(toneless(s.text)) && shape(s.text).onset !== t.onset && shape(s.text).vowel !== t.vowel);
  return pick(options.length ? options : pool.filter((s) => !own.has(toneless(s.text))));
}

const rowY = (i, n) => 76 - i * (40 / Math.max(1, n - 1)); // % from top, near bank upward, clear of the goal picture

function placeFrog(x, y, ms = 0) {
  const kf = { left: x + '%', top: y + '%' };
  if (!ms) { Object.assign(frog.style, kf); return Promise.resolve(); }
  const from = { left: frog.style.left || '50%', top: frog.style.top || '92%' };
  return animate(frog, [
    { ...from, transform: 'translate(-50%,-78%) scale(1)' },
    { transform: 'translate(-50%,-110%) scale(1.15)', offset: 0.5 },
    { ...kf, transform: 'translate(-50%,-78%) scale(1)' }], { duration: ms, easing: 'ease-in-out' })
    .then(() => Object.assign(frog.style, kf));
}

function ripple(x, y) {
  const r = river.appendChild(el('div', 'ripple'));
  r.style.left = x + '%'; r.style.top = y + '%';
  animate(r, [{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }], { duration: 700 }).then(() => r.remove());
}

function buildRows() {
  rowsEl.innerHTML = '';
  const n = word.syllables.length;
  word.rows = word.syllables.map((syl, i) => {
    const y = rowY(i, n);
    const choices = shuffle([{ syl, right: true }, { syl: distractor(syl, word), right: false }]);
    const stones = choices.map((c, k) => {
      const b = el('button', 'stone faint', `<img src="../art/stone.png" alt="">${READING ? `<span class="label">${c.syl.text}</span>` : ''}`);
      b.style.left = (k ? 72 : 28) + '%'; b.style.top = y + '%';
      b.setAttribute('aria-label', 'stone');
      b.dataset.choice = ''; // the keyboard's Left/Right pick the row's two stones
      rowsEl.appendChild(b);
      return { el: b, ...c, x: k ? 72 : 28, y };
    });
    return { y, stones };
  });
}

function setGoal() {
  goal.innerHTML = word.image ? `<img src="${word.image}" alt="">` : `<span class="gift">🎁</span>`;
}

async function speakRow(row) {
  for (const s of row.stones) {
    s.el.classList.add('speaking');
    await audio.play(s.syl.audio);
    s.el.classList.remove('speaking');
    await sleep(250);
  }
}

/** The prompt for the current step: the word, then the row's stones in turn. */
async function promptStep() {
  goal.classList.add('pulse');
  await audio.play(word.audio);
  goal.classList.remove('pulse');
  await sleep(300);
  await speakRow(word.rows[rowIndex]);
  if (isTeaching && rowIndex === 0) await ghost.hoverEach(word.rows[rowIndex].stones.map((s) => s.el), 500);
}

async function activateRow() {
  const row = word.rows[rowIndex];
  row.stones.forEach((s) => s.el.classList.remove('faint'));
  await shell.prompt(promptStep);
}

async function choose(stone) {
  if (shell.locked) return;
  const row = word.rows[rowIndex];
  if (!row.stones.includes(stone)) return;
  shell.lock();
  sfx.tap();
  await placeFrog(stone.x, stone.y, 520);
  audio.play(stone.syl.audio);
  if (stone.right) {
    ripple(stone.x, stone.y);
    sfx.pop();
    const other = row.stones.find((s) => s !== stone);
    other.el.classList.add('gone');
    stone.crossed = true;
    row.stones.forEach((s) => delete s.el.dataset.choice); // a crossed row is no longer a choice for the keyboard
    safeY = { x: stone.x, y: stone.y };
    await sleep(600);
    rowIndex++;
    if (rowIndex < word.rows.length) await activateRow();
    else await reachBank();
  } else {
    queue.miss();
    // the stone sinks with the frog; the frog climbs back to the last safe place
    animate(stone.el, [{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: 'translate(-50%,-20%) scale(.8)', opacity: 0 }], { duration: 600 });
    await animate(frog, [{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%,-40%) scale(.7)' }], { duration: 350 });
    sfx.splash();
    ripple(stone.x, stone.y);
    await sleep(700);
    frog.style.opacity = 1; frog.style.transform = '';
    await placeFrog(safeY.x, safeY.y);
    animate(frog, [{ transform: 'translate(-50%,-50%) scale(.6)' }, { transform: 'translate(-50%,-78%) scale(1)' }], { duration: 400 });
    // offer the same row again, sides swapped
    const [a, b] = row.stones;
    [a.x, b.x] = [b.x, a.x];
    row.stones.forEach((s) => { s.el.style.left = s.x + '%'; s.el.style.opacity = ''; s.el.style.transform = ''; animate(s.el, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); });
    row.stones.reverse();
    await sleep(300);
    await shell.prompt(promptStep);
  }
}

async function reachBank() {
  const clean = !queue.missedThisTurn;
  const [x, y] = clean ? HUT_SPOTS[huts % HUT_SPOTS.length] : [30, 27];
  // the frog lands in front of the spot, so the hut it builds stays in view behind it
  await placeFrog(x, y + 7, 650);
  if (clean) {
    const hut = village.appendChild(el('img', 'hut'));
    hut.src = `../art/${HUTS[huts % HUTS.length]}.webp`; hut.alt = '';
    hut.style.left = x + '%'; hut.style.top = y + '%';
    huts++;
    sfx.pop();
    await animate(hut, [{ transform: 'translate(-50%,-85%) scale(0)' }, { transform: 'translate(-50%,-85%) scale(1.15)', offset: 0.7 }, { transform: 'translate(-50%,-85%) scale(1)' }], { duration: 500 });
    animate(frog, [{ transform: 'translate(-50%,-78%)' }, { transform: 'translate(-50%,-120%)' }, { transform: 'translate(-50%,-78%)' }], { duration: 400 });
  }
  sfx.cheer();
  // blending in the reward: the slow syllables light the crossed stones in turn, then the whole word
  const crossed = word.rows.map((r) => r.stones.find((s) => s.right));
  for (const s of crossed) { s.el.classList.remove('gone'); s.el.classList.add('lit'); await audio.play(s.syl.audio); s.el.classList.remove('lit'); await sleep(120); }
  await sleep(200);
  await audio.play(word.audio);
  queue.done();
  memory.seen(word.id, clean);
  if (clean) {
    const r = goal.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + r.height / 2);
    strip.add(word.image ? `<img src="${word.image}" alt="">` : '🏠');
  }
  await sleep(700);
  isTeaching = false;
  nextWord();
}

function nextWord() {
  word = queue.next();
  if (!word || queue.finished) {
    finale(`<div style="font-size:64px">🐸🏡</div>`, startRound);
    return;
  }
  rowIndex = 0;
  safeY = { x: 50, y: 92 };
  placeFrog(50, 92);
  setGoal();
  buildRows();
  audio.preload([word.audio, ...word.rows.flatMap((r) => r.stones.map((s) => s.syl.audio))]);
  activateRow();
}

function startRound() {
  village.innerHTML = ''; huts = 0;
  const candidates = wordsForRiver();
  const twoFirst = memory.order(candidates).sort((a, b) => a.syllables.length - b.syllables.length);
  const own = shuffle(twoFirst.slice(0, ROUND * 2));
  // on the learning path: the step's focus words first, then its review words, then the game's own choice
  const chosen = path.choose(candidates, ROUND, own).sort((a, b) => a.syllables.length - b.syllables.length);
  roundWords = chosen.map((w) => w.id);
  queue = new Queue(chosen, { cleanToWin: Math.min(ROUND, chosen.length) });
  strip = progressStrip(shell, Math.min(ROUND, chosen.length), '🏠');
  nextWord();
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    pool = content.words.filter((w) => !w.flags.some((f) => /clip|no_speech/.test(f))).flatMap((w) => w.syllables);
    startRound();
  },
  replay: () => promptStep(),
});

// state for scripted checks (tools/devcheck)
window.__game = {
  get word() { return word; }, get rowIndex() { return rowIndex; }, get locked() { return shell.locked; },
  get clean() { return queue?.clean ?? 0; }, get huts() { return huts; }, get words() { return roundWords; }, get finished() { return !!document.querySelector(".finale"); },
  choose: (right) => { const row = word?.rows?.[rowIndex]; if (row) choose(row.stones.find((s) => s.right === right)); },
};

// stones are rebuilt every word; bind taps as they appear
const observer = new MutationObserver(() => {
  for (const b of rowsEl.querySelectorAll('.stone:not([data-bound])')) {
    b.dataset.bound = '1';
    onTap(b, () => {
      const stone = word.rows.flatMap((r) => r.stones).find((s) => s.el === b);
      if (stone) choose(stone);
    });
  }
});
observer.observe(rowsEl, { childList: true });
