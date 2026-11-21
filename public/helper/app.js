// Help Grandma: Grandma asks for help in the kitchen with a command - nù ú (wipe it), sọ ọ́ nù (throw it away), dìí mú
// (hold it), fi sílẹ̀ (put it down), má fọwọ́ kàn án (don't touch it) - and the child taps the thing she means: the
// spilled juice, the paper ball, the baby, the bowl, or the hot pot. A card then shows the helper boy doing it (for the
// pot: reaching for it, then pulling his hands back) while she says it again.
//
// Built to replace Do It! (owner, 2026-11-21: you couldn't know which gesture a command wanted unless you already knew
// it, holding or not had no goal in the scene, there were only two actions, and random turns asked "don't touch" four
// times running). Here every command has a purpose in the kitchen and one way to answer (a tap on its thing); each new
// command is shown before it is asked (Grandma says it, the thing glows, the ghost hand taps it, the boy does it); and
// the turns are shuffled in cycles, every command once per cycle, so one never comes twice running.
// Wrong: the tapped card wobbles and she asks again (the turn comes back two turns later); a second miss, and the ghost
// hand shows it. Only first tries of real questions fill the strip (a lesson earns none), and a command is shown first
// only to a player who has never met it. Levels: 1 = wipe, throw, hold; 2 = and don't touch; 3 = all five.
import { loadContent, createShell, audio, sfx, onTap, Queue, memory, confetti, centre, finale, progressStrip, ghost, shuffle, sleep, el, path } from '../engine/engine.js';
import { CMDS, THINGS, LEVELS, fit } from './fit.js';

const GOAL = 6;
const ART = '../art/helper/';
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const grandma = $('grandma'), thingsEl = $('things'), actEl = $('act'), actImg = $('actImg');

let content, keys = [], cards = {}, queue, turn, phase = 'idle', attempts = 0, level, goal = GOAL, strip;
const taught = new Set();
const store = {
  get() { try { return +localStorage.getItem('helper-level') || 1; } catch { return 1; } },
  set(n) { try { localStorage.setItem('helper-level', String(n)); } catch {} },
};

async function say() {
  grandma.classList.add('speaking');
  try { await audio.play(turn.cmd.audio); } finally { grandma.classList.remove('speaking'); }
}

/** The boy doing it, on a card, while Grandma says it again. */
async function showAct(key) {
  const frames = THINGS[key].act;
  actImg.src = ART + frames[0] + '.webp';
  actEl.classList.add('on');
  const pictures = (async () => { for (const f of frames.slice(1)) { await sleep(1100); actImg.src = ART + f + '.webp'; } await sleep(1300); })();
  await Promise.all([pictures, sleep(250).then(say)]);
  actEl.classList.remove('on');
  await sleep(300);
}

// ---------------------------------------------------------------- the round

function buildCards() {
  thingsEl.innerHTML = '';
  cards = {};
  for (const key of keys) {
    const node = el('button', 'thing', `<img src="${ART + THINGS[key].thing}.webp" alt="">`);
    node.dataset.choice = '';
    node.setAttribute('aria-label', THINGS[key].thing);
    onTap(node, () => choose(key));
    thingsEl.appendChild(node);
    cards[key] = node;
  }
}

/** Every command once per cycle, shuffled; a cycle never starts with the command the last one ended on. */
function cycles(keys, n = 4, last = null) {
  const out = [];
  for (let c = 0; c < n; c++) {
    let cyc;
    do cyc = shuffle(keys); while (keys.length > 1 && cyc[0] === (out.at(-1) ?? last));
    out.push(...cyc);
  }
  return out.map((key) => ({ key }));
}

async function nextTurn() {
  // never the same command twice running: a missed turn comes back two turns later, which can put it next to its twin
  const p = queue.pending, prev = turn?.key;
  if (p.length && p[0].key === prev) { const j = p.findIndex((it) => it.key !== prev); if (j > 0) [p[0], p[j]] = [p[j], p[0]]; }
  let item = queue.next();
  if (!item) { queue = new Queue(cycles(keys, 4, turn?.key)); item = queue.next(); }
  turn = { ...item, cmd: content.byId[CMDS[item.key]] };
  attempts = 0;
  phase = 'listen';
  shell.lock();
  await sleep(500);
  if (item.teach) {
    // first meeting: she says it, its thing glows, the ghost hand taps it, the boy does it; then it is asked
    await say();
    await sleep(300);
    cards[item.key].classList.add('glow');
    await ghost.tap(cards[item.key]);
    cards[item.key].classList.remove('glow');
    sfx.pop();
    await showAct(item.key);
    await sleep(500);
  }
  await shell.prompt(say);
  phase = 'act';
}

async function choose(key) {
  if (phase !== 'act' || shell.locked) return;
  phase = 'busy';
  shell.lock();
  const card = cards[key];
  if (key === turn.key) {
    sfx.cheer();
    const c = centre(card);
    confetti(c.x, c.y);
    card.classList.add('done');
    await showAct(key);
    card.classList.remove('done');
    const clean = queue.done();
    if (clean && !turn.teach) strip.add(); // a lesson's tap copies what was just shown: only real questions earn stars
    memory.seen(turn.cmd.id, clean);
    return endTurn();
  }
  sfx.boing();
  card.classList.remove('jiggle'); void card.offsetWidth; card.classList.add('jiggle');
  attempts++;
  await sleep(500);
  if (attempts === 1) {
    queue.miss();
    await shell.prompt(say);
    phase = 'act';
    return;
  }
  // a second miss: the right thing glows, the ghost hand taps it, and the boy does it
  const right = cards[turn.key];
  right.classList.add('glow');
  await say();
  await ghost.tap(right);
  right.classList.remove('glow');
  await showAct(turn.key);
  queue.done();
  memory.seen(turn.cmd.id, false);
  endTurn();
}

async function endTurn() {
  if (strip.count >= goal) {
    phase = 'idle';
    if (!path.active) store.set(Math.min(3, level + 1));
    await sleep(400);
    finale(`<div class="finale-stars">${'⭐'.repeat(goal)}</div>`, startRound);
    return;
  }
  await sleep(500);
  nextTurn();
}

/** The step's commands first, then the level's own; at least three (two only when fewer are usable). */
function pathKeys() {
  const keyOf = Object.fromEntries(Object.entries(CMDS).map(([k, id]) => [id, k]));
  const order = [...new Set([...LEVELS[level], ...LEVELS[3]])];
  const pool = order.map((k) => content.byId[CMDS[k]]).filter((w) => w && fit.canUse(w));
  const n = Math.min(pool.length, Math.max(path.pickLevel([3, 4, 5]), pool.filter((w) => path.focus.includes(w.id)).length));
  return path.choose(pool, n, pool).map((w) => keyOf[w.id]);
}

function startRound() {
  level = path.active ? path.level : Math.min(3, Math.max(1, +params.get('level') || store.get()));
  goal = path.active ? path.pickLevel([4, 5, GOAL]) : GOAL;
  keys = (path.active ? pathKeys() : LEVELS[level]).filter((k) => content.byId[CMDS[k]] && fit.canUse(content.byId[CMDS[k]]));
  buildCards();
  strip = progressStrip(shell, goal);
  audio.preload(keys.map((k) => content.byId[CMDS[k]].audio));
  for (const k of keys) for (const f of THINGS[k].act) new Image().src = ART + f + '.webp';
  // a command is shown first only if this player has never met it (memory: this browser's record of every word met,
  // so a check stone after its teach stone asks without re-teaching; a new device teaches again)
  const met = memory.read();
  const lessons = keys.filter((k) => !taught.has(k) && !met[CMDS[k]]).map((key) => ({ key, teach: true }));
  lessons.forEach((l) => taught.add(l.key));
  queue = new Queue([...lessons, ...cycles(keys, 4, lessons.at(-1)?.key)], { cleanToWin: goal });
  turn = null;
  nextTurn();
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    startRound();
  },
  replay: () => (phase === 'act' ? say() : null),
});

// For the play-check script: read the turn; tap a thing through the same handler a finger uses.
window.__game = {
  get state() { return { phase, locked: shell.locked, level, cmd: turn?.key, teach: !!turn?.teach, attempts, stars: strip?.count ?? 0, goal, keys: [...keys], finished: !!document.querySelector('.finale') }; },
  get words() { return keys.map((k) => CMDS[k]); },
  act(key) { return choose(key); },
  card: (key) => cards[key],
};
