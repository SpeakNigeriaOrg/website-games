// Where It Happens: verbs acted out in the simplest way. A home yard has a few places, each where one action
// plainly happens: a bed (sùn), a mat with a plate (jẹun), a cup (mu), a basin (wẹ̀), a chair (jókòó), the gate
// (lọ). A boy stands in the middle. A voice says a verb; the child drags the boy to the place where it happens (or
// taps the place; keyboard: the places are the choices). Right: he goes there and does it (asleep in the bed,
// eating on the mat...), the verb plays again, a star fills. Wrong: he goes there, looks puzzled ("?"), the place's
// own verb plays, he comes back and the asked verb plays again; that verb returns two turns later. Only first tries
// fill the strip. The first turn of a session is shown by the ghost hand. Demand: a verb's meaning from the word.
import { loadContent, createShell, audio, sfx, onTap, Queue, memory, progressStrip, animate, confetti, finale, shuffle, sleep, el, centre, path } from '../engine/engine.js';
import { fit, PLACES } from './fit.js';

// By path level (1 first meeting, 2 practice, 3 the full game): places in the yard, clean turns in the round.
const N_PLACES = path.pickLevel([2, 4, 6]);
const ROUNDS = path.pickLevel([4, 6, 8]);

// The boy doing each action: a pose picture whose bottom centre stands at `at` (fractions of the place's box), as
// tall as `h` times the standing boy, or as wide as `w` times the place. `hide`: the place's own picture is hidden
// meanwhile (he has picked up the cup; he is in the basin, not beside it). Measured on the chosen art.
const POSE = {
  bed: { img: 'where_kid_sleep.png', at: [0.47, 0.6], w: 0.8 },
  mat: { img: 'where_kid_eat.png', at: [0.27, 0.85], h: 0.8 },
  cup: { img: 'where_kid_drink.png', at: [0.5, 1], h: 1, hide: true },
  basin: { img: 'where_kid_bathe.png', at: [0.5, 1.02], w: 0.95, hide: true },
  chair: { img: 'where_kid_sit.png', at: [0.5, 0.86], h: 0.82 },
};
const poseImgs = Object.fromEntries(Object.entries(POSE).map(([k, d]) => { const i = new Image(); i.src = '../art/' + d.img; return [k, i]; }));
const STAND = '../art/where_kid.png';
const WALK = new Image(); WALK.src = '../art/where_kid_walk.png';

const $ = (id) => document.getElementById(id);
const bg = $('bg'), placesEl = $('places'), kid = $('kid'), kidImg = kid.querySelector('img');

let content, places = [], words = [], queue, strip, turn = null, firstTurn = true, teachWord = null, geo = null, drag = null, turnNo = 0;
let pos = { x: 0, y: 0 }; // the boy's offset from his spot in the middle

// ---------------------------------------------------------------- layout

// Where the places stand (bottom centre, fractions of the screen) for each number of places. Portrait: rows on
// either side of the boy, on the ground below the house; landscape: a back row in front of the house and a front
// row. The boy stands in the middle.
const SLOTS = {
  portrait: {
    TL: [0.25, 0.53], TR: [0.75, 0.53], ML: [0.2, 0.72], MR: [0.8, 0.72], BL: [0.29, 0.91], BR: [0.73, 0.91], L2: [0.25, 0.62], R2: [0.75, 0.62],
    fill: { 1: ['R2'], 2: ['L2', 'R2'], 3: ['TL', 'TR', 'BR'], 4: ['TL', 'TR', 'BL', 'BR'], 5: ['TL', 'TR', 'ML', 'MR', 'BR'], 6: ['TL', 'TR', 'ML', 'MR', 'BL', 'BR'] },
    kid: [0.5, 0.75],
  },
  landscape: {
    L: [0.2, 0.8], R: [0.8, 0.8], BC: [0.5, 0.62], B1: [0.12, 0.68], B2: [0.33, 0.64], B3: [0.67, 0.64], B4: [0.88, 0.68], FL: [0.25, 0.97], FR: [0.75, 0.97],
    fill: { 1: ['R'], 2: ['L', 'R'], 3: ['L', 'R', 'BC'], 4: ['B1', 'B4', 'FL', 'FR'], 5: ['B1', 'B2', 'B3', 'B4', 'FR'], 6: ['B1', 'B2', 'B3', 'B4', 'FL', 'FR'] },
    kid: [0.5, 0.95],
  },
};

function layout() {
  const W = innerWidth, H = innerHeight, landscape = W > H;
  bg.src = landscape ? '../art/bg_where_wide.png' : '../art/bg_where_tall.png';
  bg.style.objectPosition = landscape ? '50% 30%' : '50% 100%'; // landscape: the whole house, not just its door
  const S = SLOTS[landscape ? 'landscape' : 'portrait'];
  const n = places.length || 1;
  // a place's height: as big as the screen allows for this many places; wide ones (the bed, the mat) get more width
  const s = landscape ? H * (n <= 3 ? 0.36 : 0.3) : Math.min(W * (n <= 2 ? 0.4 : n <= 4 ? 0.4 : 0.33), H * (n <= 2 ? 0.24 : 0.17));
  places.forEach((p, i) => {
    const [fx, fy] = S[S.fill[n][i]];
    const w = Math.min(s * Math.max(1, p.aspect), s * 1.25), h = Math.min(s, w / p.aspect);
    const x = Math.min(W - w / 2 - 6, Math.max(w / 2 + 6, fx * W)), y = fy * H;
    Object.assign(p.el.style, { left: x - w / 2 + 'px', top: y - h + 'px', width: w + 'px', height: h + 'px' });
    p.box = { x: x - w / 2, y: y - h, w, h };
  });
  const kh = landscape ? H * 0.4 : Math.min(H * 0.19, W * 0.42), kw = kh * 0.62;
  const [kx, ky] = S.kid;
  Object.assign(kid.style, { left: kx * W - kw / 2 + 'px', top: ky * H - kh + 'px', width: kw + 'px', height: kh + 'px' });
  geo = { W, H, s, kw, kh, home: { x: kx * W, y: ky * H }, landscape };
}
addEventListener('resize', () => { layout(); setPos(pos); });

/** Where the boy stands at a place (his feet): beside it, on the side towards the middle, level with its foot. */
function spotOf(p) {
  if (p.id === 'gate') return { x: p.box.x + p.box.w / 2, y: Math.min(geo.H - 4, p.box.y + p.box.h * 1.02) }; // in the doorway
  const cx = p.box.x + p.box.w / 2, side = cx < geo.W / 2 ? 1 : -1;
  const x = Math.abs(cx - geo.W / 2) < p.box.w * 0.3 ? cx + p.box.w * 0.5 + geo.kw * 0.2 : cx + side * (p.box.w / 2 + geo.kw * 0.15);
  return { x, y: Math.min(geo.H - 4, p.box.y + p.box.h + geo.kh * 0.04) };
}
const offsetOf = (pt) => ({ x: pt.x - geo.home.x, y: pt.y - geo.home.y });

// ---------------------------------------------------------------- the round

/** The yard's places: the step's verbs first, then the game's own order (most different actions first). */
function buildRound() {
  const pool = PLACES.map((p) => content.byId[p.verb]).filter((w) => w && fit.canUse(w));
  const n = Math.max(N_PLACES, Math.min(6, path.usable(pool).length));
  words = path.choose(pool, n, pool);
  // places keep the game's order on screen (bed, mat, gate...), whatever order the words came in
  const chosen = PLACES.filter((p) => words.some((w) => w.id === p.verb));
  placesEl.innerHTML = '';
  places = chosen.map((def) => {
    const node = el('button', 'place', `<img src="../art/${def.art}" alt="">`);
    node.setAttribute('aria-label', 'place');
    node.dataset.choice = ''; // keyboard: the places are the choices
    node.dataset.place = def.id;
    placesEl.appendChild(node);
    const p = { id: def.id, def, word: content.byId[def.verb], el: node, img: node.querySelector('img'), aspect: 1 };
    p.img.addEventListener('load', () => { p.aspect = p.img.naturalWidth / p.img.naturalHeight; layout(); }, { once: true });
    onTap(node, () => { if (canAct()) go(p, false); });
    return p;
  });
  layout();
  setPos({ x: 0, y: 0 });
  audio.preload(words.map((w) => w.audio));
}

/** The verbs asked, in order: each place once first (the step's verbs first), then a mix; never the same verb
 * three times running (with only two places, guessing "the other one" must not win). */
function chooseTurns() {
  const first = words.filter((w) => path.focus.includes(w.id) || path.review.includes(w.id));
  const out = [...shuffle(first), ...memory.order(words.filter((w) => !first.includes(w)))].slice(0, ROUNDS);
  while (out.length < ROUNDS) {
    const w = words[Math.floor(Math.random() * words.length)];
    const [a, b] = out.slice(-2);
    if (words.length > 2 ? w === b : a === w && b === w) continue;
    out.push(w);
  }
  return out;
}

// ---------------------------------------------------------------- the boy

function setPos(p) { pos = p; kid.style.translate = `${p.x}px ${p.y}px`; }

/** Walk (or hop, when he was dragged there) to an offset from his spot. */
async function walkTo(to, ms, { stride = true } = {}) {
  const from = { ...pos };
  // a real walk (not the hop after a drag) uses the walking picture, facing the way he goes
  if (stride && Math.hypot(to.x - from.x, to.y - from.y) > 30) stepping(to.x < from.x);
  kid.classList.add('walking');
  setPos(to);
  await animate(kid, [{ translate: `${from.x}px ${from.y}px` }, { translate: `${to.x}px ${to.y}px` }], { duration: ms, easing: 'ease-in-out', fill: 'none' });
  kid.classList.remove('walking');
  standing();
}
function stepping(left) { kidImg.src = WALK.src; kid.classList.toggle('left', left); }
function standing() { kidImg.src = STAND; kid.classList.remove('left'); }
const walkMs = (to) => Math.max(320, Math.min(900, Math.hypot(to.x - pos.x, to.y - pos.y) * 2.4));

async function say(w = turn?.word) {
  if (!w) return;
  kid.classList.add('listening');
  await audio.play(w.audio);
  kid.classList.remove('listening');
}

const canAct = () => !!turn && !turn.busy && !shell.locked;
const placeAt = (x, y) => places.find((p) => {
  const r = p.el.getBoundingClientRect(), m = Math.min(r.width, r.height) * 0.1;
  return x > r.left - m && x < r.right + m && y > r.top - m && y < r.bottom + m;
});
const hover = (p) => places.forEach((q) => q.el.classList.toggle('over', q === p));

// Drag: the boy follows the finger; let go over a place to send him there, anywhere else and he walks back.
// A tap on him (no drag) says the verb again.
kid.addEventListener('pointerdown', (e) => {
  if (!canAct()) return;
  e.preventDefault();
  drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, px: pos.x, py: pos.y, moved: false };
  try { kid.setPointerCapture(e.pointerId); } catch {}
});
addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.moved && Math.hypot(dx, dy) < 12) return;
  if (!drag.moved) { drag.moved = true; kid.classList.add('held'); sfx.tap(); }
  setPos({ x: drag.px + dx, y: drag.py + dy });
  hover(placeAt(e.clientX, e.clientY));
});
function release(e, cancelled) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  kid.classList.remove('held');
  hover(null);
  if (!d.moved) { if (!cancelled) shell.doReplay(); return; }
  const p = !cancelled && canAct() && placeAt(e.clientX, e.clientY);
  if (p) go(p, true);
  else { sfx.soft(); walkTo({ x: 0, y: 0 }, 380); }
}
addEventListener('pointerup', (e) => release(e, false));
addEventListener('pointercancel', (e) => release(e, true));

// ---------------------------------------------------------------- going to a place

async function go(p, dragged) {
  turn.busy = true;
  shell.lock();
  if (!dragged) sfx.whoosh();
  const to = offsetOf(spotOf(p));
  await walkTo(to, dragged ? 260 : walkMs(to), { stride: !dragged });
  if (p === turn.place) await right(p);
  else await wrong(p);
}

/** A bubble over the boy's head (or over a point): "?" when puzzled. */
function bubble(html, at) {
  const r = kid.getBoundingClientRect(), b = document.body.appendChild(el('div', 'bubble', html));
  const x = at?.x ?? r.left + r.width * 0.78, y = at?.y ?? r.top + r.height * 0.02;
  Object.assign(b.style, { left: x + 'px', top: y + 'px' });
  animate(b, [{ transform: 'translate(-50%, -100%) scale(.2)', opacity: 0 }, { transform: 'translate(-50%, -100%) scale(1)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.3,1.6,.6,1)', fill: 'none' });
  return b;
}

/** The pose picture over the place; the standing boy steps out of view meanwhile. */
function showPose(p) {
  const def = POSE[p.id], b = p.box, i = poseImgs[p.id], aspect = (i.naturalWidth || 1) / (i.naturalHeight || 1);
  const w = def.w ? def.w * b.w : def.h * geo.kh * aspect, h = w / aspect;
  const x = b.x + def.at[0] * b.w, y = b.y + def.at[1] * b.h;
  const pose = document.body.appendChild(el('div', `pose pose-${p.id}`, `<img src="${i.src}" alt="">`));
  Object.assign(pose.style, { left: x - w / 2 + 'px', top: y - h + 'px', width: w + 'px', height: h + 'px' });
  kid.classList.add('away');
  if (def.hide) p.el.classList.add('used');
  return () => { pose.remove(); kid.classList.remove('away'); p.el.classList.remove('used'); };
}

/** Little things rising or falling for a while: Zzz over the bed, drops from the basin. */
function particles(cls, html, where, n, every) {
  let k = 0;
  const id = setInterval(() => {
    if (k++ >= n) return clearInterval(id);
    const d = document.body.appendChild(el('div', cls, html)), at = where();
    d.style.left = at.x + 'px'; d.style.top = at.y + 'px';
    d.style.setProperty('--dx', at.dx + 'px');
    d.addEventListener('animationend', () => d.remove());
  }, every);
  return () => clearInterval(id);
}

/** He does it there, and the verb plays again. */
async function act(p) {
  turn.acting = p.id;
  const b = p.box, s = b.h, top = { x: b.x + b.w / 2, y: b.y };
  if (p.id === 'gate') {
    // lọ: he waves and walks out through the gateway, away down the path (smaller and smaller), then comes back
    const door = offsetOf({ x: b.x + b.w / 2, y: b.y + b.h * 0.72 }), front = { ...pos };
    const play = say();
    stepping(false);
    kid.classList.add('walking');
    await animate(kid, [{ translate: `${front.x}px ${front.y}px`, scale: 1, opacity: 1 }, { translate: `${door.x}px ${door.y}px`, scale: 0.45, opacity: 1, offset: 0.75 }, { translate: `${door.x}px ${door.y - s * 0.05}px`, scale: 0.25, opacity: 0 }], { duration: 1500, easing: 'ease-in', fill: 'none' });
    kid.style.opacity = '0';
    await play;
    await sleep(600);
    kid.style.opacity = '';
    await animate(kid, [{ translate: `${door.x}px ${door.y - s * 0.05}px`, scale: 0.25, opacity: 0 }, { translate: `${door.x}px ${door.y}px`, scale: 0.45, opacity: 1, offset: 0.25 }, { translate: `${front.x}px ${front.y}px`, scale: 1, opacity: 1 }], { duration: 1100, easing: 'ease-out', fill: 'none' });
    kid.classList.remove('walking');
    standing();
    turn.acting = null;
    return;
  }
  const done = showPose(p);
  let stop = () => {};
  const r = Math.random;
  // Zzz rising from his head end of the bed; drops thrown out sideways over the basin's rim (never over his face:
  // drops on a face read as tears)
  if (p.id === 'bed') { stop = particles('zzz', 'z', () => ({ x: b.x + b.w * (0.2 + r() * 0.1), y: b.y + s * 0.05, dx: (r() - 0.3) * s * 0.3 }), 6, 450); sfx.snore(); }
  if (p.id === 'basin') {
    stop = particles('drop', '', () => { const side = r() < 0.5 ? -1 : 1; return { x: top.x + side * b.w * (0.3 + r() * 0.15), y: b.y + b.h * 0.45, dx: side * b.w * (0.15 + r() * 0.3) }; }, 18, 100);
    sfx.splash();
  }
  if (p.id === 'mat') sfx.pop();
  await sleep(350);
  await say();
  if (p.id === 'bed') sfx.snore();
  if (p.id === 'basin') sfx.splash();
  await sleep(p.id === 'bed' ? 1300 : 900);
  stop();
  done();
  turn.acting = null;
}

async function right(p) {
  await act(p);
  sfx.cheer();
  const c = centre(kid);
  if (!turn.teaching) {
    const clean = queue.done();
    memory.seen(turn.word.id, clean);
    if (clean) { strip.add(); confetti(c.x, c.y, 22); }
  } else firstTurn = false;
  await walkTo({ x: 0, y: 0 }, walkMs({ x: 0, y: 0 }));
  await sleep(300);
  turn = null;
  nextTurn();
}

/** Not here: he looks puzzled, the place says its own verb, he comes back, and the asked verb plays again. */
async function wrong(p) {
  sfx.boing();
  kid.classList.add('puzzled');
  const q = bubble('?');
  p.el.classList.add('nope');
  await sleep(500);
  p.el.classList.remove('nope');
  p.el.classList.add('speaking');
  await audio.play(p.word.audio);
  p.el.classList.remove('speaking');
  await sleep(250);
  q.remove();
  kid.classList.remove('puzzled');
  await walkTo({ x: 0, y: 0 }, walkMs({ x: 0, y: 0 }));
  if (!turn.teaching && !turn.missed) queue.miss();
  turn.missed = true; turn.misses++;
  await sleep(300);
  turn.busy = false;
  await shell.prompt(() => say());
  if (turn.misses >= 2) await shell.prompt(() => showDrag(turn.place));
}

/** The ghost hand drags a see-through boy to the place (teaching turn, or after two misses). */
async function showDrag(p) {
  if (!p) return;
  const copy = document.body.appendChild(el('div', 'ghost-kid', `<img src="${STAND}" alt="">`));
  const r = kid.getBoundingClientRect();
  Object.assign(copy.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  const hand = document.body.appendChild(el('div', 'ghost-hand drag-hand', '👆'));
  const a = centre(kid), to = offsetOf(spotOf(p)), d = `${to.x - pos.x}px ${to.y - pos.y}px`;
  Object.assign(hand.style, { left: a.x + 'px', top: a.y + 'px' });
  await animate(hand, [{ transform: 'translate(-50%, 40px) scale(1)', opacity: 0 }, { transform: 'translate(-50%, 0) scale(.85)', opacity: 1 }], { duration: 450, fill: 'none' });
  await Promise.all([
    animate(hand, [{ translate: '0 0' }, { translate: d }], { duration: 1400, easing: 'ease-in-out', fill: 'none' }),
    animate(copy, [{ translate: '0 0' }, { translate: d }], { duration: 1400, easing: 'ease-in-out', fill: 'none' }),
  ]);
  hand.style.translate = d; copy.style.translate = d;
  p.el.classList.add('over');
  await sleep(350);
  await animate(copy, [{ opacity: 0.6 }, { opacity: 0 }], { duration: 300 });
  p.el.classList.remove('over');
  hand.remove(); copy.remove();
}

// ---------------------------------------------------------------- turns

async function nextTurn() {
  let word, teaching = false;
  if (firstTurn) { word = teachWord; teaching = true; }
  else {
    word = queue.next();
    if (!word || queue.finished) return endRound();
  }
  turnNo++;
  turn = { word, place: places.find((p) => p.word === word), teaching, busy: false, missed: false, misses: 0, acting: null };
  await sleep(450);
  if (teaching) await shell.prompt(async () => { await say(); await sleep(250); await showDrag(turn.place); await sleep(200); await say(); });
  else await shell.prompt(() => say());
}

function endRound() {
  turn = null;
  shell.clearIdle();
  // the boy, tired out, asleep in his bed
  finale(`<div class="fin-where"><img class="fin-bed" src="../art/where_bed.png" alt=""><img class="fin-kid" src="../art/where_kid_sleep.png" alt=""><span class="fin-z">z</span><span class="fin-z">z</span><span class="fin-z">z</span></div>`, startRound);
}

function startRound() {
  buildRound();
  const turns = chooseTurns();
  // the teaching turn shows the first verb; it is asked for real last
  if (firstTurn) { teachWord = turns[0]; turns.push(turns.shift()); }
  queue = new Queue(turns, { cleanToWin: ROUNDS });
  strip = progressStrip(shell, ROUNDS, '⭐');
  nextTurn();
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    await Promise.all([kidImg, WALK, ...Object.values(poseImgs)].map((i) => i.decode().catch(() => {})));
    startRound();
  },
  replay: () => say(),
  // idle: the verb again; on the teaching turn the ghost hand shows the drag again too
  onIdle: async () => { await shell.doReplay(); if (turn?.teaching && !shell.locked) await shell.prompt(() => showDrag(turn.place)); },
});
layout();

// for scripted play-throughs (tools/devcheck)
window.__game = {
  get locked() { return shell.locked || !turn || !!turn.busy || !!drag; },
  get finished() { return !turn && !!document.querySelector('.finale'); },
  get want() { return turn?.word.id; },
  get wantPlace() { return turn?.place.id; },
  get teaching() { return !!turn?.teaching; },
  get turnNo() { return turnNo; },
  get acting() { return turn?.acting ?? null; },
  get places() { return places.map((p) => p.id); },
  get clean() { return queue?.clean ?? 0; },
  get total() { return ROUNDS; },
  get words() { return words.map((w) => w.id); },
  get kid() { return kid; },
  get offset() { return { ...pos }; },
  placeEl(id) { return places.find((p) => p.id === id)?.el; },
  wrongPlace() { return places.find((p) => p !== turn?.place)?.id; },
  choose(id) { const p = places.find((q) => q.id === id); if (p && canAct()) { go(p, false); return true; } return false; },
};
