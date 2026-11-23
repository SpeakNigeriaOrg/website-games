// The learning path page: units as rows of stepping stones (path.json, from build.mjs). The next stone bobs;
// done stones carry a star (the games' finale records them in localStorage). Tapping a stone opens its game
// with the stone's words and level. Nothing here needs reading: the grown-ups panel holds all the text.
const PROGRESS = 'yo-path-progress-v1';
const progress = () => { try { return JSON.parse(localStorage.getItem(PROGRESS) || '{}'); } catch { return {}; } };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const short = (g) => (g ?? '').split(/[;(]/)[0].trim();
const JOB = { apply: 'show you understand', warmup: 'warm-up', teach: 'meet', practice: 'practise', sound: 'syllables', check: 'true or silly?', tone: 'tone pair' };
const ROW = 150;   // vertical distance between stones (px)
const SWING = 0.3; // how far stones swing left and right (fraction of the track's width)

const [plan, content] = await Promise.all([
  fetch('path.json').then((r) => r.json()),
  fetch('../content/content.json').then((r) => r.json()),
]);
const words = new Map(content.words.map((w) => [w.id, w]));
const img = (id) => (words.get(id)?.image ? `../content/${words.get(id).image}` : null);
const done = progress();
const stones = plan.units.flatMap((u) => u.meetings.flatMap((m) => m.stones));
const next = stones.find((s) => !done[s.id]);
document.getElementById('star-count').textContent = stones.filter((s) => done[s.id]).length;

// Sittings in order; the current sitting is the one holding the next stone.
const sittings = plan.units.flatMap((u) => u.meetings);
const sittingOf = new Map(sittings.flatMap((m, i) => m.stones.map((s) => [s.id, i])));
const currentSitting = next ? sittingOf.get(next.id) : Infinity;
const REST = 70;
const href = (s) => `../${s.game}/?` + new URLSearchParams({ path: s.id, focus: s.focus.join(','), review: s.review.join(','), level: s.level, ...(s.mode ? { mode: s.mode } : {}), ...(s.pairs ? { pairs: s.pairs.map((x) => x.join('~')).join(',') } : {}) });
const main = document.getElementById('path');
let index = 0;
for (const u of plan.units) {
  const unit = document.createElement('section');
  unit.className = 'unit';
  const pics = u.words.map((w) => img(w.id)).filter(Boolean).slice(0, 8);
  const list = u.words.map((w) => { const x = words.get(w.id); return `${w.source === 'curriculum' ? '●' : '○'} <b>${esc(x?.display)}</b> ${esc(short(x?.gloss))}${x?.person === 'Tolani' ? ' (Tolani)' : ''}`; }).join(' · ');
  unit.innerHTML = `<div class="banner">${u.art ? `<img class="scene" src="../art/unit_${u.art}.webp" alt="">` : ''}<div class="banner-head"><h2 lang="yo">${esc(u.yo)}</h2><span class="en">${esc(u.en)} · ${u.words.length} words</span></div>
    <div class="pics">${pics.map((p) => `<img src="${p}" alt="">`).join('')}</div><div class="words">${list}${u.waiting?.length ? `<br><i>No game can play yet:</i> ${u.waiting.map((id) => esc(words.get(id)?.display)).join(', ')}` : ''}</div></div>`;
  // Stones in order, with a rest between sittings. Within a unit, a sitting after the unit's current one is
  // locked: its stones show, but cannot be opened until the sittings before it are done. Every unit can be
  // started from its own first sitting, so a learner on a new device (progress lives in this browser only) or a
  // teacher can go straight to any unit (owner, 2026-11-20).
  const unitNext = u.meetings.flatMap((m) => m.stones).find((s) => !done[s.id]);
  const unitCurrent = unitNext ? sittingOf.get(unitNext.id) : Infinity;
  const unitStones = [];
  let y = 70;
  const rests = [];
  u.meetings.forEach((m, mi) => {
    if (mi) { rests.push({ y: y - ROW / 2 + REST / 2, done: m.stones.length && u.meetings[mi - 1].stones.every((s) => done[s.id]) }); y += REST; }
    for (const s of m.stones) { unitStones.push({ s, y, locked: sittingOf.get(s.id) > unitCurrent }); y += ROW; }
  });
  const track = document.createElement('div');
  track.className = 'track';
  track.style.setProperty('--h', `${y - ROW + 80}px`);
  unit.append(track);
  main.append(unit);
  const width = track.clientWidth;
  const points = [];
  unitStones.forEach(({ s, y, locked }, k) => {
    const x = width / 2 + Math.sin((index + k) * 1.1) * width * SWING;
    points.push([x, y]);
    const a = document.createElement(locked ? 'div' : 'a');
    a.className = `stone ${s.job}${done[s.id] ? ' done' : ''}${s === next ? ' next' : ''}${!done[s.id] && s !== next ? ' later' : ''}${locked ? ' locked' : ''}`;
    if (!locked) a.href = href(s);
    a.id = s.id;
    a.style.left = `${x}px`; a.style.top = `${y}px`;
    a.style.backgroundImage = `url(../art/game_${s.game}.png)`;
    a.setAttribute('aria-label', `${s.game}: ${s.focus.map((id) => words.get(id)?.display).join(', ')}`);
    const thumbs = document.createElement('div');
    thumbs.className = 'thumbs';
    thumbs.innerHTML = s.focus.slice(0, 3).map(img).filter(Boolean).map((p) => `<img src="${p}" alt="">`).join('');
    const right = x < width / 2;
    thumbs.style.top = `${y}px`;
    thumbs.style[right ? 'left' : 'right'] = `${right ? x + 62 : width - x + 62}px`;
    const label = document.createElement('div');
    label.className = 'label';
    label.style.left = `${x}px`; label.style.top = `${y}px`;
    label.textContent = `${JOB[s.job]} · ${s.focus.map((id) => words.get(id)?.display).join(', ')}`;
    track.append(thumbs, a, label);
  });
  for (const rest of rests) track.insertAdjacentHTML('beforeend', `<div class="rest${rest.done ? ' done' : ''}" style="top:${rest.y}px" aria-hidden="true">${rest.done ? '🌙' : '🌱'}</div>`);
  const d = points.map(([x, y], k) => (k ? `S ${(points[k - 1][0] + x) / 2} ${(points[k - 1][1] + y) / 2} ${x} ${y}` : `M ${x} ${y - 70}`)).join(' ');
  track.insertAdjacentHTML('afterbegin', `<svg aria-hidden="true"><path d="${d}"/></svg>`);
  index += unitStones.length;
}
main.insertAdjacentHTML('beforeend', `<div class="finish" aria-hidden="true">🏁</div>`);

// Coming back from a game: scroll to the next stone.
const target = next && document.getElementById(next.id);
if (target) target.scrollIntoView({ block: 'center', behavior: new URLSearchParams(location.search).has('done') ? 'smooth' : 'auto' });

const grown = document.getElementById('grown');
grown.addEventListener('click', () => {
  const on = document.body.classList.toggle('grown-up');
  document.getElementById('about').hidden = !on;
  grown.setAttribute('aria-expanded', on);
});
document.getElementById('reset').addEventListener('click', () => { try { localStorage.removeItem(PROGRESS); } catch {} location.href = location.pathname; });
window.__path = { plan, next: next?.id };
