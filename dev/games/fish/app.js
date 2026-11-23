// Fishing with Grandma: catch the fish that calls Grandma's word.
// Grandma asks for something: its picture stands big in her basket and she says the word. Identical fish leap out
// of the river one at a time, each calling a word as it jumps, and fall back after about 3 s; only the sound tells
// them apart. Tapping the fish that calls Grandma's word sends her net to scoop it up; over the basket it turns into
// the thing she asked for, says its word and drops in: one of the basket's places fills. A wrong fish says its word
// again, shakes and splashes back, with no penalty. The first request is a teaching turn: a ghost hand wags "no"
// over a wrong fish, then taps the right one, and the net shows what happens; then Grandma asks again.
// Rules (from Frog Pond, which this replaces): the target is never the first fish of a request, so tapping
// everything can't win; a catch counts only if there was at most one wrong tap since the request (an honest
// mistake) or fewer than half the fish shown were tapped. A blocked catch still turns into the thing and says its
// word (the child was right), but it doesn't stay in the basket: no place fills, the ear pulses, and the request
// starts afresh. A request isn't over until its fish is caught cleanly.
// Targets are 1 in 3 at first, then 1 in 4, then 1 in 5; foils move from another category, to the same
// category, to words sharing a syllable. Demand: recognising the heard word.
import { loadContent, createShell, audio, sfx, onTap, memory, animate, confetti, ghost, finale, shuffle, pick, sleep, el, path } from '../engine/engine.js';
import { fit, croakable } from './fit.js';

const ROUNDS = [ // per request (one target each): one target in `block` fish, how long a fish stays up, which foils
  { block: 3, life: 3100, kind: 'other' },
  { block: 4, life: 2850, kind: 'same' },
  { block: 5, life: 2600, kind: 'syllable' },
];
// By path level (1 first meeting, 2 practice, 3 the full game): the requests played. On the path a step with more
// focus words than requests gets one more request per word (up to four), at the last request's difficulty.
const TIERS = path.pickLevel([[ROUNDS[0], ROUNDS[0]], [ROUNDS[0], ROUNDS[1], ROUNDS[1]], ROUNDS]);
// Where a fish leaves the water, as fractions of the column (x, y); it leaps LIFT of the column's height above it.
const SPOTS = [[0.26, 0.62], [0.74, 0.66], [0.5, 0.76], [0.28, 0.88], [0.74, 0.9]];
const LIFT = 0.1;
// The net sprite: where its hoop's centre is (fractions of the image), and how it is turned so the hoop hangs
// down and the handle leads back up to Grandma.
const NET = { hx: 0.24, hy: 0.24, turn: -8 };

const $ = (id) => document.getElementById(id);
const river = $('river'), fishesEl = $('fishes'), card = $('card'), grandma = $('grandma'), slotsEl = $('slots'), net = $('net'), weave = $('weave');

const toneless = (s) => s.normalize('NFD').replace(/[̀́̄]/g, '').normalize('NFC').toLowerCase();

let content, plan = [], round = null, roundNo = 0, fish = null, paused = false, wantReplay = false, phase = 'idle', lastSpot = -1, caught = 0, taught = false;

// ---------------------------------------------------------------- choosing words (Frog Pond's ladder)
const sylSet = (w) => new Set(w.syllables.map((s) => toneless(s.text)));
const cvSet = (w) => new Set([...sylSet(w)].filter((s) => /^[^aeiouẹọ]/.test(s))); // syllables with a consonant
function foilsFor(target, kind, words) {
  const t = toneless(target.display), ts = sylSet(target), tcv = cvSet(target);
  // A foil never contains the target word, or is contained in it (ilé against ilé-ìwé): the child who catches it
  // heard the word and was not wrong.
  const parts = (x) => toneless(x).split(/[s-]+/);
  const overlaps = (w) => parts(w.display).some((p) => parts(target.display).includes(p));
  const ok = words.filter((w) => w.id !== target.id && toneless(w.display) !== t && w.category !== 'prefix' && !overlaps(w));
  if (kind === 'other') return ok.filter((w) => w.category !== target.category && ![...sylSet(w)].some((s) => ts.has(s)));
  if (kind === 'same') return ok.filter((w) => w.category === target.category);
  return ok.filter((w) => [...cvSet(w)].some((s) => tcv.has(s))); // shares a whole consonant-vowel syllable
}

function chooseTargets() {
  // single words only (a fish calls one word), clean takes; targets need a clear picture, approved ones first
  const clean = content.words.filter(croakable);
  const pictured = memory.order(clean.filter(fit.canUse))
    .sort((a, b) => (b.imageSource === 'approved') - (a.imageSource === 'approved'));
  if (path.active) {
    // the step's words are the targets (focus, then review), Grandma's own choice makes up the requests
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

// ---------------------------------------------------------------- geometry and effects
const box = () => river.getBoundingClientRect();
/** Centre of a node in column pixels. */
function at(node) { const r = box(), n = node.getBoundingClientRect(); return { x: n.left - r.left + n.width / 2, y: n.top - r.top + n.height / 2 }; }

function ripple(x, y, big = false) {
  const r = river.appendChild(el('div', 'ripple'));
  r.style.left = x * 100 + '%'; r.style.top = y * 100 + '%';
  animate(r, [{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: `translate(-50%,-50%) scale(${big ? 2.2 : 1.5})`, opacity: 0 }], { duration: big ? 900 : 650 }).then(() => r.remove());
}
function drops(x, y, n = 10) {
  for (let i = 0; i < n; i++) {
    const d = river.appendChild(el('div', 'drop'));
    d.style.left = x * 100 + '%'; d.style.top = y * 100 + '%';
    const a = -Math.PI * (0.1 + 0.8 * Math.random()), dist = 40 + Math.random() * 60;
    animate(d, [{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(${Math.cos(a) * dist}px, ${Math.sin(a) * dist + 40}px)`, opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.2,.6,.5,1)' }).then(() => d.remove());
  }
}
function nudgeEar() {
  const ear = document.querySelector('.ear');
  ear.classList.remove('nudge'); void ear.offsetWidth; ear.classList.add('nudge');
  setTimeout(() => ear.classList.remove('nudge'), 2500);
  sfx.soft();
}
/** Grandma says her word: she bobs and the picture in the basket glows. */
async function sayTarget() {
  card.classList.add('pulse'); grandma.classList.add('talk');
  try { await audio.play(round.target.audio); } finally { card.classList.remove('pulse'); grandma.classList.remove('talk'); }
}

// ---------------------------------------------------------------- Grandma's request
async function introduce() {
  phase = 'guide';
  card.innerHTML = `<img src="${round.target.image}" alt="">`;
  card.classList.add('show');
  sfx.pop();
  await animate(card, [{ transform: 'translateX(-50%) translateY(30%) scale(.2)' }, { transform: 'translateX(-50%) translateY(-6%) scale(1.06)', offset: 0.7 }, { transform: 'translateX(-50%) scale(1)' }], { duration: 500 });
  await shell.prompt(async () => { await sleep(150); await sayTarget(); await sleep(350); await sayTarget(); });
}

// ---------------------------------------------------------------- fish
function makeFish(word) {
  let s; do { s = Math.floor(Math.random() * SPOTS.length); } while (s === lastSpot);
  lastSpot = s;
  const r = box();
  const b = el('button', 'fish', `<span class="body"><img src="../art/fish.png" alt=""></span>`);
  b.setAttribute('aria-label', 'fish');
  fishesEl.appendChild(b);
  const half = b.offsetWidth / 2 + 6;
  const x = Math.min(Math.max(SPOTS[s][0] * r.width, half), r.width - half) / r.width, y = SPOTS[s][1];
  const lift = LIFT * r.height, dir = x > 0.5 ? -1 : 1; // fish on the right face left, towards the middle
  if (dir < 0) b.classList.add('left');
  b.style.left = x * 100 + '%'; b.style.top = (y - LIFT) * 100 + '%';
  b.style.visibility = 'hidden';
  const f = { word, isTarget: word === round.target, el: b, x, y, lift, dir, ready: false, done: false, tapped: false, finished: false };
  round.shown++;
  onTap(b, () => tapFish(f));
  return f;
}

/** Out of the water, nose up, to the top of the leap. */
async function leap(f) {
  f.el.style.visibility = '';
  ripple(f.x, f.y); drops(f.x, f.y, 6);
  sfx.pop();
  await animate(f.el, [{ transform: `translate(-50%, calc(-50% + ${f.lift}px)) rotate(${-55 * f.dir}deg) scale(.6)`, opacity: 0 },
    { transform: `translate(-50%, calc(-50% - 14px)) rotate(${-14 * f.dir}deg) scale(1.04)`, opacity: 1, offset: 0.75 },
    { transform: 'translate(-50%, -50%) rotate(0deg) scale(1)', opacity: 1 }], { duration: 460, easing: 'cubic-bezier(.2,.8,.4,1)' });
}

/** The fish calls its word. */
async function call(f) {
  f.el.classList.add('calling');
  await audio.play(f.word.audio);
  f.el.classList.remove('calling');
}

/** Nose down, back into the water with a splash. */
async function fall(f) {
  await animate(f.el, [{ transform: 'translate(-50%, -50%) rotate(0deg) scale(1)', opacity: 1 },
    { transform: `translate(-50%, calc(-50% + ${f.lift}px)) rotate(${70 * f.dir}deg) scale(.6)`, opacity: 0 }], { duration: 430, easing: 'ease-in' });
  ripple(f.x, f.y); drops(f.x, f.y, 6);
  sfx.splash();
  f.el.remove();
  f.finished = true;
}

async function showFish(word) {
  const f = makeFish(word);
  f.el.dataset.choice = ''; // keyboard: the fish that is up is the choice
  fish = f;
  await leap(f);
  await until(() => !paused);
  if (f.done) return f;
  f.ready = true;
  await call(f);
  // after two missed targets, a ghost hand shows the way once (a teaching moment, not progress for free)
  if (f.isTarget && round.missed >= 2 && !round.ghosted && !f.done) { round.ghosted = true; ghost.tap(f.el); }
  await wait(round.life - 460 - f.word.durationS * 1000, () => f.done);
  if (!f.done) { f.done = true; await fall(f); }
  else await until(() => f.finished);
  return f;
}

function schedule() {
  // one block: `block` fish with the target once; never first in the request, so tapping everything can't win
  const n = round.block, at = round.shown === 0 ? 1 + Math.floor(Math.random() * (n - 1)) : Math.floor(Math.random() * n);
  // never the same foil twice running, across blocks too
  const foils = shuffle(round.foils.filter((w) => w !== round.lastFoil || round.foils.length < 2));
  const block = Array.from({ length: n }, (_, i) => (i === at ? round.target : foils[i % foils.length]));
  round.lastFoil = block.filter((w) => w !== round.target).pop();
  return block;
}

async function tapFish(f) {
  if (!f.ready || f.done || paused || shell.locked || phase !== 'fish') return;
  f.done = true; f.tapped = true;
  sfx.tap();
  audio.stop();
  f.el.classList.remove('calling');
  if (f.isTarget) {
    if (fair()) return netCatch(f, 'clean');
    // too many taps this request: it was the right fish, so it still turns into the thing and says its word, but
    // it doesn't stay in the basket; a gentle "listen", and the request starts afresh
    await netCatch(f, 'blocked');
    round.shown = 0; round.wrong = 0;
    wantReplay = true;
    return;
  }
  round.wrong++; round.wrongAll++; round.streak++;
  if (round.streak >= 2 || !fair()) nudgeEar(); // the ear pulses once a catch would no longer count
  const say = audio.play(f.word.audio);
  f.el.classList.add('shake');
  await say;
  await sleep(200);
  await fall(f);
}

/** A catch counts if there was at most one wrong tap since the request (an honest mistake), or fewer than half
 *  the fish shown were tapped wrongly. Tapping every fish passes only when the target is second. */
const fair = () => round.wrongAll <= 1 || round.wrong < round.shown / 2;

// ---------------------------------------------------------------- the net and the basket
const netPose = (dx, dy, turn, s = 1) => `translate(calc(-${NET.hx * 100}% + ${dx}px), calc(-${NET.hy * 100}% + ${dy}px)) rotate(${turn}deg) scale(${s})`;

/** Grandma's net scoops the fish and carries it over the basket, where it turns into the thing and says its word.
 *  how: 'clean' (drops into the next place in the basket), 'blocked' (pops back out: no place fills, the ear
 *  pulses) or 'demo' (the teaching turn: floats back up to the picture, since Grandma still wants one). */
async function netCatch(f, how) {
  if (how === 'clean') round.caught = true;
  const p = at(f.el), g = at(grandma), mouth = at(weave);
  mouth.y -= weave.getBoundingClientRect().height * 0.15;
  net.style.left = p.x + 'px'; net.style.top = p.y + 'px';
  net.style.transformOrigin = `${NET.hx * 100}% ${NET.hy * 100}%`;
  net.classList.add('show');
  sfx.whoosh();
  // swoop in from Grandma's side
  await animate(net, [{ transform: netPose(g.x - p.x, g.y - p.y, NET.turn - 70, 0.6), opacity: 0 }, { transform: netPose(0, 0, NET.turn), opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.3,.9,.4,1)' });
  sfx.splash(); drops(f.x, f.y - LIFT, 8);
  // the fish goes into the hoop
  await animate(f.el, [{ transform: 'translate(-50%, -50%) scale(1)' }, { transform: 'translate(-50%, -50%) scale(.7)' }], { duration: 160 });
  // carried over the basket
  const dx = mouth.x - p.x, dy = mouth.y - p.y;
  f.el.style.zIndex = 8;
  await Promise.all([
    animate(net, [{ transform: netPose(0, 0, NET.turn) }, { transform: netPose(dx * 0.5, dy * 0.5 - 40, NET.turn - 15) }, { transform: netPose(dx, dy, NET.turn) }], { duration: 650, easing: 'ease-in-out' }),
    animate(f.el, [{ transform: 'translate(-50%, -50%) scale(.7)' }, { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 40}px)) scale(.7)` }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)` }], { duration: 650, easing: 'ease-in-out' }),
  ]);
  // the fish turns into the thing
  const thing = river.appendChild(el('div', 'thing', `<img src="${round.target.image}" alt="">`));
  thing.style.left = mouth.x + 'px'; thing.style.top = mouth.y + 'px';
  animate(net, [{ transform: netPose(dx, dy, NET.turn), opacity: 1 }, { transform: netPose(g.x - p.x, g.y - p.y, NET.turn - 70, 0.6), opacity: 0 }], { duration: 450, delay: 150, easing: 'ease-in' }).then(() => net.classList.remove('show'));
  await animate(f.el.querySelector('img'), [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.3,.4)', opacity: 0 }], { duration: 200 });
  f.el.remove();
  await animate(thing, [{ transform: 'translate(-50%,-50%) scale(.2) rotate(-20deg)' }, { transform: 'translate(-50%,-50%) scale(1.15) rotate(6deg)', offset: 0.7 }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 420 });
  if (how === 'clean') { const c = thing.getBoundingClientRect(); confetti(c.left + c.width / 2, c.top + c.height / 2); sfx.cheer(); }
  await audio.play(round.target.audio);
  if (how === 'clean') {
    // into the basket: the next place fills with the thing
    const slot = slotsEl.children[caught], s = at(slot), t = thing.getBoundingClientRect();
    await animate(thing, [{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: `translate(calc(-50% + ${s.x - mouth.x}px), calc(-50% + ${s.y - mouth.y}px)) scale(${slot.offsetWidth / t.width})` }], { duration: 550, easing: 'ease-in' });
    slot.innerHTML = `<img src="${round.target.image}" alt="">`;
    slot.classList.add('filled');
    weave.classList.remove('bounce'); void weave.offsetWidth; weave.classList.add('bounce');
    caught++;
    memory.seen(round.target.id, true);
  } else if (how === 'blocked') {
    // it hops out of the basket and back into the river: Grandma doesn't keep this one
    nudgeEar();
    const r = box(), wx = mouth.x + r.width * 0.12, wy = r.height * 0.5;
    await animate(thing, [{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${(wx - mouth.x) * 0.5}px), calc(-50% - 50px)) scale(.75) rotate(20deg)`, opacity: 1, offset: 0.4 },
      { transform: `translate(calc(-50% + ${wx - mouth.x}px), calc(-50% + ${wy - mouth.y}px)) scale(.4) rotate(60deg)`, opacity: 0 }], { duration: 750, easing: 'ease-in' });
    sfx.splash(); ripple(wx / r.width, wy / r.height, true); drops(wx / r.width, wy / r.height);
  } else {
    const c = at(card);
    await animate(thing, [{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${c.x - mouth.x}px), calc(-50% + ${c.y - mouth.y}px)) scale(1.2)`, opacity: 0 }], { duration: 600, easing: 'ease-in-out' });
  }
  thing.remove();
  f.finished = true;
}

// ---------------------------------------------------------------- the teaching turn
/** A ghost finger wags "no" over a node. */
async function ghostNo(node) {
  const hand = document.body.appendChild(el('div', 'ghost-hand no', '☝️'));
  const r = node.getBoundingClientRect();
  hand.style.left = r.left + r.width / 2 + 'px'; hand.style.top = r.top - r.height * 0.15 + 'px';
  await sleep(250);
  sfx.bump();
  const wag = (a) => ({ transform: `translate(-50%, -50%) rotate(${a}deg)` });
  await animate(hand, [wag(0), wag(-28), wag(28), wag(-28), wag(28), wag(0)], { duration: 1200, easing: 'ease-in-out', fill: 'none' });
  hand.remove();
}

/** The first request: the ghost hand turns down a wrong fish and taps the right one; then Grandma asks again. */
async function teach() {
  phase = 'teach';
  shell.lock();
  await wait(500);
  let f = makeFish(pick(round.foils));
  await leap(f); await call(f);
  f.el.classList.add('shake');
  await ghostNo(f.el);
  f.el.classList.remove('shake');
  f.done = true; await fall(f);
  await wait(700);
  f = makeFish(round.target);
  await leap(f); await call(f);
  await ghost.tap(f.el);
  f.done = true; f.tapped = true; sfx.tap();
  await netCatch(f, 'demo');
  round.shown = 0; round.wrong = 0; round.wrongAll = 0; // the demonstration is not the child's
  await sleep(300);
  await shell.prompt(sayTarget); // now you
}

// ---------------------------------------------------------------- requests
async function playRound() {
  await introduce();
  if (!taught) { taught = true; await teach(); }
  phase = 'fish';
  await wait(600);
  while (!round.caught) {
    round.queue = schedule();
    while (round.queue.length && !round.caught) {
      if (wantReplay) { wantReplay = false; await until(() => !paused); await shell.prompt(sayTarget); await wait(500); }
      const w = round.queue.shift();
      const f = await showFish(w);
      if (!f.tapped) round.streak = 0;
      if (f.isTarget && !f.tapped) round.missed++;
      fish = null;
      if (!round.caught) await wait(650);
    }
  }
  phase = 'between';
  await animate(card, [{ transform: 'translateX(-50%) scale(1)', opacity: 1 }, { transform: 'translateX(-50%) translateY(30%) scale(.2)', opacity: 0 }], { duration: 350, easing: 'ease-in' });
  card.classList.remove('show');
  card.style.opacity = '';
  await sleep(400);
}

async function startGame() {
  plan = chooseTargets();
  caught = 0;
  slotsEl.innerHTML = '';
  slotsEl.style.setProperty('--n', plan.length);
  for (let i = 0; i < plan.length; i++) slotsEl.appendChild(el('span', 'slot'));
  audio.preload(plan.flatMap((r) => [r.target.audio, ...r.foils.slice(0, 12).map((w) => w.audio)]));
  for (roundNo = 0; roundNo < plan.length; roundNo++) {
    round = { ...plan[roundNo], shown: 0, wrong: 0, wrongAll: 0, streak: 0, missed: 0, caught: false };
    await playRound();
  }
  phase = 'done';
  finale(`<div class="haul"><div class="haul-things">${plan.map((r) => `<img src="${r.target.image}" alt="">`).join('')}</div><img class="haul-basket" src="../art/basket.png" alt=""></div>`, startGame);
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    startGame();
  },
  replay: async () => { if (round && phase !== 'between' && phase !== 'done') await sayTarget(); },
  onIdle: () => { if (phase === 'fish') wantReplay = true; },
  onPause: (p) => { paused = p; },
});
shell.lock();

window.__game = {
  get phase() { return phase; }, get round() { return roundNo; }, get caught() { return caught; },
  get locked() { return shell.locked; },
  get target() { return round?.target.display; },
  get words() { return plan.map((r) => r.target.id); },
  get fish() { return phase === 'fish' && fish && !fish.done && fish.ready ? { word: fish.word.display, isTarget: fish.isTarget } : null; },
  get stats() { return round ? { shown: round.shown, wrong: round.wrong, wrongAll: round.wrongAll, fair: fair() } : null; },
  tap: () => { if (fish) tapFish(fish); },
  tapEl: () => fish?.el,
};
