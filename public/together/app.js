// Put It Together: two known words go into the pot; which picture comes out?
// Curriculum ("building blocks first"): a compound comes after its parts, so the child can work out the whole.
// A turn: the first part's picture pops up and says its word, then the second's (tap either to hear it again).
// A copy of each flies into the clay pot, which bubbles; two pictures rise out of it: the whole word and an absurd
// foil (a picture word from a category neither the whole nor its parts belong to). The two pictures are silent,
// so only meaning can find the answer. Right: the whole word plays, the picture grows and celebrates, the parts
// stay beside it. Wrong: the foil says its own word and wobbles, the right one glows and says the whole word, and
// the compound comes back two items later. Only first-try turns fill the strip. Replay: the parts again, then the
// two pictures bob (both, never one). The first turn is taught by the ghost hand and does not count.
// The finale shows the pot and what was built this round: each compound's picture with its parts small beside it.
import { loadContent, createShell, audio, sfx, onTap, Queue, memory, progressStrip, animate, confetti, ghost, finale, shuffle, pick, sleep, el, path } from '../engine/engine.js';
import { fit, partsOf, clean, FOILS } from './fit.js';

// By path level (1 first meeting, 2 practice, 3 the full game): how many compounds in the round.
const ROUND_WORDS = path.pickLevel([3, Infinity, Infinity]);

const $ = (id) => document.getElementById(id);
const stage = $('stage'), potEl = $('pot'), cardsEl = $('cards');

let content, words, queue, strip, turn = null, firstTurn = true, geo, built = []; // built: compounds made cleanly this round

// ---------------------------------------------------------------- layout

/** Portrait: the parts in a row at the top, the pot in the middle, the two pictures in a row below.
 *  Landscape: parts on the left, pot in the middle, pictures on the right (left to right is "in, then out"). */
function layout() {
  const W = innerWidth, H = innerHeight;
  if (W < H * 1.15) {
    const top = 66, bottom = 100; // under the progress strip; above the replay button
    const s = Math.min(W * 0.42, (H - top - bottom - 40) / 3.1, 220);
    const p = s * 1.3;
    const partY = top + s / 2, choiceY = H - bottom - s / 2;
    geo = { s, p, pot: { x: W / 2, y: (partY + choiceY) / 2 + s * 0.04 },
      // the parts share the top row: two at the quarter marks, three or more spread evenly
      parts: (n) => (n === 2 ? [0.27, 0.73] : Array.from({ length: n }, (_, i) => (i + 0.5) / n)).map((f) => ({ x: W * f, y: partY })),
      partSize: (n) => Math.min(s * 0.92, W / n - 14),
      choices: [{ x: W * 0.27, y: choiceY }, { x: W * 0.73, y: choiceY }] };
  } else {
    const s = Math.min(H * 0.37, W * 0.2, 220);
    const p = Math.min(H * 0.5, W * 0.26);
    const ys = [H * 0.28, H * 0.71];
    const left = Math.max(W * 0.19, 140 + s / 2); // clear of the replay button and the ear
    geo = { s, p, pot: { x: W / 2, y: H * 0.56 },
      // the parts share the left column: two at the choices' heights, three or more spread evenly
      parts: (n) => (n === 2 ? ys : Array.from({ length: n }, (_, i) => H * (0.16 + (0.68 * (i + 0.5)) / n))).map((y) => ({ x: left, y })),
      partSize: (n) => Math.min(s * 0.92, (H * 0.68) / n - 12),
      choices: ys.map((y) => ({ x: W - left + 40, y })) };
  }
  Object.assign(potEl.style, { width: geo.p + 'px', height: geo.p + 'px', left: geo.pot.x - geo.p / 2 + 'px', top: geo.pot.y - geo.p / 2 + 'px' });
  if (turn) place();
}
addEventListener('resize', layout);

function put(node, { x, y }, s) {
  Object.assign(node.style, { width: s + 'px', height: s + 'px', left: x - s / 2 + 'px', top: y - s / 2 + 'px' });
}
function place() {
  const n = turn.parts.length, spots = geo.parts(n);
  turn.parts.forEach((c, i) => put(c.el, spots[i], geo.partSize(n)));
  turn.choices.forEach((c, i) => (c === turn.centred ? put(c.el, geo.pot, geo.s * 1.2) : put(c.el, geo.choices[i], geo.s)));
}

// ---------------------------------------------------------------- pieces

/** A picture card, or for a bound piece (ì-) a written bubble: it has no picture and is never said alone. */
const face = (w) => (w.text ? `<span class="written">${w.display}</span>` : `<img src="${w.image}" alt="">`);
function card(w, cls) {
  const b = el('button', 'card ' + cls + (w.text ? ' text' : ''), face(w));
  b.setAttribute('aria-label', w.text ? w.display : 'picture');
  cardsEl.appendChild(b);
  return { word: w, el: b };
}

async function say(c, url = c.word.audio) {
  c.el.classList.add('talking');
  // a written piece has no sound of its own: it bounces for a moment instead
  await (url ? audio.play(url) : sleep(650));
  c.el.classList.remove('talking');
}

function bubbles() {
  const r = potEl.getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    const b = document.body.appendChild(el('div', 'bubble'));
    const size = 10 + Math.random() * 18;
    Object.assign(b.style, { width: size + 'px', height: size + 'px', left: r.left + r.width * (0.3 + Math.random() * 0.4) + 'px', top: r.top + r.height * 0.22 + 'px' });
    b.animate([{ transform: 'translate(-50%,0) scale(.4)', opacity: 0.95 }, { transform: `translate(${(Math.random() - 0.5) * 80 - 50}%, ${-60 - Math.random() * 90}px) scale(1)`, opacity: 0 }],
      { duration: 700 + Math.random() * 500, delay: i * 40, easing: 'ease-out' }).finished.then(() => b.remove());
  }
}
function bubbleSound() { [0, 120, 230, 330].forEach((t, i) => setTimeout(() => sfx._tone(300 + i * 90 + Math.random() * 60, 0.09, 'sine', 0.12, 1.9), t)); }

/** A copy of a part's picture flies into the pot's mouth (the part itself stays where it is). */
async function pour(c) {
  const r = c.el.getBoundingClientRect(), m = potEl.getBoundingClientRect();
  const copy = document.body.appendChild(el('div', 'card part pouring' + (c.word.text ? ' text' : ''), face(c.word)));
  Object.assign(copy.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  const dx = m.left + m.width / 2 - (r.left + r.width / 2), dy = m.top + m.height * 0.28 - (r.top + r.height / 2);
  sfx.whoosh();
  await animate(copy, [{ transform: 'none', opacity: 1 }, { transform: `translate(${dx * 0.6}px, ${dy * 0.6 - 50}px) scale(.6) rotate(-12deg)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(.12) rotate(14deg)`, opacity: 0.2 }], { duration: 650, easing: 'ease-in' });
  copy.remove();
}

// ---------------------------------------------------------------- turns

function foilFor(w) {
  const parts = partsOf(w, content.byId);
  const near = new Set([w.category, ...parts.map((p) => p.category)]);
  const taken = new Set(words.flatMap((c) => [c.id, ...c.components]));
  const ok = (f) => f && clean(f) && !f.imageCheck && !taken.has(f.id);
  for (const [cat, ids] of Object.entries(FOILS)) {
    if (near.has(cat)) continue;
    const pool = ids.map((id) => content.byId[id]).filter(ok);
    if (pool.length) return pick(pool);
  }
  // no curated foil left in this kit: any clear picture word from another category
  return pick(content.words.filter((f) => ok(f) && !near.has(f.category) && !f.components?.length && f.category in FOILS));
}

/** The prompt: each part says its word, its picture bouncing. */
async function sayParts() {
  for (let i = 0; i < turn.parts.length; i++) { await say(turn.parts[i]); await sleep(350); }
}

/** Replay: the parts again, then both pictures bob, so the question is asked again without singling one out. */
async function replay() {
  if (!turn) return;
  await sayParts();
  if (turn.open) await Promise.all(turn.choices.map((c, i) => animate(c.el, [{ transform: 'none' }, { transform: 'translateY(-14px) scale(1.05)' }, { transform: 'none' }], { duration: 420, delay: i * 200, fill: 'none' })));
}

async function buildTurn(target) {
  cardsEl.innerHTML = '';
  const parts = partsOf(target, content.byId);
  const foil = foilFor(target);
  turn = { target, open: false, missed: false, busy: false, parts: [], choices: [] };
  audio.preload([target.audio, foil?.audio, ...parts.map((p) => p.audio)].filter(Boolean));
  await shell.prompt(async () => {
    // the parts arrive one at a time, each saying its word
    for (const p of parts) {
      const c = card(p, 'part');
      turn.parts.push(c);
      onTap(c.el, () => hearPart(c));
      place();
      sfx.pop();
      // a written piece floats in from above; a picture pops up
      await animate(c.el, p.text ? [{ transform: 'translateY(-60px) scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }]
        : [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: p.text ? 700 : 380, easing: p.text ? 'ease-out' : 'cubic-bezier(.3,1.5,.6,1)', fill: 'backwards' });
      await say(c);
      await sleep(350);
    }
    // into the pot together
    await Promise.all(turn.parts.map((c, i) => sleep(i * 180).then(() => pour(c))));
    potEl.classList.add('bubbling');
    bubbleSound(); bubbles();
    await sleep(650);
    potEl.classList.remove('bubbling');
    // out of the pot: the whole and the foil, in random order
    for (const w of shuffle([target, foil].filter(Boolean))) {
      const c = card(w, 'choice');
      c.el.dataset.choice = ''; // the keyboard's answers (the parts only replay their word)
      turn.choices.push(c);
      onTap(c.el, () => choose(c));
    }
    place();
    sfx.pop();
    await Promise.all(turn.choices.map((c, i) => {
      const r = c.el.getBoundingClientRect();
      const dx = geo.pot.x - (r.left + r.width / 2), dy = geo.pot.y - geo.p * 0.2 - (r.top + r.height / 2);
      return animate(c.el, [{ transform: `translate(${dx}px, ${dy}px) scale(.15)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, delay: i * 120, easing: 'cubic-bezier(.3,1.4,.6,1)', fill: 'backwards' });
    }));
    turn.open = true;
  });
}

/** Tapping a part says it again (between turns' prompts only). */
async function hearPart(c) {
  if (shell.locked || !turn || turn.busy) return;
  sfx.tap();
  await shell.prompt(() => say(c));
}

async function choose(c) {
  if (shell.locked || !turn || !turn.open || turn.busy) return;
  turn.busy = true;
  shell.lock();
  sfx.tap();
  const right = turn.choices.find((x) => x.word === turn.target);
  if (c === right) {
    await celebrate(right);
    await finishTurn();
    return;
  }
  // the foil says what it is, wobbles; the right one glows and says the whole word
  await say(c);
  c.el.classList.add('wobble');
  sfx.soft();
  await sleep(600);
  c.el.classList.remove('wobble');
  if (turn.teaching) {
    // teaching turn: show again where to tap, and let the child do it
    await ghost.tap(right.el);
    turn.busy = false;
    shell.unlock();
    return;
  }
  queue.miss();
  turn.missed = true;
  right.el.classList.add('glow');
  await sleep(500);
  animate(c.el, [{ opacity: 1 }, { opacity: 0, transform: 'scale(.6)' }], { duration: 300 });
  await toCentre(right);
  await say(right);
  await sleep(600);
  right.el.classList.remove('glow');
  await finishTurn();
}

/** The whole moves over the pot, bigger, with its parts still beside it (the meaning link stays on screen). */
async function toCentre(c) {
  turn.centred = c;
  c.el.classList.add('moving');
  put(c.el, geo.pot, geo.s * 1.2);
  await sleep(520);
}

/** The whole word plays; its picture grows over the pot; the parts nod along beside it. */
async function celebrate(right) {
  const foil = turn.choices.find((x) => x !== right);
  if (foil) animate(foil.el, [{ opacity: 1 }, { opacity: 0, transform: 'scale(.6)' }], { duration: 300 });
  sfx.cheer();
  right.el.classList.add('won');
  await toCentre(right);
  const r = right.el.getBoundingClientRect();
  confetti(r.left + r.width / 2, r.top + r.height / 2);
  turn.parts.forEach((p, i) => animate(p.el, [{ transform: 'none' }, { transform: 'translateY(-12px) rotate(-4deg)' }, { transform: 'none' }], { duration: 420, delay: 150 + i * 220, fill: 'none' }));
  await say(right);
  await sleep(700);
}

async function finishTurn() {
  if (turn.teaching) firstTurn = false;
  else {
    const isClean = queue.done();
    memory.seen(turn.target.id, isClean);
    if (isClean) { strip.add(`<img src="${turn.target.image}" alt="">`); built.push(turn.target); }
  }
  await Promise.all([...cardsEl.children].map((n) => animate(n, [{ opacity: getComputedStyle(n).opacity }, { opacity: 0, transform: 'translateY(20px) scale(.7)' }], { duration: 320 })));
  turn = null;
  cardsEl.innerHTML = '';
  await sleep(400);
  nextTurn();
}

async function nextTurn() {
  if (firstTurn) {
    // teaching turn: after the pictures come out, the ghost hand taps the whole word. It does not count.
    await buildTurn(words[0]);
    turn.teaching = true;
    await ghost.tap(turn.choices.find((c) => c.word === turn.target).el);
    return;
  }
  const target = queue.next();
  if (!target || queue.finished) {
    turn = null;
    cardsEl.innerHTML = '';
    finale(`<div class="finale-pic"><img src="pot.png" alt=""></div><div class="built">${built.map(madeHtml).join('')}</div>`, startRound);
    return;
  }
  await buildTurn(target);
}

/** The finale's record of one compound built: its parts, small, then the whole (part + part = whole). */
function madeHtml(w) {
  // a written piece's --len (its letters, not its tone marks) shrinks long pieces such as àtẹ́lẹ̀- to fit
  const letters = (t) => t.normalize('NFD').replace(/[^\p{L}]/gu, '').length;
  const parts = partsOf(w, content.byId).map((p) => (p.text ? `<span class="bit written" style="--len:${letters(p.display)}">${p.display}</span>` : `<img class="bit" src="${p.image}" alt="">`)).join('<b>+</b>');
  return `<div class="made">${parts}<b>=</b><img class="whole" src="${w.image}" alt=""></div>`;
}

function startRound() {
  built = [];
  queue = new Queue(path.active ? words : memory.order(words), { cleanToWin: words.length });
  strip = progressStrip(shell, words.length, '⭐');
  nextTurn();
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    const all = content.words.filter((w) => fit.canUse(w, content.byId));
    // on the path: the step's compounds first (focus, then review), then the game's own, as many as the level takes
    words = path.active ? path.choose(all, Math.max(ROUND_WORDS, path.usable(all).length), memory.order(all)) : memory.order(all);
    layout();
    startRound();
  },
  replay,
});
layout();

// for scripted play-throughs (tools/devcheck)
window.__game = {
  get locked() { return shell.locked || !turn || !turn.open || turn.busy; },
  get finished() { return !turn && !!document.querySelector('.finale'); },
  get want() { return turn?.target.id; },
  get parts() { return turn ? turn.parts.map((c) => c.word.id) : []; },
  get choices() { return turn ? turn.choices.map((c) => c.word.id) : []; },
  get clean() { return queue?.clean ?? 0; },
  get words() { return (words || []).map((w) => w.id); },
  get teaching() { return !!turn?.teaching; },
  choose(id) { const c = turn?.choices.find((x) => x.word.id === id); if (c) choose(c); return !!c; },
  hear(i) { const c = turn?.parts[i]; if (c) hearPart(c); return !!c; },
  choiceEl(right) { return turn?.choices.find((c) => (c.word === turn.target) === right)?.el; },
};
