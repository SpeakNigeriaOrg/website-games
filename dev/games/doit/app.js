// Do It!: commands understood by doing them, with the "don't" trap.
// One object glows (the glow says WHICH object; only the words say WHAT to do). The command plays with
// input locked, then a ring around the object starts closing. The child acts on the object:
//   dìí mú (hold it)            press and hold until the small ring fills (0.8 s): the object lifts
//   nù ú (wipe it)              rub back and forth on it: it sparkles clean
//   sọ ọ́ nù (throw it away)     fling it, or drag it into the basket: it lands in the basket
//   fi sílẹ̀ (put it down)        drag it onto the mat on the floor: it rests there
//   má fọwọ́ kàn án (don't touch) keep hands off until the ring closes
// The world always does exactly what the child did. Waiting until the ring closes is itself an action
// ("I didn't touch it"), so on a positive command waiting is a miss, and waiting can't be used to probe.
// Match: cheer, the command replays over the action, a star. Mismatch: the action plays, the object comes
// back, the command repeats, one retry; a second miss gets a ghost-hand demonstration. A first miss costs a
// star (a miss knocks the last star off), so random acting doesn't fill the strip.
// Levels: 1 = hold vs don't (default); 2 = wipe vs throw vs don't; 3 (optional) = all five.
// From the learning path the step's commands are played, with "don't" as the other choice: 2 commands and 4 stars
// at level 1, 3 commands and 5 stars at level 2, all five at level 3. The path never moves the stored level.
import { loadContent, createShell, audio, sfx, Queue, memory, confetti, centre, finale, shuffle, sleep, el, path } from '../engine/engine.js';
import { fit, CMDS, LEVELS } from './fit.js';

const GOAL = 6;          // stars in a round
const WINDOW_MS = 4000;  // the ring: time to act (same on every turn, so its length tells nothing)
const HOLD_MS = 800;
const params = new URLSearchParams(location.search);

// Objects on the table, in % of the room column. Plain, neutral things: none of them looks like it wants
// one particular action (no soap that asks to be wiped, no stone that asks to be thrown).
const THINGS = [
  { id: 'ogede_banana', x: 31, y: 52 },
  { id: 'osan_orange', x: 50, y: 52 },
  { id: 'sibi_spoon', x: 69, y: 52 },
];

const $ = (id) => document.getElementById(id);
const column = $('column'), room = $('room'), thingsEl = $('things'), mat = $('mat'), bin = $('bin');

let content, things, queue, turn, phase = 'idle', attempts = 0, stars = 0, level, keys = [], goal = GOAL, g = null, windowTimer = null, holdTimer = null;
const taught = new Set();

const store = {
  get() { try { return +localStorage.getItem('doit-level') || 1; } catch { return 1; } },
  set(n) { try { localStorage.setItem('doit-level', String(n)); } catch {} },
};

// ---------------------------------------------------------------- layout: the scene is the picture's box, cover-fitted into the column

const BG = { w: 832, h: 1216 };
function fitScene() {
  const r = column.getBoundingClientRect();
  const k = Math.max(r.width / BG.w, r.height / BG.h);
  Object.assign(room.style, { width: BG.w * k + 'px', height: BG.h * k + 'px', left: (r.width - BG.w * k) / 2 + 'px', top: (r.height - BG.h * k) + 'px' }); // bottom-aligned: the floor and the table stay in view
}
addEventListener('resize', fitScene);
fitScene();

// ---------------------------------------------------------------- helpers

async function tween(node, frames, opts) {
  const a = node.animate(frames, { duration: 400, easing: 'ease-out', fill: 'forwards', ...opts });
  await a.finished;
  try { a.commitStyles(); } catch {}
  a.cancel();
}
const pct = (x, y) => { const r = room.getBoundingClientRect(); return { x: (x - r.left) / r.width * 100, y: (y - r.top) / r.height * 100 }; };
const inside = (node, x, y) => { const r = node.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
const place = (t, x, y) => { t.el.style.left = x + '%'; t.el.style.top = y + '%'; t.pos = { x, y }; };
const say = () => audio.play(turn.cmd.audio);

function sparkle(x, y, char = '✨') {
  const s = document.body.appendChild(el('div', 'sparkle', char));
  s.style.left = x + 'px'; s.style.top = y + 'px';
  s.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: `translate(-50%,-150%) scale(1.2) rotate(${Math.random() * 90 - 45}deg)`, opacity: 0 }], { duration: 700 }).finished.then(() => s.remove());
}

// ---------------------------------------------------------------- stars (a miss knocks the last one off)

function buildStars() {
  shell.progressEl.innerHTML = '';
  for (let i = 0; i < goal; i++) shell.progressEl.appendChild(el('span', 'slot'));
  stars = 0;
}
function addStar() {
  const s = shell.progressEl.children[stars];
  if (s) { s.innerHTML = '⭐'; s.classList.add('filled'); }
  return ++stars;
}
async function loseStar() {
  if (!stars) return;
  const s = shell.progressEl.children[--stars];
  await tween(s, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(50px) rotate(90deg)', opacity: 0 }], { duration: 500 });
  s.innerHTML = ''; s.classList.remove('filled'); s.style.opacity = ''; s.style.transform = '';
}

// ---------------------------------------------------------------- the ring (time to act) and the hold ring

function ring(t, kind) { return t.el.querySelector(`.ring .${kind}`); }
function startWindow(ms = WINDOW_MS) {
  stopWindow();
  const c = ring(turn.thing, 'win');
  c.parentNode.classList.add('on');
  c.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: 100 }], { duration: ms, easing: 'linear', fill: 'forwards' });
  windowTimer = setTimeout(() => { windowTimer = null; complete('dont'); }, ms);
}
function stopWindow() {
  clearTimeout(windowTimer); windowTimer = null;
  for (const t of things || []) { const c = ring(t, 'win'); c.getAnimations().forEach((a) => a.cancel()); c.parentNode.classList.remove('on'); }
}
function fillHoldRing(t, ms = HOLD_MS) {
  const c = ring(t, 'hold');
  c.parentNode.classList.add('on');
  return c.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], { duration: ms, easing: 'linear', fill: 'forwards' });
}
function clearHoldRing(t) { const c = ring(t, 'hold'); c.getAnimations().forEach((a) => a.cancel()); }

// ---------------------------------------------------------------- what the world does (child or ghost)

const world = {
  async hold(t) {
    sfx.pop();
    t.inner.classList.add('lifted');
    await sleep(900);
    t.inner.classList.remove('lifted');
    clearHoldRing(t);
  },
  async wipe(t) {
    sfx.whoosh();
    const c = centre(t.el);
    for (let i = 0; i < 6; i++) { sparkle(c.x + (Math.random() - 0.5) * 80, c.y + (Math.random() - 0.5) * 60); await sleep(70); }
    t.inner.classList.add('shiny');
    await home(t, 250);
    await sleep(500);
    t.inner.classList.remove('shiny');
  },
  async throw(t) {
    const b = pct(centre(bin).x, centre(bin).y - bin.getBoundingClientRect().height * 0.15);
    const from = t.pos, top = Math.min(from.y, b.y) - 18;
    sfx.whoosh();
    await tween(t.el, [{ left: from.x + '%', top: from.y + '%' }, { left: (from.x + b.x) / 2 + '%', top: top + '%' }, { left: b.x + '%', top: b.y + '%' }], { duration: 550, easing: 'ease-in' });
    t.pos = b;
    t.inner.classList.add('binned');
    sfx.bump();
    bin.classList.remove('wobble'); void bin.offsetWidth; bin.classList.add('wobble');
    await sleep(600);
  },
  async put(t, at) {
    const m = mat.getBoundingClientRect();
    const target = at && inside(mat, at.x, at.y) ? pct(at.x, at.y) : pct(m.left + m.width / 2, m.top + m.height / 2);
    await tween(t.el, [{ left: t.pos.x + '%', top: t.pos.y + '%' }, { left: target.x + '%', top: target.y + '%' }], { duration: 350 });
    t.pos = target;
    sfx.drum(0.8);
    await sleep(500);
  },
  async dont(t) { sfx.soft(); await sleep(300); },
  async touch(t) { await home(t, 250); t.inner.classList.remove('jiggle'); void t.inner.offsetWidth; t.inner.classList.add('jiggle'); sfx.bump(); await sleep(400); },
};

/** Back to its place on the table (from the basket it pops back up). */
async function home(t, ms = 400) {
  if (t.inner.classList.contains('binned')) {
    t.inner.classList.remove('binned');
    place(t, t.x, t.y);
    await tween(t.inner, [{ transform: 'scale(0)' }, { transform: 'scale(1.15)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 350 });
    t.inner.style.transform = '';
    sfx.pop();
    return;
  }
  if (t.pos.x === t.x && t.pos.y === t.y) return;
  await tween(t.el, [{ left: t.pos.x + '%', top: t.pos.y + '%' }, { left: t.x + '%', top: t.y + '%' }], { duration: ms });
  place(t, t.x, t.y);
}

// ---------------------------------------------------------------- gestures on the glowing object

function bindGestures(t) {
  t.el.addEventListener('pointerdown', (e) => {
    if (phase !== 'act' || shell.locked || turn.thing !== t || g) return;
    e.preventDefault();
    stopWindow();
    try { t.el.setPointerCapture(e.pointerId); } catch {}
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, segX: e.clientX, segY: e.clientY, dirX: 0, dirY: 0, rev: 0, mode: 'press', samples: [{ x: e.clientX, y: e.clientY, t: performance.now() }], start: { ...t.pos } };
    t.inner.classList.add('pressed');
    fillHoldRing(t);
    holdTimer = setTimeout(() => { if (g && g.mode === 'press') { g = null; t.inner.classList.remove('pressed'); complete('hold'); } }, HOLD_MS);
  });
  t.el.addEventListener('pointermove', (e) => {
    if (!g || e.pointerId !== g.id) return;
    const x = e.clientX, y = e.clientY;
    g.samples.push({ x, y, t: performance.now() }); if (g.samples.length > 8) g.samples.shift();
    if (g.mode === 'press' && Math.hypot(x - g.x0, y - g.y0) > 14) { g.mode = 'move'; clearTimeout(holdTimer); clearHoldRing(t); }
    if (g.mode !== 'move') return;
    // the object goes where the finger goes
    const r = room.getBoundingClientRect();
    place(t, g.start.x + (x - g.x0) / r.width * 100, g.start.y + (y - g.y0) / r.height * 100);
    // rubbing: count direction reversals of at least 16 px, on either axis
    for (const [p, seg, dir] of [[x, 'segX', 'dirX'], [y, 'segY', 'dirY']]) {
      if (Math.abs(p - g[seg]) > 16) { const s = Math.sign(p - g[seg]); if (g[dir] && s !== g[dir]) { g.rev++; sparkle(x, y); } g[dir] = s; g[seg] = p; }
    }
    if (g.rev >= 4) { release(t); complete('wipe'); }
  });
  const up = (e) => {
    if (!g || e.pointerId !== g.id) return;
    const mode = g.mode, s = g.samples, at = { x: e.clientX, y: e.clientY };
    release(t);
    if (mode === 'press') return complete('touch');
    const a = s.find((p) => performance.now() - p.t < 120) || s[0], b = s[s.length - 1];
    const speed = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, b.t - a.t);
    if (inside(bin, at.x, at.y) || speed > 0.9) return complete('throw');
    if (inside(mat, at.x, at.y)) return complete('put', at);
    complete('touch');
  };
  t.el.addEventListener('pointerup', up);
  t.el.addEventListener('pointercancel', up);
}

function release(t) {
  if (g) { try { t.el.releasePointerCapture(g.id); } catch {} }
  g = null;
  clearTimeout(holdTimer);
  t.inner.classList.remove('pressed');
  if (!t.inner.classList.contains('lifted')) clearHoldRing(t);
}

// ---------------------------------------------------------------- judging

async function complete(action, at) {
  if (phase !== 'act') return;
  phase = 'busy';
  stopWindow();
  const t = turn.thing;
  shell.lock();
  // an unfinished gesture (a tap, a drag to nowhere) is only an action when the command was "don't touch"
  if (action === 'touch' && turn.key !== 'dont') {
    await world.touch(t);
    phase = 'act'; shell.unlock(); startWindow();
    return;
  }
  await world[action](t, at);
  if (action === turn.key) return success(t);
  // mismatch: comic, gentle; the object comes back and the command repeats
  sfx.boing();
  t.inner.classList.remove('jiggle'); void t.inner.offsetWidth; t.inner.classList.add('jiggle');
  await sleep(500);
  await home(t);
  attempts++;
  if (attempts === 1) {
    queue.miss();
    await loseStar();
    await sleep(300);
    await shell.prompt(say);
    phase = 'act'; startWindow();
    return;
  }
  // second miss: the ghost hand shows it, the command plays once more, and on we go
  await sleep(300);
  await say();
  await demo(turn.key, t);
  await say();
  await home(t);
  endTurn();
}

async function success(t) {
  sfx.cheer();
  const c = centre(t.el);
  confetti(c.x, c.y);
  await sleep(250);
  await say(); // the command replays over the action's result
  addStar();
  await sleep(300);
  await home(t);
  endTurn();
}

async function endTurn() {
  t_off();
  const clean = queue.done();
  memory.seen(turn.cmd.id, clean);
  if (stars >= goal) {
    phase = 'idle';
    if (!path.active) store.set(Math.min(3, level + 1));
    await sleep(500);
    finale(`<div class="finale-stars">${'⭐'.repeat(goal)}</div>`, startRound);
    return;
  }
  await sleep(600);
  nextTurn();
}
function t_off() { for (const t of things) t.inner.classList.remove('glow-on'); }

// ---------------------------------------------------------------- ghost-hand demonstrations

const ghostHand = {
  show() { this.h = document.body.appendChild(el('div', 'ghost-hand doit-ghost', '👆')); return this; },
  at(x, y) { this.h.style.left = x + 'px'; this.h.style.top = y + 'px'; },
  async move(x, y, ms = 450) { this.h.style.transition = `left ${ms}ms ease, top ${ms}ms ease`; this.at(x, y); await sleep(ms + 30); },
  async press(down) { await tween(this.h, [{ transform: `translate(-50%,0) scale(${down ? 1 : 0.82})` }, { transform: `translate(-50%,0) scale(${down ? 0.82 : 1})` }], { duration: 160 }); },
  hide() { this.h?.remove(); this.h = null; },
};

async function demo(key, t) {
  const c = () => centre(t.el);
  const r = room.getBoundingClientRect();
  const hand = ghostHand.show();
  hand.at(r.left + r.width * 0.5, r.bottom - 40);
  await sleep(50);
  if (key === 'dont') {
    // the hand comes close, stops, wags "no", and backs away while the ring closes
    startDemoRing(t);
    await hand.move(c().x, c().y + r.height * 0.16, 600);
    for (let i = 0; i < 3; i++) { await hand.move(c().x - 30, c().y + r.height * 0.16, 180); await hand.move(c().x + 30, c().y + r.height * 0.16, 180); }
    await hand.move(r.left + r.width * 0.5, r.bottom - 40, 700);
    await sleep(WINDOW_MS - 3000);
    stopWindow();
    hand.hide();
    await world.dont(t);
    return;
  }
  await hand.move(c().x, c().y);
  await hand.press(true);
  if (key === 'hold') {
    t.inner.classList.add('pressed');
    await fillHoldRing(t).finished;
    t.inner.classList.remove('pressed');
    const p = world.hold(t);
    await hand.press(false);
    await p;
  } else if (key === 'wipe') {
    const p = c();
    for (let i = 0; i < 3; i++) { await hand.move(p.x - 40, p.y, 200); sparkle(p.x - 30, p.y); await hand.move(p.x + 40, p.y, 200); sparkle(p.x + 30, p.y); }
    await hand.press(false);
    await world.wipe(t);
  } else if (key === 'throw') {
    // drag it a little, then fling it toward the basket
    const b = centre(bin);
    const p = c();
    await dragWithHand(t, hand, p.x + (b.x - p.x) * 0.25, p.y + (b.y - p.y) * 0.25, 300);
    hand.hide();
    await world.throw(t);
  } else if (key === 'put') {
    const m = mat.getBoundingClientRect();
    await dragWithHand(t, hand, m.left + m.width / 2, m.top + m.height / 2, 1100);
    await hand.press(false);
    await world.put(t);
  }
  hand.hide();
}

async function dragWithHand(t, hand, x, y, ms) {
  const steps = Math.max(6, Math.round(ms / 40));
  const a = centre(t.el);
  for (let i = 1; i <= steps; i++) {
    const px = a.x + (x - a.x) * i / steps, py = a.y + (y - a.y) * i / steps;
    hand.h.style.transition = 'none'; hand.at(px, py);
    const p = pct(px, py); place(t, p.x, p.y);
    await sleep(ms / steps);
  }
}

function startDemoRing(t) {
  const c = ring(t, 'win');
  c.parentNode.classList.add('on');
  c.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: 100 }], { duration: WINDOW_MS, easing: 'linear', fill: 'forwards' });
}

// ---------------------------------------------------------------- turns

/** Every object gets every command equally often, shuffled, never the same object twice running. */
function balancedTurns(keys, cycles = 3) {
  const out = [];
  for (let c = 0; c < cycles; c++) {
    let pairs;
    for (let tries = 0; tries < 30; tries++) {
      pairs = shuffle(things.flatMap((t) => keys.map((key) => ({ thing: t, key }))));
      const prev = out[out.length - 1];
      if (pairs.every((p, i) => i ? p.thing !== pairs[i - 1].thing : !prev || p.thing !== prev.thing)) break;
    }
    out.push(...pairs);
  }
  return out;
}

async function nextTurn() {
  let item = queue.next();
  if (!item) { queue = new Queue(balancedTurns(keys)); item = queue.next(); }
  turn = { ...item, cmd: content.byId[CMDS[item.key]] };
  attempts = 0;
  phase = 'listen';
  shell.lock();
  turn.thing.inner.classList.add('glow-on');
  audio.preload([turn.cmd.audio]);
  await sleep(500);
  if (item.teach) {
    // teaching: the ghost hand does it once (with the command before and over it), then it's the child's turn
    await say();
    await sleep(300);
    await demo(item.key, turn.thing);
    sfx.cheer();
    await say();
    await home(turn.thing);
    await sleep(700);
  }
  await shell.prompt(say);
  phase = 'act';
  startWindow();
}

async function startRound() {
  level = path.active ? path.level : Math.min(3, Math.max(1, +params.get('level') || store.get()));
  goal = path.active ? path.pickLevel([4, 5, GOAL]) : GOAL;
  keys = path.active ? pathKeys() : LEVELS[level];
  buildStars();
  const teach = keys.filter((k) => !taught.has(k));
  teach.forEach((k) => taught.add(k));
  const lessons = teach.map((key, i) => ({ thing: things[i % things.length], key, teach: true }));
  queue = new Queue([...lessons, ...balancedTurns(keys)]);
  for (const t of things) home(t);
  nextTurn();
}

/** The step's commands first, then "don't" (the trap that makes the others mean something), then the level's own. */
function pathKeys() {
  const keyOf = Object.fromEntries(Object.entries(CMDS).map(([k, id]) => [id, k]));
  const order = [...new Set(['dont', ...LEVELS[level], ...LEVELS[3]])];
  const pool = order.map((k) => content.byId[CMDS[k]]).filter((w) => w && fit.canUse(w));
  // a step with more commands than the level's round size gets a bigger round (at most all five), as Errand does
  const n = Math.min(5, Math.max(path.pickLevel([2, 3, 5]), pool.filter((w) => path.focus.includes(w.id)).length));
  return path.choose(pool, n, pool).map((w) => keyOf[w.id]);
}

function buildThings() {
  things = THINGS.map((d) => {
    const w = content.byId[d.id];
    const node = el('div', 'thing', `<div class="halo"></div><div class="thing-inner"><img src="${w.image}" alt=""></div>
      <svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="win" cx="50" cy="50" r="46" pathLength="100"/><circle class="hold" cx="50" cy="50" r="38" pathLength="100"/></svg>`);
    thingsEl.appendChild(node);
    const t = { ...d, word: w, el: node, inner: node.querySelector('.thing-inner') };
    place(t, d.x, d.y);
    bindGestures(t);
    return t;
  });
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    buildThings();
    startRound();
  },
  replay: () => (phase === 'act' ? say() : null),
  onIdle: () => {}, // the ring is the timer here
  onPause: (paused) => {
    if (phase !== 'act') return;
    if (paused) { if (g) { release(turn.thing); home(turn.thing); } stopWindow(); }
    else startWindow();
  },
});

// For the play-check script: read the turn; perform a gesture through the same path the pointer uses.
window.__game = {
  get state() { return { phase, locked: shell.locked, level, cmd: turn?.key, thing: turn?.thing.id, teach: !!turn?.teach, attempts, stars, finished: !!document.querySelector('.finale') }; },
  get words() { return keys.map((k) => CMDS[k]); },
  act(action) { if (phase === 'act') complete(action); },
  thingEl: () => turn?.thing.el,
  binEl: () => bin, matEl: () => mat,
};
