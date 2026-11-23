// Stretchy Word: pull a word-creature long and it says itself slowly, one syllable at a time; let go and it
// snaps back saying itself fast. A blob creature carries the word's picture on its back. Dragging its tail
// to the right passes notches: at each one the next syllable plays and a bump grows on its back (never shown
// in advance). On release it springs back and the natural word plays. A plain tap plays the natural word.
// Press-and-hold (handy with a mouse) stretches it automatically. Idle: it wiggles its tail. No wrong answer.
// Swipe, the arrow button or the keyboard arrows bring the next creature; pulled all the way, a creature
// joins the gallery along the top.
// From the learning path: the step's words, shortest first; level 1 is 4 creatures, level 2 is 6.
import { loadContent, path, createShell, audio, sfx, memory, progressStrip, animate, confetti, finale, sleep, el } from '../engine/engine.js';
import { fit, WORDS, PER_ROUND, usable } from './fit.js';

const NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const svg = $('creature'), mover = $('mover'), nextBtn = $('next'), meadow = $('meadow');

const ROUND = path.pickLevel([4, 6, fit.roundSize]);
const COLOURS = [ // body, belly, outline-friendly tuft
  ['#7fd36b', '#c8f2b0', '#ffd84d'], ['#ff9cc2', '#ffd9e8', '#ffffff'], ['#6fbaf2', '#c9e7ff', '#ffd84d'],
  ['#ffb347', '#ffe0b0', '#ff7a6b'], ['#b590f2', '#e4d6ff', '#ffd84d'], ['#4fd1c5', '#c2f3ee', '#ff9cc2'],
];

// Geometry, in the creature's viewBox units.
const X0 = 70, BASE = 300, GROUND = 500, BODY_H = 220, MAX_SPAN = 420;
// Camera: fixed. The creature rests at the left with room on the right for its longest stretch (plus the tail),
// so pulling it makes it visibly longer; its face, picture and height never change size.
// (A camera that widened to follow the tail made a stretch read as the creature shrinking.)
const VBX = 40, TAIL_ROOM = 140, ASPECT = 0.62;
const VIEW_W = X0 + BASE + MAX_SPAN + TAIL_ROOM - VBX;
/** The stretch for a finger at clientX: the grabbed point follows the finger, except that when the finger took hold
 *  too far right to reach the full stretch before the edge of the view, its travel counts a little extra, so the
 *  last notch is always reachable with a mouse or a finger, in either orientation. */
function stretchAt(clientX) {
  const r = svg.getBoundingClientRect();
  const x = VBX + Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * VIEW_W;
  const room = VBX + VIEW_W - 30 - grab.x, need = maxStretch() + 20 - grab.s;
  return grab.s + (x - grab.x) * (room > 0 ? Math.max(1, need / room) : 1);
}

let content, words = [], index = 0, strip, collected = new Set();
// Set when a stretch collects the creature: once it has sprung back and said itself, the next creature walks in
// on its own (a child who has finished a creature should never be left wondering what to do).
let justCollected = false;
let word, n = 1, notch = 140, colour = COLOURS[0];
let s = 0, v = 0;                 // stretch beyond the resting length, and its speed (for the spring)
let mode = 'idle';                // idle | drag | press | auto | spring | walk | demo
let played = 0, bumps = [], bumpScale = 1, gen = 0, sylChain = Promise.resolve();
let walkX = 0, wiggleUntil = 0, mouthOpenUntil = 0, blinkAt = 0, lastT = 0;
let grab = { x: 0, s: 0 }, press = null, holdTimer = null, swipe = null, demoing = false;

// ------------------------------------------------------------ the creature's parts

function svgEl(tag, attrs = {}, parent = mover) {
  const e = document.createElementNS(NS, tag);
  for (const [k, val] of Object.entries(attrs)) e.setAttribute(k, val);
  parent.appendChild(e);
  return e;
}

const P = {};
function buildCreature() {
  mover.innerHTML = '';
  const OUT = '#2b2118';
  // the goal: a little flag on the grass where the tail arrives at full stretch (pull it there to collect)
  P.goal = svgEl('g', { class: 'goal' });
  svgEl('rect', { x: -5, y: -200, width: 10, height: 206, rx: 5, fill: '#8a5a2b', stroke: '#2b2118', 'stroke-width': 5 }, P.goal);
  P.pennant = svgEl('path', { d: 'M5 -196 L86 -168 L5 -138 Z', stroke: '#2b2118', 'stroke-width': 6, 'stroke-linejoin': 'round', class: 'pennant' }, P.goal);
  svgEl('circle', { cx: 0, cy: -204, r: 10, fill: '#ffd84d', stroke: '#2b2118', 'stroke-width': 5 }, P.goal);
  P.shadow = svgEl('ellipse', { fill: 'rgba(0,0,0,.16)' });
  // outline layer: every part drawn fat and dark, so the fill layer on top merges into one silhouette
  P.o = svgEl('g', { fill: OUT, stroke: OUT, 'stroke-width': 16, 'stroke-linejoin': 'round' });
  P.oTail = svgEl('path', { fill: 'none', 'stroke-width': 52, 'stroke-linecap': 'round' }, P.o);
  P.oTuft = svgEl('circle', {}, P.o);
  P.oFeet = [0, 1, 2, 3].map(() => svgEl('ellipse', {}, P.o));
  P.oBody = svgEl('rect', {}, P.o);
  P.oBumps = svgEl('g', {}, P.o);
  // fill layer
  P.f = svgEl('g', {});
  P.fTail = svgEl('path', { fill: 'none', 'stroke-width': 36, 'stroke-linecap': 'round' }, P.f);
  P.fTuft = svgEl('circle', {}, P.f);
  P.fTuftShine = svgEl('circle', { fill: 'url(#shine)' }, P.f);
  P.fFeet = [0, 1, 2, 3].map(() => svgEl('ellipse', {}, P.f));
  P.fBody = svgEl('rect', {}, P.f);
  P.fBumps = svgEl('g', {}, P.f);
  P.belly = svgEl('rect', { 'clip-path': 'url(#bodyClip)' }, P.f);
  P.shine = svgEl('ellipse', { fill: 'url(#shine)' }, P.f);
  // face, at the left end
  P.face = svgEl('g', {});
  P.cheekL = svgEl('ellipse', { fill: '#ff7f9d', opacity: 0.55 }, P.face);
  P.cheekR = svgEl('ellipse', { fill: '#ff7f9d', opacity: 0.55 }, P.face);
  P.eyes = [0, 1].map(() => ({
    white: svgEl('ellipse', { fill: '#fff', stroke: OUT, 'stroke-width': 7 }, P.face),
    pupil: svgEl('circle', { fill: OUT }, P.face),
    glint: svgEl('circle', { fill: '#fff' }, P.face),
  }));
  P.mouth = svgEl('path', { fill: '#7a2a3a', stroke: OUT, 'stroke-width': 7, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, P.face);
  // the picture it carries on its back
  P.badgeRing = svgEl('circle', { fill: '#fff', stroke: OUT, 'stroke-width': 8 });
  P.badgeImg = svgEl('image', { 'clip-path': 'url(#badgeClip)', preserveAspectRatio: 'xMidYMid slice' });
  P.hit = svgEl('circle', { fill: 'transparent', class: 'tail-hit' }); // generous grab area round the tuft
  P.bodyHit = svgEl('rect', { fill: 'transparent', class: 'body-hit' });
}

function setWordLook() {
  colour = COLOURS[index % COLOURS.length];
  for (const e of [P.fBody, ...P.fFeet]) e.setAttribute('fill', colour[0]);
  P.fTail.setAttribute('stroke', colour[0]);
  P.fTuft.setAttribute('fill', colour[2]);
  P.belly.setAttribute('fill', colour[1]);
  P.fBumps.setAttribute('fill', colour[0]);
  P.badgeImg.setAttribute('href', word.image);
  P.pennant.setAttribute('fill', colour[0]);
}

const easeOutBack = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

function render(t) {
  const L = BASE + s;
  const H = BODY_H * Math.min(1.14, Math.max(1, 1 - s / 2600)); // a squish (spring) bulges it up; a stretch never thins it
  const top = GROUND - H;
  const idle = mode === 'idle' || mode === 'walk';
  const breath = idle ? Math.sin(t / 420) * 4 : 0;
  const VH = VIEW_W * ASPECT;
  svg.setAttribute('viewBox', `${VBX} ${GROUND + 56 - VH} ${VIEW_W} ${VH}`);
  mover.setAttribute('transform', `translate(${walkX} ${breath * 0.5})`);
  const x1 = X0 + L; // right end of the body

  P.shadow.setAttribute('cx', X0 + L / 2 + 20); P.shadow.setAttribute('cy', GROUND + 34);
  P.shadow.setAttribute('rx', L / 2 + 60); P.shadow.setAttribute('ry', 18);

  for (const r of [P.oBody, P.fBody, P.bodyHit, $('clipBody')]) {
    r.setAttribute('x', X0); r.setAttribute('y', top - breath); r.setAttribute('width', L); r.setAttribute('height', H + breath); r.setAttribute('rx', H / 2);
  }
  P.belly.setAttribute('x', X0); P.belly.setAttribute('y', top + H * 0.64); P.belly.setAttribute('width', L); P.belly.setAttribute('height', H);
  P.shine.setAttribute('cx', X0 + L * 0.42); P.shine.setAttribute('cy', top + H * 0.22); P.shine.setAttribute('rx', L * 0.36); P.shine.setAttribute('ry', H * 0.16);

  // feet: two under the head, two under the tail end
  const fx = [X0 + 70, X0 + 150, x1 - 140, x1 - 60];
  const step = idle ? 0 : Math.sin(t / 90) * (mode === 'walk' ? 8 : 0);
  fx.forEach((x, i) => {
    for (const f of [P.oFeet[i], P.fFeet[i]]) {
      f.setAttribute('cx', x); f.setAttribute('cy', GROUND + 10 - (i % 2 ? step : -step)); f.setAttribute('rx', 30); f.setAttribute('ry', 18);
    }
  });

  // tail: from the back end, curling up to a tuft; wiggles when idle-prompted or while stretching
  const wig = t < wiggleUntil ? Math.sin(t / 70) * 26 : (mode === 'drag' || mode === 'auto' ? Math.sin(t / 120) * 5 : Math.sin(t / 600) * 6);
  const bx = x1 - 26, by = top + H * 0.5;
  const tx = x1 + 78, ty = top + H * 0.02 + wig * 0.5;
  const d = `M${bx} ${by} C ${x1 + 50} ${by + 10 + wig * 0.2}, ${x1 + 92 + wig * 0.3} ${top + H * 0.35}, ${tx} ${ty}`;
  P.oTail.setAttribute('d', d); P.fTail.setAttribute('d', d);
  for (const c of [P.oTuft, P.fTuft]) { c.setAttribute('cx', tx); c.setAttribute('cy', ty); c.setAttribute('r', 34); }
  P.fTuftShine.setAttribute('cx', tx); P.fTuftShine.setAttribute('cy', ty); P.fTuftShine.setAttribute('r', 34);
  P.hit.setAttribute('cx', tx); P.hit.setAttribute('cy', ty + 20); P.hit.setAttribute('r', 95);

  // bumps: one per syllable heard so far, spread over the stretched part of the back
  const r0 = Math.min(62, notch * 0.46);
  const span = Math.max(0, L - BASE);
  const startX = X0 + BASE - 60;
  bumps.forEach((b, k) => {
    const grow = easeOutBack(Math.min(1, (t - b.born) / 320));
    const r = Math.max(0, r0 * grow * bumpScale);
    const cx = startX + (k + 0.5) * (span / Math.max(bumps.length, 1));
    const cy = top + 14 - breath;
    for (const c of [b.o, b.f]) { c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r); }
  });

  // face
  const look = Math.min(1, Math.max(-0.3, s / 300));
  const blink = t > blinkAt && t < blinkAt + 140 ? 0.1 : 1;
  if (t > blinkAt + 140) blinkAt = t + 2200 + Math.random() * 2600;
  const eyeY = top + H * 0.36 - breath;
  [[X0 + 68, 30], [X0 + 138, 33]].forEach(([x, ry], i) => {
    const e = P.eyes[i];
    const strain = mode === 'drag' || mode === 'auto' ? 0.85 : 1;
    e.white.setAttribute('cx', x); e.white.setAttribute('cy', eyeY); e.white.setAttribute('rx', 25); e.white.setAttribute('ry', ry * blink * strain);
    e.pupil.setAttribute('cx', x + 6 + look * 8); e.pupil.setAttribute('cy', eyeY + 4); e.pupil.setAttribute('r', blink < 1 ? 0 : 13);
    e.glint.setAttribute('cx', x + 2 + look * 8); e.glint.setAttribute('cy', eyeY - 2); e.glint.setAttribute('r', blink < 1 ? 0 : 4.5);
  });
  const mx = X0 + 104, my = top + H * 0.62 - breath;
  const open = t < mouthOpenUntil ? 1 : (mode === 'drag' || mode === 'auto' ? 0.35 : 0);
  P.mouth.setAttribute('d', open
    ? `M${mx - 24} ${my} Q ${mx} ${my - 6} ${mx + 24} ${my} Q ${mx} ${my + 18 + 22 * open} ${mx - 24} ${my} Z`
    : `M${mx - 26} ${my - 4} Q ${mx} ${my + 22} ${mx + 26} ${my - 4} Q ${mx} ${my + 8} ${mx - 26} ${my - 4} Z`);
  P.cheekL.setAttribute('cx', X0 + 34); P.cheekR.setAttribute('cx', X0 + 176);
  for (const c of [P.cheekL, P.cheekR]) { c.setAttribute('cy', my - 8); c.setAttribute('rx', 17); c.setAttribute('ry', 11); }

  // the goal flag stands under the tuft's place at full stretch; it waves when the tail gets there
  P.goal.setAttribute('transform', `translate(${X0 + BASE + maxStretch() + 78} ${GROUND + 24})`);
  P.goal.classList.toggle('reached', played === n);

  // badge: the word's picture riding just behind the head
  const bxc = X0 + 210, byc = top - 34 - breath, br = 74;
  P.badgeRing.setAttribute('cx', bxc); P.badgeRing.setAttribute('cy', byc); P.badgeRing.setAttribute('r', br);
  const cb = $('clipBadge'); cb.setAttribute('cx', bxc); cb.setAttribute('cy', byc); cb.setAttribute('r', br - 8);
  P.badgeImg.setAttribute('x', bxc - br + 8); P.badgeImg.setAttribute('y', byc - br + 8);
  P.badgeImg.setAttribute('width', (br - 8) * 2); P.badgeImg.setAttribute('height', (br - 8) * 2);
}

// ------------------------------------------------------------ stretching and sound

const maxStretch = () => n * notch;

function addBump(t) {
  const o = svgEl('circle', {}, P.oBumps), f = svgEl('circle', {}, P.fBumps);
  bumps.push({ o, f, born: t });
}
function clearBumps() { P.oBumps.innerHTML = ''; P.fBumps.innerHTML = ''; bumps = []; bumpScale = 1; }

/** Set the stretch; each notch passed for the first time plays the next syllable and grows a bump. */
function setStretch(target) {
  const max = maxStretch();
  s = target > max ? max + (target - max) * 0.25 : Math.max(0, target); // rubbery past the end
  while (played < n && s >= (played + 1) * notch - 18) {
    const k = played++;
    addBump(performance.now());
    sayClip(word.syllables[k].audio);
    if (played === n) collect();
  }
}

function sayClip(url) {
  const g = gen;
  sylChain = sylChain.then(async () => {
    if (g !== gen) return;
    mouthOpenUntil = performance.now() + 380;
    await audio.play(url);
    await sleep(70);
  });
  return sylChain;
}

async function sayWord() {
  mouthOpenUntil = performance.now() + (word.durationS || 0.8) * 1000;
  await audio.play(word.audio);
}

function collect() {
  if (demoing || collected.has(word.id)) return;
  collected.add(word.id);
  justCollected = true;
  memory.seen(word.id, true);
  const html = `<img src="${word.image}" alt="" style="box-shadow: 0 0 0 3px ${colour[0]}">`;
  setTimeout(() => { sfx.cheer(); const r = P.badgeRing.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2, 18); flyToGallery(r, html); }, 200);
}

/** The picture flies from the creature's back to its place in the gallery, which fills when it lands. */
async function flyToGallery(from, html) {
  const slot = shell.progressEl.children[strip.count];
  if (!slot) return strip.add(html);
  const to = slot.getBoundingClientRect();
  const pic = document.body.appendChild(el('div', 'fly-pic', html));
  Object.assign(pic.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
  const dx = to.left + to.width / 2 - from.left - from.width / 2, dy = to.top + to.height / 2 - from.top - from.height / 2;
  await animate(pic, [{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(0,-30px) scale(1.15)', offset: 0.25 },
    { transform: `translate(${dx}px, ${dy}px) scale(${to.width / from.width})` }], { duration: 750, easing: 'ease-in-out' });
  pic.remove();
  strip.add(html);
}

/** Let go: spring back, and say the whole word fast. */
async function release() {
  if (!['drag', 'auto', 'press'].includes(mode)) return;
  clearTimeout(holdTimer);
  const wasStretched = s > 8 || played > 0, full = played === n;
  gen++;
  audio.stop();
  sylChain = Promise.resolve();
  mode = 'spring';
  v = 0;
  if (wasStretched) sfx.whoosh();
  const springDone = new Promise((r) => (springResolve = r));
  await sayWord();
  await springDone;
  if (full && !demoing && collected.size === words.length) return roundDone();
  if (justCollected) {
    justCollected = false;
    await sleep(700);
    const next = words.findIndex((w, i) => i > index && !collected.has(w.id));
    const first = words.findIndex((w) => !collected.has(w.id));
    if (next >= 0 || first >= 0) await go((next >= 0 ? next : first) - index);
  }
}
let springResolve = null;

function stepSpring(dt) {
  const k = 300, c = 15;
  const a = -k * s - c * v;
  v += a * dt; s += v * dt;
  s = Math.max(-46, s);
  bumpScale = Math.max(0, bumpScale - dt * 3.2);
  if (Math.abs(s) < 0.6 && Math.abs(v) < 6) {
    s = 0; v = 0; mode = 'idle'; played = 0; clearBumps();
    springResolve?.(); springResolve = null;
    shell.armIdle();
  }
}

/** Press and hold: stretch one notch at a time, waiting for each syllable to finish. */
async function autoStretch() {
  mode = 'auto';
  const g = gen;
  while (mode === 'auto' && g === gen && played < n) {
    const from = s, to = (played + 1) * notch, t0 = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        if (mode !== 'auto' || g !== gen) return resolve();
        const p = Math.min(1, (performance.now() - t0) / 380);
        setStretch(from + (to - from) * (1 - Math.pow(1 - p, 2)));
        p < 1 ? requestAnimationFrame(tick) : resolve();
      };
      tick();
    });
    await sylChain;
  }
}

function tapped() {
  mode = 'spring'; s = 0; v = -140; // a little squish
  sfx.pop();
  sayWord();
  springResolve = null;
}

// ------------------------------------------------------------ pointer input

const toSvg = (e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
const canTouch = () => !shell.locked && (mode === 'idle' || mode === 'spring');

svg.addEventListener('pointerdown', (e) => {
  if (!canTouch()) return;
  const isTail = e.target === P.hit, isBody = e.target === P.bodyHit || P.f.contains(e.target) || P.face.contains(e.target) || e.target === P.badgeImg || e.target === P.badgeRing;
  if (!isTail && !isBody) return;
  e.stopPropagation();
  try { svg.setPointerCapture(e.pointerId); } catch {} // synthetic test pointers have nothing to capture
  gen++; audio.stop(); sylChain = Promise.resolve();
  if (mode === 'spring') { mode = 'idle'; s = Math.max(0, s); played = 0; clearBumps(); }
  const p = toSvg(e);
  if (isTail) { mode = 'drag'; grab = { x: p.x, s }; sfx.tap(); return; }
  mode = 'press';
  press = { x: p.x, y: p.y };
  holdTimer = setTimeout(() => { if (mode === 'press') autoStretch(); }, 300);
});

svg.addEventListener('pointermove', (e) => {
  if (mode !== 'drag' && mode !== 'press') return;
  const p = toSvg(e);
  if (mode === 'press') {
    if (Math.hypot(p.x - press.x, p.y - press.y) < 24) return;
    clearTimeout(holdTimer);
    mode = 'drag'; grab = { x: p.x, s }; // pulling the body works like pulling the tail
  }
  setStretch(stretchAt(e.clientX));
});

const up = () => {
  if (mode === 'press') { clearTimeout(holdTimer); mode = 'idle'; tapped(); return; }
  if (mode === 'drag' || mode === 'auto') release();
};
svg.addEventListener('pointerup', up);
svg.addEventListener('pointercancel', up);

// swipe on the meadow (not on the creature) for the next or previous creature
meadow.addEventListener('pointerdown', (e) => { swipe = { x: e.clientX, y: e.clientY }; });
meadow.addEventListener('pointerup', (e) => {
  if (!swipe || mode !== 'idle' || shell.locked) { swipe = null; return; }
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
});
nextBtn.addEventListener('click', () => { if (mode === 'idle' && !shell.locked) { sfx.tap(); go(1); } });
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') go(1);
  else if (e.key === 'ArrowLeft') go(-1);
  else if (e.code === 'Space' && !e.repeat && mode === 'idle' && !shell.locked) { mode = 'press'; autoStretch(); }
});
addEventListener('keyup', (e) => { if (e.code === 'Space' && mode === 'auto') release(); });

// ------------------------------------------------------------ words and walking

function loop(t) {
  const dt = Math.min(0.04, (t - (lastT || t)) / 1000);
  lastT = t;
  if (mode === 'spring') stepSpring(dt);
  if (word) render(t);
  requestAnimationFrame(loop);
}

async function walk(from, to, ms) {
  const prev = mode;
  mode = 'walk';
  const t0 = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      walkX = from + (to - from) * (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
      p < 1 ? requestAnimationFrame(tick) : resolve();
    };
    tick();
  });
  mode = prev === 'walk' ? 'idle' : prev;
}

function setWord(i) {
  index = (i + words.length) % words.length;
  word = words[index];
  n = word.syllables.length;
  notch = Math.min(150, MAX_SPAN / n);
  s = 0; v = 0; played = 0; clearBumps();
  setWordLook();
  audio.preload([word.audio, ...word.syllables.map((x) => x.audio)]);
}

let going = false;
async function go(dir) {
  if (going || mode !== 'idle' || shell.locked || !word) return;
  going = true;
  shell.clearIdle();
  sfx.whoosh();
  await walk(0, dir > 0 ? -520 : 900, 420); // just out of sight, so the scene is empty only briefly
  setWord(index + dir);
  await walk(dir > 0 ? 900 : -520, 0, 550);
  mode = 'idle';
  going = false;
  await shell.prompt(sayWord);
}

async function demo() {
  // the ghost hand takes the tail, pulls the creature long (it speaks slowly), and lets go (it speaks fast)
  demoing = true; // a demonstration doesn't fill the gallery
  await shell.prompt(async () => {
    await sleep(400);
    const hand = document.body.appendChild(el('div', 'ghost-hand', '👆'));
    const place = () => { const r = P.fTuft.getBoundingClientRect(); hand.style.left = r.left + r.width / 2 + 'px'; hand.style.top = r.top + r.height * 0.6 + 'px'; };
    place();
    await sleep(700);
    mode = 'drag';
    const t0 = performance.now(), dur = n * 650, goal = maxStretch() + 10;
    await new Promise((resolve) => {
      const tick = () => {
        const p = Math.min(1, (performance.now() - t0) / dur);
        setStretch(goal * p); place();
        p < 1 ? requestAnimationFrame(tick) : resolve();
      };
      tick();
    });
    await sylChain;
    await sleep(300);
    hand.remove();
    await release();
  });
  demoing = false;
}

function roundDone() {
  shell.clearIdle();
  finale(`<div class="finale-pics">${words.map((w) => `<img src="${w.image}" alt="">`).join('')}</div>`, startRound);
}

function startRound() {
  words = Object.entries(PER_ROUND).flatMap(([k, m]) => memory.order(WORDS[k].map((id) => content.byId[id]).filter(usable)).slice(0, m));
  if (path.active) { // the learning path: focus words first, then review words, then the game's own; shortest first
    const pool = [...new Set([...fit.curated, ...path.focus, ...path.review])].map((id) => content.byId[id]).filter(usable);
    words = path.choose(pool, ROUND, words).sort((a, b) => a.syllables.length - b.syllables.length);
  }
  collected = new Set();
  strip = progressStrip(shell, words.length, '');
  setWord(0);
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    buildCreature();
    startRound();
    requestAnimationFrame(loop);
    window.__game = {
      get mode() { return mode; }, get s() { return s; }, get played() { return played; }, get n() { return n; },
      get word() { return word; }, get bumps() { return bumps.length; }, get collected() { return collected.size; }, get total() { return words.length; }, get words() { return words.map((w) => w.id); },
      notch: () => notch, setStretch, release, go, autoStretch, tail: () => P.hit, body: () => P.bodyHit, svg,
      grab() { if (canTouch()) { mode = 'drag'; } },
    };
    await walk(900, 0, 700);
    await demo();
  },
  replay: () => sayWord(),
  onIdle: () => { if (mode === 'idle') { wiggleUntil = performance.now() + 1200; sfx.soft(); } shell.armIdle(); },
});
