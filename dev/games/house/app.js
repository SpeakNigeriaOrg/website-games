// Wake the House: tap a sleeping thing in a home scene; it wakes, colours in, bounces and says its name.
// A second tap says it slowly, one bounce per syllable (a word without syllable clips is said again). Taps during playback wait their turn (queued, never
// stacked). If the child is idle the next sleeper snores. When everything is awake the room dances and the
// things say their names in a round. No wrong answer: this introduces home words.
import { loadContent, createShell, audio, sfx, onTap, memory, animate, confetti, ghost, finale, sleep, el, centre, path } from '../engine/engine.js';
import { fit, ROOMS, usable } from './fit.js';

const $ = (id) => document.getElementById(id);
const thingsEl = $('things'), bg = $('bg'), room = $('room');

let content, roomIndex = 0, things = [], tasks = [], busy = false, lastWoken = null, demoDone = false, celebrating = false;

// ------------------------------------------------------------ layout

/** Spread the things over the room: two rows in landscape, two columns in portrait, rows staggered. */
function layout() {
  const W = innerWidth, H = innerHeight, n = things.length;
  const landscape = W > H;
  const cols = landscape ? Math.ceil(n / 2) : 2;
  const rows = Math.ceil(n / cols);
  // keep clear of the replay button (bottom-left): a margin below in portrait, to the left in landscape
  const top = landscape ? 30 : 60, bottom = landscape ? 26 : 100, left = landscape ? 100 : 12, right = 12;
  const size = Math.min((W - left - right) / cols * 0.8, (H - top - bottom) / rows * 0.84, 260);
  things.forEach((t, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const inRow = Math.min(cols, n - r * cols);
    const cellW = (W - left - right) / inRow;
    const stagger = (r % 2 ? 0.12 : -0.12) * size * (landscape ? 0 : 1);
    const x = left + cellW * (c + 0.5) + stagger;
    const y = top + (H - top - bottom) * ((r + 0.5) / rows) + ((c % 2) ? size * 0.06 : -size * 0.06);
    Object.assign(t.el.style, { left: x + 'px', top: y + 'px', width: size + 'px', height: size + 'px' });
  });
}
addEventListener('resize', layout);

// ------------------------------------------------------------ things

/** From the learning path: the room holding most of the step's words, with fewer things at the lower levels.
 * Focus things come first (the demo wakes one); a focus thing from another room joins this one. */
function pathRoom() {
  const score = (r) => r.words.filter((id) => path.focus.includes(id)).length * 10 + r.words.filter((id) => path.review.includes(id)).length;
  roomIndex = ROOMS.indexOf(ROOMS.reduce((best, r) => (score(r) > score(best) ? r : best)));
  const own = ROOMS[roomIndex].words.map((id) => content.byId[id]).filter((w) => w && fit.canUse(w));
  const extra = [...path.focus, ...path.review].map((id) => content.byId[id]).filter((w) => w && fit.canUse(w) && !own.includes(w));
  const pool = [...own, ...extra], focusN = pool.filter((w) => path.focus.includes(w.id)).length;
  return path.choose(pool, path.pickLevel([Math.max(3, focusN), Math.max(4, focusN), Math.max(own.length, focusN)]), own);
}

function buildRoom() {
  const words = path.active ? pathRoom() : ROOMS[roomIndex % ROOMS.length].words.map((id) => content.byId[id]).filter(usable);
  bg.src = ROOMS[roomIndex % ROOMS.length].bg;
  thingsEl.innerHTML = '';
  lastWoken = null; tasks = []; celebrating = false;
  things = words.map((word, i) => {
    const node = el('button', 'thing asleep', `
      <div class="card"><img src="${word.image}" alt=""></div>
      <div class="zzz" aria-hidden="true"><span>z</span><span>z</span><span>Z</span></div>`);
    node.setAttribute('aria-label', 'sleeping thing');
    node.dataset.choice = ''; // keyboard: arrows move between the things, Space or Enter taps one
    node.style.setProperty('--tilt', (i % 2 ? 4 : -4) + 'deg');
    thingsEl.appendChild(node);
    const t = { word, el: node, awake: false, willWake: false };
    onTap(node, () => tapThing(t));
    return t;
  });
  layout();
  audio.preload(things.flatMap((t) => [t.word.audio, ...t.word.syllables.map((s) => s.audio)]));
}

function tapThing(t) {
  if (celebrating || shell.locked) return;
  sfx.tap();
  if (tasks.length >= 3) return; // a handful queued is plenty; more taps would only pile up
  if (!t.willWake) { t.willWake = true; tasks.push(() => wake(t)); }
  else tasks.push(() => sayslow(t));
  run();
}

async function run() {
  if (busy) return;
  busy = true;
  while (tasks.length) await tasks.shift()();
  busy = false;
  shell.armIdle();
  if (things.length && things.every((t) => t.awake) && !celebrating) celebrate();
}

const bounce = (node, h = 26, ms = 420) => animate(node, [
  { transform: 'translate(-50%,-50%) scale(1,1)' },
  { transform: 'translate(-50%,-50%) translateY(4px) scale(1.12,.86)', offset: 0.15 },
  { transform: `translate(-50%,-50%) translateY(-${h}px) scale(.94,1.08)`, offset: 0.5 },
  { transform: 'translate(-50%,-50%) translateY(2px) scale(1.08,.92)', offset: 0.85 },
  { transform: 'translate(-50%,-50%) scale(1,1)' }], { duration: ms, easing: 'ease-in-out', fill: 'none' });

async function wake(t) {
  t.el.classList.remove('asleep', 'snoring');
  t.el.classList.add('awake', 'waking');
  t.el.setAttribute('aria-label', 'thing');
  sfx.pop();
  const c = centre(t.el);
  confetti(c.x, c.y, 14);
  t.awake = true;
  lastWoken = t;
  memory.seen(t.word.id, true);
  bounce(t.el, 40, 600);
  await audio.play(t.word.audio);
  t.el.classList.remove('waking');
  await sleep(150);
}

async function sayslow(t) {
  lastWoken = t;
  t.el.classList.add('speaking');
  // a word recorded without a slow take (no syllable clips) is said again, with one bounce
  if (!t.word.syllables.length) { bounce(t.el, 22, 360); await audio.play(t.word.audio); }
  else await audio.sequence(t.word.syllables.map((s) => s.audio), 160, () => bounce(t.el, 22, 360));
  await sleep(150);
  t.el.classList.remove('speaking');
}

async function sayNatural(t) {
  t.el.classList.add('speaking');
  bounce(t.el, 30, 500);
  await audio.play(t.word.audio);
  t.el.classList.remove('speaking');
}

function snore(t) {
  if (!t) return;
  t.el.classList.add('snoring');
  sfx._noise(0.9, 0.05, 420, 180);
  setTimeout(() => sfx._noise(0.7, 0.035, 300, 160), 1000);
  setTimeout(() => t.el.classList.remove('snoring'), 2200);
}
const nextSleeper = () => things.find((t) => !t.willWake);

async function celebrate() {
  celebrating = true;
  shell.lock();
  await sleep(400);
  sfx.cheer();
  room.classList.add('dancing');
  things.forEach((t, i) => t.el.style.setProperty('--delay', (i * 0.12) + 's'));
  await sleep(900);
  for (const t of things) { await sayNatural(t); await sleep(220); }
  await sleep(500);
  room.classList.remove('dancing');
  shell.unlock();
  shell.clearIdle();
  finale(`<div class="finale-pics">${things.map((t) => `<img src="${t.word.image}" alt="">`).join('')}</div>`, () => {
    if (!path.active) roomIndex++; // a path step stays in its room
    buildRoom();
  });
}

async function demo() {
  demoDone = true;
  const t = things[0];
  await shell.prompt(async () => {
    await sleep(500);
    await ghost.tap(t.el);
  });
  tapThing(t);
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    buildRoom();
    window.__game = { get things() { return things; }, tapThing, get busy() { return busy; }, get tasks() { return tasks.length; },
      get celebrating() { return celebrating; }, get room() { return roomIndex; }, layout,
      get words() { return things.map((t) => t.word.id); },
      showRoom(i) { roomIndex = i; buildRoom(); }, rooms: ROOMS.length };
    if (!demoDone) await demo();
  },
  replay: async () => { if (lastWoken) await sayNatural(lastWoken); else snore(nextSleeper()); },
  onIdle: () => { snore(nextSleeper()); shell.armIdle(7000); },
});
