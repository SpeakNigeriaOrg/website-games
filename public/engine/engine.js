import { analytics } from './analytics.js';
// Shared engine for the dev games. Plain ES module, no build step.
//
// Conventions every game gets from here (games plan, "Interaction ground rules"):
// - sound starts with one big tap (browsers block audio before a gesture);
// - one replay button, bottom-left, always; it replays the current prompt and pauses motion;
// - input is locked while a prompt plays (the ear pulses), and unlocks when it ends;
// - if the child does nothing, the prompt replays after 6 s; a ghost hand can demonstrate;
// - only clean (first-try) turns count for progress, and a missed item returns two items later.

const BASE = new URL('..', import.meta.url).href; // dev/games/

// ---------------------------------------------------------------- content

/** voices: 'single' for games that compare pitch or join clips across words (one person per round: Femi,
 * who recorded the most); 'any' (default) for meaning games, which may use Tolani where Femi has no usable take. */
export const NOT_ALONE = new Set(['prefix', 'pronoun', 'particle']);

export async function loadContent({ voices = 'any' } = {}) {
  const res = await fetch(BASE + 'content/content.json');
  const content = await res.json();
  for (const w of content.words) {
    w.audio = w.audio && BASE + 'content/' + w.audio;
    w.slow = w.slow && BASE + 'content/' + w.slow;
    w.image = w.image && BASE + 'content/' + w.image;
    for (const s of w.syllables) s.audio = BASE + 'content/' + s.audio;
  }
  // ?gates (or ?gates=<profile>) keeps only recordings the inclusion gates include for that profile
  // (scripts/computeGates.mjs; default profile "words"). Off by default while the thresholds are being
  // calibrated: enforcing them today leaves some games without enough words.
  // Opened from the learning path, the path's lenient profiles apply (pathTone for single-voice games).
  const gate = path.active ? (voices === 'single' ? 'pathTone' : 'path') : new URLSearchParams(location.search).get('gates');
  // A kit built before a profile existed carries no decisions for it: keep its words rather than drop them all.
  const profile = gate === null ? null : gate || 'words';
  if (profile && content.words.some((w) => w.inclusion?.[profile])) content.words = content.words.filter((w) => !w.inclusion || w.inclusion[profile] === 'included');
  if (voices === 'single') content.words = content.words.filter((w) => (w.person ?? 'Femi') === 'Femi');
  // On the path, a sound stone (the game's, or its mode's, fit job is 'sound': it plays syllable clips and asks the
  // child to hear them) uses only words whose tones are clear (toneClear below), never the lenient profile's rest:
  // the round is smaller rather than filled with unclear words. Meaning games keep the lenient profile.
  if (path.active && await isSoundStone()) content.words = content.words.filter(toneClear);
  // Words that are not standalone (bound pieces, pronoun pieces, particles, proper names; the kit's `standalone`)
  // are not prompts, foils or fillers in these games: teaching them needs a game built for them.
  content.words = content.words.filter((w) => w.standalone ?? !NOT_ALONE.has(w.category));
  content.byId = Object.fromEntries(content.words.map((w) => [w.id, w]));
  return content;
}

/** A word whose recorded tones are clearly its written tones: the tone model heard the written tones (no high/low
 * swap) and is at least 0.9 sure of every syllable. The bar for tone stones and for sound stones on the path.
 * pWritten is the tone model's own confidence, not yet validated against listeners: a provisional bar, not a
 * measurement of what a child hears. Same rule as path/build.mjs toneClear (Node cannot import this file). */
export const toneClear = (w) => {
  const t = w?.tone, l = t?.learner;
  return !!l && l.matchesWritten === true && l.highLowSwaps === 0 && (t.perSyllable ?? []).every((s) => s.pWritten >= 0.9);
};
/** True when this page is a game opened from the path in a mode whose job is 'sound' (its fit.js says so). */
async function isSoundStone() {
  const dir = new URL('.', location.href).pathname.split('/').filter(Boolean).pop();
  try {
    const m = await import(`${BASE}${dir}/fit.js`);
    const mode = m.modes?.find((x) => x.mode === params.get('mode')) ?? m.modes?.[0];
    return (mode ?? m.fit).job === 'sound';
  } catch { return false; }
}

// ---------------------------------------------------------------- learning path
//
// The path page (dev/games/path/) opens a game as <game>/?path=<step id>&focus=<ids>&review=<ids>&level=<n>.
// focus: the unit's words this step is about; review: words from earlier units to mix back in; level: 1 (first
// meeting: fewest choices, shortest round) to 3. A game asks path.choose(candidates, n) for its words: focus
// words it can use first, then review words, then (only to make up the number) the game's own choice. The
// round's finale offers the way back to the path, which records the step as done.
const params = new URLSearchParams(location.search);
const ids = (k) => (params.get(k) || '').split(',').filter(Boolean);
export const path = {
  active: params.has('path'),
  step: params.get('path'),
  focus: ids('focus'),
  review: ids('review'),
  /** Tone pairs for a tone stone: words that differ only in tone, as [a, b] ("pairs=a~b,c~d"). */
  pairs: ids('pairs').map((p) => p.split('~')).filter((p) => p.length === 2),
  /** 1, 2 or 3; games without a path use their own full difficulty (3). */
  level: Math.min(3, Math.max(1, Number(params.get('level')) || (params.has('path') ? 1 : 3))),
  /** By level: a value from [level1, level2, level3]. */
  pickLevel(values) { return values[this.level - 1]; },
  /** Up to n words from candidates: focus first, then review (recently missed first), then the rest in the order given
   * (or by memory). */
  choose(candidates, n = candidates.length, rest = null) {
    if (!this.active) return (rest ?? candidates).slice(0, n);
    const by = (list) => list.map((id) => candidates.find((w) => w.id === id)).filter(Boolean);
    const out = [...shuffle(by(this.focus))];
    // review: a word the child missed the last time it was asked comes first (memory), the rest in any order
    const m = memory.read();
    const review = shuffle(by(this.review)).sort((a, b) => (m[b.id]?.missed ? 1 : 0) - (m[a.id]?.missed ? 1 : 0));
    for (const w of review) if (out.length < n && !out.includes(w)) out.push(w);
    for (const w of rest ?? candidates) if (out.length < n && !out.includes(w)) out.push(w);
    return out.slice(0, n);
  },
  /** Words of this step a game can actually use (for the path page's check and for tests). */
  usable(candidates) { return candidates.filter((w) => this.focus.includes(w.id) || this.review.includes(w.id)); },
  done(stars = 3) {
    if (!this.active) return;
    try {
      const k = 'yo-path-progress-v1', m = JSON.parse(localStorage.getItem(k) || '{}');
      m[this.step] = { stars: Math.max(stars, m[this.step]?.stars ?? 0), t: Date.now() };
      localStorage.setItem(k, JSON.stringify(m));
    } catch {}
  },
};

export const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- audio

const ctx = new (window.AudioContext || window.webkitAudioContext)();
const buffers = new Map();
let current = new Set();

async function buffer(url) {
  if (!buffers.has(url)) buffers.set(url, fetch(url).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)));
  return buffers.get(url);
}

export const audio = {
  ctx,
  preload: (urls) => Promise.all(urls.filter(Boolean).map((u) => buffer(u).catch(() => null))),
  /** Play one clip; resolves when it ends (or is stopped). */
  async play(url, { rate = 1, gain = 1 } = {}) {
    if (!url) return;
    const buf = await buffer(url);
    return new Promise((resolve) => {
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      g.gain.value = gain;
      src.buffer = buf;
      src.playbackRate.value = rate;
      src.connect(g).connect(ctx.destination);
      const done = () => { current.delete(entry); resolve(); };
      const entry = { src, done };
      current.add(entry);
      src.onended = done;
      src.start();
    });
  },
  /** Play clips one after another with a gap (ms); `onEach(i)` fires as each starts. */
  async sequence(urls, gap = 250, onEach) {
    for (let i = 0; i < urls.length; i++) {
      onEach?.(i);
      await audio.play(urls[i]);
      if (i < urls.length - 1) await sleep(gap);
    }
  },
  stop() { for (const e of current) { try { e.src.onended = null; e.src.stop(); } catch {} e.done(); } current = new Set(); },
};

// Short synthesised effects, so no game ships a placeholder sound file.
export const sfx = {
  _tone(freq, dur, type = 'sine', vol = 0.18, slide = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur);
  },
  _noise(dur, vol = 0.25, from = 2000, to = 300) {
    const n = ctx.createBufferSource(), b = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime;
    f.type = 'lowpass'; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.buffer = b; n.connect(f).connect(g).connect(ctx.destination); n.start(t);
  },
  pop() { sfx._tone(520, 0.12, 'sine', 0.2, 1.8); },
  tap() { sfx._tone(880, 0.05, 'triangle', 0.08); },
  splash() { sfx._noise(0.6, 0.3, 3000, 200); sfx._tone(180, 0.25, 'sine', 0.12, 0.5); },
  boing() { sfx._tone(220, 0.35, 'sine', 0.2, 2.2); },
  bump() { sfx._tone(120, 0.18, 'square', 0.08, 0.6); },
  whoosh() { sfx._noise(0.35, 0.18, 800, 4000); },
  drum(pitch = 1) { sfx._tone(110 * pitch, 0.35, 'sine', 0.35, 0.55); sfx._noise(0.06, 0.12, 1500, 400); },
  cheer() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => sfx._tone(f, 0.18, 'triangle', 0.14), i * 90)); },
  win() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => sfx._tone(f, 0.22, 'triangle', 0.14), i * 110)); },
  soft() { sfx._tone(300, 0.2, 'sine', 0.1, 0.8); },
  snore() { sfx._noise(0.9, 0.08, 500, 180); sfx._tone(90, 0.9, 'sine', 0.05, 0.8); },
};

// ---------------------------------------------------------------- shell

/** Builds the frame every game shares: start overlay, replay button, ear, progress strip.
 *  `opts.onStart()` runs after the first tap; `opts.replay()` is what the replay button plays. */
export function createShell(opts) {
  const root = document.body;
  root.classList.add('game');
  const startEl = el('div', 'start-overlay', `<button class="start-btn" aria-label="Play"><span>▶</span></button>`);
  const replayEl = el('button', 'replay-btn', '<span aria-hidden="true">🔊</span>');
  replayEl.setAttribute('aria-label', 'Hear it again');
  const earEl = el('div', 'ear', '<span aria-hidden="true">👂</span>');
  const progressEl = el('div', 'progress-strip');
  root.append(progressEl, replayEl, earEl, startEl);

  let locked = true;
  let idleTimer = null;
  let promptToken = 0;
  const shell = {
    root, progressEl,
    get locked() { return locked; },
    lock() { locked = true; earEl.classList.add('listening'); root.classList.add('locked'); shell.clearIdle(); },
    unlock() { locked = false; earEl.classList.remove('listening'); root.classList.remove('locked'); shell.armIdle(); },
    /** Run a prompt with input locked; unlocks afterwards, unless a newer prompt (a replay) has started meanwhile. */
    async prompt(fn) {
      const token = ++promptToken;
      shell.lock();
      try { await fn(); } finally { if (token === promptToken) shell.unlock(); }
    },
    replay: opts.replay,
    /** Idle: after `ms` of no input, call opts.onIdle (default: replay). */
    armIdle(ms = 6000) { shell.clearIdle(); idleTimer = setTimeout(() => { if (!locked) (opts.onIdle || shell.doReplay)(); }, ms); },
    clearIdle() { clearTimeout(idleTimer); },
    // While input is locked something is already playing (a prompt, or the game's own sequence): ignore.
    async doReplay() { if (!shell.replay || locked) return; opts.onPause?.(true); audio.stop(); await shell.prompt(shell.replay); opts.onPause?.(false); },
    touched() { shell.armIdle(); },
  };
  replayEl.addEventListener('click', () => { sfx.tap(); shell.doReplay(); });
  // Keyboard (mouse-and-keyboard play): the game marks its answer elements with data-choice (or sets
  // shell.choices to a function returning them). Two choices: Left and Right pick them directly. More: Left and
  // Right move a highlight, Space or Enter picks. R replays the prompt; Space or Enter starts the game.
  let focus = -1;
  const choiceEls = () => (shell.choices ? shell.choices() : [...root.querySelectorAll('[data-choice]')])
    .filter((e) => e && e.isConnected && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.05 && getComputedStyle(e).pointerEvents !== 'none')
    .sort((a, b) => { const p = a.getBoundingClientRect(), q = b.getBoundingClientRect(); return Math.abs(p.left - q.left) > 8 ? p.left - q.left : p.top - q.top; });
  const activate = (e) => { shell.touched(); if (e.__tap) e.__tap({ currentTarget: e, target: e, key: true, clientX: 0, clientY: 0 }); else e.click(); };
  addEventListener('keydown', (ev) => {
    if (ev.repeat || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if (startEl.isConnected) { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); startEl.querySelector('button').click(); } return; }
    if (ev.key === 'r' || ev.key === 'R') { sfx.tap(); shell.doReplay(); return; }
    if (locked || !['ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(ev.key)) return;
    const els = choiceEls();
    if (!els.length) return;
    ev.preventDefault();
    root.querySelectorAll('.key-focus').forEach((e) => e.classList.remove('key-focus'));
    if (els.length === 1) { focus = -1; activate(els[0]); return; } // one choice: any of the keys picks it
    if (els.length === 2 && ev.key.startsWith('Arrow')) { focus = -1; activate(els[ev.key === 'ArrowLeft' ? 0 : 1]); return; }
    if (ev.key.startsWith('Arrow')) {
      focus = focus < 0 ? (ev.key === 'ArrowLeft' ? els.length - 1 : 0) : (focus + (ev.key === 'ArrowLeft' ? -1 : 1) + els.length) % els.length;
      els[focus].classList.add('key-focus');
    } else if (focus >= 0 && els[focus]) { const e = els[focus]; focus = -1; activate(e); }
  });
  root.addEventListener('pointerdown', () => shell.touched(), true);
  startEl.querySelector('button').addEventListener('click', async () => {
    await ctx.resume();
    startEl.remove();
    analytics.roundStart();
    opts.onStart();
  }, { once: true });
  return shell;
}

export function el(tag, cls, html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.innerHTML = html;
  return e;
}

/** A tap that ignores drags (moved > 10 px) and works with mouse and touch. */
export function onTap(target, handler) {
  target.__tap = handler; // the keyboard activates the same handler (see keyboard in createShell)
  let down = null;
  target.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  target.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved < 12) handler(e);
  });
}

// ---------------------------------------------------------------- turns and progress

/** Items to play through, where a missed item comes back two items later and only clean turns count. */
export class Queue {
  constructor(items, { cleanToWin = items.length } = {}) {
    this.pending = [...items];
    this.cleanToWin = cleanToWin;
    this.clean = 0;
    this.current = null;
    this.missedThisTurn = false;
    analytics.turns(items.length);
  }
  next() { this.current = this.pending.shift() ?? null; this.missedThisTurn = false; return this.current; }
  miss() { if (!this.missedThisTurn) { analytics.miss(); this.missedThisTurn = true; this.pending.splice(Math.min(2, this.pending.length), 0, this.current); } }
  /** Call when the turn ends; returns true if it was clean. */
  done() { const clean = !this.missedThisTurn; if (clean) this.clean++; return clean; }
  get finished() { return this.clean >= this.cleanToWin || (!this.pending.length && !this.current); }
}

/** Per-player memory in the browser: when each word was last met, how often answered cleanly, and whether the last
 * turn was missed (the path puts those review words first). */
export const memory = {
  key: 'yo-games-memory-v1',
  read() { try { return JSON.parse(localStorage.getItem(this.key) || '{}'); } catch { return {}; } },
  write(m) { try { localStorage.setItem(this.key, JSON.stringify(m)); } catch {} },
  seen(id, clean) {
    const m = this.read(); const e = m[id] || { n: 0, clean: 0 };
    e.n++; if (clean) e.clean++; e.missed = !clean; e.t = Date.now(); m[id] = e; this.write(m);
  },
  /** Words due for review first (met before, longest ago), then the rest shuffled. */
  order(words) {
    const m = this.read();
    const met = words.filter((w) => m[w.id]).sort((a, b) => m[a.id].t - m[b.id].t);
    return [...met.slice(0, 2), ...shuffle(words.filter((w) => !met.slice(0, 2).includes(w)))];
  },
};

/** A row of slots that fill with stars (or anything) for clean turns. */
export function progressStrip(shell, total, icon = '⭐') {
  shell.progressEl.innerHTML = '';
  const slots = Array.from({ length: total }, () => shell.progressEl.appendChild(el('span', 'slot')));
  let n = 0;
  return {
    add(html = icon) { if (n < total) { slots[n].innerHTML = html; slots[n].classList.add('filled'); n++; } return n; },
    get count() { return n; },
  };
}

// ---------------------------------------------------------------- feedback

/** Runs a Web Animation, then releases it. Its end state is kept only where it differs from the element's own
 * style: that property is written inline. (Left running with fill: forwards, a finished animation overrode every
 * later style change - River's frog stayed invisible after a splash. Writing every end value inline instead left
 * e.g. transform: scale(1) after a bounce, which beat the game's later pose classes - the giant's collapse, the
 * parrot's tilt.) With fill: 'none' nothing is kept. Resolves when the animation ends; a cancelled one resolves too. */
export function animate(target, keyframes, options) {
  const a = target.animate(keyframes, { duration: 400, easing: 'ease-out', fill: 'forwards', ...options });
  return a.finished.then(() => {
    if (options?.fill === 'none') { a.cancel(); return; }
    const props = Object.keys(a.effect.getKeyframes().at(-1) ?? {}).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p));
    const css = (p) => p.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
    const end = Object.fromEntries(props.map((p) => [p, getComputedStyle(target).getPropertyValue(css(p))]));
    a.cancel();
    for (const p of props) if (getComputedStyle(target).getPropertyValue(css(p)) !== end[p]) target.style.setProperty(css(p), end[p]);
  }, () => {});
}

export function confetti(x, y, n = 28) {
  const colors = ['#f2b33d', '#e4572e', '#29a36a', '#3f7cd9', '#b05ad6'];
  for (let i = 0; i < n; i++) {
    const p = el('div', 'confetti');
    p.style.background = colors[i % colors.length];
    p.style.left = x + 'px'; p.style.top = y + 'px';
    document.body.appendChild(p);
    const a = Math.random() * Math.PI * 2, d = 80 + Math.random() * 140;
    p.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 120}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }],
    { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.4,1)' }).finished.then(() => p.remove());
  }
}

export const centre = (node) => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

/** A ghost hand that hovers over targets in turn (never singling out an answer), or taps one (after misses). */
export const ghost = {
  async hoverEach(nodes, ms = 700) {
    const hand = document.body.appendChild(el('div', 'ghost-hand', '👆'));
    for (const n of nodes) { const c = centre(n); hand.style.left = c.x + 'px'; hand.style.top = c.y + 'px'; await sleep(ms); }
    hand.remove();
  },
  async tap(node) {
    const hand = document.body.appendChild(el('div', 'ghost-hand', '👆'));
    const c = centre(node);
    hand.style.left = c.x + 'px'; hand.style.top = c.y + 40 + 'px';
    await animate(hand, [{ transform: 'translate(-50%,0) scale(1)' }, { transform: 'translate(-50%,-40px) scale(1)' }, { transform: 'translate(-50%,-40px) scale(.85)' }, { transform: 'translate(-50%,-40px) scale(1)' }], { duration: 1100 });
    hand.remove();
  },
};

/** End-of-round screen: a big celebration and a "play again" button. */
export function finale(html, onAgain) {
  sfx.win();
  path.done();
  analytics.complete();
  const back = path.active ? `<a class="path-btn" href="${BASE}path/?done=${encodeURIComponent(path.step)}" aria-label="Back to the path">➜</a>` : '';
  const o = document.body.appendChild(el('div', 'finale', `<div class="finale-card">${html}<div class="finale-btns"><button class="again-btn" aria-label="Play again">↻</button>${back}</div></div>`));
  confetti(innerWidth / 2, innerHeight / 3, 60);
  o.querySelector('.again-btn').addEventListener('click', () => { o.remove(); analytics.roundStart(); onAgain(); });
}
