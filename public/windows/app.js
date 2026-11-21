// Windows: who does what, from two words. A house with windows (2 at level 1, 3, then 4); in each window an
// animal is doing something (its clip, or its still moving gently). The narrator says two words, animal then
// action ("ajá ... sùn"); the child taps the window showing that pair. Every other window shares one of the two
// words with the asked pair (the same animal doing something else, or another animal doing the same thing), so
// both words matter; at level 1 there is one other window, differing in the animal only. Right: that window's
// animal cheers (it bounces, the two words again), a star. Wrong: the tapped window says its own two words, the
// right window glows, the asked pair plays again and the child taps it; the pair returns two turns later. Only
// first tries fill the strip. The first pair of a session is shown by the ghost hand. The audio is two single words,
// never a spliced sentence. Demand: composition (subject + action), heard and recognised.
import { loadContent, createShell, audio, sfx, onTap, Queue, progressStrip, animate, confetti, ghost, finale, shuffle, sleep, el, centre, path } from '../engine/engine.js';
import { fit } from './fit.js';
import { SUBJECTS, ACTIONS, ACTION_APART, GRID_BY_LEVEL, combo, portrait, apartOk, isSubject, isAction } from '../combo.js';
import { scene, artUrl } from '../combo_scene.js';

// By path level (1 first meeting, 2 practice, 3 the full game): animals x actions in the round, windows, clean turns.
const [N_SUBJECTS, N_ACTIONS] = path.pickLevel(GRID_BY_LEVEL);
const N_WINDOWS = path.pickLevel([2, 3, 4]);
const ROUNDS = path.pickLevel([4, 6, 8]);
// The pane inside the window frame picture (fractions of the frame: x, y, w, h), measured on the chosen art.
const PANE = [0.18, 0.082, 0.64, 0.843]; // the hole, a little under the frame on every side
const FRAME_ASPECT = 823 / 622; // the frame picture's width / height (replaced by the image's own once loaded)

const $ = (id) => document.getElementById(id);
const bg = $('bg'), winsEl = $('windows');

let content, subjects = [], actions = [], wins = [], queue, strip, turn = null, firstTurn = true, teachPair = null, turnNo = 0, frameAspect = FRAME_ASPECT;

// ---------------------------------------------------------------- layout

// The plain wall in each house picture, in its own pixels: below the roof's eaves, above the door's top, inside the
// corners (measured on the art). Windows go only there, so none sits on the roof or the door (owner, 2026-11-20).
const WALLS = {
  tall: { src: '../art/house_wall_tall.png', w: 832, h: 1216, top: 367, bottom: 818, left: 0, right: 831 },
  wide: { src: '../art/house_wall_wide.png', w: 1216, h: 832, top: 253, bottom: 550, left: 45, right: 1171 },
};

/** The wall's rectangle on screen: the background is drawn with object-fit: cover at object-position 50% 30%. */
function wallOnScreen(wall, W, H) {
  const s = Math.max(W / wall.w, H / wall.h), ox = (W - wall.w * s) * 0.5, oy = (H - wall.h * s) * 0.3;
  return { top: oy + wall.top * s, bottom: oy + wall.bottom * s, left: ox + wall.left * s, right: ox + wall.right * s };
}

/** The windows on the wall in the grid that makes them biggest, clear of the progress strip and the replay button. */
function layout() {
  const W = innerWidth, H = innerHeight, landscape = W > H, wall = landscape ? WALLS.wide : WALLS.tall;
  bg.src = wall.src;
  if (!wins.length) return;
  const onWall = wallOnScreen(wall, W, H), pad = 12, gap = 14;
  const top = Math.max(64, onWall.top + pad), bottom = Math.min(H - (landscape ? 16 : 100), onWall.bottom - pad);
  const left = Math.max(landscape ? 96 : 10, onWall.left + pad), right = Math.min(W - (landscape ? 96 : 10), onWall.right - pad);
  const n = wins.length;
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const w = Math.min((right - left - gap * (cols - 1)) / cols, ((bottom - top - gap * (rows - 1)) / rows) * frameAspect);
    if (!best || w > best.w) best = { cols, rows, w };
  }
  const { cols, rows, w } = best, h = w / frameAspect;
  const y0 = top + (bottom - top - rows * h - gap * (rows - 1)) / 2;
  wins.forEach((win, i) => {
    const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), c = i % cols;
    const x0 = (left + right) / 2 - (inRow * w + gap * (inRow - 1)) / 2;
    Object.assign(win.el.style, { left: x0 + c * (w + gap) + 'px', top: y0 + r * (h + gap) + 'px', width: w + 'px', height: h + 'px' });
  });
}
addEventListener('resize', layout);

// ---------------------------------------------------------------- the round

/** The round's animals and actions: the step's words first, then the games' own order (most different first). */
function buildRound() {
  const sPool = SUBJECTS.map((s) => content.byId[s.id]).filter((w) => w && isSubject(w));
  const aPool = ACTIONS.map((a) => content.byId[a.id]).filter((w) => w && isAction(w));
  subjects = path.choose(sPool, Math.max(N_SUBJECTS, Math.min(sPool.length, path.usable(sPool).length)), sPool);
  actions = path.choose(aPool, Math.max(N_ACTIONS, Math.min(aPool.length, path.usable(aPool).length)), aPool);
  if (!apartOk(actions)) {
    const forced = actions.filter((w) => path.focus.includes(w.id) || path.review.includes(w.id));
    if (forced.length < 2) { const keep = forced[0] ?? actions[0]; actions = [keep, aPool.find((w) => w !== keep && apartOk([keep, w]))]; }
  }
  audio.preload([...subjects, ...actions].map((w) => w.audio));
  for (const s of subjects) for (const a of actions) new Image().src = artUrl(combo(s.id, a.id).still);
}

/** The pairs asked: every pair of the grid once (the step's words first), then a mix; never the same twice running. */
function chooseTurns() {
  const pairs = [];
  for (const s of subjects) for (const a of actions) pairs.push({ s, a });
  const step = (p) => path.focus.includes(p.s.id) || path.focus.includes(p.a.id);
  const out = [...shuffle(pairs.filter(step)), ...shuffle(pairs.filter((p) => !step(p)))].slice(0, ROUNDS);
  while (out.length < ROUNDS) { const p = pairs[Math.floor(Math.random() * pairs.length)]; if (p !== out.at(-1)) out.push(p); }
  return out;
}

const close = (a, b) => ACTION_APART.some(([x, y]) => (a.id === x && b.id === y) || (a.id === y && b.id === x));

/** The other windows: each shares the animal or the action with the asked pair. Level 1: another animal doing the
 * same thing. Later: a mix of both kinds (sáré and rìn told apart only from level 3). */
function foilsFor(t) {
  const sameAction = shuffle(subjects.filter((s) => s !== t.s)).map((s) => ({ s, a: t.a }));
  const sameSubject = shuffle(actions.filter((a) => a !== t.a && (path.level >= 3 || !close(a, t.a)))).map((a) => ({ s: t.s, a }));
  if (path.level === 1 || !sameSubject.length) return sameAction.slice(0, N_WINDOWS - 1);
  const out = [];
  // alternate the two kinds, starting with a random one, so both words matter in every turn
  const lists = Math.random() < 0.5 ? [sameAction, sameSubject] : [sameSubject, sameAction];
  for (let i = 0; out.length < N_WINDOWS - 1 && (lists[0].length || lists[1].length); i++) { const l = lists[i % 2]; if (l.length) out.push(l.shift()); }
  return out;
}

// ---------------------------------------------------------------- windows

function makeWindows(pairs) {
  for (const w of wins) w.scene.stop();
  winsEl.innerHTML = '';
  wins = pairs.map((p) => {
    const node = el('button', 'win', `<div class="pane"></div><img class="frame" src="../art/window_frame.png" alt="">`);
    node.dataset.choice = '';
    node.setAttribute('aria-label', 'window');
    const pane = node.querySelector('.pane');
    Object.assign(pane.style, { left: PANE[0] * 100 + '%', top: PANE[1] * 100 + '%', width: PANE[2] * 100 + '%', height: PANE[3] * 100 + '%' });
    const sc = scene(combo(p.s.id, p.a.id), { loop: true });
    pane.appendChild(sc.node);
    winsEl.appendChild(node);
    const win = { ...p, el: node, scene: sc };
    onTap(node, () => tapWindow(win));
    return win;
  });
  layout();
  for (const w of wins) w.scene.play();
}

async function sayPair(s, a, win) {
  win?.el.classList.add('speaking');
  await audio.play(s.audio);
  await sleep(380);
  await audio.play(a.audio);
  win?.el.classList.remove('speaking');
}

const canAct = () => !!turn && !turn.busy && !shell.locked;
const isRight = (win) => win.s === turn.s && win.a === turn.a;

async function tapWindow(win) {
  if (!canAct()) return;
  turn.busy = true;
  shell.lock();
  if (isRight(win)) await right(win);
  else await wrong(win);
}

async function right(win) {
  sfx.cheer();
  win.el.classList.remove('glow');
  win.el.classList.add('cheer');
  const c = centre(win.el);
  if (!turn.teaching) {
    const clean = queue.done();
    if (clean) { strip.add(); confetti(c.x, c.y, 26); }
  } else firstTurn = false;
  await sleep(200);
  await sayPair(win.s, win.a, win);
  await sleep(700);
  win.el.classList.remove('cheer');
  turn = null;
  nextTurn();
}

/** Not this one: the tapped window says its own pair, the right one glows, the asked pair again; tap it. */
async function wrong(win) {
  sfx.boing();
  win.el.classList.add('nope');
  await sleep(450);
  win.el.classList.remove('nope');
  await sayPair(win.s, win.a, win);
  await sleep(300);
  if (!turn.teaching && !turn.missed) queue.miss();
  turn.missed = true; turn.misses++;
  const target = wins.find(isRight);
  target.el.classList.add('glow');
  turn.busy = false;
  await shell.prompt(() => sayPair(turn.s, turn.a));
}

// ---------------------------------------------------------------- turns

async function nextTurn() {
  let pair, teaching = false;
  if (firstTurn) { pair = teachPair; teaching = true; }
  else {
    pair = queue.next();
    if (!pair || queue.finished) return endRound();
  }
  turnNo++;
  turn = { s: pair.s, a: pair.a, teaching, busy: true, missed: false, misses: 0 };
  shell.lock();
  // the windows close and open on new scenes
  winsEl.classList.add('shut');
  await sleep(350);
  makeWindows(shuffle([pair, ...foilsFor(pair)]));
  winsEl.classList.remove('shut');
  await sleep(500);
  turn.busy = false;
  if (teaching) await shell.prompt(async () => { await sayPair(turn.s, turn.a); await sleep(300); await ghost.tap(wins.find(isRight).el); await sleep(200); await sayPair(turn.s, turn.a); });
  else await shell.prompt(() => sayPair(turn.s, turn.a));
}

function endRound() {
  turn = null;
  shell.clearIdle();
  // everyone leans out of the windows
  finale(`<div class="fin-cast">${subjects.map((w, i) => `<img src="${artUrl(portrait(w.id))}" alt="" style="animation-delay:${i * 0.15}s">`).join('')}</div>`, startRound);
}

function startRound() {
  buildRound();
  const turns = chooseTurns();
  if (firstTurn) { teachPair = turns[0]; turns.push(turns.shift()); }
  queue = new Queue(turns, { cleanToWin: ROUNDS });
  strip = progressStrip(shell, ROUNDS, '⭐');
  nextTurn();
}

const frameImg = new Image();
frameImg.src = '../art/window_frame.png';
frameImg.decode().then(() => { frameAspect = frameImg.naturalWidth / frameImg.naturalHeight; layout(); }).catch(() => {});

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    startRound();
  },
  replay: () => (turn ? sayPair(turn.s, turn.a) : Promise.resolve()),
  // idle: the pair again; on the teaching turn the ghost hand shows the tap again too
  onIdle: async () => { await shell.doReplay(); if (turn?.teaching && !shell.locked) await shell.prompt(() => ghost.tap(wins.find(isRight).el)); },
});
layout();

// for scripted play-throughs (tools/devcheck)
window.__game = {
  get locked() { return shell.locked || !turn || !!turn.busy; },
  get finished() { return !turn && !!document.querySelector('.finale'); },
  get want() { return turn ? { subject: turn.s.id, action: turn.a.id } : null; },
  get teaching() { return !!turn?.teaching; },
  get turnNo() { return turnNo; },
  get clean() { return queue?.clean ?? 0; },
  get total() { return ROUNDS; },
  get words() { return [...subjects, ...actions].map((w) => w.id); },
  get windows() { return wins.map((w) => ({ subject: w.s.id, action: w.a.id, name: w.scene.combo.name, video: w.scene.hasVideo })); },
  rightEl() { return wins.find((w) => turn && isRight(w))?.el; },
  wrongEl() { return wins.find((w) => turn && !isRight(w))?.el; },
  windowEls() { return wins.map((w) => w.el); },
};
