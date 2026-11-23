// Who Came to Visit? Guests wait at the door; the voice names one; let in the one named.
// Three guests (kit pictures: animals and people) wait in the yard. A knock, then a name. The child taps a guest
// and it walks through the door. Right: it goes in and the name plays again; it then waves from a window.
// Wrong: the chosen guest says its own name, the right guest wobbles and says its name, and the child lets it in.
// New words come by elimination: now and then a stranger (not met this session) joins the guests. It waits 1-4
// turns while known guests are named, so "tap the stranger" does not win; when its (new) name is called, the
// child can work it out because the other two are known. Inside, the stranger says its name twice.
// The session starts with three guests who each say their name as they arrive (the only names given away).
// Listening test: all guests look like what they are; which one is wanted is only in the audio.
import { loadContent, createShell, audio, sfx, memory, progressStrip, animate, confetti, ghost, finale, shuffle, pick, sleep, el, onTap, path } from '../engine/engine.js';
import { fit, APART } from './fit.js';

// By path level (1 first meeting, 2 practice, 3 the full game): clean turns to fill the strip, guests waiting
// at the door, and how many guests the round has in all (the rest come later as strangers).
const ROUND = path.pickLevel([4, 6, 8]);
const WAITING = path.pickLevel([2, 3, 3]);
const ROUND_GUESTS = path.pickLevel([3, 5, Infinity]);
const SLOT_XS = { 2: [0.25, 0.75], 3: [0.19, 0.5, 0.81] };
let SLOT_X = SLOT_XS[3];
const IMG = { w: 832, h: 1216 };
const READING = new URLSearchParams(location.search).has('read');
const $ = (id) => document.getElementById(id);
const yard = $('yard'), art = $('art'), guestsEl = $('guests'), door = $('door'), doorway = $('doorway');

let content, pool, strip, slots, known, unmet, lastIn, missed, target, misses, turnNo, nextStrangerTurn, teaching = true, inside, L = {};

// ------------------------------------------------------------ layout

function layout() {
  const W = innerWidth, H = innerHeight;
  const artW = Math.min(W, H * IMG.w / IMG.h), artH = artW * IMG.h / IMG.w;
  const left = (W - artW) / 2, top = W > H ? 0 : Math.max(0, Math.min((H - artH) * 0.3, H - artH - 260));
  Object.assign(art.style, { left: left + 'px', top: top + 'px', width: artW + 'px', height: artH + 'px' });
  Object.assign($('sand').style, { left: left + 'px', width: artW + 'px', top: (top + artH * 0.8) + 'px' });
  const yardTop = top + artH * 0.65, yardBottom = W > H ? H - 8 : H - 100;
  const card = Math.min(artW * 0.26, (yardBottom - yardTop) * 0.8, 170);
  const cy = Math.max(yardTop + card * 0.55, Math.min(top + artH + card * 0.1, (yardTop + yardBottom) / 2));
  L = { W, H, artW, artH, left, top, card, cy };
  yard.style.setProperty('--card', card + 'px');
  slots?.forEach((g, i) => g && placeGuest(g, i));
}
const slotPos = (i) => ({ x: L.left + L.artW * SLOT_X[i], y: L.cy });
function placeGuest(g, i) {
  const p = slotPos(i);
  Object.assign(g.el.style, { left: (p.x - L.card / 2) + 'px', top: (p.y - L.card / 2) + 'px' });
}

// ------------------------------------------------------------ guests

function makeGuest(word) {
  const b = el('button', 'guest', `<img src="${word.image}" alt="">${READING ? `<span class="label">${word.display}</span>` : ''}`);
  b.setAttribute('aria-label', 'guest'); b.dataset.choice = '';
  b.style.setProperty('--delay', (-Math.random() * 2).toFixed(2) + 's');
  const g = { word, el: b, stranger: false, waited: 0, revealAt: 0 };
  onTap(b, () => choose(g));
  return g;
}

/** A guest walks into slot i from the nearer side. */
async function arrive(g, i) {
  slots[i] = g;
  showInside(null);
  guestsEl.appendChild(g.el);
  placeGuest(g, i);
  const from = (i === 0 ? -1 : i === slots.length - 1 ? 1 : pick([-1, 1])) * (L.artW * 0.6 + L.card);
  const steps = setInterval(() => sfx._tone(180 + Math.random() * 40, 0.05, 'triangle', 0.05), 180);
  await animate(g.el, [
    { transform: `translateX(${from}px)` }, { transform: `translate(${from * 0.75}px, -8px)`, offset: 0.25 },
    { transform: `translate(${from * 0.5}px, 0)`, offset: 0.5 }, { transform: `translate(${from * 0.25}px, -8px)`, offset: 0.75 },
    { transform: 'translate(0, 0)' }], { duration: 950, easing: 'linear', fill: 'none' });
  clearInterval(steps);
}

async function sayName(g, cls = 'speaking') {
  g.el.classList.add(cls);
  await audio.play(g.word.audio);
  g.el.classList.remove(cls);
}

async function wobble(g) {
  await animate(g.el, [{ transform: 'rotate(0)' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(8deg)' }, { transform: 'rotate(-5deg)' }, { transform: 'rotate(0)' }], { duration: 550, fill: 'none' });
}

async function knock() {
  for (let k = 0; k < 2; k++) {
    sfx._tone(160, 0.09, 'square', 0.12, 0.7); sfx._noise(0.05, 0.15, 1200, 300);
    animate(doorway, [{ transform: 'translateX(0)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }], { duration: 120, fill: 'none' });
    await sleep(260);
  }
}

async function namePrompt() {
  await knock();
  await sleep(250);
  doorway.classList.add('calling');
  await audio.play(target.word.audio);
  doorway.classList.remove('calling');
}

// ------------------------------------------------------------ the door and the room

async function openDoor(open) {
  door.classList.toggle('open', open);
  if (open) sfx._tone(320, 0.25, 'sine', 0.06, 1.5); else { sfx._tone(140, 0.12, 'square', 0.08, 0.6); }
  await sleep(380);
}

/** The guest walks up to the door and in. */
async function goIn(g) {
  const r = g.el.getBoundingClientRect(), d = doorway.getBoundingClientRect();
  const dx = d.left + d.width / 2 - (r.left + r.width / 2), dy = d.top + d.height * 0.62 - (r.top + r.height / 2);
  const s = Math.min(1, d.height * 0.7 / r.height);
  g.el.classList.add('walking');
  const opening = openDoor(true);
  await animate(g.el, [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 14}px) scale(${(1 + s) / 2})`, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(${s})` }], { duration: 900, easing: 'ease-in-out' });
  await opening;
  await animate(g.el, [{ transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 1 }, { transform: `translate(${dx}px, ${dy - 6}px) scale(${s * 0.75})`, opacity: 0 }], { duration: 450 });
  g.el.remove();
  await openDoor(false);
}

/** Guests who came in wave from the windows (the latest four). */
function showInside(word) {
  if (word) inside = [word, ...inside.filter((w) => w !== word)];
  const out = new Set(slots.filter(Boolean).map((g) => g.word));
  const shown = inside.filter((w) => !out.has(w)).slice(0, 4);
  const wins = [$('winL').querySelector('.waving'), $('winR').querySelector('.waving')];
  wins.forEach((w) => { w.innerHTML = ''; });
  shown.forEach((w, k) => {
    const im = el('img', 'peek' + (k === 0 && w === word ? ' new' : ''));
    im.src = w.image; im.alt = '';
    wins[k % 2].appendChild(im);
  });
  return wins[0].querySelector('.new');
}

// ------------------------------------------------------------ turns

function chooseNewcomer() {
  const atDoor = new Set(slots.filter(Boolean).map((g) => g.word.id));
  const strangerHere = slots.some((g) => g?.stranger);
  if (!strangerHere && unmet.length && turnNo >= nextStrangerTurn) return { word: unmet.shift(), stranger: true };
  const back = pool.filter((w) => known.has(w.id) && !atDoor.has(w.id)).sort((a, b) => (lastIn[a.id] ?? -1) - (lastIn[b.id] ?? -1));
  if (back.length) return { word: back[0], stranger: false };
  return { word: unmet.shift(), stranger: true };
}

async function nextTurn() {
  if (strip.count >= ROUND) {
    finale(`<div class="finale-guests">${inside.map((w) => `<img src="${w.image}" alt="">`).join('')}</div>`, startRound);
    return;
  }
  shell.lock();
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]) continue;
    const { word, stranger } = chooseNewcomer();
    const g = makeGuest(word);
    if (stranger) { g.stranger = true; g.revealAt = pick([1, 2, 2, 3, 3, 4]); }
    await arrive(g, i);
  }
  const here = slots.filter(Boolean);
  const due = here.find((g) => g.stranger && g.waited + 1 >= g.revealAt);
  const knownHere = here.filter((g) => !g.stranger);
  const missedHere = knownHere.filter((g) => missed.has(g.word.id) && g.word !== target?.word);
  if (due) target = due;
  else if (missedHere.length && Math.random() < 0.7) target = pick(missedHere);
  else target = pick(knownHere.filter((g) => g.word !== target?.word).length ? knownHere.filter((g) => g.word !== target?.word) : knownHere);
  misses = 0;
  audio.preload(here.map((g) => g.word.audio));
  await shell.prompt(async () => {
    await sleep(250);
    await namePrompt();
    if (teaching) { await sleep(200); await ghost.hoverEach(slots.map((g) => g.el), 600); teaching = false; }
  });
}

async function choose(g) {
  if (shell.locked || !slots.includes(g)) return;
  shell.lock();
  sfx.tap();
  if (g === target) return letIn(g);
  // wrong: the chosen guest says its own name; the right one wobbles and says its name
  misses++;
  missed.add(target.word.id);
  wobble(g);
  await sayName(g, 'oops');
  await sleep(300);
  wobble(target);
  await sayName(target);
  await sleep(150);
  shell.unlock();
  if (misses >= 2) { shell.lock(); await ghost.tap(target.el); shell.unlock(); }
}

async function letIn(g) {
  const clean = misses === 0;
  const i = slots.indexOf(g);
  slots[i] = null;
  const said = audio.play(g.word.audio);
  await goIn(g);
  await said;
  const peek = showInside(g.word);
  sfx.pop();
  if (g.stranger) {
    known.add(g.word.id);
    nextStrangerTurn = turnNo + 2;
    await sleep(250);
    for (let k = 0; k < 2; k++) { peek.classList.add('speaking'); await audio.play(g.word.audio); peek.classList.remove('speaking'); await sleep(300); }
  } else await sleep(200);
  memory.seen(g.word.id, clean);
  lastIn[g.word.id] = turnNo;
  if (clean) {
    missed.delete(g.word.id);
    const r = doorway.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + r.height / 3);
    sfx.cheer();
    strip.add(`<img src="${g.word.image}" alt="">`);
  }
  for (const s of slots) if (s?.stranger) s.waited++;
  turnNo++;
  await sleep(500);
  nextTurn();
}

async function startRound() {
  guestsEl.innerHTML = '';
  // on the path, every focus word (up to three) is among the guests who introduce themselves
  const n = path.active ? Math.min(3, Math.max(WAITING, pool.filter((w) => path.focus.includes(w.id)).length)) : 3;
  SLOT_X = SLOT_XS[n];
  slots = Array(n).fill(null);
  known = new Set(); lastIn = {}; missed = new Set(); inside = []; target = null; turnNo = 0; nextStrangerTurn = 1;
  $('winL').querySelector('.waving').innerHTML = ''; $('winR').querySelector('.waving').innerHTML = '';
  strip = progressStrip(shell, ROUND, '🏠');
  const order = path.active ? pool : memory.order(pool);
  const intro = order.slice(0, n);
  unmet = path.active ? order.slice(n) : shuffle(order.slice(n));
  // the first guests introduce themselves as they arrive
  await shell.prompt(async () => {
    for (let i = 0; i < n; i++) {
      const g = makeGuest(intro[i]);
      await arrive(g, i);
      await sleep(150);
      await sayName(g);
      known.add(g.word.id);
      await sleep(300);
    }
  });
  nextTurn();
}

addEventListener('resize', layout);

/** On the path: the step's guests first (focus, then review), then the door's own; never two that look alike. */
function pathGuests() {
  const extra = [...path.focus, ...path.review].map((id) => content.byId[id]).filter((w) => w && fit.canUse(w) && !pool.includes(w));
  const all = [...pool, ...extra], out = [];
  for (const w of path.choose(all, all.length, memory.order(pool))) {
    if (APART.some((pair) => pair.includes(w.id) && out.some((o) => pair.includes(o.id)))) continue;
    out.push(w);
  }
  return out.slice(0, Math.max(ROUND_GUESTS, path.usable(out).length + 1));
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    pool = fit.curated.map((id) => content.byId[id]).filter((w) => w && fit.canUse(w));
    if (path.active) pool = pathGuests();
    audio.preload(pool.map((w) => w.audio));
    layout();
    startRound();
  },
  replay: () => target && namePrompt(),
});
layout();

window.__game = {
  get target() { return target?.word; }, get locked() { return shell.locked; }, get clean() { return strip?.count ?? 0; },
  get finished() { return !!document.querySelector('.finale'); }, get misses() { return misses; },
  get guests() { return slots?.map((g) => g && { id: g.word.id, stranger: g.stranger, waited: g.waited }); },
  get known() { return [...(known || [])]; }, get turn() { return turnNo; },
  get words() { return (pool || []).map((w) => w.id); },
  /** Tap the named guest (true) or another (false). */
  choose(right) { const g = right ? target : slots.find((s) => s && s !== target); if (g) choose(g); return g?.word.id; },
  get targetIsStranger() { return !!target?.stranger; },
  choiceEl(right) { return (right ? target : slots.find((s) => s && s !== target))?.el; },
};
