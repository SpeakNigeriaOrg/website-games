// Beat the Drum: hear a word, then drum it out, one beat per syllable, and the drum says the word back.
// The word plays at normal speed, then slowly (its syllable clips in turn). Each tap on the drum plays the
// next syllable, so the taps "say" the word. A pause of 1.5 s ends the turn. Right count: the word plays
// whole and a dancer joins the party. Too few: the word hangs unfinished and the dancer waits. Too many:
// the extra taps go "boing". After a miss a ghost hand drums it once and the child drums again.
// Listening test: nothing on screen ever shows the number of syllables (no counter, no marks, and the
// prompt's slow playback does not pulse anything per syllable).
// From the learning path: the step's words, shortest first; level 1 is 4 words, level 2 is 6.
import { loadContent, path, createShell, audio, sfx, Queue, memory, animate, confetti, finale, sleep, el, centre } from '../engine/engine.js';
import { fit, LEVELS, usable } from './fit.js';

const END_PAUSE = 1500;
const ROUND = path.pickLevel([4, 6, fit.roundSize]);
const DANCERS = 6;

const $ = (id) => document.getElementById(id);
const drum = $('drum'), pic = $('pic'), waiter = $('waiter'), party = $('party');

let content, roundWords = [], queue, word, taps = 0, endTimer = null, attempts = 0, joined = 0, teaching = true, playing = null;
let phase = 'wait'; // 'turn' only while the child may drum

// ------------------------------------------------------------ word choice

function chooseWords() {
  const own = LEVELS.flatMap((lvl) => memory.order(lvl.ids.map((id) => content.byId[id]).filter(usable)).slice(0, lvl.take));
  if (!path.active) return own;
  // the learning path: focus words first, then review words, then the game's own; played shortest first
  const pool = [...new Set([...fit.curated, ...path.focus, ...path.review])].map((id) => content.byId[id]).filter(usable);
  return path.choose(pool, ROUND, own).sort((a, b) => a.syllables.length - b.syllables.length);
}

// ------------------------------------------------------------ drum and sounds

const squash = () => animate(drum, [
  { transform: 'translateX(-50%) scale(1,1)' }, { transform: 'translateX(-50%) scale(1.06,.9)', offset: 0.3 },
  { transform: 'translateX(-50%) scale(1,1)' }], { duration: 220, fill: 'none' });
const wobble = () => animate(drum, [
  { transform: 'translateX(-50%) rotate(0)' }, { transform: 'translateX(-50%) rotate(-7deg) scale(1.03,.97)' },
  { transform: 'translateX(-50%) rotate(6deg)' }, { transform: 'translateX(-50%) rotate(-3deg)' },
  { transform: 'translateX(-50%) rotate(0)' }], { duration: 500, fill: 'none' });

function ring(x, y) {
  const r = document.body.appendChild(el('div', 'beat-ring'));
  r.style.left = x + 'px'; r.style.top = y + 'px';
  animate(r, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: .9 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }], { duration: 500 }).then(() => r.remove());
}
const drumHead = () => { const r = drum.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.12 }; };

/** One beat: the drum thumps and says syllable i (stopping any syllable still sounding). */
function beat(i) {
  sfx.drum(1);
  squash();
  const h = drumHead(); ring(h.x, h.y);
  audio.stop();
  playing = audio.play(word.syllables[i].audio);
  return playing;
}

// ------------------------------------------------------------ the turn

async function prompt() {
  pic.classList.add('pulse');
  await audio.play(word.audio);
  await sleep(500);
  await audio.sequence(word.syllables.map((s) => s.audio), 280);
  pic.classList.remove('pulse');
}

function onDrum(e) {
  e?.preventDefault?.();
  if (phase !== 'turn' || shell.locked || !word) return;
  clearTimeout(endTimer);
  if (taps < word.syllables.length) beat(taps);
  else { sfx.drum(0.8); sfx.boing(); wobble(); }
  taps++;
  endTimer = setTimeout(endTurn, END_PAUSE);
}

async function endTurn() {
  if (phase !== 'turn') return;
  phase = 'wait';
  shell.lock();
  const n = word.syllables.length;
  await playing;
  if (taps === n) return success();
  queue.miss();
  attempts++;
  if (taps < n) {
    // the word hangs unfinished: the dancer waits, head tilted, tapping a foot
    waiter.classList.add('waiting');
    pic.classList.add('hang');
    sfx.soft();
    await sleep(1400);
    waiter.classList.remove('waiting');
    pic.classList.remove('hang');
  } else {
    await sleep(500);
  }
  await model();
  if (attempts >= 3) { // enough tries for now: hear it whole, and it comes back later
    await sleep(300);
    await audio.play(word.audio);
    await sleep(500);
    return nextWord();
  }
  startTurn();
}

/** A ghost hand drums the word once, one beat per syllable. */
async function model() {
  const hand = document.body.appendChild(el('div', 'ghost-hand', '👆'));
  const h = drumHead();
  hand.style.left = h.x + 'px'; hand.style.top = (h.y + 60) + 'px';
  await animate(hand, [{ opacity: 0 }, { opacity: 0.9 }], { duration: 300 });
  for (let i = 0; i < word.syllables.length; i++) {
    await animate(hand, [{ transform: 'translate(-50%,0)' }, { transform: 'translate(-50%,-34px) scale(.9)' }], { duration: 160, easing: 'ease-in' });
    const p = beat(i);
    animate(hand, [{ transform: 'translate(-50%,-34px) scale(.9)' }, { transform: 'translate(-50%,0)' }], { duration: 200 });
    await p;
    await sleep(260);
  }
  await animate(hand, [{ opacity: 0.9 }, { opacity: 0 }], { duration: 300 });
  hand.remove();
  await sleep(300);
}

async function success() {
  await sleep(250);
  drum.classList.add('glow');
  await audio.play(word.audio);
  drum.classList.remove('glow');
  const clean = queue.done();
  memory.seen(word.id, clean);
  if (clean) await joinParty();
  else { sfx.pop(); await sleep(500); }
  nextWord();
}

/** The waiting dancer leaps into the party line. */
async function joinParty() {
  sfx.cheer();
  const c = centre(waiter);
  confetti(c.x, c.y);
  const slot = slotFor(joined);
  const d = party.appendChild(el('img', 'dancer'));
  d.src = waiter.src;
  d.style.setProperty('--flip', waiter.style.getPropertyValue('--flip') || 1);
  Object.assign(d.style, { left: slot.x + '%', bottom: (100 - slot.feet) + '%', height: slot.h + 'vh', zIndex: slot.feet, animationDelay: (joined % 3) * -0.2 + 's' });
  // fly from the waiter's place to the slot
  const from = waiter.getBoundingClientRect(), to = d.getBoundingClientRect();
  waiter.style.visibility = 'hidden';
  await animate(d, [
    { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.height / to.height}) scaleX(var(--flip))` },
    { transform: `translate(${(from.left - to.left) / 2}px, ${(from.top - to.top) / 2 - 120}px) scale(${(from.height / to.height + 1) / 2}) scaleX(var(--flip))`, offset: 0.5 },
    { transform: 'translate(0,0) scale(1) scaleX(var(--flip))' }], { duration: 900, easing: 'ease-in-out', fill: 'none' });
  d.classList.add('dancing');
  joined++;
  await sleep(500);
}

/** Party places on the open ground behind the drum: a front row, then a smaller row further back. */
function slotFor(i) {
  if (innerWidth > innerHeight) {
    const xs = [28, 72, 18, 82, 36, 64, 9, 91, 50];
    return { x: xs[i % xs.length], feet: i < 8 ? 62 : 54, h: i < 8 ? 27 : 21 };
  }
  const front = [50, 28, 72, 9, 91], back = [39, 61, 18, 82];
  return i < front.length ? { x: front[i], feet: 60, h: 15 } : { x: back[(i - front.length) % back.length], feet: 54, h: 12 };
}

function setWaiter() {
  waiter.src = `../art/dancer${joined % DANCERS}.png`;
  waiter.style.setProperty('--flip', Math.floor(joined / DANCERS) % 2 ? -1 : 1);
  waiter.style.visibility = '';
  animate(waiter, [{ opacity: 0, transform: 'translateY(30px) scaleX(var(--flip))' }, { opacity: 1, transform: 'translateY(0) scaleX(var(--flip))' }], { duration: 400, fill: 'none' });
}

function startTurn() {
  phase = 'turn';
  taps = 0;
  clearTimeout(endTimer);
  shell.unlock();
}

async function nextWord() {
  word = queue.next();
  if (!word || queue.finished) {
    party.classList.add('finale-dance');
    pic.style.visibility = 'hidden';
    finale(`<div class="finale-dancers">${Array.from({ length: Math.min(joined, DANCERS) }, (_, i) => `<img src="../art/dancer${i}.png" alt="">`).join('')}</div>`, startRound);
    return;
  }
  phase = 'wait';
  attempts = 0;
  taps = 0;
  pic.innerHTML = word.image ? `<img src="${word.image}" alt="">` : '';
  pic.style.visibility = word.image ? '' : 'hidden';
  setWaiter();
  audio.preload([word.audio, ...word.syllables.map((s) => s.audio)]);
  await shell.prompt(async () => {
    await sleep(300);
    await prompt();
    if (teaching) { await sleep(400); await model(); teaching = false; }
  });
  startTurn();
}

function startRound() {
  party.innerHTML = '';
  party.classList.remove('finale-dance');
  joined = 0;
  const words = chooseWords();
  roundWords = words.map((w) => w.id);
  queue = new Queue(words, { cleanToWin: Math.min(ROUND, words.length) });
  nextWord();
}

drum.addEventListener('pointerdown', onDrum);
addEventListener('keydown', (e) => { if (e.code === 'Space' && e.target === document.body && !e.repeat) onDrum(e); });

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    window.__game = {
      drum: onDrum, get word() { return word; }, get taps() { return taps; }, get locked() { return shell.locked; },
      get joined() { return joined; }, get attempts() { return attempts; }, get queue() { return queue; },
      get finished() { return !!document.querySelector('.finale'); }, get words() { return roundWords; },
    };
    startRound();
  },
  // replay only between turns' beats: during feedback the game's own sequence is already speaking
  replay: async () => { if (phase !== 'turn') return; clearTimeout(endTimer); taps = 0; await prompt(); },
});
