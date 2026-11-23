// Sort It: show you know what a word means by putting the thing where it belongs.
// The scene has two or three places, each plainly for one kind of thing (a table laid with plates, an animal pen,
// a wardrobe, a garage, a bathroom basin). A sealed parcel slides in and says its word; nothing on it shows what
// is inside. The child drags it to a place (or taps the place; keyboard: the places are the choices). Right: the
// parcel opens there, the thing appears, says its word and stays: the place fills. Wrong: the parcel bumps back,
// the place shakes its head, the parcel opens just long enough to show the thing and say its word, closes, and
// comes back two parcels later. Only first-try placements fill the strip. The first parcel of a session is
// carried by the ghost hand; that thing stays as an example. Demand: meaning from the heard word alone (apply).
import { loadContent, createShell, audio, sfx, onTap, Queue, memory, progressStrip, animate, confetti, ghost, finale, shuffle, sleep, el, centre, path } from '../engine/engine.js';
import { fit, PLACES, PLACE_ORDER, placeOf } from './fit.js';

// By path level (1 first meeting, 2 practice, 3 the full game): places in the scene and parcels in the round.
const N_PLACES = path.pickLevel([2, 3, 3]);
const N_BOXES = path.pickLevel([4, 6, 8]);
const MAX_PLACES = 4; // only when the step's words need that many places
// Where the things sit on each place's picture: fractions of the sprite (x, y, w, h), from the chosen art.
const SPOTS = {
  table: [0.04, 0, 0.92, 0.5],      // on the table top, over the plates
  pen: [0.14, 0.04, 0.72, 0.56],    // on the grass inside the fence
  wardrobe: [0.1, 0.1, 0.62, 0.76], // inside, under the hangers
  garage: [0.12, 0.36, 0.76, 0.62], // in the open bay
  bath: [0.08, 0.06, 0.84, 0.5],    // on the shelf and basin
};
const ASPECT = { table: 1.93, pen: 2.4, wardrobe: 0.6, garage: 1.34, bath: 0.9 }; // replaced by the image's own once loaded

const $ = (id) => document.getElementById(id);
const stage = $('stage'), bg = $('bg'), placesEl = $('places'), parcel = $('parcel'), parcelImg = parcel.querySelector('img');

let content, places = [], words = [], teachWord = null, example = null, queue, strip, turn = null, firstRound = true, dock, pos = { x: 0, y: 0 }, drag = null;
const misses = new Map(); // word id -> wrong placements this round (two: the ghost hand helps when it returns)

// ---------------------------------------------------------------- layout

/** Places on a grid that gives the smallest place the most room; the parcel waits at the bottom centre. */
function layout() {
  const W = innerWidth, H = innerHeight, landscape = W > H;
  bg.src = landscape ? '../art/bg_sort_wide.png' : '../art/bg_sort_tall.png';
  const B = landscape ? Math.min(H * 0.27, 124) : Math.min(W * 0.34, H * 0.15, 150);
  dock = { x: W / 2, y: H - (landscape ? 12 : 30) - B / 2, size: B };
  Object.assign(parcel.style, { left: dock.x - B / 2 + 'px', top: dock.y - B / 2 + 'px', width: B + 'px', height: B + 'px' });
  if (!places.length) return;
  const top = 64, bottom = dock.y - B / 2 - 12, left = 10, right = W - 10;
  // every grid and every order of the places on it (at most 4 places): the smallest place biggest, then the most
  // room in all (a tall wardrobe shares a row with the basin rather than sitting alone in a wide one)
  const perms = (a) => (a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((r) => [x, ...r])));
  let best = null;
  for (const order of perms(places)) for (let cols = 1; cols <= places.length; cols++) {
    const rows = Math.ceil(places.length / cols), ch = (bottom - top) / rows;
    const areas = order.map((p, i) => {
      const r = Math.floor(i / cols), cw = (right - left) / Math.min(cols, places.length - r * cols);
      const w = Math.min(cw * 0.94, ch * 0.94 * p.aspect); return w * w / p.aspect;
    });
    const size = Math.min(...areas), sum = areas.reduce((a, b) => a + b, 0);
    if (!best || size > best.size * 1.02 || (size > best.size * 0.98 && sum > best.sum)) best = { order, cols, ch, size, sum };
  }
  best.order.forEach((p, i) => {
    const r = Math.floor(i / best.cols), c = i % best.cols, cw = (right - left) / Math.min(best.cols, places.length - r * best.cols);
    const cx = left + cw * (c + 0.5), cy = top + best.ch * (r + 0.5);
    const w = Math.min(cw * 0.94, best.ch * 0.94 * p.aspect), h = w / p.aspect;
    Object.assign(p.el.style, { left: cx - w / 2 + 'px', top: cy - h / 2 + 'px', width: w + 'px', height: h + 'px' });
    p.w = w; p.h = h;
    layoutSpots(p);
  });
}
addEventListener('resize', layout);

/** The things on a place: as big as fits in its spot area, in as many rows as that takes. */
function layoutSpots(p) {
  const [x, y, w, h] = SPOTS[p.id];
  Object.assign(p.spots.style, { left: x * 100 + '%', top: y * 100 + '%', width: w * 100 + '%', height: h * 100 + '%' });
  const n = Math.max(1, p.things.length), aw = (p.w || 200) * w, ah = (p.h || 200) * h;
  let size = 0;
  for (let rows = 1; rows <= n; rows++) size = Math.max(size, Math.min(aw / Math.ceil(n / rows), ah / rows) * 0.9);
  p.spots.style.setProperty('--ts', Math.min(size, (p.h || 200) * 0.42) + 'px');
}

// ---------------------------------------------------------------- the round's places and words

const wordsOf = (p) => content.words.filter((w) => placeOf(w) === p);

/** On the path: the places of the step's words (most words first), then the most different others, up to the
 * level's number (more only if the step's words need them); its words first, then each place's own in turn. */
function buildRound() {
  const avail = PLACES.filter((p) => wordsOf(p).length >= 3);
  const asked = path.active ? [...path.focus, ...path.review].map((id) => content.byId[id]).filter((w) => w && avail.includes(placeOf(w))) : [];
  const count = (p) => asked.filter((w) => placeOf(w) === p).length;
  const needed = avail.filter((p) => count(p)).sort((a, b) => count(b) - count(a) || PLACE_ORDER.indexOf(a.id) - PLACE_ORDER.indexOf(b.id));
  const others = avail.filter((p) => !needed.includes(p));
  const chosen = [...needed, ...(path.active ? others.sort((a, b) => PLACE_ORDER.indexOf(a.id) - PLACE_ORDER.indexOf(b.id)) : shuffle(others))]
    .slice(0, Math.min(MAX_PLACES, Math.max(N_PLACES, needed.length)));
  // the game's own order: one word from each place in turn, each place's words due-first
  const lists = chosen.map((p) => memory.order(wordsOf(p))), rest = [];
  for (let i = 0; i < Math.max(...lists.map((l) => l.length)); i++) for (const l of lists) if (l[i]) rest.push(l[i]);
  const pool = rest;
  const round = path.choose(pool, Math.max(N_BOXES, path.usable(pool).length), rest);
  // every place gets at least one parcel
  for (const p of chosen) if (!round.some((w) => placeOf(w) === p)) { const w = rest.find((x) => placeOf(x) === p && !round.includes(x)); if (w) round.push(w); }
  // the first round's example, carried by the ghost hand: a word not in the round (else a non-step word from it)
  teachWord = null;
  if (firstRound) {
    teachWord = rest.find((w) => !round.includes(w) && !path.focus.includes(w.id)) ?? null;
    if (!teachWord) { const w = round.find((x) => !path.focus.includes(x.id) && !path.review.includes(x.id)); if (w) { round.splice(round.indexOf(w), 1); teachWord = w; } }
  }
  words = round;
  example = teachWord;
  placesEl.innerHTML = '';
  places = chosen.map((p) => {
    const node = el('button', 'place', `<img src="../art/${p.art}" alt=""><div class="spots"></div>`);
    node.setAttribute('aria-label', 'place');
    node.dataset.choice = ''; // keyboard: the places are the choices
    node.dataset.place = p.id;
    placesEl.appendChild(node);
    const place = { id: p.id, def: p, el: node, img: node.querySelector('img'), spots: node.querySelector('.spots'), things: [], aspect: ASPECT[p.id] };
    place.img.addEventListener('load', () => { place.aspect = place.img.naturalWidth / place.img.naturalHeight; layout(); }, { once: true });
    onTap(node, () => { if (canAct()) drop(place, false); });
    return place;
  });
  layout();
  audio.preload([...words, teachWord].filter(Boolean).map((w) => w.audio));
}

// ---------------------------------------------------------------- the parcel

/** Move the parcel to an offset from its dock. */
async function glide(x, y, ms = 400, easing = 'ease-in-out') {
  const from = `translate(${pos.x}px, ${pos.y}px)`, to = `translate(${x}px, ${y}px)`;
  pos = { x, y };
  parcel.style.transform = to;
  await animate(parcel, [{ transform: from }, { transform: to }], { duration: ms, easing, fill: 'none' });
}
const offsetTo = (node) => { const c = centre(node); return { x: c.x - dock.x, y: c.y - dock.y }; };

async function say() {
  if (!turn) return;
  parcelImg.classList.add('talking');
  await audio.play(turn.word.audio);
  parcelImg.classList.remove('talking');
}

const canAct = () => !!turn && !turn.busy && !shell.locked;
const placeAt = (x, y) => places.find((p) => {
  const r = p.el.getBoundingClientRect(), m = Math.min(r.width, r.height) * 0.1;
  return x > r.left - m && x < r.right + m && y > r.top - m && y < r.bottom + m;
});
const hover = (p) => places.forEach((q) => q.el.classList.toggle('over', q === p));

// Drag: the parcel follows the pointer; let go over a place to put it there, anywhere else and it slides home.
// A tap on the parcel (no drag) says its word again.
parcel.addEventListener('pointerdown', (e) => {
  if (!canAct()) return;
  e.preventDefault();
  drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, px: pos.x, py: pos.y, moved: false };
  try { parcel.setPointerCapture(e.pointerId); } catch {}
});
addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.moved && Math.hypot(dx, dy) < 12) return;
  if (!drag.moved) { drag.moved = true; parcel.classList.add('held'); sfx.tap(); }
  pos = { x: drag.px + dx, y: drag.py + dy };
  parcel.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
  hover(placeAt(e.clientX, e.clientY));
});
const release = (e, cancelled) => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  parcel.classList.remove('held');
  hover(null);
  if (!d.moved) { if (!cancelled) shell.doReplay(); return; }
  const p = !cancelled && canAct() && placeAt(e.clientX, e.clientY);
  if (p) drop(p, true);
  else glide(0, 0, 300, 'cubic-bezier(.3,1.4,.6,1)');
};
addEventListener('pointerup', (e) => release(e, false));
addEventListener('pointercancel', (e) => release(e, true));

// ---------------------------------------------------------------- placing

async function drop(p, dragged) {
  turn.busy = true;
  shell.lock();
  sfx.whoosh();
  const t = offsetTo(p.el);
  await glide(t.x, t.y, dragged ? 220 : 560, 'ease-in-out');
  if (p.id === turn.place.id) await right(p);
  else await wrong(p);
}

const card = (w, cls) => el('div', cls, `<img src="${w.image}" alt="">`);

/** Open the parcel at the place: the thing comes out, finds its spot, says its word and stays. */
async function right(p) {
  const w = turn.word;
  sfx.pop();
  const c = centre(parcel);
  await animate(parcelImg, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.35) rotate(-6deg)', opacity: 0 }], { duration: 260, fill: 'none' });
  parcel.classList.add('gone');
  confetti(c.x, c.y, 22);
  const thing = p.spots.appendChild(card(w, 'thing'));
  thing.style.visibility = 'hidden';
  p.things.push(w);
  layoutSpots(p);
  const r = thing.getBoundingClientRect(), B = dock.size * 0.9;
  const fly = document.body.appendChild(card(w, 'thing fly'));
  Object.assign(fly.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  const s = B / r.width, dx = c.x - (r.left + r.width / 2), dy = c.y - (r.top + r.height / 2);
  await animate(fly, [{ transform: `translate(${dx}px, ${dy}px) scale(${s * 0.4})` }, { transform: `translate(${dx}px, ${dy - B * 0.5}px) scale(${s})`, offset: 0.45 }, { transform: 'none' }], { duration: 900, easing: 'ease-in-out', fill: 'none' });
  fly.remove();
  thing.style.visibility = '';
  thing.classList.add('speaking');
  animate(p.el, [{ transform: 'scale(1)' }, { transform: 'scale(1.06, .95)', offset: 0.3 }, { transform: 'scale(.98, 1.03)', offset: 0.65 }, { transform: 'scale(1)' }], { duration: 500, fill: 'none' });
  await audio.play(w.audio);
  thing.classList.remove('speaking');
  sfx.cheer();
  if (!turn.teaching) {
    const clean = queue.done() && !turn.helped;
    memory.seen(w.id, clean);
    if (clean) strip.add(`<img src="${w.image}" alt="">`);
  }
  await sleep(500);
  endTurn();
}

/** The wrong place: it shakes its head, the parcel bumps home, peeks open to show the thing and say its word,
 * closes, and leaves (it comes back two parcels later). */
async function wrong(p) {
  const w = turn.word;
  sfx.bump();
  p.el.classList.add('nope');
  await glide(0, 0, 520, 'cubic-bezier(.3,1.5,.6,1)');
  p.el.classList.remove('nope');
  const B = dock.size;
  const peek = document.body.appendChild(card(w, 'thing peek'));
  Object.assign(peek.style, { left: dock.x - B * 0.45 + 'px', top: dock.y - B * 0.45 + 'px', width: B * 0.9 + 'px', height: B * 0.9 + 'px' });
  sfx.soft();
  const up = [{ transform: 'translateY(0) scale(.3)', opacity: 0 }, { transform: `translateY(${-B * 0.75}px) scale(1)`, opacity: 1 }];
  parcelImg.classList.add('open');
  await animate(peek, up, { duration: 380, easing: 'cubic-bezier(.3,1.4,.6,1)' });
  await audio.play(w.audio);
  await sleep(450);
  await animate(peek, [...up].reverse(), { duration: 320, easing: 'ease-in', fill: 'none' });
  peek.remove();
  parcelImg.classList.remove('open');
  await sleep(150);
  sfx.whoosh();
  await glide(-(innerWidth / 2 + B), 0, 450, 'ease-in');
  if (!turn.teaching) {
    queue.miss();
    queue.done();
    memory.seen(w.id, false);
    misses.set(w.id, (misses.get(w.id) || 0) + 1);
  }
  endTurn();
}

function endTurn() {
  turn = null;
  nextTurn();
}

// ---------------------------------------------------------------- turns

async function nextTurn() {
  const teaching = !!teachWord;
  const word = teaching ? teachWord : queue.next();
  teachWord = null;
  if (!word) return endRound();
  const place = places.find((p) => p.id === placeOf(word).id);
  turn = { word, place, teaching, busy: false, helped: !teaching && (misses.get(word.id) || 0) >= 2 };
  // the parcel slides in from the right and says its word
  parcel.classList.remove('gone');
  pos = { x: innerWidth / 2 + dock.size, y: 0 };
  parcel.style.transform = `translate(${pos.x}px, 0)`;
  await sleep(250);
  sfx.whoosh();
  await glide(0, 0, 560, 'cubic-bezier(.3,1.3,.6,1)');
  if (teaching) {
    // teaching: the ghost hand carries the parcel to its place
    turn.busy = true;
    await shell.prompt(async () => { await sleep(200); await say(); await sleep(300); await carry(place); });
    await drop(place, true);
    return;
  }
  await shell.prompt(async () => { await sleep(150); await say(); });
  if (turn?.helped) await ghost.tap(place.el); // after two misses of this word, the hand shows where it goes
}

/** The ghost hand presses the parcel and drags it to the place. */
async function carry(p) {
  const c = centre(parcel), t = offsetTo(p.el);
  const hand = document.body.appendChild(el('div', 'ghost-hand', '👆'));
  Object.assign(hand.style, { transition: 'none', left: c.x + 'px', top: c.y + 'px' });
  await animate(hand, [{ transform: 'translate(-50%, 40px) scale(1)', opacity: 0 }, { transform: 'translate(-50%, 0) scale(.85)', opacity: 1 }], { duration: 500, fill: 'none' });
  parcel.classList.add('held');
  await Promise.all([
    glide(t.x, t.y, 1500, 'ease-in-out'),
    animate(hand, [{ transform: 'translate(-50%, 0) scale(.85)' }, { transform: `translate(calc(-50% + ${t.x}px), ${t.y}px) scale(.85)` }], { duration: 1500, easing: 'ease-in-out', fill: 'none' }),
  ]);
  parcel.classList.remove('held');
  hand.remove();
}

async function endRound() {
  turn = null;
  parcel.classList.add('gone');
  shell.lock();
  for (const p of places) {
    sfx.drum(1 + places.indexOf(p) * 0.25);
    await animate(p.el, [{ transform: 'scale(1)' }, { transform: 'scale(1.08) rotate(-2deg)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 450, fill: 'none' });
  }
  shell.unlock();
  shell.clearIdle();
  const shown = places.map((p) => {
    const [x, y, w, h] = SPOTS[p.id];
    return `<div class="fin-place" style="aspect-ratio:${p.aspect}"><img src="../art/${p.def.art}" alt="">
      <div class="fin-spots" style="left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%">${p.things.map((t) => `<img src="${t.image}" alt="">`).join('')}</div></div>`;
  }).join('');
  finale(`<div class="fin-places">${shown}</div>`, startRound);
}

function startRound() {
  misses.clear();
  buildRound();
  firstRound = false;
  // parcels in a mixed order; on the path the step's words are all in it
  queue = new Queue(shuffle(words));
  strip = progressStrip(shell, words.length, '📦');
  nextTurn();
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    startRound();
  },
  replay: () => say(),
});
layout();

// for scripted play-throughs (tools/devcheck)
window.__game = {
  get locked() { return shell.locked || !turn || !!turn.busy; },
  get finished() { return !turn && !!document.querySelector('.finale'); },
  get want() { return turn?.word.id; },
  get wantPlace() { return turn?.place.id; },
  get teaching() { return !!turn?.teaching; },
  get places() { return places.map((p) => p.id); },
  get filled() { return Object.fromEntries(places.map((p) => [p.id, p.things.map((w) => w.id)])); },
  get clean() { return queue?.clean ?? 0; },
  get total() { return words.length; },
  get words() { return [...words, example].filter(Boolean).map((w) => w.id); },
  placeEl(id) { return places.find((p) => p.id === id)?.el; },
  wrongPlace() { return places.find((p) => p.id !== turn?.place.id)?.id; },
  parcel,
  choose(id) { const p = places.find((q) => q.id === id); if (p && canAct()) { drop(p, false); return true; } return false; },
};
