// Frog Pond: catch only the frog that says the word.
// Grandma holds up the target's picture and says its word; the picture moves to the corner. Identical
// frogs pop up from the lily pads one at a time, each croaking a word, and sink after about 3 s.
// Tapping the frog that said the word turns it into the thing (one of 3 slots fills). A wrong frog says
// its word again, blinks and sinks, with no penalty. A missed target comes back.
// Spam-tapping can't win: a catch counts only if there was at most one wrong tap since the target was announced
// (one honest mistake is forgiven) or fewer than half the frogs in the round were tapped, and the round never
// opens with the target. A blocked catch still turns into the thing and says its word (the child was right), but
// no slot fills and the ear pulses: a gentle "listen", no progress.
// Targets are 1 in 3 at first, then 1 in 4, then 1 in 5; foils move from another category, to the same
// category, to words sharing a syllable. Demand: recognising the heard word.
import { loadContent, createShell, audio, sfx, onTap, memory, progressStrip, animate, confetti, ghost, finale, shuffle, pick, sleep, el, path } from '../engine/engine.js';
// fit.legacy.js (was fit.js): renamed so the path builder, which picks games by their fit.js, uses Fishing with
// Grandma (fish/) instead of this game. Frog Pond itself still plays from its own URL.
import { fit, croakable } from './fit.legacy.js';

const ROUNDS = [ // per round (one target each): one target in `block` frogs, how long a frog stays, which foils
  { block: 3, life: 3100, kind: 'other' },
  { block: 4, life: 2850, kind: 'same' },
  { block: 5, life: 2600, kind: 'syllable' },
];
// By path level (1 first meeting, 2 practice, 3 the full game): the rounds played. On the path a step with more
// focus words than rounds gets one more round per word (up to four), at the last round's difficulty.
const TIERS = path.pickLevel([[ROUNDS[0], ROUNDS[0]], [ROUNDS[0], ROUNDS[1], ROUNDS[1]], ROUNDS]);
// lily pads in bg_pond.png, in image pixels (832 x 1216): centre x, y and radius; the top-left pad holds the target card
const PADS = [[572, 172, 115], [685, 428, 130], [175, 545, 142], [697, 713, 125], [225, 912, 145], [630, 1003, 128]];
/** Where a frog sits on pad p, as fractions of the column. The picture is cropped to fill the screen (object-fit:
 *  cover), so map image pixels through the same crop, and slide the frog along its pad if the pad's centre is
 *  near a cropped edge. */
function padSpot(p) {
  const r = pond.getBoundingClientRect(), [cx, cy, rad] = PADS[p];
  const s = Math.max(r.width / 832, r.height / 1216), ox = (r.width - 832 * s) / 2, oy = (r.height - 1216 * s) / 2;
  const half = r.width * 0.135 + 4;
  const lo = Math.max(half, ox + (cx - rad * 0.7) * s), hi = Math.min(r.width - half, ox + (cx + rad * 0.7) * s);
  const x = Math.min(Math.max(ox + cx * s, lo), Math.max(lo, hi));
  const y = Math.max(oy + (cy + rad * 0.25) * s, 62 + r.width * 0.27 * 0.8); // keep the frog clear of the progress strip
  return [x / r.width, y / r.height];
}
const $ = (id) => document.getElementById(id);
const pond = $('pond'), frogsEl = $('frogs'), card = $('card'), guide = $('guide');

const toneless = (s) => s.normalize('NFD').replace(/[̀́̄]/g, '').normalize('NFC').toLowerCase();

let content, strip, plan = [], round = null, roundNo = 0, frog = null, paused = false, wantReplay = false, phase = 'idle', lastPad = -1, playing = 0;

// ---------------------------------------------------------------- choosing words
const sylSet = (w) => new Set(w.syllables.map((s) => toneless(s.text)));
const cvSet = (w) => new Set([...sylSet(w)].filter((s) => /^[^aeiouẹọ]/.test(s))); // syllables with a consonant
function foilsFor(target, kind, words) {
  const t = toneless(target.display), ts = sylSet(target), tcv = cvSet(target);
  const ok = words.filter((w) => w.id !== target.id && toneless(w.display) !== t && w.category !== 'prefix');
  if (kind === 'other') return ok.filter((w) => w.category !== target.category && ![...sylSet(w)].some((s) => ts.has(s)));
  if (kind === 'same') return ok.filter((w) => w.category === target.category);
  return ok.filter((w) => [...cvSet(w)].some((s) => tcv.has(s))); // shares a whole consonant-vowel syllable
}

function chooseTargets() {
  // single words only (frogs croak one word), clean takes; targets need a clear picture, approved ones first
  const clean = content.words.filter(croakable);
  const pictured = memory.order(clean.filter(fit.canUse))
    .sort((a, b) => (b.imageSource === 'approved') - (a.imageSource === 'approved'));
  if (path.active) {
    // the step's words are the targets (focus, then review), the pond's own choice makes up the rounds
    const tiers = [...TIERS];
    while (tiers.length < Math.min(4, pictured.filter((w) => path.focus.includes(w.id)).length)) tiers.push(TIERS.at(-1));
    return path.choose(pictured, tiers.length, pictured).map((t, i) => {
      let foils = foilsFor(t, tiers[i].kind, clean);
      if (foils.length < 3) foils = foilsFor(t, 'other', clean);
      return { target: t, foils, ...tiers[i] };
    });
  }
  const used = new Set();
  // hardest tier first, since it has the fewest candidates
  const plan = [];
  for (const i of [2, 1, 0]) {
    const fits = pictured.filter((w) => !used.has(w.id) && foilsFor(w, ROUNDS[i].kind, clean).length >= 3);
    // few words fit the shared-syllable tier, so take any of them (not always the first approved one)
    const t = (i === 2 ? pick(fits) : fits[0]) || pictured.find((w) => !used.has(w.id));
    used.add(t.id);
    plan[i] = { target: t, foils: foilsFor(t, ROUNDS[i].kind, clean), ...ROUNDS[i] };
    if (plan[i].foils.length < 3) plan[i].foils = foilsFor(t, 'other', clean);
  }
  return plan;
}

// ---------------------------------------------------------------- time that stops for replays
async function wait(ms, stop = () => false) {
  let left = ms, last = performance.now();
  while (left > 0 && !stop()) {
    await sleep(Math.min(50, left));
    const now = performance.now();
    if (!paused) left -= now - last;
    last = now;
  }
}
const until = async (cond) => { while (!cond()) await sleep(40); };

// ---------------------------------------------------------------- effects
function ripple(x, y, big = false) {
  const r = pond.appendChild(el('div', 'ripple'));
  r.style.left = x * 100 + '%'; r.style.top = y * 100 + '%';
  animate(r, [{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: `translate(-50%,-50%) scale(${big ? 2.2 : 1.5})`, opacity: 0 }], { duration: big ? 900 : 650 }).then(() => r.remove());
}
function drops(x, y) {
  for (let i = 0; i < 10; i++) {
    const d = pond.appendChild(el('div', 'drop'));
    d.style.left = x * 100 + '%'; d.style.top = y * 100 + '%';
    const a = -Math.PI * (0.1 + 0.8 * Math.random()), dist = 60 + Math.random() * 70;
    animate(d, [{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(${Math.cos(a) * dist}px, ${Math.sin(a) * dist + 40}px)`, opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.2,.6,.5,1)' }).then(() => d.remove());
  }
}
function nudgeEar() {
  const ear = document.querySelector('.ear');
  ear.classList.remove('nudge'); void ear.offsetWidth; ear.classList.add('nudge');
  setTimeout(() => ear.classList.remove('nudge'), 2500);
  sfx.soft();
}
async function sayTarget() {
  playing++;
  card.classList.add('pulse');
  try { await audio.play(round.target.audio); } finally { card.classList.remove('pulse'); playing--; }
}

// ---------------------------------------------------------------- the guide
async function introduce() {
  phase = 'guide';
  const t = round.target;
  card.innerHTML = `<img src="${t.image}" alt="">`;
  card.classList.add('show');
  const pr = pond.getBoundingClientRect(); // the corner card sits on the top-left pad, below the progress strip
  const big = { left: '50%', top: '40%', width: '50%' }, corner = { left: '23.7%', top: Math.max(pr.height * 0.16, 66 + pr.width * 0.125) + 'px', width: '25%' };
  Object.assign(card.style, big);
  animate(guide, [{ transform: 'translate(-50%,110%)' }, { transform: 'translate(-50%,8%)' }], { duration: 500, easing: 'cubic-bezier(.3,1.4,.5,1)' });
  await animate(card, [{ transform: 'translate(-50%,-50%) scale(0)' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 450, delay: 250 });
  await shell.prompt(async () => { await sleep(150); await sayTarget(); await sleep(350); await sayTarget(); });
  shell.lock();
  animate(guide, [{ transform: 'translate(-50%,8%)' }, { transform: 'translate(-50%,110%)' }], { duration: 450, easing: 'ease-in' });
  await animate(card, [{ ...big, transform: 'translate(-50%,-50%)' }, { ...corner, transform: 'translate(-50%,-50%)' }], { duration: 650, easing: 'ease-in-out' });
  Object.assign(card.style, corner);
  card.getAnimations().forEach((a) => a.cancel());
  card.style.transform = 'translate(-50%,-50%)';
  shell.unlock();
}

// ---------------------------------------------------------------- frogs
function schedule() {
  // one block: `block` frogs with the target once; never first in the round, so tapping everything can't win
  const n = round.block, at = round.shown === 0 ? 1 + Math.floor(Math.random() * (n - 1)) : Math.floor(Math.random() * n);
  // never the same foil twice running, across blocks too
  const foils = shuffle(round.foils.filter((w) => w !== round.lastFoil || round.foils.length < 2));
  const block = Array.from({ length: n }, (_, i) => (i === at ? round.target : foils[i % foils.length]));
  round.lastFoil = block.filter((w) => w !== round.target).pop();
  return block;
}

async function showFrog(word) {
  let p; do { p = Math.floor(Math.random() * PADS.length); } while (p === lastPad);
  lastPad = p;
  const [x, y] = padSpot(p);
  const b = el('button', 'frog', `<img src="../art/frog.png" alt="">`);
  b.setAttribute('aria-label', 'frog');
  b.dataset.choice = ''; // keyboard: the frog that is up is the choice
  b.style.left = x * 100 + '%'; b.style.top = y * 100 + '%';
  frogsEl.appendChild(b);
  const f = { word, isTarget: word === round.target, el: b, x, y, ready: false, done: false, tapped: false };
  frog = f;
  round.shown++;
  onTap(b, () => tapFrog(f));
  ripple(x, y);
  sfx.pop();
  await animate(b, [{ transform: 'translate(-50%,-30%) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-95%) scale(1.08)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,-82%) scale(1)', opacity: 1 }], { duration: 380 });
  await until(() => !paused);
  if (f.done) return f;
  // the croak: the frog says its word
  f.ready = true;
  b.classList.add('croaking');
  playing++;
  await audio.play(word.audio);
  playing--;
  b.classList.remove('croaking');
  // after two missed targets, a ghost hand shows the way once (a teaching moment, not progress for free)
  if (f.isTarget && round.missed >= 2 && !round.ghosted && !f.done) { round.ghosted = true; ghost.tap(b); }
  await wait(round.life - 380 - word.durationS * 1000, () => f.done);
  if (!f.done) { f.done = true; await sink(f); }
  else await until(() => f.finished);
  return f;
}

async function sink(f) {
  await animate(f.el, [{ transform: 'translate(-50%,-82%) scale(1)', opacity: 1 }, { transform: 'translate(-50%,-20%) scale(.6)', opacity: 0 }], { duration: 420, easing: 'ease-in' });
  ripple(f.x, f.y);
  f.el.remove();
  f.finished = true;
}

async function tapFrog(f) {
  if (!f.ready || f.done || paused || shell.locked || phase !== 'frogs') return;
  f.done = true; f.tapped = true;
  sfx.tap();
  audio.stop();
  if (f.isTarget) {
    if (fair()) return catchTarget(f);
    // too many taps this round: it was the right frog, so it still turns into the thing and says its word, but
    // no slot fills; a gentle "listen", the thing slips away, the round starts afresh
    splashAt(f);
    await becomeThing(f);
    nudgeEar();
    await sink(f);
    round.shown = 0; round.wrong = 0;
    wantReplay = true;
    return;
  }
  round.wrong++; round.wrongAll++; round.streak++;
  if (round.streak >= 2 || !fair()) nudgeEar(); // the ear pulses once a catch would no longer count
  playing++;
  const say = audio.play(f.word.audio);
  f.el.classList.add('blink');
  await say; playing--;
  await sleep(250);
  await sink(f);
}

/** A catch counts if there was at most one wrong tap since the target was announced (an honest mistake), or
 *  fewer than half the frogs shown were tapped wrongly. Tapping every frog passes only when the target is second. */
const fair = () => round.wrongAll <= 1 || round.wrong < round.shown / 2;

function splashAt(f) { sfx.splash(); drops(f.x, f.y); ripple(f.x, f.y, true); }

/** The frog turns into the thing, which says its word (`onShow` runs as it appears). */
async function becomeThing(f, onShow = () => {}) {
  const thing = el('div', 'thing', `<img src="${round.target.image}" alt="">`);
  await animate(f.el.querySelector('img'), [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.3,.4)', opacity: 0 }], { duration: 220 });
  f.el.appendChild(thing);
  await animate(thing, [{ transform: 'translate(-50%,-50%) scale(.2) rotate(-20deg)' }, { transform: 'translate(-50%,-50%) scale(1.15) rotate(6deg)', offset: 0.7 }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 450 });
  onShow();
  playing++;
  await audio.play(round.target.audio);
  playing--;
  return thing;
}

async function catchTarget(f) {
  round.caught = true;
  splashAt(f);
  const thing = await becomeThing(f, () => {
    const r = f.el.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + r.height / 2);
    sfx.cheer();
  });
  // to the slot
  const slot = shell.progressEl.children[strip.count].getBoundingClientRect(), t = thing.getBoundingClientRect();
  await animate(thing, [{ transform: 'translate(-50%,-50%) scale(1)' },
    { transform: `translate(calc(-50% + ${slot.left + slot.width / 2 - t.left - t.width / 2}px), calc(-50% + ${slot.top + slot.height / 2 - t.top - t.height / 2}px)) scale(${slot.width / t.width})` }], { duration: 700, easing: 'ease-in-out' });
  strip.add(`<img src="${round.target.image}" alt="">`);
  memory.seen(round.target.id, true);
  f.el.remove();
  f.finished = true;
}

async function playRound() {
  await introduce();
  phase = 'frogs';
  await wait(600);
  while (!round.caught) {
    round.queue = schedule();
    while (round.queue.length && !round.caught) {
      if (wantReplay) { wantReplay = false; await until(() => !paused); await shell.prompt(sayTarget); await wait(500); }
      const w = round.queue.shift();
      const f = await showFrog(w);
      if (!f.tapped) round.streak = 0;
      if (f.isTarget && !f.tapped) round.missed++;
      frog = null;
      if (!round.caught) await wait(650);
    }
  }
  phase = 'between';
  card.classList.remove('show');
  await sleep(500);
}

async function startGame() {
  plan = chooseTargets();
  strip = progressStrip(shell, plan.length, '🐸');
  audio.preload(plan.flatMap((r) => [r.target.audio, ...r.foils.slice(0, 12).map((w) => w.audio)]));
  for (roundNo = 0; roundNo < plan.length; roundNo++) {
    round = { ...plan[roundNo], shown: 0, wrong: 0, wrongAll: 0, streak: 0, missed: 0, caught: false };
    await playRound();
  }
  phase = 'done';
  finale(`<div style="font-size:64px">🐸💦</div>`, startGame);
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    startGame();
  },
  replay: async () => { if (round && phase !== 'between' && phase !== 'done') await sayTarget(); },
  onIdle: () => { if (phase === 'frogs') wantReplay = true; },
  onPause: (p) => { paused = p; },
});
shell.lock();

window.__game = {
  get phase() { return phase; }, get round() { return roundNo; }, get caught() { return strip?.count ?? 0; },
  get target() { return round?.target.display; },
  get words() { return plan.map((r) => r.target.id); },
  get frog() { return frog && !frog.done && frog.ready ? { word: frog.word.display, isTarget: frog.isTarget } : null; },
  get stats() { return round ? { shown: round.shown, wrong: round.wrong, wrongAll: round.wrongAll, fair: fair() } : null; },
  tap: () => { if (frog) tapFrog(frog); },
  tapEl: () => frog?.el,
};
