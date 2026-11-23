// Gate Rally: drive up the road and steer through the gate that matches the word.
// A pair of identical gates comes down the road; a word plays, then each gate has its turn (left, then
// right), glowing. The child taps (or swipes) left or right to change lane, at any time while the pair comes
// near, and may change their mind as often as they like: the lane the kart is in when the gates arrive is the answer.
// The kart never stops: it rolls steadily toward each pair, at a speed set from that pair's prompt, so the word and
// the gates always finish speaking the same distance out and the child then has the same time to choose (longer on
// the first lap). It starts every pair between the lanes; with no choice it drives straight between the gates, a
// gentle miss (no coin, the item returns later),
// so doing nothing never wins. After any miss the kart slows to a crawl at the gates (it never stops), the right gate glows and says its
// syllable (in pictures mode, the word), then the word plays again: never a bare "no".
//   Syllables mode (hearing): the word, then each gate says a syllable; one of them is in the word.
//   Pictures mode (understanding): the gates carry two pictures; the word names one. The gates glow in
//   turn but do not speak, or the child could match sound to sound without knowing the word.
//   Sequence mode (building a word): the word plays and its picture hangs on a banner over the road; then one pair
//   of gates per syllable, in order. Each pair: the word, then one gate says the word's next syllable and the other
//   a foil. A right gate lights the next stone on the banner's line (the word built so far); after a miss the right
//   gate glows and speaks while the kart crawls on, and the same syllable's pair comes again, so the word is always
//   built in order. The last syllable passed: the word plays, the stones light in turn with their syllables, the
//   word again, and the track turns into a new scene for the next word. A word is clean only if every syllable was
//   right first time; a word with a miss comes back two words later.
// A lap is 8 clean gates (sequence: 4 clean words); a wrong gate skids gently and the word comes back two items later.
// From the learning path: straight into a lap with the step's words (no picker), syllables mode unless ?mode= names
// another; level 1 is a short, unhurried lap (4 gates; sequence: 3 two-syllable words). ?mode= also skips the picker
// outside the path.
import { loadContent, path, createShell, audio, sfx, Queue, memory, progressStrip, animate, confetti, ghost, finale, shuffle, pick, sleep, el } from '../engine/engine.js';
import { fit, BAD, syllableWord, pictureWord, sequenceWord } from './fit.js';

const LAP = path.pickLevel([4, 6, 8]);
const SEQ_LAP = path.pickLevel([3, 4, 4]), SEQ_MAX = path.pickLevel([2, 3, 4]); // sequence: words per lap, most syllables
const MODES = ['syllables', 'pictures', 'sequence'];
const ASKED = MODES.find((m) => m === new URLSearchParams(location.search).get('mode')) || null;
// Sequence mode: each word gets a new track (the first is the road the other modes use).
const TRACKS = ['bg_road', 'rally_track_savanna', 'rally_track_village', 'rally_track_river', 'rally_track_hills'].map((n) => `../art/${n}.png`);
const READING = new URLSearchParams(location.search).has('read');
const $ = (id) => document.getElementById(id);
const road = $('road'), canvas = $('lanes'), world = $('world'), kartWrap = $('kartWrap'), bg = $('bg');
const g2d = canvas.getContext('2d');

// ---------------------------------------------------------------- road geometry (fractions of the column)
// Matches bg_road.png: vanishing point at (0.502, 0.243); the road edge reaches the side at y = 0.785.
const VPX = 0.502, HY = 0.243, KY = 0.80, EDGE = 0.502 / (0.785 - 0.243);
const SPAWN_Z = 7, PASS_Z = 1.0;
let W = 0, H = 0, roadColour = 'rgb(214,93,63)';
const yOf = (z) => HY + (KY - HY) / z;              // screen y (fraction of H) of something at distance z
const hwOf = (y) => EDGE * (y - HY);                 // road half-width (fraction of W) at screen y
const laneX = (side, y) => VPX + (side === 'left' ? -0.5 : side === 'right' ? 0.5 : 0) * hwOf(y);

function resize() {
  const r = road.getBoundingClientRect();
  W = r.width; H = r.height;
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  g2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize);

/** The painted road's colour, near the bottom of a background picture: [r, g, b]. */
function roadRgb(img) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const x = c.getContext('2d');
    x.drawImage(img, img.naturalWidth * 0.3, img.naturalHeight * 0.96, 4, 4, 0, 0, 1, 1);
    return [...x.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  } catch { return null; }
}
function sampleRoadColour() { const c = roadRgb(bg); if (c) roadColour = `rgb(${c})`; }
if (bg.complete) sampleRoadColour();
bg.addEventListener('load', sampleRoadColour);

// ---------------------------------------------------------------- motion
const motion = { s: 0, v: 0, target: 2.2, stopS: Infinity, creepS: Infinity, paused: false, last: 0 };
// How densely the road is marked: kerb bands, centre dashes and roadside posts pass FLOW times as often per road unit.
// The gates approach at the speed their prompt and choosing time set (approach(), below), often about 1 unit/s; with
// sparse markings that looked like a crawl (owner, 2026-11-23: "the rally games feel slow"). Denser markings make the
// same speed look faster without changing when anything arrives.
const FLOW = 3;
let cruise = 2.2;

function drawRoad() {
  const g = g2d, s = motion.s;
  g.clearRect(0, 0, W, H);
  // road surface (covers the picture's painted road so the markings can move)
  const yb = 1.02, hb = hwOf(yb);
  g.fillStyle = roadColour;
  g.beginPath();
  g.moveTo(VPX * W, HY * H); g.lineTo((VPX - hb * 1.03) * W, yb * H); g.lineTo((VPX + hb * 1.03) * W, yb * H); g.closePath(); g.fill();
  // kerbs and centre dashes, row by row in perspective
  for (let py = Math.ceil(HY * H) + 1; py < H; py += 2) {
    const y = py / H, z = (KY - HY) / (y - HY), wpos = s + z, hw = hwOf(y) * W;
    // far away, where a band would be thinner than ~3 rows, it would shimmer: draw the kerb its average colour instead
    const bandRows = (KY - HY) * H / (z * z) / (2.2 * FLOW);
    const band = Math.floor(wpos * 2.2 * FLOW) % 2 === 0;
    g.fillStyle = bandRows < 3 ? '#e6958c' : band ? '#f4f1e8' : '#d8342a';
    const kw = Math.max(1, hw * 0.07);
    g.fillRect(VPX * W - hw - kw * 0.4, py, kw, 2);
    g.fillRect(VPX * W + hw - kw * 0.6, py, kw, 2);
    if (bandRows >= 3 && Math.floor(wpos * 1.4 * FLOW) % 2 === 0) { g.fillStyle = 'rgba(255,255,255,.92)'; const dw = Math.max(1, hw * 0.035); g.fillRect(VPX * W - dw / 2, py, dw, 2); }
  }
  // roadside posts every 1.5 / FLOW units, far to near
  const gap = 1.5 / FLOW, first = Math.floor((s + 0.6) / gap) + 1;
  for (let k = first + Math.ceil(12 / gap); k >= first; k--) {
    const z = k * gap - s; if (z < 0.6 || z > 12) continue;
    const y = yOf(z), hw = hwOf(y), size = (0.05 / z) * W;
    for (const side of [-1, 1]) {
      const x = (VPX + side * hw * 1.18) * W;
      g.fillStyle = '#ffffff'; g.fillRect(x - size * 0.18, y * H - size * 1.6, size * 0.36, size * 1.6);
      g.fillStyle = '#d8342a'; g.fillRect(x - size * 0.18, y * H - size * 1.6, size * 0.36, size * 0.4);
    }
  }
  // speed streaks whenever the kart moves: faint at first, stronger on a streak
  if (motion.v > 0.3) {
    g.strokeStyle = `rgba(255,255,255,${Math.min(0.55, 0.22 + 0.11 * streak)})`; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const ph = ((s * 0.9 * FLOW + i * 0.37) % 1), side = i % 2 ? 1 : -1;
      const x = (0.5 + side * (0.38 + (i % 3) * 0.04)) * W, y = (0.45 + ph * 0.55) * H;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + side * 6, y + 26 + streak * 6); g.stroke();
    }
  }
}

function frame(t) {
  const dt = Math.min(0.05, (t - (motion.last || t)) / 1000);
  motion.last = t;
  if (!motion.paused) {
    const a = motion.v < motion.target ? 2.5 : 4;
    motion.v += Math.sign(motion.target - motion.v) * Math.min(Math.abs(motion.target - motion.v), a * dt);
    if (motion.stopS < Infinity) motion.v = Math.min(motion.v, Math.sqrt(2 * 3 * Math.max(0, motion.stopS - motion.s)) + 0.05); // brake smoothly
    motion.s += motion.v * dt;
    if (motion.s >= motion.stopS) { motion.s = motion.stopS; motion.v = 0; }
    // after a miss: slow to a crawl near the gates, but never stop (the owner found stopping frustrating)
    if (motion.creepS < Infinity) motion.v = Math.min(motion.v, 0.05 + 1.2 * Math.max(0, motion.creepS - motion.s));
  }
  kartWrap.classList.toggle('idle', motion.paused || motion.v < 0.2);
  drawRoad();
  placeGates();
  // the pair arrives: the lane the kart is in now is the answer (the child may change lanes until this moment)
  if (pair && (phase === 'prompt' || phase === 'choose') && gateZ() <= PASS_Z && !pair.arrived && !motion.paused) {
    pair.arrived = true;
    arrive();
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- gates
const WAVE = `<svg class="wave" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 15h6l8-7v24l-8-7H8z" fill="#2b2118"/><path d="M27 13c3 4 3 10 0 14M31 9c5 6 5 16 0 22" stroke="#2b2118" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
const ARCH = `<svg viewBox="0 0 100 150" aria-hidden="true">
  <rect x="4" y="10" width="11" height="140" rx="4" fill="#3f7cd9" stroke="#2b2118" stroke-width="3"/>
  <rect x="85" y="10" width="11" height="140" rx="4" fill="#3f7cd9" stroke="#2b2118" stroke-width="3"/>
  <path d="M28 14V24M72 14V24" stroke="#2b2118" stroke-width="3"/>
  <rect x="0" y="0" width="100" height="16" rx="5" fill="#fff" stroke="#2b2118" stroke-width="3"/>
  <g fill="#2b2118">${Array.from({ length: 12 }, (_, i) => `<rect x="${2 + i * 8}" y="${i % 2 ? 1.5 : 8}" width="8" height="6.5"/>`).join('')}</g>
  <circle cx="9.5" cy="10" r="5" fill="#f2b33d" stroke="#2b2118" stroke-width="2"/><circle cx="90.5" cy="10" r="5" fill="#f2b33d" stroke="#2b2118" stroke-width="2"/>
</svg>`;

// Sequence mode's picker button: three gates in a row.
const SEQ_ICON = `<svg class="seq-icon" viewBox="0 0 120 50" aria-hidden="true">${[0, 40, 80].map((x, i) => `<g transform="translate(${x + 3} 6)">
  <rect x="0" y="4" width="5" height="40" rx="2" fill="#3f7cd9" stroke="#2b2118" stroke-width="2"/><rect x="29" y="4" width="5" height="40" rx="2" fill="#3f7cd9" stroke="#2b2118" stroke-width="2"/>
  <rect x="-2" y="0" width="38" height="8" rx="3" fill="#fff" stroke="#2b2118" stroke-width="2"/>
  <circle cx="17" cy="24" r="8" fill="${i < 2 ? '#ffd23f' : '#fff'}" stroke="#2b2118" stroke-width="2"/></g>`).join('')}</svg>`;

let pair = null; // { g: world position, gates: [{side, el, opt}], arrived }

function makeGate(side, opt) {
  const inner = mode === 'pictures' ? `<img src="${opt.image}" alt="">` : READING ? `<span class="label">${opt.text}</span>` : WAVE;
  const e = el('div', 'gate', `${ARCH}<div class="panel">${inner}</div>`);
  e.dataset.choice = side; e.__tap = () => steer(side); // keyboard: Left and Right steer through a gate
  world.appendChild(e);
  return { side, el: e, opt };
}

function placeGates() {
  if (!pair) return;
  const z = pair.g - motion.s;
  for (const gt of pair.gates) {
    if (z < 0.5) { gt.el.style.display = 'none'; continue; }
    const y = yOf(z), hw = hwOf(y), w = hw * 0.86 * W;
    Object.assign(gt.el.style, {
      left: laneX(gt.side, y) * W + 'px', top: y * H + 'px', width: w + 'px', fontSize: Math.max(4, w / 22) + 'px',
      zIndex: z < PASS_Z ? 25 : 10, opacity: Math.max(0, Math.min(1, (SPAWN_Z + 0.5 - z) / 1.2, (z - 0.62) / 0.38)),
    });
    const label = gt.el.querySelector('.label'); if (label) label.style.fontSize = w / 5 + 'px';
  }
}
const gateZ = () => (pair ? pair.g - motion.s : Infinity);
const until = async (cond) => { while (!cond()) await sleep(40); };

// ---------------------------------------------------------------- content
const toneless = (s) => s.normalize('NFD').replace(/[̀́̄]/g, '').normalize('NFC').toLowerCase();
const VOWELS = /[aeiouẹọ]/;
function shape(s) { const t = toneless(s); const i = t.search(VOWELS); return { onset: i < 0 ? t : t.slice(0, i), vowel: i < 0 ? '' : t[i] }; }
let content, sylPool, lapWords = [];

const syllableWords = () => content.words.filter(syllableWord);
const pictureWords = () => content.words.filter(pictureWord);
const sequenceWords = () => content.words.filter((w) => sequenceWord(w) && w.syllables.length <= SEQ_MAX);

/** A foil for one of the word's syllables: a syllable not in the word, differing in onset and vowel. */
function foilFor(word, target) {
  const t = shape(target.text);
  const own = new Set(word.syllables.map((s) => toneless(s.text)));
  const far = sylPool.filter((s) => !own.has(toneless(s.text)) && shape(s.text).onset !== t.onset && shape(s.text).vowel !== t.vowel);
  return pick(far.length ? far : sylPool.filter((s) => !own.has(toneless(s.text))));
}
/** A syllable pair: the right syllable and its foil, as gate options. */
const sylOptions = (target, d) => [{ right: true, audio: target.audio, text: target.text, durationS: target.durationS }, { right: false, audio: d.audio, text: d.text, durationS: d.durationS }];

/** One item for this mode: the word and its two options, the right one marked. */
function buildOptions(word) {
  if (mode === 'syllables') { const target = pick(word.syllables); return sylOptions(target, foilFor(word, target)); }
  const first = toneless(word.syllables[0]?.text || word.display);
  const others = pictureWords().filter((w) => w.id !== word.id && w.category !== word.category && toneless(w.syllables[0]?.text || w.display) !== first);
  const d = pick(others);
  return [{ right: true, image: word.image, text: word.display }, { right: false, image: d.image, text: d.display }];
}

// ---------------------------------------------------------------- the game
let mode = null, queue, strip, word, phase = 'idle', streak = 0, talking = 0, promptGen = 0, timed = false;
let coinFlight = Promise.resolve(); // the last right gate's coin, still flying while the kart drives on
let laps = 0; // laps finished this session: the first lap approaches more slowly
/** Time to choose after the prompt ends (s): longer on the first lap, a little shorter on a streak. */
const choiceTime = () => (timed ? Math.max(1.8, 2.6 - 0.12 * Math.min(streak, 6)) : 3.2);
/** How long the prompt takes: the word, then each gate's turn (as speakGates plays them). */
const promptSeconds = (opts) => (word.durationS || 0.9) + 0.15 + opts.reduce((n, o) => n + (mode !== 'pictures' ? o.durationS || 0.5 : 0.65) + 0.22, 0);
/** Approach speed for this pair (road units/s): set so that the prompt always ends the same distance out and the
 * child then has the same choosing time, whatever the word's length (a fixed speed made the syllables come late
 * on long words). */
const approach = (opts) => (SPAWN_Z - PASS_Z - 0.2) / (promptSeconds(opts) + choiceTime());
let teaching = true, lastSides = [];

async function speakGates(gen) {
  for (const gt of pair.gates) {
    if (gen !== promptGen) return;
    gt.el.classList.add('speaking');
    if (mode !== 'pictures') await audio.play(gt.opt.audio);
    else { sfx.tap(); await sleep(650); }
    gt.el.classList.remove('speaking');
    await sleep(220);
  }
}

/** The prompt: the word, then each gate has its turn as the pair comes near. */
async function sayPrompt(gen, { wait = true } = {}) {
  talking++;
  try {
    await audio.play(word.audio);
    if (gen !== promptGen) return;
    if (wait) await until(() => gen !== promptGen || gateZ() <= 2.7 || motion.s >= motion.stopS);
    await sleep(150);
    await speakGates(gen);
    if (gen === promptGen && teaching && pair) await ghost.hoverEach(pair.gates.map((g) => g.el.querySelector('.panel')), 550);
  } finally { talking--; }
}

async function nextItem() {
  if (mode === 'sequence') return nextSyllable();
  word = queue.next();
  if (!word || queue.finished) return endLap();
  launchPair(buildOptions(word));
}

/** Sends a pair of gates down the road and plays its prompt. */
async function launchPair(options) {
  let opts = shuffle(options);
  // never the right answer on the same side three times running
  const side = opts[0].right ? 'left' : 'right';
  if (lastSides.length >= 2 && lastSides.slice(-2).every((s) => s === side)) opts = opts.reverse();
  lastSides.push(opts[0].right ? 'left' : 'right');
  audio.preload([word.audio, ...opts.map((o) => o.audio)]);
  world.innerHTML = '';
  const g = motion.s + SPAWN_Z;
  pair = { g, gates: [makeGate('left', opts[0]), makeGate('right', opts[1])], arrived: false, lane: null };
  pair.done = new Promise((r) => (pair.resolve = r));
  // steady approach: the word and the gates speak on the way in, then the child has the same time to choose.
  // Steering is never locked while a pair approaches: the child may change lanes (and their mind) until arrival.
  motion.stopS = Infinity;
  motion.target = approach(opts);
  phase = 'prompt';
  shell.unlock();
  const gen = ++promptGen;
  await sayPrompt(gen, { wait: false });
  if (phase === 'prompt') phase = 'choose';
}

/** Move to a lane. Allowed whenever a pair is approaching, as often as the child likes; the answer is the lane
 * the kart is in when the pair arrives. Resolves (true) when that pair has been passed. */
function steer(side) {
  if (!pair || pair.arrived || (phase !== 'prompt' && phase !== 'choose') || motion.paused) return Promise.resolve(false);
  if (pair.lane !== side) {
    pair.lane = side;
    sfx.tap();
    kartWrap.classList.remove('lean-l', 'lean-r');
    kartWrap.classList.add(side === 'left' ? 'lean-l' : 'lean-r');
    kartWrap.style.left = laneX(side, KY) * 100 + '%';
    setTimeout(() => kartWrap.classList.remove('lean-l', 'lean-r'), 330);
  }
  return pair.done.then(() => true);
}

/** The pair has arrived: through the gate of the kart's lane, or between the gates if it never chose. */
async function arrive() {
  const p = pair, gate = p.gates.find((g) => g.side === p.lane);
  promptGen++; // a prompt or replay still playing stops here
  audio.stop();
  if (!gate) await passNone();
  else { phase = 'drive'; shell.lock(); if (gate.opt.right) await passRight(gate); else await passWrong(gate); }
  p.resolve();
}

function puff(n = 4) {
  for (let i = 0; i < n; i++) {
    const d = road.appendChild(el('div', 'dust'));
    const r = kartWrap.getBoundingClientRect(), c = road.getBoundingClientRect();
    d.style.left = (r.left - c.left + r.width * (0.2 + Math.random() * 0.6)) + 'px'; d.style.top = (r.bottom - c.top - 10) + 'px';
    animate(d, [{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0.9 }, { transform: `translate(${(Math.random() - 0.5) * 120}%, ${40 + Math.random() * 60}%) scale(1.6)`, opacity: 0 }], { duration: 600 }).then(() => d.remove());
  }
}

async function flyCoin(fromEl, toEl, html) {
  const a = fromEl.getBoundingClientRect(), b = toEl ? toEl.getBoundingClientRect() : { left: innerWidth / 2, top: 20, width: 0, height: 0 };
  const coin = document.body.appendChild(el('div', 'coin', html));
  Object.assign(coin.style, { position: 'fixed', left: a.left + a.width / 2 + 'px', top: a.top + a.height / 2 + 'px', width: Math.max(40, W * 0.13) + 'px' });
  confetti(a.left + a.width / 2, a.top + a.height / 2, 18);
  await animate(coin, [{ transform: 'translate(-50%,-50%) scale(.3)' }, { transform: 'translate(-50%,-90%) scale(1.25)', offset: 0.3 },
    { transform: `translate(calc(-50% + ${b.left + b.width / 2 - a.left - a.width / 2}px), calc(-50% + ${b.top + b.height / 2 - a.top - a.height / 2}px)) scale(.55)` }], { duration: 800, easing: 'ease-in-out' });
  coin.remove();
}

async function passRight(gate) {
  sfx.whoosh(); sfx.pop();
  puff(5);
  if (mode === 'sequence') return passRightSyllable(gate);
  audio.play(word.audio);
  const clean = queue.done();
  memory.seen(word.id, clean);
  const slot = strip && clean ? shell.progressEl.children[strip.count] : null;
  // the coin flies while the kart drives on: the next pair need not wait for it (endLap does)
  const img = word.image;
  coinFlight = flyCoin(gate.el.querySelector('.panel'), slot, '★').then(() => { if (clean) { strip.add(mode === 'pictures' ? `<img src="${img}" alt="">` : '⭐'); sfx.cheer(); } });
  streak++;
  cruise = 2.2 * (1 + 0.08 * Math.min(streak, 6));
  motion.target = cruise;
  await afterPass();
}

/** The pair arrived with no choice: through the middle, no coin, the word again; the item returns later. */
async function passNone() {
  phase = 'drive';
  shell.lock();
  kartWrap.style.left = '50%';
  missed();
  pair.gates.forEach((g) => g.el.classList.toggle('wrong', !g.opt.right));
  sfx.soft();
  holdGates();
  const gen = ++promptGen;
  await shell.prompt(async () => { talking++; try { await showRight(); if (mode !== 'sequence') await audio.play(word.audio); } finally { talking--; } });
  if (gen === promptGen) shell.lock();
  motion.creepS = Infinity;
  motion.target = cruise * 0.6;
  await afterPass();
}

/** After a miss the gates stay in view while the right one speaks: the kart slows to a crawl near them, never stopping. */
/** A miss: no coin. The word comes back two items later; in sequence mode the same syllable's pair comes next. */
function missed() {
  queue.miss();
  if (mode === 'sequence') seq.missed = true; // the word's turn ends (clean or not) when its last syllable is passed
  else { queue.done(); memory.seen(word.id, false); }
  streak = 0; cruise = 2.2;
}

function holdGates() { motion.creepS = Math.max(motion.s, pair.g - PASS_Z); }

/** Never a bare "no": the right gate glows and says its syllable (in pictures mode, the word). */
async function showRight() {
  const gate = pair.gates.find((g) => g.opt.right);
  await sleep(200);
  gate.el.classList.add('speaking');
  await audio.play(mode !== 'pictures' ? gate.opt.audio : word.audio);
  await sleep(250);
  gate.el.classList.remove('speaking');
  await sleep(200);
}

async function passWrong(gate) {
  gate.el.classList.add('wrong');
  missed();
  kartWrap.classList.add('skid');
  sfx.bump(); setTimeout(() => sfx.soft(), 180);
  puff(6);
  holdGates();
  await sleep(750);
  kartWrap.classList.remove('skid');
  // show the right gate, say the word again, then drive on; it comes back two items later (sequence: the right
  // gate's syllable, and the same pair comes again next)
  const gen = ++promptGen;
  await shell.prompt(async () => { talking++; try { await showRight(); if (mode !== 'sequence') await audio.play(word.audio); } finally { talking--; } });
  if (gen === promptGen) shell.lock();
  motion.creepS = Infinity;
  motion.target = cruise;
  await afterPass();
}

async function afterPass() {
  teaching = false;
  await until(() => gateZ() < 0.5);
  world.innerHTML = '';
  pair = null;
  phase = 'cruise';
  kartWrap.style.left = '50%'; // back between the lanes for the next pair
  await sleep(300);
  if (mode === 'sequence' && seq.i >= word.syllables.length) completeWord(); else nextItem();
}

// ---------------------------------------------------------------- sequence mode: build the word, syllable by syllable
let seq = null; // the word being built: { i: next syllable, missed, foils (one per syllable), stones, banner }
let trackNo = 0;
const seqBox = document.body.appendChild(el('div', 'seq-box'));
seqBox.hidden = true;
const hasPicture = (w) => !!w.image && !w.imageCheck;
const wordPicture = (w) => (hasPicture(w) ? `<img src="${w.image}" alt="">` : WAVE);

/** A new word: its picture on the banner over the road, an unlit stone per syllable. Each syllable keeps one foil,
 * so a pair that comes again after a miss is the same pair. */
function showWord() {
  seq = { i: 0, missed: false, foils: word.syllables.map((s) => foilFor(word, s)) };
  seqBox.innerHTML = `<div class="banner">${wordPicture(word)}</div><div class="stones">${word.syllables.map(() => '<span class="stone"></span>').join('')}</div>`;
  seq.banner = seqBox.querySelector('.banner');
  seq.stones = [...seqBox.querySelectorAll('.stone')];
  seqBox.hidden = false;
  animate(seqBox, [{ transform: 'translate(-50%, -140%)', opacity: 0 }, { transform: 'translate(-50%, 0)', opacity: 1 }], { duration: 500, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'none' });
  audio.preload([word.audio, ...word.syllables.map((s) => s.audio), ...seq.foils.map((f) => f.audio)]);
}

/** The next pair: the word's next syllable and its foil (a new word first, when the last one is built). */
async function nextSyllable() {
  if (!seq) {
    word = queue.next();
    if (!word || queue.finished) return endLap();
    showWord();
    await sleep(450);
  }
  launchPair(sylOptions(word.syllables[seq.i], seq.foils[seq.i]));
}

/** A right gate: its syllable plays and the next stone lights, and stays lit. */
async function passRightSyllable(gate) {
  audio.play(gate.opt.audio);
  const stone = seq.stones[seq.i];
  coinFlight = flyCoin(gate.el.querySelector('.panel'), stone, '★').then(() => stone.classList.add('lit'));
  seq.i++;
  streak++;
  cruise = 2.2 * (1 + 0.08 * Math.min(streak, 6));
  motion.target = cruise;
  await afterPass();
}

/** The word is built: it plays, its stones light in turn with their syllables, the word again; then the track
 * turns into a new scene for the next word. The kart drives on throughout. */
async function completeWord() {
  phase = 'celebrate';
  shell.lock();
  await coinFlight; // the last stone lights before the word is sung
  const clean = queue.done();
  memory.seen(word.id, clean);
  talking++;
  try {
    await sleep(250);
    seq.banner.classList.add('sing');
    await audio.play(word.audio);
    seq.banner.classList.remove('sing');
    await sleep(300);
    for (let i = 0; i < seq.stones.length; i++) {
      seq.stones[i].classList.add('sing');
      await audio.play(word.syllables[i].audio);
      seq.stones[i].classList.remove('sing');
      await sleep(110);
    }
    await sleep(250);
    seq.banner.classList.add('sing');
    sfx.cheer();
    const b = seq.banner.getBoundingClientRect();
    confetti(b.left + b.width / 2, b.top + b.height / 2, 36);
    await audio.play(word.audio);
    seq.banner.classList.remove('sing');
    if (clean) { await flyCoin(seq.banner, shell.progressEl.children[strip.count], '★'); strip.add(hasPicture(word) ? `<img src="${word.image}" alt="">` : '⭐'); }
  } finally { talking--; }
  seq = null;
  if (queue.clean >= queue.cleanToWin || !queue.pending.length) return endLap();
  await animate(seqBox, [{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%, -60%)' }], { duration: 350, fill: 'none' });
  seqBox.hidden = true;
  await transformTrack(++trackNo);
  phase = 'cruise';
  nextItem();
}

const rgbOf = (c) => (c.match(/\d+/g) || [214, 93, 63]).slice(0, 3).map(Number);
/** The track turns into a new scene: the next picture grows out from the horizon while the road's colour blends. */
async function transformTrack(n) {
  const src = TRACKS[n % TRACKS.length];
  const next = new Image();
  next.src = src;
  await next.decode().catch(() => {});
  const from = rgbOf(roadColour), to = roadRgb(next) || from;
  const layer = el('img', 'bg bg-next');
  layer.src = src;
  road.insertBefore(layer, canvas);
  sfx.whoosh(); setTimeout(() => sfx.win(), 250);
  const r = road.getBoundingClientRect();
  confetti(r.left + VPX * W, r.top + HY * H, 30);
  const at = `at ${VPX * 100}% ${HY * 100}%`, t0 = performance.now(), ms = 1500;
  const blend = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    roadColour = `rgb(${from.map((v, i) => Math.round(v + (to[i] - v) * k))})`;
    if (k < 1) requestAnimationFrame(blend);
  };
  requestAnimationFrame(blend);
  await animate(layer, [{ clipPath: `circle(0% ${at})` }, { clipPath: `circle(130% ${at})` }], { duration: ms, easing: 'ease-in', fill: 'none' });
  bg.src = src;
  await bg.decode().catch(() => {});
  layer.remove();
}

async function endLap() {
  phase = 'done';
  await coinFlight; // the last coin lands in the strip before the finale
  pair = null; world.innerHTML = '';
  motion.target = 0;
  laps++;
  seq = null; seqBox.hidden = true;
  finale(`<div style="font-size:64px">🏁🏆</div>`, path.active || ASKED ? () => startLap(mode) : showModePicker);
}

function startLap(m) {
  mode = m;
  timed = laps > 0 && path.level > 1; // a first meeting on the path never speeds up
  streak = 0; cruise = 2.2; lastSides = []; seq = null; trackNo = 0;
  if (bg.getAttribute('src') !== TRACKS[0]) bg.src = TRACKS[0]; // every lap starts on the first road
  const seqMode = mode === 'sequence', n = seqMode ? SEQ_LAP : LAP;
  const candidates = mode === 'syllables' ? syllableWords() : seqMode ? sequenceWords() : pictureWords();
  let ordered = memory.order(candidates);
  if (seqMode) ordered = [...ordered.filter(hasPicture), ...ordered.filter((w) => !hasPicture(w))]; // the banner shows a picture where we have one
  // on the learning path: the step's focus words first, then its review words, then the game's own choice
  const chosen = path.choose(candidates, n, shuffle(ordered.slice(0, n * 2)));
  lapWords = chosen.map((w) => w.id);
  queue = new Queue(chosen, { cleanToWin: Math.min(n, chosen.length) });
  strip = progressStrip(shell, Math.min(n, chosen.length), '⭐');
  kartWrap.style.left = '50%';
  motion.target = cruise;
  phase = 'cruise';
  setTimeout(nextItem, 600);
}

function showModePicker() {
  phase = 'picker';
  motion.target = 0;
  shell.progressEl.innerHTML = '';
  const pics = shuffle(pictureWords().filter((w) => w.imageSource === 'approved')).slice(0, 2);
  const picker = document.body.appendChild(el('div', 'mode-picker', `<div class="mode-row">
    <button class="mode-btn" data-mode="syllables" aria-label="sounds"><span class="mini">${WAVE}</span><span class="mini">${WAVE}</span></button>
    <button class="mode-btn" data-mode="pictures" aria-label="pictures">${pics.map((w) => `<span class="mini"><img src="${w.image}" alt=""></span>`).join('')}</button>
    <button class="mode-btn seq" data-mode="sequence" aria-label="sequence">${SEQ_ICON}</button>
  </div>`));
  for (const b of picker.querySelectorAll('.mode-btn')) b.addEventListener('click', () => { sfx.pop(); picker.remove(); startLap(b.dataset.mode); });
}

// steering: tap the left or right half, or swipe
let down = null;
road.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
road.addEventListener('pointerup', (e) => {
  if (!down) return;
  const dx = e.clientX - down.x; down = null;
  const r = road.getBoundingClientRect();
  const side = Math.abs(dx) > 30 ? (dx < 0 ? 'left' : 'right') : (e.clientX < r.left + r.width / 2 ? 'left' : 'right');
  steer(side);
});

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    sylPool = content.words.filter((w) => !w.flags.some((f) => BAD.test(f))).flatMap((w) => w.syllables).filter((s) => s.audio && !s.flags.some((f) => BAD.test(f)));
    resize();
    if (ASKED) startLap(ASKED); else if (path.active) startLap('syllables'); else showModePicker();
  },
  replay: async () => {
    if (!word || !pair || phase === 'cruise' || phase === 'done') return;
    const gen = ++promptGen;
    await sayPrompt(gen, { wait: false });
  },
  onPause: (p) => { motion.paused = p; },
  // No idle replay: a replay pauses the kart, and the idle timer (armed when a pair starts) ran out just before the
  // gates arrived, halting the kart there for the whole replay. The pair arriving already answers a child who does
  // nothing (through the middle, the right gate speaks). The replay button still replays and pauses.
  onIdle: () => {},
});
shell.lock();

resize();
requestAnimationFrame(frame);

// for the play-check script
window.__game = {
  get phase() { return phase; }, get mode() { return mode; }, get locked() { return shell.locked || talking > 0; },
  get answer() { return pair?.gates.find((g) => g.opt.right)?.side; }, get word() { return word?.display; },
  get clean() { return queue?.clean ?? 0; }, get words() { return lapWords; }, get streak() { return streak; }, get z() { return gateZ(); },
  get seq() { return seq && { i: seq.i, n: word.syllables.length, missed: seq.missed, lit: seq.stones.filter((s) => s.classList.contains('lit')).length }; },
  get paused() { return motion.paused; }, get v() { return motion.v; },
  get target() { return pair?.gates.find((g) => g.opt.right)?.opt.text; }, get track() { return bg.getAttribute('src'); }, get trackNo() { return trackNo; },
  get syllables() { return mode === 'sequence' && word ? word.syllables.map((s) => s.text) : null; },
  pickMode: (m) => document.querySelector(`.mode-btn[data-mode="${m}"]`)?.click(),
  steer,
};
