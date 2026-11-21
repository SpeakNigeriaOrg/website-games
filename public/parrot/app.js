// Silly Parrot: the parrot holds up a picture and names it. Sometimes it is right, sometimes silly.
// Right -> feed it a seed. Silly -> bonk its hat with the squeaky hammer, and it squawks the right word.
// A miss shows what happened (hiccup "oops" / offended parrot), the right word plays, and the child
// taps the other button. Progress is a streak of clean turns: a miss spills the streak, so guessing
// (50/50) almost never reaches the end. Demand: hearing whether the spoken word matches the picture.
import { loadContent, createShell, audio, sfx, onTap, Queue, memory, progressStrip, animate, confetti, centre, ghost, finale, shuffle, pick, sleep, el, path } from '../engine/engine.js';
import { fit as parrotFit, APART } from './fit.js'; // (fit() here is the layout)

// By path level (1 first meeting, 2 practice, 3 the full game). On the path the streak is at least as long as
// the step's words, so each of them is held up.
let STREAK = path.pickLevel([3, 4, 5]);              // clean turns in a row to win the round
const OTHER_CATEGORY_TURNS = path.pickLevel([Infinity, 3, 6]); // child turns whose silly word comes from another category; later, the same one
const ROUND_WORDS = path.pickLevel([4, 6, Infinity]); // on the path: the pictures the parrot holds up (silly words come from all)
const $ = (id) => document.getElementById(id);
const parrotArea = $('parrotArea'), parrot = $('parrot'), sign = $('sign'), bubble = $('bubble');
const seedBtn = $('seedBtn'), hammerBtn = $('hammerBtn');
const parrotImg = parrot.querySelector('.parrot-img');

// Where the blank sign and the beak/head are in the parrot sprite, in % of the sprite box.
const SPRITE = { sign: { left: 3, top: 2.5, width: 94, height: 37.5 }, beak: { x: 54, y: 53 }, head: { x: 66, y: 45 } };

let content, pool, round, queue, strip, turn, childTurns = 0, deck = [], phase = 'idle', teaching = 0, busy = true;

// ---------------------------------------------------------------- extra sounds (synthesised)
const fx = {
  crunch() { [0, 90, 180].forEach((t) => setTimeout(() => sfx._noise(0.07, 0.3, 4000, 1200), t)); },
  squeak() { sfx._tone(1300, 0.12, 'sine', 0.16, 1.7); setTimeout(() => sfx._tone(1700, 0.1, 'sine', 0.12, 0.7), 120); },
  squawk() { sfx._tone(950, 0.22, 'sawtooth', 0.07, 0.55); setTimeout(() => sfx._tone(800, 0.25, 'sawtooth', 0.07, 0.5), 230); },
  hiccup() { sfx._tone(420, 0.09, 'sine', 0.22, 2.4); },
  huff() { sfx._noise(0.3, 0.15, 900, 200); },
};

// ---------------------------------------------------------------- layout

function fit() {
  const r = parrotArea.getBoundingClientRect();
  const ratio = (parrotImg.naturalWidth || 3) / (parrotImg.naturalHeight || 4);
  let w = r.width, h = w / ratio;
  if (h > r.height) { h = r.height; w = h * ratio; }
  parrot.style.width = w + 'px'; parrot.style.height = h + 'px';
}
addEventListener('resize', fit);
parrotImg.addEventListener('load', fit);
Object.assign(sign.style, { left: SPRITE.sign.left + '%', top: SPRITE.sign.top + '%', width: SPRITE.sign.width + '%', height: SPRITE.sign.height + '%' });

const spritePoint = (p) => { const r = parrot.getBoundingClientRect(); return { x: r.left + r.width * p.x / 100, y: r.top + r.height * p.y / 100 }; };

// ---------------------------------------------------------------- turns

function nextSilly() {
  if (!deck.length) deck = shuffle([true, true, false, false]);
  return deck.pop();
}

/** On a tone stone the silly word is always the picture's tone partner: only the tone tells them apart. */
let tonePartner = new Map();

function sillyWord(word) {
  if (tonePartner.has(word)) return tonePartner.get(word);
  const sameCat = childTurns >= OTHER_CATEGORY_TURNS;
  const options = pool.filter((w) => w !== word && w.display !== word.display && (sameCat ? w.category === word.category : w.category !== word.category));
  return pick(options.length ? options : pool.filter((w) => w !== word));
}

function makeTurn(word, silly) {
  return { word, silly, said: silly ? sillyWord(word) : word, correct: silly ? 'hammer' : 'seed' };
}

async function showPicture() {
  sign.innerHTML = `<img src="${turn.word.image}" alt="">`;
  await animate(sign, [{ transform: 'scale(0) rotate(-20deg)' }, { transform: 'scale(1.1) rotate(4deg)', offset: 0.7 }, { transform: 'scale(1) rotate(0)' }], { duration: 450 });
  sfx.pop();
}

async function say(w) {
  parrot.classList.add('talk');
  await audio.play(w.audio);
  parrot.classList.remove('talk');
}

/** The prompt: the parrot names the picture (rightly or sillily). In the fix step, the right word. */
async function promptTurn() {
  await say(phase === 'fix' ? turn.word : turn.said);
}

function showBubble(html, ms = 1400) {
  bubble.innerHTML = html;
  bubble.classList.remove('show'); void bubble.offsetWidth; bubble.classList.add('show');
  setTimeout(() => bubble.classList.remove('show'), ms);
}

/** A quick body jolt that leaves nothing behind (the engine's animate() keeps its end transform inline, which
 *  would override the .offended posture for the rest of the game). */
const jolt = (keyframes, duration) => parrot.animate(keyframes, { duration, easing: 'ease-out' }).finished.catch(() => {});

async function flySeed() {
  const from = centre(seedBtn), to = spritePoint(SPRITE.beak);
  const s = document.body.appendChild(el('div', 'flying-seed'));
  s.style.left = from.x + 'px'; s.style.top = from.y + 'px';
  sfx.whoosh();
  await animate(s, [{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: `translate(calc(-50% + ${(to.x - from.x) / 2}px), calc(-50% + ${(to.y - from.y) / 2 - 80}px)) scale(1.3)` },
    { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(.6)` }], { duration: 600, easing: 'ease-in-out' });
  s.remove();
  fx.crunch();
  await jolt([{ transform: 'scale(1)' }, { transform: 'scale(1.04,.96)' }, { transform: 'scale(.98,1.03)' }, { transform: 'scale(1)' }], 400);
}

async function bonk() {
  const head = spritePoint(SPRITE.head);
  const h = document.body.appendChild(el('div', 'flying-hammer', hammerBtn.innerHTML));
  h.style.left = head.x + 'px'; h.style.top = head.y + 'px';
  await animate(h, [{ transform: 'translate(-10%,-110%) rotate(60deg)' }, { transform: 'translate(-10%,-110%) rotate(-30deg)' }], { duration: 260, easing: 'ease-in' });
  fx.squeak(); sfx.bump();
  jolt([{ transform: 'scale(1,1)' }, { transform: 'scale(1.06,.9)' }, { transform: 'scale(1)' }], 300);
  await animate(h, [{ transform: 'translate(-10%,-110%) rotate(-30deg)', opacity: 1 }, { transform: 'translate(-10%,-150%) rotate(40deg)', opacity: 0 }], { duration: 300 });
  h.remove();
}

function wiggle(btn) {
  btn.classList.remove('wiggle'); void btn.offsetWidth; btn.classList.add('wiggle');
}

async function spillStreak() {
  const filled = [...shell.progressEl.querySelectorAll('.slot.filled')];
  await Promise.all(filled.map((s, i) => animate(s, [{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(40px) rotate(${i % 2 ? 50 : -50}deg)`, opacity: 0 }], { duration: 450, delay: i * 40 })));
  strip = progressStrip(shell, STREAK, seedIcon());
}

const seedIcon = () => '<span class="seed-icon"></span>';

/** The reactions, shared by the child's taps and the ghost demonstrations. */
const react = {
  async seedRight() { await flySeed(); sfx.cheer(); parrot.classList.add('happy'); const c = spritePoint(SPRITE.beak); confetti(c.x, c.y); await sleep(500); await say(turn.word); parrot.classList.remove('happy'); },
  async hammerSilly() { await bonk(); fx.squawk(); parrot.classList.add('shake'); showBubble('❗'); await sleep(550); parrot.classList.remove('shake'); await say(turn.word); sfx.cheer(); },
  async seedSilly() { await flySeed(); await sleep(150); for (let i = 0; i < 2; i++) { fx.hiccup(); await jolt([{ transform: 'translateY(0)' }, { transform: 'translateY(-4%)' }, { transform: 'translateY(0)' }], 260); await sleep(120); } showBubble('😳'); await sleep(400); await say(turn.word); wiggle(hammerBtn); },
  async hammerRight() { await bonk(); fx.huff(); parrot.classList.add('offended'); showBubble('💢', 1800); await sleep(700); await say(turn.word); parrot.classList.remove('offended'); wiggle(seedBtn); },
};

async function choose(choice) {
  if (busy || shell.locked || phase === 'idle') return;
  busy = true;
  shell.lock();
  sfx.tap();
  if (phase === 'answer') {
    if (choice === turn.correct) {
      await (choice === 'seed' ? react.seedRight() : react.hammerSilly());
      return endTurn();
    }
    queue.miss();
    spillStreak();
    await (choice === 'seed' ? react.seedSilly() : react.hammerRight());
    phase = 'fix';
    busy = false;
    shell.unlock();
    return;
  }
  // fix step: only the right button does something; the other one makes the right one wiggle
  if (choice !== turn.correct) { sfx.soft(); wiggle(turn.correct === 'seed' ? seedBtn : hammerBtn); busy = false; shell.unlock(); return; }
  if (choice === 'seed') { await flySeed(); parrot.classList.add('happy'); await sleep(400); parrot.classList.remove('happy'); }
  else { await bonk(); fx.squawk(); await sleep(300); await say(turn.word); }
  endTurn();
}

async function endTurn() {
  const clean = queue.done();
  memory.seen(turn.word.id, clean);
  childTurns++;
  if (clean) {
    const n = strip.add(seedIcon());
    if (n >= STREAK) { phase = 'idle'; await sleep(600); finale(`<img src="../art/parrot.png" alt="" style="height:34vh"><div class="finale-seeds">${seedIcon().repeat(STREAK)}</div>`, startRound); return; }
  }
  await sleep(500);
  nextTurn();
}

async function nextTurn() {
  busy = true;
  let word = queue.next();
  if (!word) { queue = new Queue(path.active ? shuffle(round) : memory.order(pool)); word = queue.next(); }
  turn = makeTurn(word, nextSilly());
  phase = 'answer';
  audio.preload([turn.word.audio, turn.said.audio]);
  shell.lock();
  await showPicture();
  await sleep(350);
  await shell.prompt(promptTurn);
  busy = false;
}

// ---------------------------------------------------------------- teaching: a ghost plays one right turn and one silly turn

async function demo(word, silly) {
  turn = makeTurn(word, silly);
  if (silly) turn.said = pick(pool.filter((w) => w.category !== word.category));
  phase = 'demo';
  shell.lock();
  await showPicture();
  await sleep(350);
  await say(turn.said);
  await sleep(300);
  const btn = silly ? hammerBtn : seedBtn;
  await ghost.tap(btn);
  sfx.tap();
  await (silly ? react.hammerSilly() : react.seedRight());
  await sleep(600);
}

async function startRound() {
  strip = progressStrip(shell, STREAK, seedIcon());
  const order = path.active ? [...round] : memory.order(pool);
  childTurns = 0; deck = [];
  if (teaching === 0) {
    teaching = 1;
    // the ghost's words are kept out of the child's first turns (on the path, the ghost uses words outside the step)
    const others = memory.order(pool.filter((w) => !round.includes(w)));
    const [a, b] = path.active && others.length >= 2 ? others : order.splice(0, 2);
    await demo(a, false);
    await demo(b, true);
    if (!path.active) order.push(a, b);
  }
  queue = new Queue(order);
  nextTurn();
}

/** On the path: the step's words first (focus, then review), then the parrot's own; one word per meaning. */
function pathPool() {
  const extra = [...path.focus, ...path.review].map((id) => content.byId[id]).filter((w) => w && parrotFit.canUse(w) && !pool.includes(w));
  const all = [...pool, ...extra], out = [];
  for (const w of path.choose(all, all.length, memory.order(pool))) {
    if (APART.some((pair) => pair.includes(w.id) && out.some((o) => pair.includes(o.id)))) continue;
    out.push(w);
  }
  return out;
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: parrotFit.voices });
    pool = parrotFit.curated.map((id) => content.byId[id]).filter((w) => w && parrotFit.canUse(w));
    round = pool;
    const pairs = path.pairs.map((p) => p.map((id) => content.byId[id])).filter((p) => p.every((w) => parrotFit.canUseInPair(w)) && p[0].person === p[1].person);
    if (path.active && pairs.length) {
      // tone stone: the round is the pair words; the demo still uses the parrot's own pictures
      tonePartner = new Map(pairs.flatMap(([x, y]) => [[x, y], [y, x]]));
      round = pairs.flat();
      STREAK = path.pickLevel([4, 5, 6]);
    } else if (path.active) {
      pool = pathPool();
      round = pool.slice(0, Math.max(ROUND_WORDS, path.usable(pool).length));
      STREAK = Math.max(STREAK, pool.filter((w) => path.focus.includes(w.id)).length);
    }
    fit();
    startRound();
  },
  replay: () => (busy ? null : promptTurn()), // no replay in the middle of a reaction
  onIdle: async () => {
    if (phase === 'fix') { await shell.doReplay(); await ghost.tap(turn.correct === 'seed' ? seedBtn : hammerBtn); }
    else if (phase === 'answer') shell.doReplay();
  },
});

onTap(seedBtn, () => choose('seed'));
onTap(hammerBtn, () => choose('hammer'));

// For the play-check script: read the turn, act right or wrong.
window.__game = {
  get tonePairs() { return [...tonePartner.keys()].map((w) => w.id); },
  get state() { return { phase, locked: shell.locked, silly: turn?.silly, word: turn?.word.id, said: turn?.said.id, correct: turn?.correct, streak: strip?.count, childTurns, finished: !!document.querySelector('.finale') }; },
  tap: (choice) => choose(choice),
  get words() { return (round || []).map((w) => w.id); },
};
