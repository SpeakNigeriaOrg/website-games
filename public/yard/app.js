// Hide and Seek: a voice calls an animal; find the one hiding in the yard.
// Four identical bushes. Animals run in and dive behind bushes in full view. Each turn the animal's name
// plays, then every hidden animal peeks out at once (peekaboo!) and ducks back; only then can the child tap.
// Right: the animal pops out, jumps for joy and is named again, then hops into another bush. Wrong: the
// tapped animal peeks out and says its own name (an empty bush just rustles), then the right bush rustles
// and the child taps it. The first turn is a teaching turn with one animal and a ghost hand.
// Demand: meaning. The peek shows every animal equally, and the prompt is only sound, so a child who
// ignores the audio is left guessing among two or three bushes.
import { loadContent, createShell, audio, sfx, onTap, Queue, memory, progressStrip, animate, confetti, ghost, finale, shuffle, pick, sleep, el, centre, path } from '../engine/engine.js';
import { fit, APART } from './fit.js';

// By path level (1 first meeting, 2 practice, 3 the full game): clean finds to win, animals in the yard.
const ROUND = path.pickLevel([4, 5, 6]);
const CAST = path.pickLevel([2, 3, 3]);
const IMG_W = 1216, IMG_H = 832;
// art/yard_bush<i>.png: the four bushes cut from the background, as % boxes of the picture
const BUSHES = [{ x: 4.11, y: 58.53, w: 22.04, h: 26.68 }, { x: 27.8, y: 58.65, w: 21.96, h: 26.56 },
  { x: 51.56, y: 58.65, w: 22.04, h: 26.68 }, { x: 75.0, y: 58.53, w: 22.04, h: 26.68 }];

const $ = (id) => document.getElementById(id);
const scene = $('scene'), animalsEl = $('animals'), bushesEl = $('bushes');

let content, pool, queue, strip, cast, residents, bushes, turnNo, current = null;
let rects = [], disc = 100, mode = 'row';

// ---------------------------------------------------------------- layout

/** Wide screens: the yard picture fills the width and its own four bushes are the hiding places.
 *  Tall screens: only the back of the yard (wall and trees) is shown, cut above the painted bushes, and the
 *  four bushes stand two by two on the red earth below, big enough for small fingers. */
function layout() {
  const W = innerWidth, H = innerHeight;
  mode = W / H >= 1 ? 'row' : 'grid';
  document.body.dataset.mode = mode;
  const bg = scene.querySelector('.scene-bg');
  if (mode === 'row') {
    const S = W / IMG_W, h = IMG_H * S, top = Math.min(0, H - h);
    Object.assign(scene.style, { left: 0, top: top + 'px', width: W + 'px', height: h + 'px' });
    Object.assign(bg.style, { left: 0, width: W + 'px', height: h + 'px' });
    rects = BUSHES.map((r) => ({ x: r.x / 100 * W, y: top + r.y / 100 * h, w: r.w / 100 * W, h: r.h / 100 * h }));
  } else {
    const backH = H * 0.36, S = backH / (IMG_H * 0.575), imgW = IMG_W * S;
    Object.assign(scene.style, { left: 0, top: 0, width: W + 'px', height: backH + 'px' });
    Object.assign(bg.style, { left: (W - imgW) / 2 + 'px', width: imgW + 'px', height: IMG_H * S + 'px' });
    const bw = Math.min(W * 0.44, (H - backH - 150) / 2 / 0.82), bh = bw * 0.82;
    const gapY = (H - backH - 2 * bh - 110) / 3;
    rects = [0, 1, 2, 3].map((i) => ({ x: W * (i % 2 ? 0.74 : 0.26) - bw / 2, y: backH + gapY + (i < 2 ? 0 : bh + gapY), w: bw, h: bh }));
  }
  disc = rects[0].w * 0.62;
  for (const bush of bushes || []) Object.assign(bush.el.style, px(rects[bush.i]));
  for (const a of cast || []) if (a.bush != null) { a.el.style.width = disc + 'px'; place(a, a.state); }
}
const px = (r) => ({ left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
addEventListener('resize', layout);

// ---------------------------------------------------------------- positions (screen px)

function spot(b, state) {
  const r = rects[b];
  const cx = r.x + r.w / 2;
  const s = state === 'out' ? 1.12 : 1;
  const y = state === 'hidden' ? r.y + r.h * 0.5
    : state === 'peek' ? r.y - disc * 0.12
      // 'out': standing on top of the bush; in the two-by-two grid, in front of the bush's top instead, or a
      // bottom-row animal would stand over the bush above it and seem to come out of the wrong bush
      : mode === 'grid' ? r.y + disc * 0.05 : r.y - disc * s * 0.5;
  return { left: cx + 'px', top: y + 'px', transform: `translate(-50%,-50%) scale(${s})` };
}

function place(a, state) {
  a.state = state;
  Object.assign(a.el.style, spot(a.bush, state));
}

async function go(a, state, ms = 350, easing = 'ease-out') {
  const from = { left: a.el.style.left, top: a.el.style.top, transform: a.el.style.transform };
  const to = spot(a.bush, state);
  a.state = state;
  a.el.classList.toggle('up', state === 'out');
  await a.el.animate([from, to], { duration: ms, easing }).finished.catch(() => {});
  Object.assign(a.el.style, to);
}

// ---------------------------------------------------------------- yard

function buildYard() {
  bushesEl.innerHTML = ''; animalsEl.innerHTML = '';
  bushes = BUSHES.map((box, i) => {
    const b = el('button', 'bush', `<img src="../art/yard_bush${i}.png" alt="">`);
    b.setAttribute('aria-label', 'bush'); b.dataset.choice = '';
    Object.assign(b.style, px(rects[i]));
    bushesEl.appendChild(b);
    const bush = { i, el: b, animal: null };
    onTap(b, () => tapBush(bush));
    return bush;
  });
}

function makeAnimal(word) {
  const node = el('div', 'animal', `<img src="${word.image}" alt="">`);
  node.style.width = disc + 'px';
  node.style.opacity = 0;
  animalsEl.appendChild(node);
  return { word, el: node, bush: null, state: 'away' };
}

async function rustle(bush, big = false) {
  bush.el.classList.remove('rustle', 'shake');
  void bush.el.offsetWidth;
  bush.el.classList.add(big ? 'shake' : 'rustle');
  sfx._noise(0.3, 0.12, 2500, 900);
  if (big) leaves(bush);
  await sleep(big ? 650 : 500);
  bush.el.classList.remove('rustle', 'shake');
}

function leaves(bush) {
  const r = bush.el.getBoundingClientRect();
  for (let i = 0; i < 7; i++) {
    const l = document.body.appendChild(el('div', 'leaf'));
    l.style.left = r.left + r.width * (0.2 + Math.random() * 0.6) + 'px';
    l.style.top = r.top + r.height * 0.3 + 'px';
    l.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: `translate(${(Math.random() - 0.5) * 80}px, ${r.height * 0.7}px) rotate(${Math.random() * 400}deg)`, opacity: 0 }],
    { duration: 900 + Math.random() * 400, easing: 'ease-in' }).finished.then(() => l.remove());
  }
}

const emptyBushes = () => bushes.filter((b) => !b.animal);

/** A new animal runs in from the side along the bush tops and dives into an empty bush, in full view. */
async function arrive(a) {
  const bush = pick(emptyBushes());
  bush.animal = a; a.bush = bush.i;
  const fromLeft = bush.i < 2;
  const target = spot(bush.i, 'out');
  const x0 = fromLeft ? -disc : innerWidth + disc;
  const start = { ...target, left: x0 + 'px' };
  Object.assign(a.el.style, start, { opacity: 1 });
  a.el.classList.add('up');
  sfx.whoosh();
  const hops = [];
  for (let k = 1; k < 4; k++) {
    const t = k / 4;
    const x = x0 + (parseFloat(target.left) - x0) * t;
    hops.push({ left: x + 'px', top: parseFloat(target.top) - (k % 2 ? disc * 0.25 : 0) + 'px', transform: target.transform, offset: t });
  }
  await a.el.animate([start, ...hops, target], { duration: 1100, easing: 'linear' }).finished;
  Object.assign(a.el.style, target);
  a.state = 'out';
  a.el.classList.add('jig'); sfx.pop(); await sleep(500); a.el.classList.remove('jig');
  await dive(a);
}

async function dive(a) {
  sfx._tone(700, 0.25, 'sine', 0.12, 0.4);
  await go(a, 'hidden', 380, 'ease-in');
  rustle(bushes[a.bush]);
}

/** Every hidden animal peeks out at once, then ducks back. */
async function peekAll(ms = 1300) {
  const hiding = cast.filter((a) => a.bush != null);
  sfx.boing();
  await Promise.all(hiding.map((a) => go(a, 'peek', 300, 'cubic-bezier(.3,1.6,.6,1)')));
  await sleep(ms);
  await Promise.all(hiding.map((a) => go(a, 'hidden', 260, 'ease-in')));
}

// ---------------------------------------------------------------- turns

async function promptTurn() {
  await sleep(250);
  await audio.play(current.target.word.audio);
  await sleep(250);
  await peekAll();
}

async function tapBush(bush) {
  if (shell.locked || !current || current.busy) return;
  current.busy = true;
  shell.lock();
  sfx.tap();
  const a = bush.animal;
  if (a === current.target) {
    // found! out it pops, jumps for joy, and is named again
    rustle(bush, true);
    await go(a, 'out', 380, 'cubic-bezier(.3,1.6,.6,1)');
    sfx.cheer();
    const c = centre(a.el); confetti(c.x, c.y, 22);
    a.el.classList.add('joy');
    await audio.play(a.word.audio);
    await sleep(500);
    a.el.classList.remove('joy');
    const clean = !current.missed;
    if (!current.teaching) {
      queue.done();
      memory.seen(a.word.id, clean);
      if (clean) strip.add(`<img src="${a.word.image}" alt="">`);
    }
    // then hides somewhere else, in full view
    const to = pick(emptyBushes());
    bush.animal = null; to.animal = a;
    const from = spot(a.bush, 'out');
    a.bush = to.i;
    const dest = spot(a.bush, 'out');
    sfx.whoosh();
    await a.el.animate([from, { ...from, left: (parseFloat(from.left) + parseFloat(dest.left)) / 2 + 'px', top: Math.min(parseFloat(from.top), parseFloat(dest.top)) - disc * 0.6 + 'px' }, dest], { duration: 650, easing: 'ease-in-out' }).finished;
    Object.assign(a.el.style, dest);
    await dive(a);
    await sleep(400);
    current.busy = false;
    nextTurn();
  } else {
    if (!current.missed && !current.teaching) queue.miss();
    current.missed = true;
    if (a) {
      // the wrong animal peeks out and says its own name
      await go(a, 'peek', 280, 'cubic-bezier(.3,1.6,.6,1)');
      a.el.classList.add('shy');
      await audio.play(a.word.audio);
      a.el.classList.remove('shy');
      await sleep(250);
      await go(a, 'hidden', 260, 'ease-in');
    } else {
      sfx.soft();
      await rustle(bush, true);
    }
    await sleep(300);
    // the target is named again and its bush rustles
    await shell.prompt(async () => {
      await audio.play(current.target.word.audio);
      await rustle(bushes[current.target.bush], true);
    });
    current.busy = false;
  }
}

async function nextTurn() {
  if (turnNo === 0) {
    // teaching turn: one animal, one hiding place in view, and a ghost hand shows the tap
    turnNo++;
    await arrive(cast[0]);
    residents = 1;
    current = { target: cast[0], teaching: true, missed: false };
    await shell.prompt(promptTurn);
    await ghost.tap(bushes[cast[0].bush].el);
    return;
  }
  const word = queue.next();
  if (!word || queue.finished) { current = null; await goodbye(); return; }
  const want = Math.min(cast.length, turnNo <= 3 ? 2 : 3);
  turnNo++;
  shell.lock();
  while (residents < want) { await arrive(cast[residents]); residents++; await sleep(200); }
  current = { target: cast.find((a) => a.word === word), missed: false };
  await shell.prompt(promptTurn);
}

async function goodbye() {
  // everyone pops out to wave, then the finale
  await Promise.all(cast.filter((a) => a.bush != null).map((a) => go(a, 'out', 400, 'cubic-bezier(.3,1.6,.6,1)')));
  cast.forEach((a) => a.el.classList.add('joy'));
  finale(`<div class="finale-row">${cast.map((a) => `<img src="${a.word.image}" alt="">`).join('')}</div>`, startRound);
}

function chooseCast() {
  // on the path the step's words come first (all of them, up to three), then the yard's own
  const ordered = path.active ? path.choose(pool, pool.length, memory.order(pool)) : memory.order(pool);
  const n = path.active ? Math.min(3, Math.max(CAST, pool.filter((w) => path.focus.includes(w.id)).length)) : CAST;
  const out = [];
  for (const w of ordered) {
    if (out.length === n) break;
    if (APART.some((pair) => pair.includes(w.id) && out.some((o) => pair.includes(o.id) && o.id !== w.id))) continue;
    out.push(w);
  }
  return out;
}

function startRound() {
  buildYard();
  const words = chooseCast();
  cast = words.map(makeAnimal);
  residents = 0; turnNo = 0;
  // targets: three turns among the first two animals, then the rest among all three
  // (on the path, every animal is sure to be asked for: shuffled runs instead of free picks)
  const items = path.active ? [...shuffle(words.slice(0, 2)), pick(words.slice(0, 2)), ...shuffle(words), ...shuffle(words), ...shuffle(words)].slice(0, 10)
    : [...Array.from({ length: 3 }, () => pick(words.slice(0, 2))), ...Array.from({ length: 7 }, () => pick(words))];
  queue = new Queue(items, { cleanToWin: ROUND });
  strip = progressStrip(shell, ROUND, '⭐');
  audio.preload(words.map((w) => w.audio));
  nextTurn();
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    pool = fit.curated.map((id) => content.byId[id]).filter((w) => w && fit.canUse(w));
    if (path.active) pool.push(...[...path.focus, ...path.review].map((id) => content.byId[id]).filter((w) => w && fit.canUse(w) && !pool.includes(w)));
    startRound();
  },
  replay: () => promptTurn(),
});
layout();

// for scripted play-throughs (tools/devcheck)
window.__game = {
  get locked() { return shell.locked || !current || !!current.busy; },
  get finished() { return !!document.querySelector('.finale'); },
  get teaching() { return !!current?.teaching; },
  get target() { return current?.target.bush ?? null; },
  get bushes() { return bushes ? bushes.map((b) => b.animal?.word.id ?? null) : []; },
  get clean() { return queue?.clean ?? 0; },
  get words() { return (cast || []).map((a) => a.word.id); },
  tap(i) { tapBush(bushes[i]); },
};
