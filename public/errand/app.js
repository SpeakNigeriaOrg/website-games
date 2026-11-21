// Grandma's Errand: show you know the words. Grandma sits at one side of a room full of things the child already
// knows (on the shelves, on the table, on the floor). She asks for one of them by its word. The child finds it and
// drags it to her (or taps it: it flies to her). Right: she takes it, smiles, says the word and puts it in her bag;
// another one like it appears in its place, so the room never empties and nothing is found by elimination. Wrong:
// the thing says its own word and goes back to its place, and Grandma asks again; that request returns two later.
// Only first tries fill the strip. Late in the full game she asks for two things in a row; either order is fine.
// Demand: meaning, among many known things at once (no picture to match, no small set of choices).
import { loadContent, createShell, audio, sfx, Queue, memory, progressStrip, animate, confetti, finale, shuffle, sleep, el, centre, path } from '../engine/engine.js';
import { fit, APART } from './fit.js';

// By path level (1 first meeting, 2 practice, 3 the full game): things in the room, requests in the round (clean
// ones fill the strip), and how many of those requests are for two things at once (the last ones).
const THINGS = path.pickLevel([5, 7, 9]);
// (A path step with more focus words than requests gets one request per focus word: every one is asked for.)
const BASE_REQUESTS = path.pickLevel([4, 6, 8]);
let REQUESTS = BASE_REQUESTS;
const DOUBLES = path.level === 3 ? 2 : 0;
// Where the furniture's top surface is, as a fraction of its sprite's height (measured on the art).
const SHELF_TOP = 0.12, TABLE_TOP = 0.11;

const $ = (id) => document.getElementById(id);
const stage = $('stage'), bg = $('bg'), furniture = $('furniture'), grandma = $('grandma'), bag = $('bag'), thingsEl = $('things'), peek = $('peek');

let content, things = [], queue, strip, turn = null, firstTurn = true, geo = null, drag = null, bagged = 0;

// ---------------------------------------------------------------- the room

const img = (src) => { const i = new Image(); i.src = src; return i; };
const SHELF = img('../art/errand_shelf.png'), TABLE = img('../art/errand_table.png');
const aspect = (i) => (i.naturalWidth || 3) / (i.naturalHeight || 1);

/** Surfaces (lines things stand on) for this screen: shelves on the wall, the table, the floor. Grandma sits at the
 * right (the replay button is bottom-left): beside the room in landscape, in the bottom-right corner in portrait. */
function layout() {
  const W = innerWidth, H = innerHeight, landscape = W > H;
  bg.src = landscape ? '../art/bg_errand_wide.png' : '../art/bg_errand_tall.png';
  const gImg = grandma.querySelector('img'), gA = aspect(gImg) || 0.75;
  let gH = landscape ? H * 0.8 : Math.min(H * 0.32, (W * 0.5) / gA);
  const gW = gH * gA;
  Object.assign(grandma.style, { width: gW + 'px', height: gH + 'px', left: W - gW - (landscape ? 18 : 6) + 'px', top: H - gH - 6 + 'px' });
  const bH = landscape ? H * 0.27 : Math.min(H * 0.13, W * 0.27);
  const bagX = landscape ? W - gW - 18 - bH * 0.55 : W - gW - bH * 0.45;
  Object.assign(bag.style, { width: bH + 'px', height: bH + 'px', left: bagX - bH / 2 + 'px', top: H - bH - 8 + 'px' });

  const s = landscape ? Math.min(H * 0.18, 110) : Math.min(W * 0.23, H * 0.12, 120); // a thing's size
  const roomL = landscape ? 18 : 12, roomR = landscape ? W - gW - 18 - bH * 1.1 : W - 12;
  const surfaces = [];
  const addShelf = (y, x0, x1) => surfaces.push({ kind: 'shelf', y, x0, x1 });
  if (landscape) {
    addShelf(H * 0.37, roomL + 10, roomR - 10);
    surfaces.push({ kind: 'table', y: H * 0.66, x0: roomL + (roomR - roomL) * 0.2, x1: roomR - (roomR - roomL) * 0.12 });
    surfaces.push({ kind: 'floor', y: H - 12, x0: 100 + s * 0.5, x1: 100 + s * 1.7, cap: 1 }); // clear of the replay button
    surfaces.push({ kind: 'floor', y: H - 12, x0: roomR - (roomR - roomL) * 0.12 - s * 0.6, x1: roomR + s * 0.3, cap: 1 });
  } else {
    addShelf(H * 0.22, roomL + 8, roomR - 8);
    addShelf(H * 0.4, roomL + 8, roomR - 8);
    surfaces.push({ kind: 'table', y: H * 0.575, x0: roomL + 24, x1: roomR - 24 });
    // the floor in front of the table, left of Grandma and above the replay button and her bag
    surfaces.push({ kind: 'floor', y: Math.min(H * 0.83, H - bH * 1.3 - 16), x0: roomL + 4, x1: W - gW - 10 });
  }
  for (const f of surfaces) f.cap ??= Math.max(1, Math.floor((f.x1 - f.x0) / (s * 1.12)));
  // shelves and the table, drawn under the things
  furniture.innerHTML = '';
  for (const f of surfaces) {
    if (f.kind === 'shelf') {
      const w = f.x1 - f.x0 + 24, h = w / aspect(SHELF);
      const e = furniture.appendChild(el('img', 'shelf')); e.src = SHELF.src; e.alt = '';
      Object.assign(e.style, { left: f.x0 - 12 + 'px', top: f.y - h * SHELF_TOP + 'px', width: w + 'px' });
    } else if (f.kind === 'table') {
      const w = f.x1 - f.x0 + 30, h = w / aspect(TABLE);
      const e = furniture.appendChild(el('img', 'table')); e.src = TABLE.src; e.alt = '';
      Object.assign(e.style, { left: f.x0 - 15 + 'px', top: f.y - h * TABLE_TOP + 'px', width: w + 'px' });
    }
  }
  // each thing gets a spot: surfaces filled evenly (the emptiest first), spread along each
  const fill = surfaces.map(() => 0), which = things.map(() => {
    let best = -1;
    surfaces.forEach((f, i) => { if (fill[i] < f.cap && (best < 0 || fill[i] / f.cap < fill[best] / surfaces[best].cap)) best = i; });
    fill[best]++;
    return best;
  });
  const placed = surfaces.map(() => 0);
  things.forEach((t, k) => {
    const i = which[k], f = surfaces[i], j = placed[i]++, n = fill[i];
    const x = f.x0 + (f.x1 - f.x0) * (j + 0.5) / n + (j % 2 ? 1 : -1) * s * 0.05;
    const y = f.y - s * 0.96;
    t.home = { x, y: y + s / 2 };
    Object.assign(t.el.style, { left: x - s / 2 + 'px', top: y + 'px', width: s + 'px', height: s + 'px' });
  });
  geo = { W, H, s, landscape };
}
addEventListener('resize', () => { if (things.length) layout(); });

const lap = () => { const r = grandma.getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.62 }; };
const bagMouth = () => { const r = bag.getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.3 }; };

// ---------------------------------------------------------------- choosing the round

/** Words the child already knows on the path, nearest first: this unit's carryable words, then earlier units'. */
async function knownOrder() {
  try {
    const p = await (await fetch('../path/path.json')).json();
    const unitId = (path.step || '').split('.')[0];
    let at = p.units.findIndex((u) => u.id === unitId);
    if (at < 0) {
      const score = (u) => u.words.filter((w) => path.focus.includes(w.id)).length;
      at = p.units.indexOf(p.units.reduce((a, b) => (score(b) > score(a) ? b : a)));
    }
    return p.units.slice(0, at + 1).reverse().flatMap((u) => shuffle(u.words.map((w) => w.id)));
  } catch { return []; }
}

/** The room's things: the step's words first (focus, then review), then other known carryable words, then (only to
 * make up the number) Grandma's own; never two of an APART group. */
async function chooseThings() {
  const pool = content.words.filter((w) => fit.canUse(w));
  const byId = (ids) => ids.map((id) => content.byId[id]).filter((w) => w && pool.includes(w));
  const curated = byId(fit.curated);
  const rest = path.active ? [...byId(await knownOrder()), ...shuffle(curated), ...shuffle(pool)] : [...memory.order(curated), ...shuffle(pool)];
  // a step with more focus words than the level's room size gets a fuller room (at most 9: the room holds no more)
  const n = Math.max(THINGS, Math.min(9, path.usable(pool).length));
  const out = [];
  for (const w of path.choose(pool, pool.length, [...new Set(rest)])) {
    if (out.length >= n) break;
    if (out.includes(w) || APART.some((g) => g.includes(w.id) && out.some((o) => g.includes(o.id)))) continue;
    out.push(w);
  }
  return out;
}

/** Requests: single words (the step's words first), then the doubles, each two different things. */
function chooseRequests(words) {
  const first = words.filter((w) => path.focus.includes(w.id) || path.review.includes(w.id));
  const order = [...first, ...shuffle(words.filter((w) => !first.includes(w)))];
  // every focus and review word in the room is asked for at least once (the doubles take two words each)
  REQUESTS = Math.max(BASE_REQUESTS, Math.min(first.length, words.length) - DOUBLES);
  const singles = Array.from({ length: REQUESTS - DOUBLES }, (_, i) => [order[i % order.length]]);
  const left = [...order.slice(singles.length), ...shuffle(order.slice(0, singles.length))]; // not yet asked first
  const doubles = Array.from({ length: DOUBLES }, (_, i) => [left[(2 * i) % left.length], left[(2 * i + 1) % left.length]]);
  return [...singles, ...doubles];
}

function buildRoom(words) {
  thingsEl.innerHTML = '';
  things = shuffle(words).map((word, i) => {
    const b = el('button', 'thing', `<div class="card"><img src="${word.image}" alt=""></div>`);
    b.setAttribute('aria-label', 'thing');
    b.dataset.choice = ''; // keyboard: arrows move the highlight between the things, Space or Enter brings one
    b.style.setProperty('--tilt', ((i * 37) % 9 - 4) + 'deg');
    thingsEl.appendChild(b);
    const t = { word, el: b, home: null };
    b.__tap = () => bring(t, false);
    b.addEventListener('pointerdown', (e) => grab(t, e));
    return t;
  });
  layout();
  audio.preload(words.map((w) => w.audio));
}

// ---------------------------------------------------------------- dragging (a tap brings it too)

function grab(t, e) {
  if (shell.locked || !turn || turn.busy || drag) return;
  e.preventDefault();
  try { t.el.setPointerCapture(e.pointerId); } catch {}
  drag = { t, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false };
}
function overGrandma(x, y) {
  const pad = 30;
  return [grandma, bag].some((n) => { const r = n.getBoundingClientRect(); return x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad; });
}
addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.moved && Math.hypot(dx, dy) < 12) return;
  if (!drag.moved) { drag.moved = true; drag.t.el.classList.add('dragging'); sfx.tap(); }
  drag.t.el.style.translate = `${dx}px ${dy}px`;
  grandma.classList.toggle('reaching', overGrandma(e.clientX, e.clientY));
});
function release(e, cancel) {
  if (!drag || e.pointerId !== drag.id) return;
  const { t, moved } = drag;
  drag = null;
  grandma.classList.remove('reaching');
  if (!moved) { if (!cancel) bring(t, false); return; }
  if (!cancel && overGrandma(e.clientX, e.clientY)) { bring(t, true); return; }
  goHome(t); // dropped somewhere else: back to its place, nothing counted
}
addEventListener('pointerup', (e) => release(e, false));
addEventListener('pointercancel', (e) => release(e, true));

/** Where a thing is drawn now, relative to its place (its drag offset). */
const offset = (t) => { const [x = '0px', y = '0px'] = (t.el.style.translate || '').split(' '); return { x: parseFloat(x) || 0, y: parseFloat(y) || 0 }; };
async function moveTo(t, to, { scale = 1, ms = 450, easing = 'ease-in-out', arc = 0 } = {}) {
  const from = offset(t), sc = parseFloat(t.el.style.scale) || 1;
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - arc };
  await animate(t.el, [{ translate: `${from.x}px ${from.y}px`, scale: sc }, { translate: `${mid.x}px ${mid.y}px`, scale: (sc + scale) / 2 }, { translate: `${to.x}px ${to.y}px`, scale }], { duration: ms, easing, fill: 'none' });
  t.el.style.translate = `${to.x}px ${to.y}px`;
  t.el.style.scale = String(scale);
}
async function goHome(t) {
  sfx.soft();
  await moveTo(t, { x: 0, y: 0 }, { ms: 380, easing: 'ease-out' });
  t.el.classList.remove('dragging', 'flying');
  t.el.style.translate = ''; t.el.style.scale = '';
}
const toward = (t, p) => ({ x: p.x - t.home.x, y: p.y - t.home.y });

// ---------------------------------------------------------------- Grandma

async function talk(url) {
  grandma.classList.add('talking');
  await audio.play(url);
  grandma.classList.remove('talking');
}

/** The request: the thing(s) still wanted, in the order asked. */
async function ask() {
  const left = turn.wants.filter((w) => !turn.got.includes(w));
  for (let i = 0; i < left.length; i++) { await talk(left[i].audio); if (i < left.length - 1) await sleep(600); }
}

function heart() {
  const r = grandma.getBoundingClientRect();
  const h = document.body.appendChild(el('div', 'heart', '💛'));
  h.style.left = r.left + r.width * 0.5 + 'px'; h.style.top = r.top + r.height * 0.1 + 'px';
  animate(h, [{ transform: 'translate(-50%,0) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-26px) scale(1.2)', opacity: 1, offset: 0.4 }, { transform: 'translate(-50%,-64px) scale(1)', opacity: 0 }], { duration: 1100 }).then(() => h.remove());
}

async function bring(t, dragged) {
  if (shell.locked || !turn || turn.busy) return;
  turn.busy = true;
  shell.lock();
  t.el.classList.add('flying');
  t.el.classList.remove('dragging');
  if (!dragged) sfx.whoosh();
  await moveTo(t, toward(t, lap()), { scale: 0.8, ms: dragged ? 260 : 560, arc: dragged ? 0 : 70 });
  const left = turn.wants.filter((w) => !turn.got.includes(w));
  if (left.includes(t.word)) {
    turn.got.push(t.word);
    grandma.classList.add('happy');
    sfx.pop(); heart();
    await talk(t.word.audio); // she says its name as she takes it
    grandma.classList.remove('happy');
    sfx.whoosh();
    await moveTo(t, toward(t, bagMouth()), { scale: 0.25, ms: 420, arc: 50, easing: 'ease-in' });
    bagged++; fillBag(t.word);
    t.el.style.visibility = 'hidden';
    refill(t);
    if (turn.got.length < turn.wants.length) {
      await sleep(350);
      turn.busy = false;
      await shell.prompt(ask);
      return;
    }
    await finishTurn();
  } else {
    // not this one: Grandma shakes her head, the thing says what it is and goes back to its place
    grandma.classList.add('nope');
    sfx.soft();
    await sleep(450);
    grandma.classList.remove('nope');
    t.el.classList.add('speaking');
    await audio.play(t.word.audio);
    t.el.classList.remove('speaking');
    await goHome(t);
    if (!turn.missed && !turn.teaching) queue.miss();
    turn.missed = true; turn.misses++;
    await sleep(250);
    turn.busy = false;
    await shell.prompt(ask);
    if (turn.misses >= 2) showDrag(things.find((x) => turn.wants.includes(x.word) && !turn.got.includes(x.word)));
  }
}

/** Another one like it appears in its place (Grandma's house has plenty), so the room never thins out. */
async function refill(t) {
  await sleep(500);
  t.el.classList.remove('flying');
  t.el.style.translate = ''; t.el.style.scale = '';
  t.el.style.visibility = '';
  animate(t.el, [{ scale: 0, opacity: 0 }, { scale: 1, opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.3,1.6,.6,1)', fill: 'none' });
}

/** The bag: what went in peeks out of the top; it swells a little with each clean request. */
function fillBag(word) {
  const p = peek.appendChild(el('img', '', ''));
  p.src = word.image; p.alt = '';
  p.style.setProperty('--r', ((bagged * 47) % 50 - 25) + 'deg');
  p.style.left = [6, 50, 28, 14, 42][bagged % 5] + "%";
  while (peek.children.length > 5) peek.firstChild.remove();
  animate(bag, [{ transform: 'scale(1)' }, { transform: 'scale(1.12,.9)' }, { transform: 'scale(.95,1.08)' }, { transform: 'scale(1)' }], { duration: 420, fill: 'none' });
}
const bagSize = () => { bag.style.scale = String(1 + 0.03 * (strip?.count ?? 0)); };

/** The ghost hand drags a see-through copy of a thing to Grandma (teaching turn, or after two misses). */
async function showDrag(t) {
  if (!t) return;
  const ghostCopy = document.body.appendChild(el('div', 'ghost-thing', t.el.innerHTML));
  const r = t.el.getBoundingClientRect();
  Object.assign(ghostCopy.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  const hand = document.body.appendChild(el('div', 'ghost-hand drag-hand', '👆'));
  const a = centre(t.el), b = lap();
  hand.style.left = a.x + 'px'; hand.style.top = a.y + 'px';
  await animate(hand, [{ transform: 'translate(-50%,0) scale(1)' }, { transform: 'translate(-50%,0) scale(.85)' }], { duration: 350 });
  const d = `${b.x - a.x}px ${b.y - a.y}px`;
  await Promise.all([
    animate(hand, [{ translate: '0 0' }, { translate: d }], { duration: 1200, easing: 'ease-in-out' }),
    animate(ghostCopy, [{ translate: '0 0', opacity: 0.85 }, { translate: d, opacity: 0.85 }], { duration: 1200, easing: 'ease-in-out' }),
  ]);
  await animate(ghostCopy, [{ opacity: 0.85 }, { opacity: 0 }], { duration: 300 });
  hand.remove(); ghostCopy.remove();
}

// ---------------------------------------------------------------- turns

async function finishTurn() {
  sfx.cheer();
  const clean = !turn.missed;
  if (turn.teaching) firstTurn = false;
  else {
    queue.done();
    for (const w of turn.wants) memory.seen(w.id, clean);
    if (clean) {
      strip.add(`<span class="slot-pics">${turn.wants.map((w) => `<img src="${w.image}" alt="">`).join('')}</span>`);
      bagSize();
      const m = bagMouth(); confetti(m.x, m.y, 22);
    }
  }
  await sleep(900);
  turn = null;
  nextTurn();
}

async function nextTurn() {
  if (firstTurn) {
    // teaching turn: Grandma asks, then the ghost hand drags the thing to her; the child does it. Not counted.
    turn = { wants: [teachWord], got: [], missed: false, misses: 0, teaching: true };
    await sleep(500);
    await shell.prompt(async () => { await ask(); await sleep(250); await showDrag(things.find((t) => t.word === teachWord)); });
    return;
  }
  const req = queue.next();
  if (!req || queue.finished) {
    turn = null;
    finale(`<div class="finale-errand"><img class="fg" src="../art/grandma_sit.png" alt=""><div class="fbag"><img src="../art/errand_bag.png" alt=""><div class="bag-peek">${peek.innerHTML}</div><img class="front" src="../art/errand_bag.png" alt=""></div></div>`,
      () => startRound());
    return;
  }
  turn = { wants: req, got: [], missed: false, misses: 0, teaching: false };
  await sleep(500);
  await shell.prompt(ask);
}

let teachWord = null, roundWords = [];
async function startRound() {
  roundWords = await chooseThings();
  buildRoom(roundWords);
  const requests = chooseRequests(roundWords);
  if (firstTurn) {
    // the teaching turn uses the first request's word; that request moves to the end of the singles
    teachWord = requests[0][0];
    requests.splice(REQUESTS - DOUBLES - 1, 0, requests.shift());
  }
  queue = new Queue(requests, { cleanToWin: REQUESTS });
  strip = progressStrip(shell, REQUESTS, '👜');
  peek.innerHTML = ''; bagged = 0; bagSize();
  nextTurn();
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    await Promise.all([SHELF, TABLE, grandma.querySelector('img')].map((i) => i.decode().catch(() => {})));
    startRound();
  },
  replay: () => (turn ? ask() : null),
  // idle: Grandma asks again; on the teaching turn the ghost hand shows the drag again too
  onIdle: async () => { await shell.doReplay(); if (turn?.teaching && !shell.locked) await shell.prompt(() => showDrag(things.find((t) => t.word === teachWord))); },
});

// for scripted play-throughs (tools/devcheck)
window.__game = {
  get locked() { return shell.locked || !turn || !!turn.busy || !!drag; },
  get finished() { return !!document.querySelector('.finale'); },
  get want() { return turn ? turn.wants.filter((w) => !turn.got.includes(w)).map((w) => w.id) : []; },
  get double() { return !!turn && turn.wants.length > 1; },
  get teaching() { return !!turn?.teaching; },
  get clean() { return queue?.clean ?? 0; },
  get requests() { return REQUESTS; },
  get words() { return roundWords.map((w) => w.id); },
  get things() { return things.map((t) => t.word.id); },
  get bag() { return bag; }, get grandma() { return grandma; },
  thingEl(id) { return things.find((t) => t.word.id === id)?.el; },
  choiceEl(right) { const want = this.want; return things.find((t) => want.includes(t.word.id) === right)?.el; },
  choose(id) { const t = things.find((x) => x.word.id === id); if (t) bring(t, false); return !!t; },
  layout,
};
