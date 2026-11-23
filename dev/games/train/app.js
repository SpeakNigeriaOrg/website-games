// Word Train: the engine whistles a word; put its carriages in order, and the train says the word.
// An engine (with the word's picture in its steam cloud) waits on the track; identical carriages (one colour,
// shuffled every turn) stand on the grass. Each carriage says its syllable (in turn in the prompt, and when tapped).
// Tapping a carriage couples it next (dragging it to the train works too). When the train is full it plays the
// joined syllables in the child's order. Right: the natural take plays and the train chugs off. Wrong: the train
// plays the scrambled nonsense, wobbles, the first misplaced carriage pops off (with the ones behind it), and the
// child places them again.
// Levels: Missing Carriage (the train plays the word with one syllable replaced by a toot; pick the missing one of
// two), then one teaching turn with the first carriage already coupled (not counted), then 2- and 3-syllable words.
// Listening test: the carriages look identical, so which one goes where is only in the audio.
// From the learning path: the step's words, shortest first; level 1 is only Missing Carriage (4 turns), level 2 is
// 2 Missing Carriage turns then the teaching turn and 2 to put in order, level 3 the full plan.
import { loadContent, path, createShell, audio, sfx, Queue, memory, progressStrip, animate, confetti, ghost, finale, shuffle, pick, sleep, el, centre } from '../engine/engine.js';
import { fit, TWO, THREE, toneless, cleanSyl } from './fit.js';

const READING = new URLSearchParams(location.search).has('read');
const $ = (id) => document.getElementById(id);
const stage = $('stage'), trainEl = $('train'), looseEl = $('loose'), trackEl = $('track');

const PLAN = [{ level: 'missing', n: 2, from: TWO }, { level: 'order', n: 2, from: TWO }, { level: 'order', n: 2, from: THREE }];
// On the learning path, by level: how many turns of each kind (words are assigned shortest first).
const PATH_PLAN = path.pickLevel([[{ level: 'missing', n: 4 }], [{ level: 'missing', n: 2 }, { level: 'order', n: 2 }], PLAN]);
const ROUND = (path.active ? PATH_PLAN : PLAN).reduce((s, p) => s + p.n, 0); // counted turns
const COLOURS = ['#f2b33d', '#29a36a', '#3f7cd9', '#b05ad6', '#e86aa6', '#18a5a7', '#f08a24'];

const VOWELS = /[aeiouẹọ]/;
function shape(s) { const t = toneless(s); const i = t.search(VOWELS); return { onset: i < 0 ? t : t.slice(0, i), vowel: i < 0 ? '' : t[i] }; }
const usable = fit.canUse;

let content, pool, queue, strip, turn = null, teaching = true, taughtOrder = false, colourIdx = 0;
let L = {}; // layout in px

// ------------------------------------------------------------ sounds (synthesised; Yorùbá only from the kit)

const ctx = audio.ctx;
function horn(freqs, dur, vol = 0.09, slide = 1) {
  const t = ctx.currentTime, g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 1800;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
  g.gain.setValueAtTime(vol, t + dur - 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(ctx.destination);
  for (const fr of freqs) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(fr, t); if (slide !== 1) o.frequency.linearRampToValueAtTime(fr * slide, t + dur);
    o.connect(f); o.start(t); o.stop(t + dur + 0.02);
  }
  return sleep(dur * 1000);
}
const toot = (dur = 0.45) => horn([330, 415], Math.min(0.6, Math.max(0.3, dur)), 0.11);
const whistle = async () => { await horn([880, 1109], 0.28, 0.06); await sleep(60); await horn([880, 1109], 0.5, 0.06, 0.97); };
function chug(n = 6, every = 230) {
  for (let i = 0; i < n; i++) setTimeout(() => sfx._noise(0.14, i % 2 ? 0.07 : 0.11, 900, 250), i * every);
}

// ------------------------------------------------------------ drawing

const ENGINE_SVG = `<svg viewBox="0 0 150 125" aria-hidden="true">
  <path d="M4 114 L18 90 L30 90 L30 114 Z" fill="#4a4038" stroke="#2b2118" stroke-width="3" stroke-linejoin="round"/>
  <path d="M29 52 L32 26 L25 15 L52 15 L45 26 L48 52 Z" fill="#3b3430" stroke="#2b2118" stroke-width="4" stroke-linejoin="round"/>
  <rect x="16" y="50" width="86" height="46" rx="16" fill="#e4572e" stroke="#2b2118" stroke-width="4"/>
  <rect x="44" y="51" width="8" height="44" fill="#f2b33d"/><rect x="74" y="51" width="8" height="44" fill="#f2b33d"/>
  <path d="M22 60 Q40 56 96 58" stroke="#ff8a63" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M60 51 a12 12 0 0 1 24 0 Z" fill="#f2b33d" stroke="#2b2118" stroke-width="4" stroke-linejoin="round"/>
  <rect x="8" y="48" width="18" height="50" rx="8" fill="#4a4038" stroke="#2b2118" stroke-width="4"/>
  <circle cx="13" cy="62" r="7" fill="#ffe680" stroke="#2b2118" stroke-width="3"/>
  <rect x="96" y="22" width="48" height="76" rx="7" fill="#3f7cd9" stroke="#2b2118" stroke-width="4"/>
  <rect x="88" y="12" width="62" height="13" rx="6" fill="#2b2118"/>
  <rect x="106" y="33" width="28" height="25" rx="6" fill="#fff6d6" stroke="#2b2118" stroke-width="3"/>
  <rect x="10" y="94" width="136" height="10" rx="5" fill="#2b2118"/>
  <g class="wheel"><circle cx="120" cy="106" r="17" fill="#d64545" stroke="#2b2118" stroke-width="4"/>
    <path d="M120 91 V121 M105 106 H135 M109 95 L131 117 M131 95 L109 117" stroke="#2b2118" stroke-width="2.5"/><circle cx="120" cy="106" r="4.5" fill="#f2b33d" stroke="#2b2118" stroke-width="2"/></g>
  <g class="wheel"><circle cx="72" cy="111" r="12" fill="#d64545" stroke="#2b2118" stroke-width="4"/>
    <path d="M72 100 V122 M61 111 H83" stroke="#2b2118" stroke-width="2.5"/><circle cx="72" cy="111" r="3.5" fill="#f2b33d"/></g>
  <g class="wheel"><circle cx="40" cy="111" r="12" fill="#d64545" stroke="#2b2118" stroke-width="4"/>
    <path d="M40 100 V122 M29 111 H51" stroke="#2b2118" stroke-width="2.5"/><circle cx="40" cy="111" r="3.5" fill="#f2b33d"/></g>
  <rect x="40" y="107" width="80" height="6" rx="3" fill="#c9c2b8" stroke="#2b2118" stroke-width="2"/>
</svg>`;

const CAR_SVG = `<svg viewBox="0 0 110 80" aria-hidden="true">
  <rect x="0" y="56" width="14" height="7" rx="3.5" fill="#2b2118"/>
  <rect x="7" y="3" width="100" height="13" rx="6.5" class="dark" stroke="#2b2118" stroke-width="3.5"/>
  <rect x="11" y="12" width="92" height="50" rx="11" class="body" stroke="#2b2118" stroke-width="4"/>
  <rect x="13" y="47" width="88" height="7" class="dark"/>
  <rect x="21" y="21" width="29" height="21" rx="6" fill="#fff6d6" stroke="#2b2118" stroke-width="3"/>
  <rect x="64" y="21" width="29" height="21" rx="6" fill="#fff6d6" stroke="#2b2118" stroke-width="3"/>
  <rect x="13" y="59" width="88" height="6" rx="3" fill="#2b2118"/>
  <g class="wheel"><circle cx="32" cy="68" r="10.5" fill="#4a4038" stroke="#2b2118" stroke-width="3.5"/><path d="M32 58.5 V77.5 M22.5 68 H41.5" stroke="#c9c2b8" stroke-width="2.5"/><circle cx="32" cy="68" r="3" fill="#c9c2b8"/></g>
  <g class="wheel"><circle cx="80" cy="68" r="10.5" fill="#4a4038" stroke="#2b2118" stroke-width="3.5"/><path d="M80 58.5 V77.5 M70.5 68 H89.5" stroke="#c9c2b8" stroke-width="2.5"/><circle cx="80" cy="68" r="3" fill="#c9c2b8"/></g>
</svg>`;

function buildScenery() {
  const trees = $('trees');
  trees.innerHTML = '';
  for (const [x, s] of [[6, 1], [17, 0.7], [79, 0.85], [91, 1.1], [56, 0.6]]) {
    const t = el('div', 'tree', '<i></i><b></b>');
    t.style.left = x + '%'; t.style.setProperty('--s', s);
    trees.appendChild(t);
  }
}

// ------------------------------------------------------------ layout

function computeLayout() {
  const W = innerWidth, H = innerHeight, n = turn ? turn.slots.length : 3;
  const side = W > H * 1.2;
  const top = 62;
  const trainUnits = 1.45 + n * 1.12 + 0.12;
  let U;
  if (side) U = Math.min(W * 0.92 / (trainUnits + 1.5), (H - top - 16) / 2.75);
  else U = Math.min(W * 0.94 / trainUnits, (H - top - 20) / 4.1, 150);
  const engW = 1.45 * U, engH = engW * 125 / 150, carW = U, carH = U * 80 / 110, gap = 0.12 * U;
  const cloudW = 1.35 * U, cloudH = 1.15 * U;
  let trackY, trainX;
  const trainW = engW + n * (carW + gap);
  if (side) {
    trackY = top + engH + 0.1 * U + Math.max(0, (H - top - 16 - 2.75 * U) * 0.3);
    trainX = (W - trainW - cloudW - 0.15 * U) / 2 + cloudW + 0.15 * U;
  } else {
    trackY = Math.max(top + cloudH + engH + 0.15 * U, H * 0.47);
    trainX = (W - trainW) / 2;
  }
  L = { W, H, U, side, engW, engH, carW, carH, gap, cloudW, cloudH, trackY, trainX, trainW, n };
  const s = stage.style;
  s.setProperty('--u', U + 'px'); s.setProperty('--carW', carW + 'px'); s.setProperty('--carH', carH + 'px');
  s.setProperty('--engW', engW + 'px'); s.setProperty('--engH', engH + 'px'); s.setProperty('--trackY', trackY + 'px');
  // scenery: hills meet the grass a little above the track
  const gy = (trackY - 0.55 * U) / H * 1000;
  $('ground').setAttribute('y', gy);
  $('hillFar').setAttribute('d', `M0 ${gy} L0 ${gy - 120} Q180 ${gy - 230} 360 ${gy - 140} T720 ${gy - 150} T1000 ${gy - 190} L1000 ${gy} Z`);
  $('hillNear').setAttribute('d', `M0 ${gy + 2} L0 ${gy - 60} Q250 ${gy - 140} 500 ${gy - 60} T1000 ${gy - 80} L1000 ${gy + 2} Z`);
  $('trees').style.top = (trackY - 0.55 * U) + 'px';
}

const slotX = (i) => L.engW + L.gap + i * (L.carW + L.gap);

function place() {
  computeLayout();
  Object.assign(trainEl.style, { left: L.trainX + 'px', top: (L.trackY - L.engH) + 'px' });
  if (!turn) return;
  const cloud = turn.cloud;
  if (L.side) Object.assign(cloud.style, { left: -(L.cloudW + 0.15 * L.U) + 'px', top: (L.engH - L.cloudH) * 0.35 + 'px' });
  else Object.assign(cloud.style, { left: (L.engW * 0.42 - L.cloudW / 2) + 'px', top: -(L.cloudH + 0.12 * L.U) + 'px' });
  turn.ghosts.forEach((g, i) => { g.style.left = slotX(i) + 'px'; });
  turn.slots.forEach((c, i) => { if (c) setCoupled(c, i); });
  turn.loose.forEach(setLoose);
}

/** Homes on the grass: spread across, a little jumbled, clear of the replay button. */
function assignHomes(cars) {
  const m = cars.length;
  const xs = shuffle([...Array(m).keys()]);
  cars.forEach((c, k) => { c.home = { fx: (xs[k] + 0.5) / m + (Math.random() - 0.5) * 0.06, fy: 0.3 + Math.random() * 0.4, rot: (Math.random() - 0.5) * 14 }; });
}
function homePx(c) {
  const top = L.trackY + 0.35 * L.U, bottom = L.H - 14;
  let y = top + (bottom - top) * c.home.fy;
  y = Math.min(Math.max(y, top + L.carH / 2), bottom - L.carH / 2);
  let x = L.W * c.home.fx;
  x = Math.min(Math.max(x, L.carW / 2 + 10), L.W - L.carW / 2 - 10);
  if (y + L.carH / 2 > L.H - 100 && x - L.carW / 2 < 150) x = 150 + L.carW / 2;
  return { x, y };
}
function setLoose(c) {
  const p = homePx(c);
  Object.assign(c.el.style, { left: (p.x - L.carW / 2) + 'px', top: (p.y - L.carH / 2) + 'px' });
  c.el.style.setProperty('--rot', c.home.rot + 'deg');
}
function setCoupled(c, i) {
  Object.assign(c.el.style, { left: slotX(i) + 'px', top: (L.engH - L.carH) + 'px' });
  c.el.style.setProperty('--rot', '0deg');
}

/** Move a carriage to a new parent/position, animating from where it is now (FLIP), with a little hop. */
async function moveCar(c, toTrain, slot, { ms = 520, hop = 0.5 } = {}) {
  if (toTrain) delete c.el.dataset.choice; else c.el.dataset.choice = '';
  const a = c.el.getBoundingClientRect();
  const fromRot = toTrain ? (c.el.style.transform ? 0 : c.home.rot) : 0, toRot = toTrain ? 0 : c.home.rot;
  c.el.style.transform = '';
  if (toTrain) { trainEl.appendChild(c.el); setCoupled(c, slot); } else { looseEl.appendChild(c.el); setLoose(c); }
  const b = c.el.getBoundingClientRect();
  const dx = a.left - b.left + (a.width - b.width) / 2, dy = a.top - b.top + (a.height - b.height) / 2;
  await animate(c.el, [
    { transform: `translate(${dx}px, ${dy}px) rotate(${fromRot}deg)` },
    { transform: `translate(${dx / 2}px, ${dy / 2 - L.U * hop}px) rotate(${(fromRot + toRot) / 2}deg)`, offset: 0.5 },
    { transform: `translate(0, 0) rotate(${toRot}deg)` }], { duration: ms, easing: 'ease-in-out', fill: 'none' });
  c.el.style.transform = ''; // rest pose from the CSS (rotate(var(--rot))): an inline transform here means "being dragged"
}

// ------------------------------------------------------------ turns

function makeCar(syl, idx, colour) {
  const b = el('button', 'car', CAR_SVG + (READING ? `<span class="label">${syl.text}</span>` : ''));
  b.setAttribute('aria-label', 'carriage');
  b.style.setProperty('--car', colour);
  const c = { el: b, syl, idx };
  b.__tap = () => couple(c); // keyboard: a loose carriage (data-choice) couples next, as a tap does
  bindCar(c);
  return c;
}

function distractor(target, word) {
  const t = shape(target.text);
  const own = new Set(word.syllables.map((s) => toneless(s.text)));
  const ok = pool.filter((s) => !own.has(toneless(s.text)));
  const strict = ok.filter((s) => shape(s.text).onset !== t.onset && shape(s.text).vowel !== t.vowel);
  return pick(strict.length ? strict : ok);
}

function buildTurn(item) {
  const { word, level } = item;
  trainEl.innerHTML = ''; looseEl.innerHTML = '';
  const colour = COLOURS[colourIdx++ % COLOURS.length];
  const n = word.syllables.length;
  turn = { item, word, level, slots: Array(n).fill(null), loose: [], ghosts: [], misses: 0, gap: -1 };
  computeLayout();
  const cloud = el('div', 'pic-cloud', `<img src="${word.image}" alt="">`);
  trainEl.appendChild(cloud);
  turn.cloud = cloud;
  const engine = el('div', 'engine', ENGINE_SVG);
  trainEl.appendChild(engine);
  turn.engine = engine;
  turn.ghosts = word.syllables.map(() => trainEl.appendChild(el('div', 'slot-ghost')));
  const cars = word.syllables.map((s, i) => makeCar(s, i, colour));
  if (level === 'missing') {
    turn.gap = Math.floor(Math.random() * n);
    cars.forEach((c, i) => { if (i !== turn.gap) { turn.slots[i] = c; trainEl.appendChild(c.el); } });
    turn.loose = [cars[turn.gap], makeCar(distractor(word.syllables[turn.gap], word), -1, colour)];
  } else if (level === 'coupled') {
    turn.slots[0] = cars[0]; trainEl.appendChild(cars[0].el);
    turn.loose = cars.slice(1);
  } else {
    turn.loose = cars;
  }
  turn.allCars = [...turn.slots.filter(Boolean), ...turn.loose];
  assignHomes(turn.loose);
  turn.loose.forEach((c) => { c.el.dataset.choice = ''; looseEl.appendChild(c.el); });
  place();
  audio.preload([word.audio, ...turn.allCars.map((c) => c.syl.audio)]);
}

async function rollIn() {
  turn.loose.forEach((c) => { c.el.style.opacity = 0; });
  trainEl.classList.add('rolling');
  chug(6, 230);
  await animate(trainEl, [{ transform: `translateX(${L.W - L.trainX + 40}px)` }, { transform: 'translateX(0)' }], { duration: 1400, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'none' });
  trainEl.classList.remove('rolling');
  for (const c of turn.loose) {
    c.el.style.opacity = '';
    sfx.pop();
    await animate(c.el, [{ transform: `scale(0) rotate(${c.home.rot}deg)` }, { transform: `scale(1.1) rotate(${c.home.rot}deg)`, offset: 0.7 }, { transform: `scale(1) rotate(${c.home.rot}deg)` }], { duration: 320, fill: 'none' });
    c.el.style.transform = ''; // the engine keeps the end pose inline; moveCar reads an inline transform as a drag
  }
}

async function speak(c) {
  c.el.classList.add('speaking');
  await audio.play(c.syl.audio);
  c.el.classList.remove('speaking');
}

/** The train plays what is coupled, in order; an empty slot toots. */
async function playTrain() {
  for (let i = 0; i < turn.slots.length; i++) {
    const c = turn.slots[i];
    if (c) await speak(c);
    else {
      const g = turn.ghosts[i];
      g.classList.add('tooting');
      await toot(turn.word.syllables[i].durationS || 0.45);
      g.classList.remove('tooting');
    }
    await sleep(70);
  }
}

async function sayWord() {
  turn.cloud.classList.add('pulse');
  await audio.play(turn.word.audio);
  turn.cloud.classList.remove('pulse');
}

async function promptTurn() {
  await whistle();
  puffs(3);
  await sleep(150);
  await sayWord();
  await sleep(450);
  if (turn.level === 'missing') { await playTrain(); await sleep(450); }
  for (const c of turn.loose) { await speak(c); await sleep(280); }
}

function puffs(n = 4) {
  const r = turn.engine.getBoundingClientRect();
  for (let i = 0; i < n; i++) setTimeout(() => {
    const p = stage.appendChild(el('div', 'puff'));
    p.style.left = r.left + r.width * 0.25 + 'px'; p.style.top = r.top + r.height * 0.1 + 'px';
    animate(p, [{ transform: 'translate(-50%,-50%) scale(.4)', opacity: .9 }, { transform: `translate(${10 + Math.random() * 30}px, ${-L.U * 0.9}px) scale(1.4)`, opacity: 0 }], { duration: 1100, easing: 'ease-out' }).then(() => p.remove());
  }, i * 220);
}

const nextSlot = () => turn.level === 'missing' ? (turn.slots[turn.gap] ? -1 : turn.gap) : turn.slots.findIndex((s) => !s);
const correctCar = () => { const s = nextSlot(); return turn.loose.find((c) => c.idx === s); };

async function startTurn() {
  shell.lock();
  await rollIn();
  await shell.prompt(async () => {
    await promptTurn();
    if (turn.level === 'missing' && teaching) await ghost.hoverEach(turn.loose.map((c) => c.el), 600);
    if (turn.level === 'coupled') await ghost.tap(turn.loose[0].el);
  });
}

async function couple(c) {
  if (shell.locked || !turn || !turn.loose.includes(c)) return;
  const slot = nextSlot();
  if (slot < 0) return;
  shell.lock();
  sfx.tap();
  turn.loose = turn.loose.filter((x) => x !== c);
  turn.slots[slot] = c;
  const said = audio.play(c.syl.audio);
  await moveCar(c, true, slot);
  sfx.bump();
  await said;
  if (nextSlot() >= 0) { shell.unlock(); return; }
  await sleep(350);
  await judge();
}

async function judge() {
  trainEl.classList.add('rolling');
  await animate(trainEl, [{ transform: 'translateX(0)' }, { transform: `translateX(${-0.25 * L.U}px)` }], { duration: 500, easing: 'ease-in-out', fill: 'none' });
  trainEl.style.transform = `translateX(${-0.25 * L.U}px)`;
  trainEl.classList.remove('rolling');
  await playTrain();
  const right = turn.slots.every((c, i) => c.idx === i);
  if (right) return success();
  // wrong: comic wobble, then the first misplaced carriage pops off, with the ones behind it
  queue.miss();
  turn.misses++;
  sfx.boing();
  await animate(trainEl, [{ transform: `translateX(${-0.25 * L.U}px) rotate(0)` }, { transform: `translateX(${-0.25 * L.U}px) rotate(-3deg)` },
    { transform: `translateX(${-0.25 * L.U}px) rotate(3deg)` }, { transform: `translateX(${-0.25 * L.U}px) rotate(-2deg)` }, { transform: `translateX(${-0.25 * L.U}px) rotate(0)` }],
  { duration: 700, fill: 'none' });
  trainEl.style.transform = '';
  const first = turn.slots.findIndex((c, i) => c.idx !== i);
  const off = turn.level === 'missing' ? [turn.gap] : turn.slots.map((_, i) => i).filter((i) => i >= first);
  sfx.pop();
  await Promise.all(off.map((i, k) => {
    const c = turn.slots[i];
    turn.slots[i] = null;
    turn.loose.push(c);
    return sleep(k * 120).then(() => moveCar(c, false, 0, { ms: k ? 600 : 750, hop: k ? 0.4 : 1.6 }));
  }));
  await sleep(300);
  await shell.prompt(async () => {
    await sayWord();
    await sleep(400);
    if (turn.level === 'missing') { await playTrain(); await sleep(400); }
    for (const c of turn.loose) { await speak(c); await sleep(280); }
    if (turn.misses >= 2) await ghost.tap(correctCar().el);
  });
}

async function success() {
  await sleep(200);
  await sayWord();
  const clean = turn.level === 'coupled' ? null : queue.done();
  if (turn.level !== 'coupled') memory.seen(turn.word.id, clean);
  const c = centre(turn.cloud);
  if (clean !== false) { sfx.cheer(); confetti(c.x, c.y); }
  if (clean) strip.add(`<img src="${turn.word.image}" alt="">`);
  await whistle();
  trainEl.classList.add('rolling');
  chug(8, 200);
  puffs(5);
  await animate(trainEl, [{ transform: `translateX(${-0.25 * L.U}px)` }, { transform: `translateX(${-(L.trainX + L.trainW + L.cloudW + 60)}px)` }], { duration: 1700, easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'none' });
  trainEl.classList.remove('rolling');
  trainEl.style.transform = '';
  trainEl.innerHTML = '';
  if (turn.level === 'missing') teaching = false;
  if (turn.level === 'coupled') taughtOrder = true;
  nextTurn();
}

function nextTurn() {
  let item;
  const peek = queue.pending[0];
  if (!queue.finished && peek && peek.level === 'order' && !taughtOrder) {
    item = { word: teachWord, level: 'coupled' };
  } else {
    item = queue.next();
  }
  if (!item || queue.finished) {
    turn = null;
    looseEl.innerHTML = '';
    finale(`<div class="finale-train">${ENGINE_SVG}</div>`, startRound);
    return;
  }
  buildTurn(item);
  startTurn();
}

let teachWord, roundWords = [];
function startRound() {
  const used = new Set();
  const take = (ids, k) => {
    const ws = memory.order(ids.map((id) => content.byId[id]).filter(usable)).filter((w) => !used.has(w.id)).slice(0, k);
    ws.forEach((w) => used.add(w.id));
    return ws;
  };
  let items = PLAN.flatMap((p) => take(p.from, p.n).map((word) => ({ word, level: p.level })));
  if (path.active) {
    // the learning path: focus words first, then review words, then the game's own; shortest first
    const pool = [...new Set([...fit.curated, ...path.focus, ...path.review])].map((id) => content.byId[id]).filter(usable);
    const chosen = path.choose(pool, ROUND, items.map((it) => it.word)).sort((a, b) => a.syllables.length - b.syllables.length);
    const levels = PATH_PLAN.flatMap((p) => Array(p.n).fill(p.level));
    items = chosen.map((word, i) => ({ word, level: levels[i] ?? 'order' }));
    used.clear(); chosen.forEach((w) => used.add(w.id));
  }
  teachWord = take(TWO, 1)[0] ?? take(fit.curated, 1)[0];
  taughtOrder = !teachWord; // no spare word to teach with: go straight to ordering
  roundWords = items.map((it) => it.word.id);
  queue = new Queue(items, { cleanToWin: Math.min(ROUND, items.length) });
  strip = progressStrip(shell, Math.min(ROUND, items.length), '🚂');
  nextTurn();
}

// ------------------------------------------------------------ input: tap to couple, or drag onto the train

function bindCar(c) {
  let down = null, dragging = false;
  c.el.addEventListener('pointerdown', (e) => {
    if (shell.locked || !turn?.loose.includes(c)) return;
    down = { x: e.clientX, y: e.clientY }; dragging = false;
    c.el.setPointerCapture?.(e.pointerId);
  });
  c.el.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!dragging && Math.hypot(dx, dy) > 12) { dragging = true; c.el.classList.add('dragging'); }
    if (dragging) c.el.style.transform = `translate(${dx}px, ${dy}px) rotate(0deg) scale(1.08)`;
  });
  const end = async (e) => {
    if (!down) return;
    const wasDrag = dragging; down = null; dragging = false;
    c.el.classList.remove('dragging');
    if (!wasDrag) { c.el.style.transform = ''; couple(c); return; }
    if (e.type !== 'pointercancel' && e.clientY < L.trackY + 0.3 * L.U && !shell.locked && nextSlot() >= 0) {
      couple(c);
    } else {
      const from = c.el.style.transform;
      c.el.style.transform = '';
      animate(c.el, [{ transform: from }, { transform: `rotate(${c.home.rot}deg)` }], { duration: 300, fill: 'none' })
        .then(() => { if (!c.el.classList.contains('dragging')) c.el.style.transform = ''; });
    }
  };
  c.el.addEventListener('pointerup', end);
  c.el.addEventListener('pointercancel', end);
}

addEventListener('resize', () => place());

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    const clean = content.words.filter((w) => w.audio && !w.flags.some((f) => /clip|no_speech|more_than_one|repair_rejected/.test(f)));
    pool = clean.flatMap((w) => w.syllables).filter((s) => cleanSyl(s) && VOWELS.test(toneless(s.text)) && !/ /.test(s.text));
    startRound();
  },
  replay: () => turn && promptTurn(),
});

buildScenery();
computeLayout();
Object.assign(trainEl.style, { left: L.trainX + 'px', top: (L.trackY - L.engH) + 'px' });

window.__game = {
  get word() { return turn?.word; }, get level() { return turn?.level; }, get locked() { return shell.locked; },
  get clean() { return queue?.clean ?? 0; }, get words() { return roundWords; }, get finished() { return !!document.querySelector('.finale'); },
  get misses() { return turn?.misses ?? 0; }, get looseCount() { return turn?.loose.length ?? 0; },
  /** Tap the right (or a wrong) loose carriage for the next slot. */
  tap(right) { if (!turn) return false; const good = correctCar(); const c = right ? (good ?? turn.loose[0]) : (turn.loose.find((x) => x !== good) ?? turn.loose[0]); if (c) couple(c); return !!c; },
  get carEls() { return turn?.loose.map((c) => c.el) ?? []; },
  correctEl: () => (turn ? correctCar()?.el : null),
};
