// You're Hungry!: a hungry goat asks for a food; give it the right one.
// The goat sits behind the kitchen table with two foods on plates (later three, then four). It names the food
// it wants; the plates wake up only after the request. The tapped food flies to its mouth. Right: chomp,
// crumbs, and the goat says the word again. Wrong: it sniffs, says what it was offered, pushes it back and
// asks again. Only first-try turns fill the strip; late in the round it asks for two foods in a row.
// Demand: meaning (which picture the heard word names). Nothing on screen marks the wanted food.
import { loadContent, createShell, audio, sfx, onTap, Queue, memory, progressStrip, animate, confetti, ghost, finale, shuffle, sleep, el, path } from '../engine/engine.js';
import { fit, APART } from './fit.js';

// By path level (1 first meeting, 2 practice, 3 the full game): clean feeds to fill the strip, foods in the
// round, the most plates on the table, and whether it asks for two foods in a row late in the round.
const ROUND = path.pickLevel([4, 6, 8]);
const ROUND_FOODS = path.pickLevel([4, 6, Infinity]);
const MAX_PLATES = path.pickLevel([2, 3, 4]);
const DOUBLES = path.level === 3;
const IMG_W = 1216, IMG_H = 832;
const TABLE_TOP = 619;        // image px where the table's top edge starts (art/kitchen_table.png is cut from here)
const PLATE_Y = 690;          // image px: where plates sit on the table

const $ = (id) => document.getElementById(id);
const scene = $('scene'), goat = $('goat'), table = $('table'), platesEl = $('plates');

let content, foods, queue, strip, turn = null, firstTurn = true, geo;

// ---------------------------------------------------------------- layout

/** The kitchen covers the screen (anchored bottom-centre); everything else is placed from image coordinates. */
function layout() {
  const W = innerWidth, H = innerHeight;
  const S = Math.max(W / IMG_W, H / IMG_H);
  const ox = (W - IMG_W * S) / 2, oy = H - IMG_H * S;
  Object.assign(scene.style, { left: ox + 'px', top: oy + 'px', width: IMG_W * S + 'px', height: IMG_H * S + 'px' });
  Object.assign(table.style, { left: ox + 'px', top: oy + TABLE_TOP * S + 'px', width: IMG_W * S + 'px', height: (IMG_H - TABLE_TOP) * S + 'px' });
  const tableY = oy + TABLE_TOP * S;
  // the goat: as big as fits between the top of the screen and the table, its lower body behind the table,
  // leaving headroom under the strip to grow two steps (on a wide screen it would otherwise fill the height
  // from the start and its growing, the round's progress, could not show)
  const goatH = Math.min(IMG_H * 0.42 * S, (tableY - 70) / (0.9 * (1 + 2 * SIZE_STEP) - 0.1), W * 0.62 / 0.817);
  const goatW = goatH * 0.817;
  Object.assign(goat.style, { width: goatW + 'px', height: goatH + 'px', left: W / 2 - goatW / 2 + 'px', top: tableY - goatH * 0.8 + 'px' });
  // usable table width: on screen, on the table, clear of the replay button
  const left = Math.max(ox + 90 * S, 96), right = Math.min(ox + 1130 * S, W - 12);
  geo = { S, ox, oy, W, H, tableY, plateY: oy + PLATE_Y * S, left, right, goatTop: tableY - goatH * 0.8, goatH };
  applySize();
  if (turn) placePlates(false);
}
addEventListener('resize', layout);

function placePlates(animateIn) {
  const n = turn.plates.length;
  const { W, H, tableY } = geo;
  // plates may run to the left edge when they end above the replay button
  const left = Math.max(geo.left - (geo.plateY + 60 < H - 100 ? 84 : 0), 12), span = geo.right - left;
  let spots, size = Math.min(span / n * 0.86, H * 0.24, 170);
  if (size >= 104 || n < 4 || W > H) {
    spots = turn.plates.map((_, i) => ({ x: left + span * (i + 0.5) / n, y: geo.plateY }));
  } else {
    // narrow portrait with four foods: a two-by-two grid on the table, clear of the replay button
    size = Math.min(W * 0.36, (H - tableY - 24) / 2.15, 150);
    const y0 = tableY + size * 0.62, y1 = y0 + size * 1.08;
    spots = turn.plates.map((_, i) => ({ x: W * (i % 2 ? 0.77 : 0.45), y: i < 2 ? y0 : y1 }));
  }
  turn.plates.forEach((p, i) => {
    const { x, y } = spots[i];
    p.home = { x, y };
    Object.assign(p.el.style, { width: size + 'px', height: size + 'px', padding: size * 0.09 + 'px', left: x - size / 2 + 'px', top: y - size / 2 + 'px' });
    if (animateIn) animate(p.el, [{ transform: 'translateY(40px) scale(.3)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, delay: i * 90, easing: 'cubic-bezier(.3,1.5,.6,1)', fill: 'backwards' });
  });
}

const mouth = () => { const r = goat.getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 }; };

// ---------------------------------------------------------------- the goat

async function talk(url) {
  goat.classList.add('talking');
  await audio.play(url);
  goat.classList.remove('talking');
}

function crumbs(x, y) {
  const colors = ['#c98a3f', '#e8b85c', '#8a5a2b', '#f3d38b', '#fff2c8'];
  for (let i = 0; i < 16; i++) {
    const c = document.body.appendChild(el('div', 'crumb'));
    c.style.background = colors[i % colors.length];
    c.style.left = x + 'px'; c.style.top = y + 'px';
    const a = Math.PI * (0.15 + Math.random() * 0.7), d = 40 + Math.random() * 90;
    c.animate([{ transform: 'translate(-50%,-50%)', opacity: 1 },
      { transform: `translate(${Math.cos(a) * d * (Math.random() < 0.5 ? -1 : 1)}px, ${Math.sin(a) * d + 60}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }],
    { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.3,.6,.6,1)' }).finished.then(() => c.remove());
  }
}

function chompSound() { sfx._noise(0.09, 0.32, 2600, 500); sfx._tone(150, 0.08, 'square', 0.06, 0.6); }
function sniffSound() { sfx._noise(0.12, 0.12, 5000, 2500); }

async function munch() {
  goat.classList.add('munching');
  const m = mouth();
  for (let i = 0; i < 4; i++) { chompSound(); crumbs(m.x, m.y + 10); await sleep(210); }
  goat.classList.remove('munching');
  const heart = document.body.appendChild(el('div', 'heart', '💛'));
  heart.style.left = m.x + 'px'; heart.style.top = m.y - geo.H * 0.08 + 'px';
  animate(heart, [{ transform: 'translate(-50%,0) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-30px) scale(1.2)', opacity: 1, offset: 0.4 }, { transform: 'translate(-50%,-70px) scale(1)', opacity: 0 }], { duration: 1100 }).then(() => heart.remove());
}

// ---------------------------------------------------------------- turns

function buildTurn(target, n, double) {
  const others = shuffle(foods.filter((f) => f !== target)).slice(0, n - 1);
  const shown = shuffle([target, ...others]);
  const wants = double ? [target, others[0]] : [target];
  platesEl.innerHTML = '';
  turn = { target, wants, step: 0, missed: false, plates: shown.map((w) => {
    const b = el('button', 'plate', `<img src="${w.image}" alt="">`);
    b.setAttribute('aria-label', 'food'); b.dataset.choice = '';
    platesEl.appendChild(b);
    const p = { word: w, el: b, eaten: false };
    onTap(b, () => choose(p));
    return p;
  }) };
  placePlates(true);
  audio.preload(shown.map((w) => w.audio));
}

/** The request: the food(s) still wanted, in order. */
async function ask() {
  const urls = turn.wants.slice(turn.step).map((w) => w.audio);
  for (let i = 0; i < urls.length; i++) { await talk(urls[i]); if (i < urls.length - 1) await sleep(450); }
}

async function choose(p) {
  if (shell.locked || !turn || p.eaten || turn.busy) return;
  turn.busy = true;
  shell.lock();
  sfx.whoosh();
  const want = turn.wants[turn.step];
  const m = mouth();
  const r = p.el.getBoundingClientRect();
  const dx = m.x - (r.left + r.width / 2), dy = m.y - (r.top + r.height / 2);
  p.el.classList.add('flying');
  if (p.word === want) {
    await animate(p.el, [{ transform: 'none' }, { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(.8) rotate(-10deg)`, offset: 0.5 }, { transform: `translate(${dx}px, ${dy}px) scale(.3) rotate(10deg)` }], { duration: 520, easing: 'ease-in' });
    p.eaten = true;
    p.el.style.visibility = 'hidden';
    await munch();
    await talk(p.word.audio);
    turn.step++;
    if (turn.step < turn.wants.length) {
      await sleep(300);
      turn.busy = false;
      await shell.prompt(ask);
      return;
    }
    await finishTurn();
  } else {
    // stops just under the nose, sniffed, named, pushed back
    await animate(p.el, [{ transform: 'none' }, { transform: `translate(${dx * 0.85}px, ${dy * 0.85 + 30}px) scale(.6)` }], { duration: 420, easing: 'ease-out' });
    goat.classList.add('sniffing');
    for (let i = 0; i < 3; i++) { sniffSound(); await sleep(170); }
    goat.classList.remove('sniffing');
    await talk(p.word.audio);
    goat.classList.add('nope');
    sfx.soft();
    await animate(p.el, [{ transform: `translate(${dx * 0.85}px, ${dy * 0.85 + 30}px) scale(.6)` }, { transform: 'none' }], { duration: 450, easing: 'ease-in-out' });
    goat.classList.remove('nope');
    p.el.classList.remove('flying');
    p.el.style.transform = '';
    if (!turn.missed && !turn.teaching) queue.miss();
    if (!turn.teaching) { wrongs++; if (wrongs % 3 === 0) setTimeout(shrink, 300); }
    turn.missed = true;
    await sleep(250);
    turn.busy = false;
    await shell.prompt(ask);
  }
}

// ---------------------------------------------------------------- growing and shrinking
// Every 3 clean feeds the goat grows a step; every 3 wrong offers it shrinks a step and looks hungry.
// It grows upward from behind the table and never past the progress strip.
const SIZE_STEP = 0.14, MIN_SIZE = -2;
// while hungry, a thought bubble with an empty plate (the sprite's face can't change)
const bubble = goat.appendChild(el('div', 'hunger-bubble', `<svg viewBox="0 0 120 100" aria-hidden="true">
  <circle cx="14" cy="88" r="5" fill="#fff" stroke="#2b2118" stroke-width="3"/><circle cx="26" cy="74" r="8" fill="#fff" stroke="#2b2118" stroke-width="3"/>
  <ellipse cx="72" cy="40" rx="44" ry="34" fill="#fff" stroke="#2b2118" stroke-width="3"/>
  <ellipse cx="72" cy="46" rx="28" ry="10" fill="#e9eef2" stroke="#2b2118" stroke-width="3"/><ellipse cx="72" cy="44" rx="17" ry="5" fill="#d3dbe2"/>
  <path d="M40 22v14M45 22v14M42.5 36v12" stroke="#2b2118" stroke-width="3" stroke-linecap="round"/>
  <path d="M104 22c-5 2-5 14 0 16v12" stroke="#2b2118" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`));
let size = 0, rights = 0, wrongs = 0;
function applySize() {
  if (!geo) return;
  const origin = geo.goatTop + geo.goatH * 0.9;
  const maxScale = Math.max(1, (origin - 70) / (geo.goatH * 0.9));
  goat.style.scale = String(Math.min(1 + SIZE_STEP * size, maxScale));
  goat.classList.toggle('hungry', size < 0);
}
function grow() {
  size++;
  applySize();
  const r = goat.getBoundingClientRect();
  confetti(r.left + r.width / 2, r.top + r.height * 0.3, 36);
  [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => sfx._tone(f, 0.16, 'triangle', 0.12), i * 70));
}
function shrink() {
  if (size > MIN_SIZE) size--;
  applySize();
  goat.classList.add('rumble');
  sfx._noise(0.7, 0.12, 260, 90); sfx._tone(70, 0.6, 'sine', 0.1, 0.7); // tummy rumble
  setTimeout(() => goat.classList.remove('rumble'), 900);
}

async function finishTurn() {
  sfx.cheer();
  const clean = !turn.missed;
  if (turn.teaching) {
    firstTurn = false;
  } else {
    queue.done();
    memory.seen(turn.target.id, clean);
    if (clean) {
      const m = mouth(); confetti(m.x, m.y); strip.add(`<img src="${turn.target.image}" alt="">`);
      rights++;
      if (rights % 3 === 0) { await sleep(350); grow(); await sleep(700); }
    }
  }
  // leftover plates slide away
  await Promise.all(turn.plates.filter((p) => !p.eaten).map((p) => animate(p.el, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(30px) scale(.6)' }], { duration: 300 })));
  await sleep(500);
  turn.busy = false;
  nextTurn();
}

function level() {
  const c = queue.clean;
  return { n: Math.min(MAX_PLATES, c < 2 ? 2 : c < 4 ? 3 : 4), double: DOUBLES && c >= 6 };
}

async function nextTurn() {
  if (firstTurn) {
    // teaching turn: two foods; after the request a ghost hand shows the tap. It does not count.
    buildTurn(foods[0], 2, false);
    turn.teaching = true;
    await sleep(500);
    await shell.prompt(async () => { await ask(); await sleep(200); });
    await ghost.tap(turn.plates.find((p) => p.word === turn.target).el);
    return;
  }
  const target = queue.next();
  if (!target || queue.finished) {
    turn = null;
    platesEl.innerHTML = '';
    goat.classList.add('full');
    finale(`<div class="finale-pic"><img src="../art/goat.png" alt=""></div>`, () => { goat.classList.remove('full'); startRound(); });
    return;
  }
  const { n, double } = level();
  buildTurn(target, n, double);
  await sleep(500);
  await shell.prompt(ask);
}

function startRound() {
  // on the path the foods already come in order, the step's words first
  const order = path.active ? foods : memory.order(foods);
  queue = new Queue(order, { cleanToWin: ROUND });
  size = 0; rights = 0; wrongs = 0; applySize();
  strip = progressStrip(shell, ROUND, '🍽️');
  nextTurn();
}

/** On the path: the step's foods first (focus, then review), then the goat's own; never two that look alike. */
function pathFoods() {
  const extra = [...path.focus, ...path.review].map((id) => content.byId[id]).filter((w) => w && fit.canUse(w) && !foods.includes(w));
  const all = [...foods, ...extra], pool = [];
  for (const w of path.choose(all, all.length, memory.order(foods))) {
    if (APART.some((pair) => pair.includes(w.id) && pool.some((o) => pair.includes(o.id)))) continue;
    pool.push(w);
  }
  return pool.slice(0, Math.max(ROUND_FOODS, path.usable(pool).length));
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    foods = fit.curated.map((id) => content.byId[id]).filter((w) => w && fit.canUse(w));
    if (path.active) foods = pathFoods();
    layout();
    startRound();
  },
  replay: () => ask(),
});
layout();

// for scripted play-throughs (tools/devcheck)
window.__game = {
  get locked() { return shell.locked || !turn || !!turn.busy; },
  get finished() { return !turn && !!document.querySelector('.finale'); },
  get want() { return turn && turn.wants[turn.step]?.id; },
  get choices() { return turn ? turn.plates.filter((p) => !p.eaten).map((p) => p.word.id) : []; },
  get clean() { return queue?.clean ?? 0; }, get size() { return size; },
  get words() { return (foods || []).map((w) => w.id); },
  get teaching() { return !!turn?.teaching; },
  choose(id) { const p = turn?.plates.find((q) => q.word.id === id && !q.eaten); if (p) choose(p); return !!p; },
  choiceEl(right) { return turn?.plates.find((p) => !p.eaten && (p.word === turn.wants[turn.step]) === right)?.el; },
};
