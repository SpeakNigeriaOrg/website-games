// Say the Right Thing: a little scene plays and freezes at the moment something must be said (someone trips,
// grandma gives a gift, the cup overflows, a toddler reaches for a hot pot, a muddy biscuit, a rumbling tummy).
// Two identical speech balloons appear and each speaks its phrase in turn; the child taps the one that fits,
// and the scene resumes with the happy reaction. A wrong balloon gets a puzzled "huh?", the balloons swap places
// and speak again. Only clean turns count; a missed scene comes back two scenes later.
// Listening test: the balloons look identical and carry no text; which phrase fits is only in the audio.
// Distractors are only phrases that clearly do not fit the scene (e.g. never pẹ̀lẹ́ against a spill).
import { loadContent, createShell, audio, sfx, Queue, memory, progressStrip, animate, confetti, ghost, finale, shuffle, pick, sleep, el, onTap, centre, path } from '../engine/engine.js';
import { fit, SCENES } from './fit.js';

const READING = new URLSearchParams(location.search).has('read');
const $ = (id) => document.getElementById(id);
const scene = $('scene'), fa = $('frameA'), fb = $('frameB'), balloonsEl = $('balloons'), hearts = $('hearts');

const cue = {
  trip: () => { sfx.bump(); sfx._noise(0.25, 0.2, 900, 200); },
  gift: () => sfx.pop(),
  pour: () => { sfx._noise(0.5, 0.12, 2500, 600); },
  hot: () => { sfx._noise(0.8, 0.07, 6000, 3000); },
  dirty: () => { sfx._tone(210, 0.6, 'sawtooth', 0.03, 1.1); },
  hungry: () => { sfx._tone(70, 0.7, 'sine', 0.25, 1.6); setTimeout(() => sfx._tone(60, 0.5, 'sine', 0.2, 1.4), 350); },
};
const art = (id, f) => `../art/say_${id}_${f}.png`;

const BALLOON = `<svg viewBox="0 0 200 150" aria-hidden="true">
  <path d="M100 8 C160 8 192 34 192 66 C192 98 160 122 112 122 L96 146 L88 121 C40 118 8 96 8 66 C8 34 40 8 100 8 Z"
    fill="#fff" stroke="#2b2118" stroke-width="6" stroke-linejoin="round"/>
  <circle class="dot" cx="70" cy="66" r="11"/><circle class="dot" cx="100" cy="66" r="11"/><circle class="dot" cx="130" cy="66" r="11"/>
</svg>`;

let playable = SCENES, content, queue, strip, sc, balloons = [], misses = 0, teaching = true;

function showFrame(src, ms = 350) {
  // crossfade: the new frame goes on top
  fb.src = fa.src || src;
  fb.style.opacity = 1;
  fa.src = src;
  return animate(fb, [{ opacity: 1 }, { opacity: 0 }], { duration: ms });
}

async function leadIn() {
  scene.classList.remove('frozen');
  await showFrame(art(sc.id, 'a'), 300);
  await animate(fa, [{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }], { duration: 1700, easing: 'ease-in-out', fill: 'none' });
  await showFrame(art(sc.id, 'b'), 250);
  cue[sc.id]();
  await freezeShake();
}
async function freezeShake() {
  scene.classList.add('frozen');
  await animate(scene, [{ transform: 'scale(1)' }, { transform: 'scale(1.03) rotate(-.6deg)' }, { transform: 'scale(1.02) rotate(.6deg)' }, { transform: 'scale(1)' }], { duration: 450, fill: 'none' });
}

function buildBalloons() {
  balloonsEl.innerHTML = '';
  const other = pick(sc.not.map((id) => content.byId[id]).filter((w) => w?.audio));
  balloons = shuffle([{ word: content.byId[sc.phrase], right: true }, { word: other, right: false }]).map((b) => {
    const e = el('button', 'balloon hidden', BALLOON + (READING ? `<span class="label">${b.word.display}</span>` : ''));
    e.setAttribute('aria-label', 'speech balloon'); e.dataset.choice = '';
    balloonsEl.appendChild(e);
    const obj = { ...b, el: e };
    onTap(e, () => choose(obj));
    return obj;
  });
  audio.preload(balloons.map((b) => b.word.audio));
}

async function speak(b) {
  b.el.classList.add('speaking');
  await audio.play(b.word.audio);
  b.el.classList.remove('speaking');
}

async function balloonsSpeak() {
  for (const b of balloons) {
    if (b.el.classList.contains('hidden')) {
      b.el.classList.remove('hidden');
      sfx.pop();
      await animate(b.el, [{ transform: 'scale(0)' }, { transform: 'scale(1.1)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 300, fill: 'none' });
    }
    await speak(b);
    await sleep(350);
  }
}

async function prompt() {
  cue[sc.id]();
  await freezeShake();
  await sleep(200);
  await balloonsSpeak();
}

async function choose(b) {
  if (shell.locked || !balloons.includes(b)) return;
  shell.lock();
  sfx.tap();
  await speak(b);
  if (b.right) return success(b);
  // wrong: a puzzled "huh?", the balloons swap places and speak again
  misses++;
  queue.miss();
  sfx.boing();
  animate(b.el, [{ transform: 'rotate(0)' }, { transform: 'rotate(-10deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(0)' }], { duration: 500, fill: 'none' });
  await animate(scene, [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 450, fill: 'none' });
  await sleep(300);
  const [x, y] = balloons;
  const rx = x.el.getBoundingClientRect(), ry = y.el.getBoundingClientRect();
  balloonsEl.insertBefore(y.el, x.el);
  balloons = [y, x];
  animate(x.el, [{ transform: `translate(${rx.left - x.el.getBoundingClientRect().left}px, ${rx.top - x.el.getBoundingClientRect().top}px)` }, { transform: 'none' }], { duration: 400, fill: 'none' });
  await animate(y.el, [{ transform: `translate(${ry.left - y.el.getBoundingClientRect().left}px, ${ry.top - y.el.getBoundingClientRect().top}px)` }, { transform: 'none' }], { duration: 400, fill: 'none' });
  await shell.prompt(async () => {
    await sleep(200);
    await balloonsSpeak();
    if (misses >= 2) await ghost.tap(balloons.find((q) => q.right).el);
  });
}

async function success(b) {
  balloons.filter((q) => q !== b).forEach((q) => animate(q.el, [{ opacity: 1 }, { opacity: 0, transform: 'scale(.6)' }], { duration: 300 }));
  b.el.classList.add('chosen');
  scene.classList.remove('frozen');
  await showFrame(art(sc.id, 'c'), 450);
  const clean = queue.done();
  memory.seen(sc.phrase, clean);
  sfx.cheer();
  heartBurst();
  if (clean) {
    const c = centre(scene);
    confetti(c.x, c.y);
    strip.add(`<img src="${art(sc.id, 'c')}" alt="">`);
  }
  await sleep(1800);
  teaching = false;
  nextScene();
}

function heartBurst() {
  for (let i = 0; i < 7; i++) {
    const h = hearts.appendChild(el('div', 'heart'));
    h.style.left = 15 + Math.random() * 70 + '%';
    animate(h, [{ transform: 'translateY(0) scale(.4)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translateY(-${60 + Math.random() * 80}px) scale(1)`, opacity: 0 }],
      { duration: 1400 + Math.random() * 500, delay: i * 90 }).then(() => h.remove());
  }
}

async function nextScene() {
  sc = queue.next();
  if (!sc || queue.finished) {
    finale(`<div class="finale-scenes">${playable.map((s) => `<img src="${art(s.id, 'c')}" alt="">`).join('')}</div>`, startRound);
    return;
  }
  misses = 0;
  buildBalloons();
  [art(sc.id, 'b'), art(sc.id, 'c')].forEach((src) => { const i = new Image(); i.src = src; });
  shell.lock();
  await leadIn();
  await shell.prompt(async () => {
    await sleep(250);
    await balloonsSpeak();
    if (teaching) await ghost.hoverEach(balloons.map((q) => q.el), 600);
  });
}

function startRound() {
  // tolerate a rebuilt kit: play only scenes whose phrase and at least one distractor are in it
  playable = SCENES.filter((s) => content.byId[s.phrase]?.audio && s.not.some((id) => content.byId[id]?.audio));
  if (path.active) {
    // the step's scenes first (the first one is taught with the ghost hand); 3 scenes at level 1, 4 at level 2
    const pool = playable.map((s) => content.byId[s.phrase]).filter((w) => fit.canUse(w));
    const ids = path.choose(pool, path.pickLevel([3, 4, 6]), shuffle(pool)).map((w) => w.id);
    playable = ids.map((id) => playable.find((s) => s.phrase === id));
    queue = new Queue(playable, { cleanToWin: playable.length });
  } else queue = new Queue(shuffle(playable), { cleanToWin: playable.length });
  strip = progressStrip(shell, playable.length, '💬');
  fa.removeAttribute('src');
  nextScene();
}

const shell = createShell({
  onStart: async () => {
    content = await loadContent({ voices: fit.voices });
    startRound();
  },
  replay: () => sc && prompt(),
});

window.__game = {
  get scene() { return sc?.id; }, get locked() { return shell.locked; }, get clean() { return queue?.clean ?? 0; },
  get finished() { return !!document.querySelector('.finale'); }, get misses() { return misses; },
  get phrases() { return balloons.map((b) => b.word.display); },
  get words() { return playable.map((s) => s.phrase); },
  choose(right) { const b = balloons.find((q) => q.right === right); if (b) choose(b); },
  choiceEl(right) { return balloons.find((q) => q.right === right)?.el; },
};
