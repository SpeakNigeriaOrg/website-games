// Puppet Theatre: who does what, put together from two words. A little stage with a curtain; below it (at the
// sides in landscape) two rows of choices: the animals (portraits) and the actions (the kit's verb pictures).
// Free play first (a short warm-up, not on the path): tap an animal (its word plays) and an action (its word
// plays); the curtain opens and that animal does that action (its clip, or its still moving gently) while both
// words play again, animal first. Then the game: the narrator says animal ń action ("ajá ń sùn");
// the child sets that pair up (an animal and an action, in either order; it goes as soon as both are chosen, and
// in the game a choice makes no word, so the words can't be matched by ear). Right: the scene plays, a star.
// Wrong: the scene plays what was chosen (the mistake is seen), the asked pair plays again and the turn retries;
// the pair returns two turns later. Only first tries fill the strip. The first asked pair is shown by the ghost
// hand. The narrator says the sentence "<animal> ń <action>", stitched from single-word recordings (combo.js say;
// two bare words where a combination has none). Demand: composition (subject + action).
import { loadContent, createShell, audio, sfx, onTap, Queue, progressStrip, animate, confetti, ghost, finale, shuffle, sleep, el, centre, path } from '../engine/engine.js';
import { fit } from './fit.js';
import { SUBJECTS, ACTIONS, GRID_BY_LEVEL, combo, portrait, apartOk, isSubject, isAction } from '../combo.js';
import { scene, artUrl } from '../combo_scene.js';

// By path level (1 first meeting, 2 practice, 3 the full game): animals x actions on show, clean turns in the round.
const [N_SUBJECTS, N_ACTIONS] = path.pickLevel(GRID_BY_LEVEL);
const ROUNDS = path.pickLevel([4, 6, 8]);
const WARMUP = path.active ? 0 : 3; // free plays before the narrator starts asking
const SHOW_MS = 4200; // a scene plays at least this long (the clips are 5 s; the two words take about 2 s)

const $ = (id) => document.getElementById(id);
const stageEl = $('stage-box'), sceneHolder = $('scene'), curtainL = $('curtain-l'), curtainR = $('curtain-r');
const subjectRow = $('subjects'), actionRow = $('actions'), bg = $('bg');

let content, subjects = [], actions = [], picks = [], queue, strip, turn = null, mode = 'free', freePlays = 0, firstTurn = true, teachPair = null, turnNo = 0;
let chosen = { subject: null, action: null }, busy = false, showing = null;

// ---------------------------------------------------------------- layout

// The room pictures, measured on the chosen art (fractions of the picture): the dark stage opening the scene plays in
// (x0, y0, x1, y1), the top of the carved frame and the bottom of the platform.
const ROOM = {
  tall: { src: '../art/theatre_tall.png', w: 832, h: 1216, open: [0.147, 0.363, 0.852, 0.76], frameTop: 0.18, floor: 0.9 },
  wide: { src: '../art/theatre_wide.png', w: 1216, h: 832, open: [0.248, 0.315, 0.752, 0.744], frameTop: 0.13, floor: 0.86 },
};

/** The room picture is placed so that its stage opening is the stage box. Portrait: the whole theatre on top, the
 * animals and the actions in two rows on the floor below. Landscape: the room fills the width, the animals in a
 * column on the left, the actions on the right. */
function layout() {
  const W = innerWidth, H = innerHeight, landscape = W > H, R = ROOM[landscape ? 'wide' : 'tall'];
  const gap = 10, [ox0, oy0, ox1, oy1] = R.open;
  let k, left, top, rows;
  if (landscape) {
    // as wide as the screen; the opening's foot a little above the bottom
    k = Math.max(W / R.w, H / R.h);
    left = (W - R.w * k) / 2;
    top = Math.min(48 - R.frameTop * R.h * k, H - 24 - oy1 * R.h * k);
    const colW = Math.min((W - (ox1 - ox0) * R.w * k) / 2 - 2 * gap, 150);
    rows = [{ el: subjectRow, x: gap, y: 58, w: colW, h: H - 58 - 96, vertical: true }, { el: actionRow, x: W - colW - gap, y: 58, w: colW, h: H - 58 - 10, vertical: true }];
  } else {
    const rowH = Math.min(W / (Math.max(N_ACTIONS, N_SUBJECTS, 3) + 0.6), 108);
    const room = H - 50 - (2 * rowH + 3 * gap + 90);
    k = Math.min(room / ((R.floor - R.frameTop) * R.h), (W - 12) / ((ox1 - ox0) * R.w));
    left = (W - R.w * k) / 2;
    top = 50 - R.frameTop * R.h * k;
    const y1 = top + R.floor * R.h * k + gap;
    rows = [{ el: subjectRow, x: 0, y: y1, w: W, h: rowH }, { el: actionRow, x: 0, y: y1 + rowH + gap, w: W, h: rowH }];
  }
  if (!bg.src.endsWith(R.src.slice(2))) bg.src = R.src;
  Object.assign(bg.style, { left: left + 'px', top: top + 'px', width: R.w * k + 'px', height: R.h * k + 'px' });
  const stage = { x: left + ox0 * R.w * k, y: top + oy0 * R.h * k, w: (ox1 - ox0) * R.w * k, h: (oy1 - oy0) * R.h * k };
  document.body.classList.toggle('wide', landscape);
  Object.assign(stageEl.style, { left: stage.x + 'px', top: stage.y + 'px', width: stage.w + 'px', height: stage.h + 'px' });
  for (const r of rows) {
    Object.assign(r.el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    r.el.classList.toggle('vertical', !!r.vertical);
    const n = r.el.children.length || 1;
    const size = r.vertical ? Math.min(r.w * 0.92, (r.h - gap * (n - 1)) / n) : Math.min(r.h, (r.w - 12 - gap * (n - 1)) / n);
    r.el.style.setProperty('--pick', Math.floor(size) + 'px');
  }
}
addEventListener('resize', layout);

// ---------------------------------------------------------------- the round

/** The round's animals and actions: the step's words first, then the games' own order (most different first). */
function buildRound() {
  const sPool = SUBJECTS.map((s) => content.byId[s.id]).filter((w) => w && isSubject(w));
  const aPool = ACTIONS.map((a) => content.byId[a.id]).filter((w) => w && isAction(w));
  subjects = path.choose(sPool, Math.max(N_SUBJECTS, Math.min(sPool.length, path.usable(sPool).length)), sPool);
  actions = path.choose(aPool, Math.max(N_ACTIONS, Math.min(aPool.length, path.usable(aPool).length)), aPool);
  // sáré and rìn never as the only two actions, unless the step asks for both
  if (!apartOk(actions)) {
    const forced = actions.filter((w) => path.focus.includes(w.id) || path.review.includes(w.id));
    if (forced.length < 2) { const keep = forced[0] ?? actions[0]; actions = [keep, aPool.find((w) => w !== keep && apartOk([keep, w]))]; }
  }
  // on screen in the games' own order, whatever order the words came in
  subjects = sPool.filter((w) => subjects.includes(w));
  actions = aPool.filter((w) => actions.includes(w));
  subjectRow.innerHTML = ''; actionRow.innerHTML = '';
  picks = [
    ...subjects.map((w) => makePick(w, 'subject', artUrl(portrait(w.id)), subjectRow)),
    ...actions.map((w) => makePick(w, 'action', w.image, actionRow)),
  ];
  layout();
  audio.preload([...subjects, ...actions].map((w) => w.audio));
  // warm the stills (and clips) of every pair in the round
  for (const s of subjects) for (const a of actions) { const c = combo(s.id, a.id); new Image().src = artUrl(c.still); if (c.say) audio.preload([artUrl(c.say.audio)]); }
}

function makePick(w, kind, img, row) {
  const node = el('button', `pick ${kind}`, `<img src="${img}" alt="">`);
  node.dataset.choice = ''; node.dataset.id = w.id;
  node.setAttribute('aria-label', kind === 'subject' ? 'animal' : 'action');
  row.appendChild(node);
  const p = { w, kind, el: node };
  onTap(node, () => choose(p));
  return p;
}

/** The pairs asked, in order: every pair of the grid once (the step's words first), then a mix; never the same pair
 * twice running. */
function chooseTurns() {
  const pairs = [];
  for (const s of subjects) for (const a of actions) pairs.push({ s, a });
  const step = (p) => path.focus.includes(p.s.id) || path.focus.includes(p.a.id);
  let out = [...shuffle(pairs.filter(step)), ...shuffle(pairs.filter((p) => !step(p)))].slice(0, ROUNDS);
  while (out.length < ROUNDS) { const p = pairs[Math.floor(Math.random() * pairs.length)]; if (p !== out.at(-1)) out.push(p); }
  for (let i = 1; i < out.length; i++) if (out[i] === out[i - 1]) { const j = out.findIndex((p, k) => k > i && p !== out[i]); if (j > 0) [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

// ---------------------------------------------------------------- choosing

const canAct = () => !busy && !shell.locked && !document.querySelector('.finale');
const pickOf = (w) => picks.find((p) => p.w === w);
function mark() { for (const p of picks) p.el.classList.toggle('selected', chosen[p.kind] === p.w); }

async function choose(p) {
  if (!canAct()) return;
  chosen[p.kind] = p.w;
  mark();
  animate(p.el, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 260, fill: 'none' });
  if (mode === 'free') {
    // free play: each choice says its word
    sfx.tap();
    busy = true;
    await shell.prompt(() => speak(p.w));
    busy = false;
  } else sfx.pop();
  if (chosen.subject && chosen.action) await go();
}

async function speak(w) {
  const p = pickOf(w);
  p?.el.classList.add('speaking');
  await audio.play(w.audio);
  p?.el.classList.remove('speaking');
}
/** The sentence "<animal> ń <action>" (combo.js say), lighting the animal's pick and then, as the action is said,
 * the action's (as speak() lights each word); the two bare words where the combination has no sentence. */
async function sayPair(s, a) {
  const say = combo(s.id, a.id).say;
  if (!say) { await speak(s); await sleep(380); await speak(a); return; }
  const ps = pickOf(s), pa = pickOf(a);
  ps?.el.classList.add('speaking');
  const next = setTimeout(() => { ps?.el.classList.remove('speaking'); pa?.el.classList.add('speaking'); }, say.actionAt * 1000);
  await audio.play(artUrl(say.audio));
  clearTimeout(next);
  ps?.el.classList.remove('speaking'); pa?.el.classList.remove('speaking');
}

// ---------------------------------------------------------------- the show

async function openCurtain() {
  sfx.whoosh();
  stageEl.classList.add('open');
  await sleep(650);
}
async function closeCurtain() {
  stageEl.classList.remove('open');
  await sleep(600);
  // nothing behind a closed curtain (its fringe has gaps)
  showing?.stop();
  sceneHolder.innerHTML = '';
}

/** The curtain opens on that animal doing that action while both words play; then it closes. */
async function show(s, a, after) {
  showing?.stop();
  sceneHolder.innerHTML = '';
  showing = scene(combo(s.id, a.id));
  sceneHolder.appendChild(showing.node);
  await openCurtain();
  showing.play();
  const t0 = performance.now();
  await sleep(250);
  await sayPair(s, a);
  if (after) await after();
  await sleep(Math.max(500, SHOW_MS - (performance.now() - t0)));
}

async function go() {
  busy = true;
  shell.lock();
  const s = chosen.subject, a = chosen.action;
  if (mode === 'free') {
    await show(s, a);
    await closeCurtain();
    showing?.stop();
    chosen = { subject: null, action: null }; mark();
    freePlays++;
    busy = false;
    if (freePlays >= WARMUP) startGame();
    else shell.unlock();
    return;
  }
  const right = s === turn.s && a === turn.a;
  if (right) {
    await show(s, a, async () => {
      sfx.cheer();
      const c = centre(stageEl);
      if (!turn.teaching) {
        const clean = queue.done();
        if (clean) { strip.add(); confetti(c.x, c.y, 28); }
      }
      stageEl.classList.add('bravo');
    });
    stageEl.classList.remove('bravo');
    await closeCurtain();
    showing?.stop();
    if (turn.teaching) firstTurn = false;
    chosen = { subject: null, action: null }; mark();
    busy = false; turn = null;
    nextTurn();
    return;
  }
  // wrong: what was chosen plays (so the mistake is seen), then the asked pair again, and the turn retries
  await show(s, a);
  sfx.soft();
  // the two choices shake their heads gently as the curtain closes
  const chosenEls = [pickOf(s), pickOf(a)].map((p) => p.el);
  chosenEls.forEach((e) => e.classList.add('nope'));
  await closeCurtain();
  chosenEls.forEach((e) => e.classList.remove('nope'));
  showing?.stop();
  chosen = { subject: null, action: null }; mark();
  if (!turn.teaching && !turn.missed) queue.miss();
  turn.missed = true; turn.misses++;
  busy = false;
  await sleep(250);
  await shell.prompt(() => sayPair(turn.s, turn.a));
  if (turn.misses >= 2) await shell.prompt(() => demo(turn));
}

/** The ghost hand taps the asked animal, then the asked action (the teaching turn, or after two misses). */
async function demo(t) {
  for (const w of [t.s, t.a]) {
    const p = pickOf(w);
    p.el.classList.add('over');
    await ghost.tap(p.el);
    p.el.classList.remove('over');
    await sleep(150);
  }
}

// ---------------------------------------------------------------- turns

function startGame() {
  mode = 'game';
  document.body.classList.add('asking');
  const turns = chooseTurns();
  // the teaching turn shows the first pair; it is asked for real last
  if (firstTurn) { teachPair = turns[0]; turns.push(turns.shift()); }
  queue = new Queue(turns, { cleanToWin: ROUNDS });
  strip = progressStrip(shell, ROUNDS, '⭐');
  nextTurn();
}

async function nextTurn() {
  let pair, teaching = false;
  if (firstTurn) { pair = teachPair; teaching = true; }
  else {
    pair = queue.next();
    if (!pair || queue.finished) return endRound();
  }
  turnNo++;
  turn = { s: pair.s, a: pair.a, teaching, missed: false, misses: 0 };
  await sleep(500);
  if (teaching) await shell.prompt(async () => { await sayPair(turn.s, turn.a); await sleep(300); await demo(turn); await sleep(200); await sayPair(turn.s, turn.a); });
  else await shell.prompt(() => sayPair(turn.s, turn.a));
}

function endRound() {
  turn = null;
  shell.clearIdle();
  // the cast takes a bow
  finale(`<div class="fin-cast">${subjects.map((w, i) => `<img src="${artUrl(portrait(w.id))}" alt="" style="animation-delay:${i * 0.15}s">`).join('')}</div>`, startRound);
}

function startRound() {
  buildRound();
  mode = WARMUP && freePlays < WARMUP ? 'free' : 'game';
  chosen = { subject: null, action: null }; mark();
  if (mode === 'game') startGame();
  else {
    // free play: the ghost hand points out the animals, then the actions (never one answer)
    strip = progressStrip(shell, ROUNDS, '⭐');
    shell.prompt(async () => { await sleep(400); await ghost.hoverEach([...subjectRow.children, ...actionRow.children], 380); });
  }
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    startRound();
  },
  replay: () => (mode === 'game' && turn ? sayPair(turn.s, turn.a) : Promise.resolve()),
  // idle: the pair again (the teaching turn shows the taps again too); in free play, the hand points the rows out
  onIdle: async () => {
    if (mode === 'free') { if (!busy) await shell.prompt(() => ghost.hoverEach([subjectRow.children[0], actionRow.children[0]], 600)); return; }
    await shell.doReplay();
    if (turn?.teaching && !shell.locked) await shell.prompt(() => demo(turn));
  },
});
layout();

// for scripted play-throughs (tools/devcheck)
window.__game = {
  get locked() { return shell.locked || busy || (mode === 'game' && !turn); },
  get finished() { return !turn && !!document.querySelector('.finale'); },
  get mode() { return mode; },
  get want() { return turn ? { subject: turn.s.id, action: turn.a.id } : null; },
  get teaching() { return !!turn?.teaching; },
  get turnNo() { return turnNo; },
  get clean() { return queue?.clean ?? 0; },
  get total() { return ROUNDS; },
  get words() { return [...subjects, ...actions].map((w) => w.id); },
  get subjects() { return subjects.map((w) => w.id); },
  get actions() { return actions.map((w) => w.id); },
  get showing() { return showing && stageEl.classList.contains('open') ? showing.combo.name : null; },
  get showingVideo() { return !!showing?.node.classList.contains('video-on'); },
  get selected() { return { subject: chosen.subject?.id ?? null, action: chosen.action?.id ?? null }; },
  pickEl(id) { return picks.find((p) => p.w.id === id)?.el; },
  wrongPair() { const t = turn; if (!t) return null; return { subject: (subjects.find((w) => w !== t.s) ?? t.s).id, action: t.a.id }; },
};
