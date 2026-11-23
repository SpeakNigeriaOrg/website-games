// Pictures for Yoruba numbers, drawn by rule from how each number is formed, so the picture says what the word
// says. Pure module: games, the demo page (numbers/) and Node all import it.
// Basic design locked by the owner on 2026-11-20 (same ring for every number, a full ring is one score, added cowries
// glow in the next group or on a new ring, taken-away places are dashed and empty): change details, not the scheme.
//
// How Yoruba builds a number (Wikipedia, "Yoruba numerals"; checked 2026-11-20):
//   1-10 are words of their own (ọ̀kan ... ẹ̀wá); so are 20 (ogún), 30 (ọgbọ̀n) and 200 (igba, "a heap of cowries").
//   Ending in 1-4: added on top of the ten below (11 oókànlá "one on ten", 21 oókànlélógún "one on twenty").
//   Ending in 5-9: taken from the ten above (15 ẹ̀ẹ́dógún "five from twenty", 25 = 30 - 5, 35 = 40 - 5).
//   Even tens from 40: twenties (40 ogójì = 20 x 2, 100 ọgọ́rùn-ún = 20 x 5, 200 = 20 x 10).
//   Odd tens from 50: ten taken from the next twenty (50 àádọ́ta = 20 x 3 - 10, 190 = 200 - 10).
// The counting forms come from counting cowries (oókàn is "owó ọ̀kan", one cowrie), so the pieces are cowries:
//   every number is drawn in one ring holding four groups of five (a full ring is one score): 1-9 fill it, a ten fills
//   two groups, a score (20) four; 30 is a score ring and a ten ring linked like a chain, one piece, because ọgbọ̀n
//   is a word of its own; a heap is 200.
//   Added ("lé", "lá": on top of): the loop starts a new group of five with the added cowries in it, glowing.
//   Taken away: empty places left in the base, as if those cowries had been taken off the string ("dín": less);
//   strings and loops group their cowries in fives, so an empty group shows at a glance.
//   Twenties: score loops side by side.

/** How n is formed: { n, base: [{ kind, count }], add: [...], take: [...] }, pieces as { kind: 'cowry'|'ten'|
 * 'score'|'thirty'|'heap', count }. Covers 1-400. */
export function decompose(n) {
  if (!Number.isInteger(n) || n < 1 || n > 400) throw new RangeError(`no rule for ${n} (1-400)`);
  if (n < 10) return { n, base: [{ kind: 'cowry', count: n }], add: [], take: [] };
  if (n === 10) return { n, base: [{ kind: 'ten', count: 1 }], add: [], take: [] };
  const u = n % 10;
  if (u >= 1 && u <= 4) { const b = decompose(n - u); return { ...b, n, add: [...b.add, { kind: 'cowry', count: u }] }; }
  if (u >= 5) { const b = decompose(n + 10 - u); return { ...b, n, take: [...b.take, { kind: 'cowry', count: 10 - u }] }; }
  // a multiple of ten
  if (n === 20) return { n, base: [{ kind: 'score', count: 1 }], add: [], take: [] };
  if (n === 30) return { n, base: [{ kind: 'thirty', count: 1 }], add: [], take: [] };
  if (n === 200) return { n, base: [{ kind: 'heap', count: 1 }], add: [], take: [] };
  if (n === 400) return { n, base: [{ kind: 'heap', count: 2 }], add: [], take: [] }; // irinwó: shown as two heaps
  if (n > 200) { const b = decompose(n - 200); return { n, base: [{ kind: 'heap', count: 1 }, ...b.base], add: b.add, take: b.take }; }
  if (n % 20 === 0) return { n, base: [{ kind: 'score', count: n / 20 }], add: [], take: [] };
  return { n, base: [{ kind: 'score', count: (n + 10) / 20 }], add: [], take: [{ kind: 'ten', count: 1 }] };
}

/** The formation in words, e.g. "20 × 3 − 10 − 5". */
export function formula(n) {
  const d = decompose(n);
  const val = { cowry: 1, ten: 10, score: 20, thirty: 30, heap: 200 };
  const part = (p) => (p.kind === 'cowry' ? `${p.count}` : p.count > 1 ? `${val[p.kind]} × ${p.count}` : `${val[p.kind]}`);
  const base = d.base.map(part).join(' + ');
  return [base, ...d.add.map((p) => `+ ${part(p)}`), ...d.take.map((p) => `− ${part(p)}`)].join(' ');
}

const C = { shell: '#f4e7c6', edge: '#6b4a2b', slit: '#6b4a2b', cord: '#8a5a2b', heap: '#d9b77e', empty: '#8f7a62', glow: '#ffc93c' };

function cowry(x, y, s) {
  // an upright cowry: an oval with a toothed slit down the middle
  const rx = s * 0.36, ry = s * 0.5;
  const teeth = [-0.25, 0, 0.25].map((t) => `<line x1="${x - rx * 0.28}" y1="${y + ry * t}" x2="${x + rx * 0.28}" y2="${y + ry * t}" stroke="${C.slit}" stroke-width="${s * 0.05}"/>`).join('');
  return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${C.shell}" stroke="${C.edge}" stroke-width="${s * 0.07}"/>` +
    `<line x1="${x}" y1="${y - ry * 0.62}" x2="${x}" y2="${y + ry * 0.62}" stroke="${C.slit}" stroke-width="${s * 0.07}"/>${teeth}`;
}

function empty(x, y, s) {
  // the place a cowry was taken from: a dashed outline, nothing inside
  return `<ellipse cx="${x}" cy="${y}" rx="${s * 0.36}" ry="${s * 0.5}" fill="#fff" stroke="${C.empty}" stroke-width="${s * 0.1}" stroke-dasharray="${s * 0.16} ${s * 0.1}"/>`;
}

const slot = (x, y, s, gone) => (gone ? empty(x, y, s) : cowry(x, y, s));

function added(x, y, s) {
  // an added cowry: the same shell on a gold glow, so it stands out from the base and from empty places
  return `<circle cx="${x}" cy="${y}" r="${s * 0.68}" fill="${C.glow}" opacity="0.85"/>` + cowry(x, y, s);
}

// Every loop is the same ring, holding four groups of five: a full ring is one score (20), so pictures differ only in
// what the ring holds; a ten fills two groups and the rest of the ring is bare cord. Taken away (`gone`): that many places, counted
// from the end of the filled groups, are empty (dashed). Added (`plus`, 1-4): the next group's space holds that many
// cowries, glowing; on a full ring (a score, a heap) the added cowries start a new ring of their own.
const ARC = 12.1, RING = 4; // cord length per position; groups of five a ring holds (a full ring is one score)
const radius = () => (RING * 6 * ARC) / (2 * Math.PI);

function loop(cx, cy, s, places, gone = 0, plus = 0, start = -Math.PI / 2) {
  // `start`: where the first place sits; the last group (empty or added) ends just before it
  const positions = RING * 6, r = radius();
  const ang = (i) => ((Math.floor(i / 5) * 6 + (i % 5) + 1) / positions) * 2 * Math.PI + start;
  // each cowry points out from the center, so its narrow side lies along the cord all round the ring
  const on = (i, draw) => { const a = ang(i), x = cx + r * Math.cos(a), y = cy + r * Math.sin(a); return `<g transform="rotate(${(a * 180) / Math.PI + 90} ${x} ${y})">${draw(x, y)}</g>`; };
  let out = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.cord}" stroke-width="${s * 0.12}"/>`;
  for (let i = 0; i < places; i++) out += on(i, (x, y) => slot(x, y, s, i >= places - gone));
  for (let j = 0; j < plus; j++) out += on(places + j, (x, y) => added(x, y, s));
  return out;
}

// Every bundle is a loop: a ten is a small loop of two groups of five, a score a large loop of four, and 30 a score
// and a ten linked like a chain (ọgbọ̀n is a word of its own; a cord between them would read as a minus sign).
const S = 16.5, PLACES = { ten: 10, score: 20, thirty: 30, heap: 0 };
const LINK = 24; // how far the chained loops overlap

function box(kind, plus) {
  // (width, height) of a piece
  if (kind === 'units' || kind === 'ten' || kind === 'score') { const d = 2 * radius() + S + 6; return [d, d]; }
  if (kind === 'thirty') { const r = radius(); return [4 * r - LINK + S + 6, 2 * r + S + 6]; }
  return [210, 160]; // heap
}

function piece(kind, x, y, gone = 0, plus = 0, count = 0) {
  // (x, y): the piece's top-left corner; count: how many a ring of units holds (1-9)
  const [w, h] = box(kind, plus);
  if (kind === 'units') return loop(x + w / 2, y + h / 2, S, count, 0, plus);
  if (kind === 'ten' || kind === 'score') return loop(x + w / 2, y + h / 2, S, PLACES[kind], gone, plus);
  if (kind === 'thirty') {
    const r = radius(), c1 = x + S / 2 + 3 + r;
    return loop(c1, y + h / 2, S, 20, Math.max(0, gone - 10)) + loop(c1 + 2 * r - LINK, y + h / 2, S, 10, Math.min(10, gone), plus, (-3 * Math.PI) / 4);
    // (the linked ring is turned so its fourth group, never used, is the part inside the overlap)
    // (the small loop starts at its bottom, so its last group, empty or added, lies on its open right side)
  }
  // heap: a mound of cowries
  let out = `<path d="M${x + 6} ${y + h - 8} Q${x + w / 2} ${y - 6} ${x + w - 6} ${y + h - 8} Z" fill="${C.heap}" stroke="${C.edge}" stroke-width="2"/>`;
  for (const [fx, fy] of [[0.3, 0.72], [0.45, 0.6], [0.6, 0.7], [0.5, 0.45], [0.38, 0.85], [0.66, 0.86], [0.52, 0.82], [0.24, 0.86], [0.76, 0.78]]) out += cowry(x + w * fx, y + h * fy, 24);
  return out;
}

function loose(n, glow = false) {
  // loose cowries in rows of five
  const cw = 30, ch = 40, cols = Math.min(5, n);
  return { w: cols * cw, h: Math.ceil(n / 5) * ch, draw: (x, y) => Array.from({ length: n }, (_, i) => (glow ? added : cowry)(x + (i % 5) * cw + cw / 2, y + Math.floor(i / 5) * ch + ch / 2, 34)).join('') };
}

function layoutRow(parts, gap = 16) {
  const w = parts.reduce((t, p) => t + p.w, 0) + gap * Math.max(0, parts.length - 1), h = Math.max(0, ...parts.map((p) => p.h));
  return { w, h, draw: (x, y) => { let cx = x, out = ''; for (const p of parts) { out += p.draw(cx, y + (h - p.h) / 2); cx += p.w + gap; } return out; } };
}

// Every number is the same ring (or a grid of them), so the picture is scaled to fill the frame.
const MIN_FRAME = 0;

/** The picture of n as an SVG string (square viewBox, white background). */
export function svg(n, { size = 512 } = {}) {
  const d = decompose(n);
  const value = { cowry: 1, ten: 10, score: 20, thirty: 30, heap: 200 };
  let gone = d.take.reduce((t, p) => t + p.count * value[p.kind], 0);
  const plus = d.add.reduce((t, p) => t + p.count, 0);
  // 1-9 are a ring holding that many (no loose cowries), so every number is drawn in the same ring
  const pieces = d.base.flatMap((p) => (p.kind === 'cowry' ? [{ kind: 'units', count: p.count }] : Array.from({ length: p.count }, () => ({ kind: p.kind }))));
  // empty places come off the last pieces first; added cowries start a new group on the last loop
  for (let i = pieces.length - 1; i >= 0 && gone > 0; i--) { const k = Math.min(gone, PLACES[pieces[i].kind] ?? 0); pieces[i].gone = k; gone -= k; }
  const last = pieces[pieces.length - 1];
  // a full ring (score) or a heap has no room: the added cowries begin a new ring, glowing (23 = a full ring and a new
  // ring holding three); a ten or the half ring of 30 takes them in its next group (14, 34)
  if (plus && (last.kind === 'score' || last.kind === 'heap')) pieces.push({ kind: 'units', count: 0, plus });
  else if (plus) last.plus = plus;
  const onLoop = true;
  const parts = pieces.map((p) => {
    const [w, h] = box(p.kind, p.plus || 0);
    return { w, h, draw: (x, y) => piece(p.kind, x, y, p.gone || 0, p.plus || 0, p.count || 0) };
  });
  // a near-square grid (3 rings: two above one; 5: three above two), so each ring stays large
  const cols = Math.ceil(Math.sqrt(parts.length));
  const rows = Array.from({ length: Math.ceil(parts.length / cols) }, (_, i) => layoutRow(parts.slice(i * cols, (i + 1) * cols)));
  const top = plus && !onLoop ? loose(plus, true) : null; // only after a heap: added cowries rest on top
  const gap = 16, baseH = rows.reduce((t, r) => t + r.h, 0) + gap * (rows.length - 1);
  const W = Math.max(...rows.map((r) => r.w), top?.w ?? 0), H = (top ? top.h + 4 : 0) + baseH;
  let y = 0, body = '';
  if (top) { body += top.draw((W - top.w) / 2, y); y += top.h + 4; }
  for (const r of rows) { body += r.draw((W - r.w) / 2, y); y += r.h + gap; }
  const pad = 6, side = Math.max(W, H, MIN_FRAME) + 2 * pad, ox = (side - W) / 2, oy = (side - H) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${side} ${side}"><rect width="${side}" height="${side}" fill="#fff"/><g transform="translate(${ox} ${oy})">${body}</g></svg>`;
}
