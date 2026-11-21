// build.mjs: builds the learning path (path.json) from the content kit, the scenes and each game's fit.js.
//
//   node dev/games/path/build.mjs            (from the repo root, after the kit is rebuilt)
//
// Units are the scenes of scenes.json, in order, each with its words in teaching order (the idea and the Yorùbá
// titles from the curriculum draft, v4 Ìpele 1; a second visit is planned there, not a leftover). Only words the
// path's gates include (profile "path", lenient) and that some meaning game can show go on it. Every compound comes
// after its parts (kit `components`, recursively): a part placed later is pulled forward, and a compound waits for a
// sitting after the one that taught its parts. A unit is split into sittings of at most four new words (the draft's
// load cap for Ìpele 1), no two of an apart pair together. A sitting is a short row of stones:
//   0. Warm-up (level 2-3): earlier words that are due back, and the known parts of today's compounds (hear the part,
//      then the whole); never a new word;
//   1. Teach (level 1): every new word's first stone, in a game whose answer is findable or has two choices;
//   2. Practice (level 2): the new words again, with words that are due mixed in;
//   3. Sound (level 1): the new words' syllables, in one voice, only words whose tones are clear (toneClear);
//   4. Tone: a tone pair when its second word arrives, and again whenever the pair is due back;
//   5. Check (level 1): a short true-or-silly recall of the sitting's new words.
// A unit ends with an Understand stone (Sort It, Grandma's Errand) over its words.
//
// Earlier words come back on the curriculum's chain (v4 principle 5): within 2 sittings of being taught, then
// within 5, then 10, then at least every 20. Each stone's review slots (as many as its round has room for) take the
// known words it can use, the soonest due first. The report lists every missed return.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { VERB_APART } from '../verbs.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAMES = path.join(HERE, '..');
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const nfc = (s) => (s ?? '').normalize('NFC');

const content = read(path.join(GAMES, 'content', 'content.json'));
const curriculum = read(path.join(HERE, 'curriculum.json'));
const sceneFile = read(path.join(HERE, 'scenes.json'));
const scenes = sceneFile.scenes; // our scenes, in order
const NEW_PER_MEETING = 4;
const CHAIN = [2, 5, 10, 20]; // sittings until the next return: after teaching, then after each return (v4 principle 5)
const VARIETY = 3;
const USE_WEIGHT = 0.25;

// Function words the draft teaches inside sentences (pronouns, particles, bound prefixes) are not game prompts
// on their own: a child cannot be asked to find "ń".
const NOT_ALONE = new Set(['pronoun', 'particle', 'prefix']);
// Words kept off the path by hand, with the reason (scenes.json held).
const HELD = sceneFile.held ?? {};
const onPath = (w) => (!w.inclusion || w.inclusion.path === 'included') && (w.standalone ?? !NOT_ALONE.has(w.category)) && !HELD[w.id];
const words = content.words.filter(onPath);
const byId = new Map(words.map((w) => [w.id, w]));
const byDisplay = new Map(words.map((w) => [nfc(w.display), w]));
const kitById = new Map(content.words.map((w) => [w.id, w]));

/** A word whose recorded tones are clearly its written tones: the tone model heard the written tones (no high/low
 * swap) and is at least 0.9 sure of every syllable. The bar for tone stones and for the words of sound stones; meaning
 * games keep the lenient profile. pWritten is the tone model's own confidence, not yet validated against listeners:
 * a provisional bar, not a measurement of what a child hears. Same rule as engine.js toneClear, which applies it
 * when a sound game fills its round. (No game plays the canonical syllable clips of content/syllables.json yet; one
 * that does should also require canonical.toneClear.) */
const toneClear = (w) => {
  const t = w?.tone, l = t?.learner;
  return !!l && l.matchesWritten === true && l.highLowSwaps === 0 && (t.perSyllable ?? []).every((s) => s.pWritten >= 0.9);
};

// Sound stones are level 1: Gate Rally's sequence lap is then three words of at most two syllables (rally/app.js
// SEQ_LAP, SEQ_MAX), so a stone lists only words the lap will play.
const LEVEL1 = { 'rally:sequence': { maxSyllables: 2, maxFocus: 3 } };
const level1Ok = (fit, w) => w.syllables.length <= (LEVEL1[`${fit.game}:${fit.mode}`]?.maxSyllables ?? Infinity);
// Every game that has a fit.js.
const fits = [];
for (const dir of fs.readdirSync(GAMES)) {
  const f = path.join(GAMES, dir, 'fit.js');
  if (!fs.existsSync(f)) continue;
  const mod = await import(pathToFileURL(f).href);
  // A game's own keep-apart pairs (look-alike or same-meaning words it never shows together) travel with its fit.
  // A game with several modes (Gate Rally: syllables, pictures, sequence) offers each as its own choice, with its
  // own job and word rule; the stone opens the game in that mode.
  if (mod.modes?.length) for (const m of mod.modes) fits.push({ ...mod.fit, ...m, game: mod.fit.game, mode: m.mode, apart: mod.APART ?? [], ...(LEVEL1[`${mod.fit.game}:${m.mode}`]?.maxFocus ? { maxFocus: LEVEL1[`${mod.fit.game}:${m.mode}`].maxFocus, roundSize: LEVEL1[`${mod.fit.game}:${m.mode}`].maxFocus } : {}) });
  else fits.push({ ...mod.fit, apart: mod.APART ?? [] });
}
// canUse gets the kit as a second argument (Put It Together checks a compound's parts). A sound game hears only
// words whose tones are clear.
const usableBy = (fit, w) => !!w && (fit.voices !== 'single' || (w.person ?? 'Femi') === 'Femi') && (fit.job !== 'sound' || (toneClear(w) && level1Ok(fit, w))) && fit.canUse(w, byId);
const fitOf = (game, mode) => fits.find((f) => f.game === game && (mode === undefined || (f.mode ?? null) === (mode ?? null)));
const key = (f) => f.mode ? `${f.game}:${f.mode}` : f.game; // variety is per game and mode

// Never two of these in one sitting's new words, or in one stone (synonyms, or pictures that look alike), plus a
// game's own pairs in its stones.
const APART = [...(sceneFile.apart ?? []), ...VERB_APART];
const clash = (a, b, extra = []) => a !== b && [...APART, ...extra].some((p) => p.includes(a) && p.includes(b));
const fitsIn = (id, ids, f) => !ids.some((x) => clash(x, id, f?.apart));

// Games that show what a word means (a picture with its word, or an action on a thing). Drum, River, Rally
// (syllables, sequence) and Train only work on a word's sounds: they never come before a word's meaning has been
// shown. Put It Together only builds a compound whose parts the child already knows.
const soundOnly = (f) => f.job === 'sound';
const together = fitOf('together');
const meaningFits = fits.filter((f) => !soundOnly(f) && f.game !== 'together');
const showsMeaning = (id) => meaningFits.some((f) => usableBy(f, byId.get(id)));

// Tone pairs: words that differ only in tone, same speaker (across two voices a child could tell them apart by
// the voice, not the tone), both with clear tones. A pair that fails the bar is listed to re-record.
const toneless = (s) => nfc(s).normalize('NFD').replace(/[̀́̄]/g, '').normalize('NFC').toLowerCase();
const parrot = fitOf('parrot');
const tonePairs = [], tonePairsUnclear = [];
{
  // held words too, so a pair kept off the path is still listed when its tones are not clear
  const ws = content.words.filter((w) => onPath({ ...w, id: '' }) && parrot?.canUseInPair?.(w));
  for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) {
    const [a, b] = [ws[i], ws[j]];
    if (toneless(a.display) === toneless(b.display) && nfc(a.display) !== nfc(b.display) && a.person === b.person) {
      (toneClear(a) && toneClear(b) ? tonePairs : tonePairsUnclear).push([a.id, b.id]);
    }
  }
}

// Units: each scene's words, in its order. Words no meaning game can show wait; a scene on hold keeps all its words
// waiting. A word marked ● on the path page is one of the curriculum's (an item of the scene's suggestedBy units).
const placed = new Set();
const units = [];
const curriculumUnit = new Map(curriculum.map((u) => [u.unit, u]));
const notPlaced = [];
for (const scene of scenes) {
  const fromCurriculum = new Set((scene.suggestedBy ?? []).flatMap((u) => curriculumUnit.get(u)?.items ?? []).flatMap((it) => it.wordIds));
  const ws = [], waiting = [];
  for (const d of scene.words) {
    const w = byId.get(d) ?? byDisplay.get(nfc(d));
    if (!w) { notPlaced.push({ scene: scene.id, word: d, why: HELD[d] ? 'held' : kitById.has(d) ? 'not on the path: gates or not standalone' : 'not in the kit' }); continue; }
    if (placed.has(w.id)) continue;
    placed.add(w.id);
    if (!scene.hold && showsMeaning(w.id)) ws.push({ id: w.id, source: fromCurriculum.has(w.id) ? 'curriculum' : 'scene' }); else waiting.push(w.id);
  }
  units.push({ id: scene.id, yo: scene.yo, en: scene.en, art: scene.art, hold: scene.hold, words: ws, waiting });
}
// Curriculum words that could be on the path but are in no scene: listed, never dropped silently.
const curriculumUnplaced = [...new Set(curriculum.flatMap((u) => u.items.flatMap((it) => it.wordIds)))]
  .filter((id) => byId.has(id) && !placed.has(id) && showsMeaning(id));

// Building blocks first (curriculum v4 principle 2): every compound after its parts, recursively. A part placed
// later is pulled forward to just before the compound (into the compound's unit), until nothing moves.
const flat = () => units.flatMap((u) => u.words.map((w) => ({ id: w.id, unit: u })));
const pathIds = new Set(flat().map((x) => x.id));
const partsOf = (id) => [...new Set((byId.get(id)?.components ?? []).filter((c) => c !== id && pathIds.has(c)))];
for (let guard = 0, moved = true; moved && guard < 500; guard++) {
  moved = false;
  const f = flat();
  for (let i = 0; i < f.length && !moved; i++) {
    for (const part of partsOf(f[i].id)) {
      const p = f.findIndex((x) => x.id === part);
      if (p < i) continue;
      const from = f[p].unit, to = f[i].unit;
      const w = from.words.splice(from.words.findIndex((x) => x.id === part), 1)[0];
      to.words.splice(to.words.findIndex((x) => x.id === f[i].id), 0, { ...w, pulledFor: f[i].id });
      moved = true;
      break;
    }
  }
}

// Sittings, stones, spaced return.
const known = [];            // words taught so far, in order
const sittings = [];         // every meeting in order (its index is the sitting number)
const state = new Map();     // word -> { taught, last, returns }: its place on the return chain
const pairState = new Map(); // tone pair -> the same
const missed = [];           // returns later than the chain allows
const recent = [];           // games of the last stones, for variety
const uses = (k) => recent.filter((g) => g === k).length;
const dueAt = (st) => st.last + CHAIN[Math.min(st.returns, CHAIN.length - 1)];
// Known words in the order they should come back: the soonest due first (overdue first of all).
const dueOrder = () => [...state.entries()].sort(([, a], [, b]) => dueAt(a) - dueAt(b) || a.last - b.last).map(([id]) => id);
const mustReturn = (s) => dueOrder().filter((id) => dueAt(state.get(id)) <= s);
// A compound Put It Together can build now: it can play it and every component is a word the child knows.
const togetherReady = (id) => !!together && usableBy(together, byId.get(id)) && byId.get(id).components.every((c) => known.includes(c));
const pickGame = (jobs, focus, exclude = [], pool = meaningFits) => {
  const scored = pool.filter((f) => jobs.includes(f.job) && !exclude.includes(key(f)))
    .map((f) => {
      // A game takes at most maxFocus path words (the yard holds three animals); the rest go to another stone.
      const covered = [];
      for (const id of focus) {
        if (covered.length >= (f.maxFocus ?? Infinity) || !usableBy(f, byId.get(id))) continue;
        if (!fitsIn(id, covered, f)) continue;
        covered.push(id);
      }
      const fill = words.filter((w) => usableBy(f, w)).length;
      return { f, covered, ok: covered.length > 0 && covered.length >= Math.min(f.minFocus ?? 1, focus.length) && fill >= Math.min(f.roundSize ?? 1, 2) };
    })
    .filter((x) => x.ok)
    // Coverage, less a penalty for a game played in the last few stones (variety: no game every sitting),
    // and a smaller one for how often it has been used on the whole path, so games that fit fewer words (Train,
    // House, Hungry) get their turns instead of the games that fit nearly everything (Parrot, Fishing) taking them all
    .map((x) => ({ ...x, score: x.covered.length - (recent.slice(-6).includes(key(x.f)) ? VARIETY : 0) - USE_WEIGHT * uses(key(x.f)) }))
    .sort((a, b) => b.score - a.score || recent.lastIndexOf(key(a.f)) - recent.lastIndexOf(key(b.f)));
  return scored[0] ?? null;
};
// Room for review words in a stone: the game's round less its focus words (path.choose fills focus first, then
// review, so a review word beyond this would not play). An estimate: some games play a shorter round at level 1.
const room = (f, focus) => Math.max(0, (f.roundSize ?? 4) - focus.length);
// Review words for a stone: known words the game can use (first), then the soonest due, none clashing with the rest.
const reviewFor = (f, focus, n, first = []) => {
  const out = [];
  for (const id of [...first, ...dueOrder()]) {
    if (out.length >= n) break;
    if (!state.has(id) || out.includes(id) || focus.includes(id) || !usableBy(f, byId.get(id))) continue;
    if (!fitsIn(id, [...focus, ...out], f)) continue;
    out.push(id);
  }
  return out;
};
// The warm-up: of the games that suit one, the one that can show the most of what must come back now (and the known
// parts of today's compounds), filled up with what is due soonest.
const WARMUP = ['parrot', 'fish', 'visit', 'hungry', 'giant', 'say', 'doit', 'yard', 'house'];
const warmupFor = (s, parts) => {
  const must = [...new Set([...parts, ...mustReturn(s)])];
  const best = WARMUP.map((g) => fitOf(g)).filter(Boolean).map((f) => {
    const covered = [];
    for (const id of [...must, ...dueOrder()]) {
      if (covered.length >= Math.min(f.roundSize ?? 4, f.maxFocus ?? Infinity)) break;
      if (!covered.includes(id) && usableBy(f, byId.get(id)) && fitsIn(id, covered, f)) covered.push(id);
    }
    const n = covered.filter((id) => must.includes(id)).length;
    // the sitting ends with the parrot's check, so the warm-up prefers another game when one does as well
    return { f, covered, score: n * 2 + covered.length * 0.1 - (recent.slice(-5).includes(key(f)) ? 1.5 : 0) - (f.game === 'parrot' ? 1 : 0) };
  }).sort((a, b) => b.score - a.score)[0];
  return best?.covered.length ? best : null;
};
// Level by how well the stone's words are known: 2 while any has come back fewer than twice, else 3 (the game as it
// is today). A word's first stone is always a teach stone at level 1.
const levelOf = (ids) => ids.some((id) => (state.get(id)?.returns ?? 0) < 2) ? 2 : 3;
// A word appears in sitting s: a return on the chain (once per sitting); a late one is recorded.
const appear = (id, s) => {
  const st = state.get(id);
  if (!st || st.last >= s) return;
  if (s > dueAt(st)) missed.push({ word: id, due: dueAt(st), back: s });
  st.last = s; st.returns++;
};

// Catch-up: a word due back in sitting s that no stone carries gets a warm-up stone of its own (at stones[at]), in a
// game that can show it (a command in Do It, a phrase in Say...).
const catchUp = (s, stones, carried, at) => {
  for (let guard = 0; guard < 3; guard++) {
    const owe = mustReturn(s).filter((id) => !carried.has(id));
    if (!owe.length) break;
    const pick = pickGame(['teach', 'practice', 'check', 'apply'], owe, [], meaningFits);
    if (!pick) break;
    recent.push(key(pick.f));
    stones.splice(at, 0, { id: null, game: pick.f.game, ...(pick.f.mode ? { mode: pick.f.mode } : {}), job: 'warmup', level: levelOf(pick.covered), focus: pick.covered, review: [] });
    for (const id of pick.covered) carried.add(id);
  }
};

const out = [];
const partHeard = []; // [part, whole, stone]: the part heard in the same sitting the whole is taught, before or with it
for (const u of units) {
  if (!u.words.length) { out.push({ id: u.id, yo: u.yo, en: u.en, art: u.art, hold: u.hold, words: [], waiting: u.waiting, meetings: [] }); continue; }
  const queue = u.words.map((w) => w.id);
  const meetings = [];
  while (queue.length) {
    // Up to four new words; a compound waits until its parts are known from an earlier sitting, and no two
    // words of an apart pair share a sitting.
    const fresh = [];
    for (let i = 0; i < queue.length && fresh.length < NEW_PER_MEETING; i++) {
      const id = queue[i];
      if (partsOf(id).some((p) => !known.includes(p))) continue;
      if (!fitsIn(id, fresh)) continue;
      fresh.push(id);
    }
    if (!fresh.length) fresh.push(queue[0]); // only if a part never arrives; the report counts compounds before parts
    for (const id of fresh) queue.splice(queue.indexOf(id), 1);

    const s = sittings.length;
    const sid = `${u.id}.m${meetings.length + 1}`;
    const stones = [];
    const add = (f, job, level, focus) => {
      recent.push(key(f));
      const stone = { id: null, game: f.game, ...(f.mode ? { mode: f.mode } : {}), job, level, focus, review: [] }; // ids once the row is final
      stones.push(stone);
      return stone;
    };
    const used = () => stones.map((x) => key(x));
    // The known parts of today's compounds: heard in the warm-up, before the whole is taught.
    const parts = [...new Set(fresh.flatMap(partsOf))];
    // 0. Warm-up: what is due back, in a game that can show it (never a new word: its words are all known).
    const warm = warmupFor(s, parts);
    const warmup = warm ? add(warm.f, 'warmup', levelOf(warm.covered), [...warm.covered]) : null;
    // 1. Teach: every new word's first stone is a teach stone at level 1. A compound Put It Together can build from
    // known parts is built there (the parts are its prompt).
    const built = fresh.filter(togetherReady);
    if (built.length) add(together, 'teach', 1, built);
    let left = fresh.filter((id) => !built.includes(id));
    for (let guard = 0; left.length && guard < 4; guard++) {
      // a teaching game first; else a game whose level 1 has two choices, labelled a teach stone (level 1); the
      // parrot last, as the sitting ends with its check
      // parrot last, as the sitting ends with its check. A teaching game unless another meets two more of the words
      // at once (fewer stones: a sitting is already five or six).
      const teachGame = pickGame(['teach'], left, ['together', ...used()]), wide = pickGame(['teach', 'practice'], left, ['together', ...used()]);
      const pick = (wide && (!teachGame || wide.covered.length >= teachGame.covered.length + 2) ? wide : teachGame)
        ?? pickGame(['teach', 'practice', 'check'], left, used()) ?? pickGame(['teach', 'practice', 'check'], left);
      if (!pick) break;
      const same = stones.find((x) => x.job === 'teach' && key(x) === key(pick.f));
      if (same && same.focus.length + pick.covered.length <= (pick.f.maxFocus ?? Infinity) && pick.covered.every((id) => fitsIn(id, same.focus, pick.f))) same.focus.push(...pick.covered);
      else add(pick.f, 'teach', 1, pick.covered);
      left = left.filter((id) => !pick.covered.includes(id));
    }
    // 2. Practice: the new words again, at level 2.
    const practice = pickGame(['practice'], fresh, used());
    if (practice) add(practice.f, 'practice', 2, practice.covered);
    // 3. Sound: the syllables of new words whose meaning this sitting has shown, clear tones only (a sound stone
    // with no clear word is skipped, never filled with unclear ones).
    const shown = fresh.filter((id) => stones.some((x) => x.job === 'teach' && x.focus.includes(id)));
    const sound = shown.length ? pickGame(['sound'], shown, used(), fits) : null;
    if (sound) add(sound.f, 'sound', 1, sound.covered);
    // The new words are known from here on, on the return chain from this sitting.
    for (const id of fresh) { known.push(id); state.set(id, { taught: s, last: s, returns: 0 }); }
    // 4. Tone: a pair whose second word arrives now, and every pair that is due back (on the same chain as words).
    for (const pair of tonePairs) {
      const k = pair.join('~'), ps = pairState.get(k);
      if (!ps && pair.some((w) => fresh.includes(w)) && pair.every((w) => known.includes(w))) pairState.set(k, { taught: s, last: s, returns: 0 });
      else if (ps && dueAt(ps) <= s) { ps.last = s; ps.returns++; }
      else continue;
      stones.push({ id: null, game: 'parrot', job: 'tone', level: 1, focus: [...pair], review: [], pairs: [pair] });
    }
    // 5. Check: a short recall of the sitting's new words, true or silly (the parrot); new words the parrot cannot
    // hold up (commands, phrases) are checked in their own game.
    // (Stretchy and Wake the House have no wrong answer: they teach, they cannot check.)
    const check = pickGame(['check'], fresh, [], fits) ?? pickGame(['practice', 'apply'], fresh);
    if (check) add(check.f, 'check', 1, check.covered);
    // Review slots: each stone takes known words it can use, the soonest due first and those no other stone of the
    // sitting carries yet; a teach stone takes the known parts of its compounds first (hear the part, then the
    // whole). Warm-up and tone stones are full already.
    const carried = new Set(stones.filter((x) => x.job === 'warmup').flatMap((x) => x.focus));
    for (const x of stones) {
      if (x.job === 'tone' || x.job === 'warmup') continue;
      const f = fitOf(x.game, x.mode ?? null);
      const own = x.job === 'teach' ? [...new Set(x.focus.flatMap(partsOf))] : [];
      const order = dueOrder();
      x.review = reviewFor(f, x.focus, room(f, x.focus), [...own, ...order.filter((id) => !carried.has(id)), ...order]);
      for (const id of [...x.focus, ...x.review]) carried.add(id);
    }
    catchUp(s, stones, carried, warmup ? 1 : 0);
    stones.forEach((x, i) => { x.id = `${sid}.${i + 1}`; });
    // Hear the part, then the whole: a part in the warm-up (or a catch-up), or in its whole's own teach stone.
    for (const x of stones) {
      if (x.job === 'warmup') { for (const p of x.focus) for (const w of fresh) if (partsOf(w).includes(p)) partHeard.push([p, w, x.id]); }
      else if (x.job === 'teach') for (const w of x.focus) for (const p of partsOf(w)) if (x.review.includes(p)) partHeard.push([p, w, x.id]);
    }
    for (const x of stones) for (const id of [...x.focus, ...x.review]) appear(id, s);
    sittings.push(sid);
    meetings.push({ id: sid, newWords: fresh, review: [...new Set(stones.flatMap((x) => [...x.review, ...(x.job === 'warmup' ? x.focus : [])]))], stones });
  }
  // Understand: late in the unit, a game where the child shows they know what the unit's words mean (no picture to
  // match: Sort It puts heard words where they belong; Grandma's Errand finds the named thing among many).
  const understand = pickGame(['apply'], u.words.map((w) => w.id), [], fits);
  if (understand) {
    const s = sittings.length;
    recent.push(key(understand.f));
    const focus = understand.covered.slice(0, 8);
    const review = reviewFor(understand.f, focus, Math.max(2, room(understand.f, focus)));
    // it is a sitting of its own: what is due back then comes first
    const stones = [{ id: null, game: understand.f.game, job: 'apply', level: levelOf(focus), focus, review }];
    catchUp(s, stones, new Set([...focus, ...review]), 0);
    stones.forEach((x, i) => { x.id = `${u.id}.understand.${i + 1}`; });
    for (const x of stones) for (const id of [...x.focus, ...x.review]) appear(id, s);
    sittings.push(`${u.id}.understand`);
    meetings.push({ id: `${u.id}.understand`, newWords: [], review: [...new Set(stones.flatMap((x) => [...x.review, ...(x.job === 'warmup' ? x.focus : [])]))], stones });
  }
  out.push({ id: u.id, yo: u.yo, en: u.en, art: u.art, words: u.words, waiting: u.waiting, meetings });
}
// Returns still owed when the path ends: the last stretch counts too (a word must come back at least every 20).
const end = sittings.length;
const owed = [...state.entries()].filter(([, st]) => dueAt(st) < end - 1).map(([id, st]) => ({ word: id, due: dueAt(st), back: null }));
const missedAll = [...missed, ...owed];

// Report: what the path does and does not do, measured on its own output.
const stonesAll = out.flatMap((u) => u.meetings.flatMap((m) => m.stones));
const pathWords = out.flatMap((u) => u.words.map((w) => w.id));
const VERB_CATS = ['action', 'command', 'transfer', 'mental'];
const verbs = pathWords.filter((id) => VERB_CATS.includes(byId.get(id)?.category));
const sittingsAll = out.flatMap((u) => u.meetings);
const taughtAt = new Map(sittingsAll.flatMap((m, i) => m.newWords.map((id) => [id, i])));
const firstStone = (id) => stonesAll.find((x) => x.focus.includes(id) || x.review.includes(id));
// Femi's words the path's gates include (the single-voice games' words): how many have clear tones.
const femiPath = content.words.filter((w) => (!w.inclusion || w.inclusion.path === 'included') && (w.person ?? 'Femi') === 'Femi');
const toneKind = (w) => toneClear(w) ? 'clear' : !w.tone?.learner ? 'no evidence' : w.tone.learner.matchesWritten === false ? 'heard differently' : 'unsure';
const tally = (xs, f) => xs.reduce((m, x) => ({ ...m, [f(x)]: (m[f(x)] ?? 0) + 1 }), {});
const teaching = sittingsAll.filter((m) => m.newWords.length);
const report = {
  words: pathWords.length,
  verbs: verbs.length, verbShare: +(verbs.length / pathWords.length).toFixed(2), // a direction, not a quota: Yorùbá children's early words are largely verbs
  firstMetAtTeachL1: pathWords.filter((id) => { const x = firstStone(id); return x?.job === 'teach' && x.level === 1; }).length,
  newWordInWarmup: teaching.filter((m) => m.stones.some((x) => x.job === 'warmup' && x.focus.some((id) => m.newWords.includes(id)))).length,
  compoundsBeforeParts: pathWords.filter((id) => partsOf(id).some((p) => !(taughtAt.get(p) < taughtAt.get(id)))).length,
  missedReturns: missedAll.length,
  wordsMissingAReturn: new Set(missedAll.map((m) => m.word)).size,
  wordsNeverBack: pathWords.filter((id) => !(state.get(id)?.returns > 0)).length,
  sittings: sittingsAll.length, stones: stonesAll.length,
  stonesPerTeachingSitting: +(teaching.reduce((n, m) => n + m.stones.length, 0) / teaching.length).toFixed(1),
  teachingSittingsWithCheck: teaching.filter((m) => m.stones.some((x) => x.job === 'check')).length + ` of ${teaching.length}`,
  soundStones: stonesAll.filter((x) => x.job === 'sound').length,
  toneStones: stonesAll.filter((x) => x.job === 'tone').length,
  partThenWhole: partHeard.length,
  waiting: out.flatMap((u) => u.waiting).length,
  femiPathWordsToneClear: `${femiPath.filter(toneClear).length} of ${femiPath.length}`,
  femiPathWordsTone: tally(femiPath, toneKind),
};
const left = words.filter((w) => !placed.has(w.id));
fs.writeFileSync(path.join(HERE, 'path.json'), JSON.stringify({
  builtAt: new Date().toISOString(), kitBuiltAt: content.builtAt, games: fits.map((f) => ({ game: f.game, ...(f.mode ? { mode: f.mode } : {}), job: f.job, voices: f.voices })),
  report, tonePairs, reRecordForTonePair: tonePairsUnclear, missedReturns: missedAll, partThenWhole: partHeard,
  pulledForward: units.flatMap((u) => u.words.filter((w) => w.pulledFor).map((w) => ({ part: w.id, for: w.pulledFor }))),
  held: HELD, heldUnits: units.filter((u) => u.hold).map((u) => ({ unit: u.id, why: u.hold, words: u.waiting })),
  curriculumUnplaced, sceneWordsNotPlaced: notPlaced, units: out.filter((u) => u.meetings.length), offPath: left.map((w) => w.id),
}, null, 1));
const show = (id) => byId.get(id)?.display ?? kitById.get(id)?.display ?? id;
console.log(`${out.filter((u) => u.meetings.length).length} units, ${sittingsAll.length} sittings, ${stonesAll.length} stones (${fits.length} games).`);
console.log(JSON.stringify(report));
for (const u of out) console.log(`  ${u.id.padEnd(9)} ${u.en.padEnd(36)} ${String(u.words.length).padStart(3)} words: ${u.hold ? `on hold, ${u.waiting.length} waiting` : u.meetings.map((m) => m.stones.map((x) => x.game).join('+')).join(' | ')}`);
console.log(`Missed returns (${missedAll.length}): ${missedAll.map((m) => `${show(m.word)} due ${m.due}, back ${m.back ?? 'never'}`).join('; ') || 'none'}`);
console.log(`Tone pairs played: ${tonePairs.map((p) => p.map(show).join('/')).join(', ') || 'none'}. Re-record for a tone pair (tones not clear): ${tonePairsUnclear.map((p) => p.map(show).join('/')).join(', ') || 'none'}.`);
console.log(`Femi path words with clear tones: ${report.femiPathWordsToneClear} (${Object.entries(report.femiPathWordsTone).map(([k, n]) => `${n} ${k}`).join(', ')}).`);
if (curriculumUnplaced.length) console.log(`Curriculum words in no scene: ${curriculumUnplaced.map(show).join(', ')}`);
if (notPlaced.length) console.log(`Scene words not placed: ${notPlaced.map((x) => `${x.word} (${x.why})`).join(', ')}`);
console.log(`Off the path (in no scene, not held): ${left.map((w) => w.id).join(', ')}`);
