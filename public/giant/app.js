// Tickle the Giant: the giant names a body part; tickle it there.
// One big friendly giant fills the screen; nothing marks the target. A body part is named and the child taps
// it on the giant. Right: that part bulges and wiggles, the giant giggles, and the part is named again.
// Wrong: the touched part reacts and, if it is one of our words, says its own name; then the target is named
// again. Big separate parts come first (hair, leg, eye, chest), small ones later (knee, palm, teeth, ear...). For
// the small parts the view moves in close (face, belly, hands or legs). After a clean round an unscored speed round ends
// with the giant collapsing with laughter. Demand: meaning.
import { loadContent, createShell, audio, sfx, onTap, Queue, memory, progressStrip, animate, confetti, ghost, finale, shuffle, sleep, el, path } from '../engine/engine.js';
import { fit, WORDS, EASY, HARD } from './fit.js';

const ROUND = 8;
const IMG_W = 721, IMG_H = 1102;
// Hit zones on art/giant.png in image px [x0, y0, x1, y1], located with Qwen3-VL and checked by eye (ear, navel,
// nail, chest and thigh measured by eye on ruled crops). Checked in this order, so a knee tap is a knee before it
// is a leg, an ear tap is an ear before it is his hair, and a nose tap is no word. Nails: only his toenails show
// (his palms face us), so the nail zones cover his toes. Thighs: under his shorts. His lips and his back are not
// drawn clearly enough to ask.
const ZONES = [
  { part: 'eye', rects: [[280, 125, 345, 195], [375, 125, 440, 195]] },
  { part: 'nose', rects: [[343, 186, 377, 203]] },
  { part: 'teeth', rects: [[300, 200, 420, 268]] },
  { part: 'ear', rects: [[234, 160, 274, 214], [447, 160, 488, 214]] },
  { part: 'navel', rects: [[330, 540, 390, 595]] },
  { part: 'knee', rects: [[235, 815, 340, 902], [380, 815, 485, 902]] },
  { part: 'nail', rects: [[146, 1050, 222, 1100], [499, 1050, 577, 1100]] },
  { part: 'finger', rects: [[0, 15, 197, 106], [0, 88, 52, 165], [524, 15, 720, 106], [669, 88, 720, 165]] },
  { part: 'palm', rects: [[48, 100, 197, 224], [524, 100, 672, 224]] },
  { part: 'hair', rects: [[241, 0, 479, 110], [236, 100, 272, 168], [448, 100, 484, 168]] },
  { part: 'chest', rects: [[296, 300, 416, 475]] },
  { part: 'thigh', rects: [[222, 700, 355, 815], [366, 700, 500, 815]] },
  { part: 'leg', rects: [[235, 815, 340, 1000], [148, 985, 322, 1102], [380, 815, 485, 1000], [396, 985, 578, 1102]] },
];
const partOf = Object.fromEntries(Object.entries(WORDS).map(([part, id]) => [id, part]));
// Close views, for parts too small to tap comfortably in the whole giant (phones): each frames a region
// where several parts can be tapped, so the view itself never singles out the answer.
const CLOSE = { face: [200, 0, 521, 300], belly: [180, 290, 540, 730], hands: [0, 0, 721, 300], legs: [120, 560, 600, 1102] };
const REGION = { eye: 'face', teeth: 'face', hair: 'face', ear: 'face', chest: 'belly', navel: 'belly', palm: 'hands', finger: 'hands',
  knee: 'legs', thigh: 'legs', nail: 'legs', leg: 'legs' };
// parts of the leg: when the leg (ẹsẹ̀, foot or leg) is asked, a tap on one of these is right too
const OF_LEG = ['knee', 'thigh', 'nail'];
const MIN_ZONE = 50;                // px: a zone smaller than this on screen is asked in a close view

const $ = (id) => document.getElementById(id);
const stage = $('stage'), giant = $('giant'), img = giant.querySelector('img');

let content, words, parts, goal = ROUND, queue, strip, turn = null, firstTurn = true, view = 'whole', box, alpha, speed = null, laughs = 0;

// ---------------------------------------------------------------- views

function frame(name) {
  const W = innerWidth, H = innerHeight;
  if (name === 'whole') {
    const top = 64;
    const s = Math.min((W - 16) / IMG_W, (H - top - 8) / IMG_H);
    // spare height (tall phones): lift his feet clear of the replay button, which would cover the left foot
    const bottom = 8 + Math.min(84, Math.max(0, H - top - 8 - IMG_H * s));
    return { s, x: (W - IMG_W * s) / 2, y: H - bottom - IMG_H * s };
  }
  const [x0, y0, x1, y1] = CLOSE[name];
  const top = 70, bottom = name === 'legs' ? 10 : 96;   // the legs view keeps his feet on the grass
  const s = Math.min((W - 16) / (x1 - x0), (H - top - bottom) / (y1 - y0));
  return { s, x: W / 2 - (x0 + x1) / 2 * s, y: top + ((H - top - bottom) - (y1 - y0) * s) / 2 - y0 * s };
}

function setView(name, instant = false) {
  view = name;
  box = frame(name);
  giant.classList.toggle('instant', instant);
  Object.assign(giant.style, { left: box.x + 'px', top: box.y + 'px', width: IMG_W * box.s + 'px', height: IMG_H * box.s + 'px' });
  document.body.dataset.view = name;
  return sleep(instant ? 0 : 650);
}
addEventListener('resize', () => setView(view, true));

/** The view a part is asked in: the whole giant, unless the part would be too small to tap there. */
function viewFor(part) {
  const s = frame('whole').s;
  const z = ZONES.find((q) => q.part === part).rects[0];
  return Math.min(z[2] - z[0], z[3] - z[1]) * s >= MIN_ZONE ? 'whole' : REGION[part];
}

// ---------------------------------------------------------------- hit testing

function loadAlpha() {
  const c = document.createElement('canvas');
  c.width = IMG_W; c.height = IMG_H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, IMG_W, IMG_H);
  alpha = g.getImageData(0, 0, IMG_W, IMG_H).data;
}

/** Which part a screen point touches: a zone name, 'body' for the rest of the giant, or null for air. */
function hit(clientX, clientY) {
  const r = giant.getBoundingClientRect();
  const x = (clientX - r.left) / r.width * IMG_W, y = (clientY - r.top) / r.height * IMG_H;
  if (x < 0 || y < 0 || x >= IMG_W || y >= IMG_H) return { part: null, x, y };
  for (const z of ZONES) if (z.rects.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d)) return { part: z.part, x, y };
  const opaque = alpha ? alpha[(Math.floor(y) * IMG_W + Math.floor(x)) * 4 + 3] > 60 : true;
  return { part: opaque ? 'body' : null, x, y };
}

// ---------------------------------------------------------------- reactions

function giggle(n = 4, pitch = 1) {
  for (let i = 0; i < n; i++) setTimeout(() => { sfx._tone((760 - (i % 2) * 90) * pitch, 0.09, 'triangle', 0.16, 1.25); }, i * 120);
}

function sparkle(cx, cy, n = 10) {
  for (let i = 0; i < n; i++) {
    const s = document.body.appendChild(el('div', 'spark', '✦'));
    s.style.left = cx + 'px'; s.style.top = cy + 'px';
    s.style.color = ['#ffd23f', '#ff8fb1', '#7fdcff', '#ffffff'][i % 4];
    const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 50;
    s.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1.1)`, opacity: 0 }],
      { duration: 650 + Math.random() * 300, easing: 'ease-out' }).finished.then(() => s.remove());
  }
}

/** A tickle: a feather wiggles at the touch, the touched part bulges, and the giant squirms toward it. */
async function tickle(part, x, y, big) {
  const r = giant.getBoundingClientRect(), k = r.width / IMG_W;
  const sx = r.left + x * k, sy = r.top + y * k;
  const f = document.body.appendChild(el('div', 'feather', '🪶'));
  f.style.left = sx + 'px'; f.style.top = sy + 'px';
  f.animate([{ transform: 'translate(-30%,-70%) rotate(-30deg)' }, { transform: 'translate(-30%,-70%) rotate(20deg)' }, { transform: 'translate(-30%,-70%) rotate(-30deg)' }],
    { duration: 260, iterations: 3 }).finished.then(() => f.remove());
  // the part itself: a copy of that bit of the picture pops out and wiggles
  const z = part && part !== 'body' ? ZONES.find((q) => q.part === part).rects.find(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d) : null;
  const [a, b, c, d] = z || [x - 45, y - 45, x + 45, y + 45];
  const bulge = el('div', 'bulge');
  Object.assign(bulge.style, {
    left: a / IMG_W * 100 + '%', top: b / IMG_H * 100 + '%', width: (c - a) / IMG_W * 100 + '%', height: (d - b) / IMG_H * 100 + '%',
    backgroundSize: `${IMG_W / (c - a) * 100}% ${IMG_H / (d - b) * 100}%`,
    backgroundPosition: `${a / (IMG_W - (c - a)) * 100}% ${b / (IMG_H - (d - b)) * 100}%`,
  });
  giant.appendChild(bulge);
  bulge.animate([{ transform: 'scale(1) rotate(0)' }, { transform: `scale(${big ? 1.3 : 1.15}) rotate(-6deg)` }, { transform: 'scale(1.05) rotate(5deg)' }, { transform: `scale(${big ? 1.2 : 1.1}) rotate(-3deg)` }, { transform: 'scale(1) rotate(0)' }],
    { duration: big ? 800 : 550, easing: 'ease-in-out' }).finished.then(() => bulge.remove());
  // the whole giant squirms, pivoting at the touched part
  giant.style.transformOrigin = `${x / IMG_W * 100}% ${y / IMG_H * 100}%`;
  if (big) {
    sparkle(sx, sy, 12);
    giggle(5 + Math.min(laughs, 4), 1 + Math.min(laughs, 6) * 0.03);
    await animate(giant, [{ transform: 'none' }, { transform: 'scale(1.04,.95) rotate(-2deg)' }, { transform: 'scale(.97,1.04) rotate(2deg)' }, { transform: 'scale(1.03,.97) rotate(-1.5deg)' }, { transform: 'none' }], { duration: 800, fill: 'none' });
    giant.style.transform = ''; // the engine keeps the end pose inline, which would mask .collapsed
  } else {
    sfx.boing();
    await animate(giant, [{ transform: 'none' }, { transform: 'rotate(1.5deg) scale(.99)' }, { transform: 'rotate(-1deg)' }, { transform: 'none' }], { duration: 450, fill: 'none' });
    giant.style.transform = '';
  }
}

// ---------------------------------------------------------------- turns

const wordOf = (part) => words[part];

async function ask() { await audio.play(wordOf(turn.part).audio); }

async function onGiantTap(e) {
  if (shell.locked || !turn || turn.busy) return;
  const h = hit(e.clientX, e.clientY);
  if (!h.part) return;                       // a tap on the sky does nothing
  turn.busy = true;
  shell.lock();
  // a knee, a thigh or a toenail is part of the leg: when the leg is asked, a tap there is right
  const right = h.part === turn.part || (turn.part === 'leg' && OF_LEG.includes(h.part));
  if (right) {
    laughs++;
    const t = tickle(h.part, h.x, h.y, true);
    await sleep(350);
    await audio.play(wordOf(turn.part).audio);
    await t;
    await sleep(200);
    turn.busy = false;
    if (speed) return speedNext();
    return finishTurn();
  }
  if (!speed && !turn.missed && !turn.teaching) queue.miss();
  turn.missed = true;
  const t = tickle(h.part, h.x, h.y, false);
  if (wordOf(h.part)) { await sleep(200); await audio.play(wordOf(h.part).audio); }
  await t;
  await sleep(350);
  turn.busy = false;
  await shell.prompt(ask);
}

async function finishTurn() {
  const clean = !turn.missed;
  if (turn.teaching) firstTurn = false;
  else {
    queue.done();
    memory.seen(wordOf(turn.part).id, clean);
    if (clean) {
      const r = giant.getBoundingClientRect();
      confetti(r.left + r.width / 2, Math.max(80, r.top + r.height * 0.2), 20);
      strip.add('<span class="star">⭐</span>');
    }
  }
  await sleep(300);
  nextTurn();
}

async function startTurn(part, teaching = false) {
  turn = { part, missed: false, teaching };
  const v = viewFor(part);
  if (v !== view) await setView(v);
  await sleep(300);
  await shell.prompt(ask);
  if (teaching) {
    const z = ZONES.find((q) => q.part === part).rects[0];
    const r = giant.getBoundingClientRect(), k = r.width / IMG_W;
    const dot = document.body.appendChild(el('div', 'ghost-target'));
    Object.assign(dot.style, { left: r.left + (z[0] + z[2]) / 2 * k + 'px', top: r.top + (z[1] + z[3]) / 2 * k + 'px' });
    await ghost.tap(dot);
    dot.remove();
  }
}

function nextTurn() {
  if (firstTurn) return startTurn(path.active ? parts[0] : 'hair', true);
  const part = queue.next();
  if (!part || queue.finished) {
    turn = null;
    return queue.clean >= goal && path.pickLevel([false, true, true]) ? speedRound() : goodbye();
  }
  startTurn(part);
}

// ---------------------------------------------------------------- the speed round (unscored)

async function speedRound() {
  await setView('whole');
  // three quick tickles on big parts, nothing scored: each one makes the giant bounce harder, building visibly to
  // the collapse (a longer unscored round, after the stars were full, felt to a player like a game that never ends)
  // only parts asked in the whole view, so the round never pauses to zoom
  // (on a wide screen no part may be big enough in the whole view: then the big parts, zooming as needed)
  const whole = parts.filter((p) => viewFor(p) === 'whole');
  speed = { list: shuffle(whole.length >= 2 ? whole : parts.filter((p) => EASY.includes(p))).slice(0, 3), i: 0 };
  giant.style.setProperty('--wobble', '0');
  document.body.classList.add('speedy');
  sfx.drum(1.2); await sleep(180); sfx.drum(1.5); await sleep(400);
  speedNext();
}

async function speedNext() {
  giant.style.setProperty('--wobble', String(speed.i)); // 0, 1, 2: the bounce grows with each tickle
  if (speed.i >= speed.list.length) return collapse();
  turn = { part: speed.list[speed.i++], missed: false };
  const v = viewFor(turn.part);
  if (v !== view) await setView(v);
  await shell.prompt(ask);
}

async function collapse() {
  turn = null;
  shell.lock();
  if (view !== 'whole') await setView('whole');
  document.body.classList.remove('speedy');
  giant.style.transformOrigin = '50% 62%';
  for (let i = 0; i < 3; i++) { giggle(6, 1.1 + i * 0.05); await animate(giant, [{ transform: 'none' }, { transform: 'scale(1.05,.93) rotate(-3deg)' }, { transform: 'scale(.96,1.05) rotate(3deg)' }, { transform: 'none' }], { duration: 600, fill: 'none' }); }
  giant.style.transform = ''; // an inline transform left by the squirms would override .collapsed
  sfx.bump();
  giant.classList.add('collapsed');
  await sleep(1000);
  giggle(8, 0.9);
  confetti(innerWidth / 2, innerHeight * 0.6, 50);
  await sleep(1200);
  giggle(8, 0.85);
  await sleep(1400);
  speed = null;
  goodbye();
}

function goodbye() {
  shell.unlock(); shell.clearIdle();
  finale(`<div class="finale-pic"><img src="../art/giant.png" alt=""></div>`, () => { giant.classList.remove('collapsed'); startRound(); });
}

function startRound() {
  laughs = 0;
  setView('whole', true);
  if (path.active) {
    // the step's parts first; the rest from the big parts before the small ones. Level 1: three parts (the
    // big ones unless a small one is the step's word), a short round and no speed round; level 2: five parts.
    const pool = [...EASY, ...HARD].map((p) => words[p]).filter((w) => w && fit.canUse(w));
    const rest = [...shuffle(EASY), ...shuffle(HARD)].map((p) => words[p]).filter((w) => pool.includes(w));
    parts = path.choose(pool, path.pickLevel([3, 5, 7]), rest).map((w) => partOf[w.id]);
    goal = path.pickLevel([4, 6, ROUND]);
    const bigFirst = (a) => [...a.filter((p) => EASY.includes(p)), ...a.filter((p) => !EASY.includes(p))];
    queue = new Queue([...bigFirst(shuffle(parts)), ...shuffle(parts), ...(parts.length < 4 ? shuffle(parts) : [])], { cleanToWin: goal });
  } else {
    parts = [...EASY, ...HARD].filter((p) => words[p]); goal = ROUND;
    const easy = shuffle(EASY.filter((p) => words[p])), all = shuffle(parts);
    queue = new Queue([...easy, ...all], { cleanToWin: ROUND });
  }
  strip = progressStrip(shell, goal, '⭐');
  nextTurn();
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    words = Object.fromEntries(Object.entries(WORDS).map(([part, id]) => [part, content.byId[id]]));
    audio.preload(Object.values(words).filter(Boolean).map((w) => w.audio));
    if (img.complete) loadAlpha(); else img.addEventListener('load', loadAlpha, { once: true });
    startRound();
  },
  replay: () => turn && ask(),
});
setView('whole', true);
onTap(giant, onGiantTap);

// Keyboard: one invisible box per part (every part, nose included, so the list gives nothing away); the arrows move
// a highlight between the parts in view and Space or Enter tickles there, exactly like a tap at the box's centre.
const keyZones = ZONES.map((z) => {
  const [a, b, c, d] = z.rects[z.part === 'leg' ? 1 : 0];
  const k = giant.appendChild(el('div', 'key-zone'));
  Object.assign(k.style, { left: a / IMG_W * 100 + '%', top: b / IMG_H * 100 + '%', width: (c - a) / IMG_W * 100 + '%', height: (d - b) / IMG_H * 100 + '%' });
  k.dataset.choice = z.part;
  k.__tap = () => { const r = k.getBoundingClientRect(); onGiantTap({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }); };
  return k;
});
shell.choices = () => keyZones.filter((k) => { const r = k.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; });

// for scripted play-throughs (tools/devcheck)
window.__game = {
  get locked() { return shell.locked || !turn || !!turn.busy; },
  get finished() { return !!document.querySelector('.finale'); },
  get target() { return turn?.part ?? null; },
  get view() { return view; },
  get speed() { return !!speed; },
  get clean() { return queue?.clean ?? 0; },
  get words() { return (parts || []).map((p) => WORDS[p]); },
  /** screen point at the middle of a part's first zone */
  point(part) {
    const z = ZONES.find((q) => q.part === part).rects[part === 'leg' ? 1 : 0];
    const r = giant.getBoundingClientRect(), k = r.width / IMG_W;
    return { x: r.left + (z[0] + z[2]) / 2 * k, y: r.top + (z[1] + z[3]) / 2 * k };
  },
  tap(part) { const p = this.point(part); onGiantTap({ clientX: p.x, clientY: p.y }); },
  tapAt(x, y) { onGiantTap({ clientX: x, clientY: y }); },
  /** move to the view a part is asked in; tickle the middle of its first zone as a tap would (no turn); */
  show(part) { return setView(viewFor(part)); },
  tickleAt(part) { const p = this.point(part), h = hit(p.x, p.y); return tickle(h.part, h.x, h.y, true).then(() => h.part); },
  zones: ZONES, IMG_W,
};
