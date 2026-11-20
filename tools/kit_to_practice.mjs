// Rebuilds the three practice games' data (public/phonics/vocab.json,
// syllables.json, sessions.json) from the Yoruba game suite's checked content
// kit, so Phonics, Tones and Vocabulary play exactly the recordings and pictures
// the suite does: gated audio, the kit's own picture per word, no R2.
//
//   node tools/kit_to_practice.mjs                      # kit at dev/games/content
//   node tools/kit_to_practice.mjs --kit <dir>          # any other kit folder
//   node tools/kit_to_practice.mjs --check              # report only, write nothing
//
// Rerun it whenever the kit is rebuilt (scripts/buildDevGameKit.mjs in the
// platform repo), commit the three JSON files, and deploy them together with the
// kit: the games load media from /content/<path>, which is where dev/games/content
// is served once the suite deploys. The output is deterministic, so a rerun on an
// unchanged kit changes nothing.
//
// What a word needs to be used at all:
//   - inclusion.path === "included" (the suite's audio gate for its learning path);
//   - standalone, by the suite's own rule (engine.js loadContent: `standalone`,
//     else not a prefix, pronoun or particle). Bound pieces, particles and proper
//     names are never prompts or foils in the suite, so they are not here either;
//   - a picture (`image`): all three games show one. The kit's file, nothing else;
//   - a known voice. A word has one recording, so one speaker. Speakers keep the
//     games' existing keys, by person: Femi = speaker3 (his account's femi.o
//     recordings and his legacy speaker3 ones), Tolani = speaker2. The tone game's
//     measured TONE_MODEL and hum recordings are keyed on those.
//
// Syllables: the kit's own syllable clips where it has them (211 words). Words
// without them (the legacy speaker2/speaker3 recordings) are syllabified from the
// kit's display spelling by the rule below, which reproduces the kit's own split
// for 208 of its 211 syllabified words (the three it misses are ambiguous ones
// like rẹ́rìnín). Those words have no syllable clips of their own; the tone game
// reads tones off the marks and simply has no recorded syllable to replay, and
// Phonics can use them only when every syllable has a canonical clip.
//
// syllables.json (Phonics' tappable bank) holds, per speaker, one clip per
// syllable text: the kit's canonical clip for that voice (content/syllables.json)
// where one exists, else the first own clip of that text among the speaker's
// usable words. Clips are only ever the same person's, so a level stays one voice.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const KIT = path.resolve(opt('--kit') || path.join(ROOT, 'dev/games/content'));
const OUT = path.resolve(opt('--out') || path.join(ROOT, 'public/phonics'));
const CHECK_ONLY = args.includes('--check');
const MEDIA = '/content/';           // where the kit is served on games.speaknigeria.org

// Dapo (legacy speaker1) plays only in Vocabulary: Tones has no tone model or hum for him, and Phonics has no
// canonical syllable clips in his voice.
const PERSON_SPEAKER = { Femi: 'speaker3', Tolani: 'speaker2', Dapo: 'speaker1' };
const VOICES_OF = { Femi: ['femi.o', 'speaker3'], Tolani: ['Tolani', 'speaker2'], Dapo: ['speaker1'] };
const NOT_ALONE = new Set(['prefix', 'pronoun', 'particle']);   // engine.js NOT_ALONE

// Levels. The old themes, re-filled by kit category (the old word lists named
// many words the kit does not include). A theme becomes a level per speaker when
// that speaker has at least MIN_LEVEL_WORDS usable words in it; bigger ones are
// split into parts of at most MAX_LEVEL_WORDS, which keeps Phonics' bank (one
// button per distinct syllable) near the 20 the games already aim for.
const THEMES = [
  { name: 'Animals (Ẹranko)', categories: ['animal'] },
  { name: 'The Home & Objects (Nǹkan Ilé)', categories: ['object'] },
  { name: 'Body Parts (Ẹ̀yà Ara)', categories: ['body'] },
  { name: 'Action Words (Ọ̀rọ̀ Ìṣe)', categories: ['action', 'transfer'] },
  { name: 'Nature & Environment (Àyíká)', categories: ['placeNature'] },
  { name: 'Everyday Life & Food (Ìgbésí Ayé)', categories: ['food'] },
  { name: 'Time & Months (Àkókò àti Oṣù)', categories: ['time'] },
  // New: kit categories the old themes had no place for.
  { name: 'People & Greetings', categories: ['people', 'social'] },
  { name: 'Commands', categories: ['command'] }
];
const MIN_LEVEL_WORDS = 3;
const MAX_LEVEL_WORDS = 8;
const RANDOM_LEVEL_WORDS = 8;
const PHONICS_MAX_BANK = 20;   // reported, not enforced (see phonics/app.js MAX_GENERATED_BANK)

const nfc = (s) => s.normalize('NFC');
const ACUTE = '́', GRAVE = '̀', MACRON = '̄';
const toneOf = (syl) => { const d = syl.normalize('NFD'); return d.includes(ACUTE) ? 'high' : d.includes(GRAVE) ? 'low' : 'mid'; };
const bare = (ch) => ch.normalize('NFD').replace(/[̀́̄]/g, '').normalize('NFC').toLowerCase();
const isVowel = (ch) => /^[aeiouẹọ]$/.test(bare(ch));

// Yoruba syllables are (C)V, (C)Vn (nasalised vowel) or a syllabic nasal.
// gb is one consonant. An n after a vowel closes it unless a vowel follows; an
// m or n starting a syllable is syllabic when tone-marked or before a consonant.
function syllabify(text) {
  const out = [];
  for (const token of nfc(text).toLowerCase().split(/[\s-]+/)) {
    const chars = [];
    for (const c of token.replace(/[^\p{L}\p{M}]/gu, '')) {
      if (/\p{M}/u.test(c) && chars.length) chars[chars.length - 1] += c; else chars.push(c);
    }
    const ch = chars.map(nfc);
    let i = 0;
    while (i < ch.length) {
      const c = ch[i], b = bare(c);
      if ((b === 'n' || b === 'm') && (c !== b || i + 1 === ch.length || !isVowel(ch[i + 1]))) { out.push(c); i++; continue; }
      let s = '';
      if (!isVowel(c)) { s += c; i++; if (b === 'g' && ch[i] && bare(ch[i]) === 'b') { s += ch[i]; i++; } }
      if (i < ch.length && isVowel(ch[i])) {
        s += ch[i]; i++;
        if (ch[i] === 'n' && (i + 1 === ch.length || !isVowel(ch[i + 1]))) { s += 'n'; i++; }
      }
      out.push(nfc(s));
    }
  }
  return out;
}

// The Vocabulary game's hint: the English half of the id. Ids are
// <romanized Yoruba>_<english>, and both halves can hold underscores now
// ("omo_daadaa_good_child", "egbon_older_sibling"), so the Yoruba half is found
// by romanizing the display spelling rather than by cutting at an underscore.
// Falls back to the last underscore (the game's own englishOf) if they disagree.
function englishHint(id, display) {
  const roman = display.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z\s-]/g, '').trim().replace(/\s+/g, '_');
  const rest = id.startsWith(roman + '_') ? id.slice(roman.length + 1) : id.slice(id.lastIndexOf('_') + 1);
  return rest.replace(/_/g, ' ');
}

const content = JSON.parse(fs.readFileSync(path.join(KIT, 'content.json'), 'utf8'));
const canonicalKit = JSON.parse(fs.readFileSync(path.join(KIT, 'syllables.json'), 'utf8'));
const exists = (rel) => fs.existsSync(path.join(KIT, rel));

// The syllabifier must agree with the kit wherever the kit has syllables.
const kitSplit = content.words.filter((w) => w.syllables?.length);
const disagree = kitSplit.filter((w) => syllabify(w.syllables.map((s) => s.text).join(' ').replace(/ /g, '')).join('|')
  !== w.syllables.map((s) => nfc(s.text).toLowerCase()).join('|'));

// ---------------------------------------------------------------- words
const dropped = [];   // { id, display, person, reason }
const usable = [];
for (const w of content.words) {
  const drop = (reason) => dropped.push({ id: w.id, display: w.display, person: w.person, reason });
  if (w.inclusion?.path !== 'included') { drop(`audio gate: inclusion.path is ${w.inclusion?.path ?? 'missing'}`); continue; }
  if (!(w.standalone ?? !NOT_ALONE.has(w.category))) { drop(`not standalone (${w.category}); the suite never uses it as a prompt`); continue; }
  if (!w.image) { drop('no picture in the kit'); continue; }
  const speaker = PERSON_SPEAKER[w.person];
  if (!speaker || !VOICES_OF[w.person].includes(w.voice)) { drop(`unknown voice ${w.voice}/${w.person}`); continue; }
  const media = [w.audio, w.image, ...(w.syllables || []).map((s) => s.audio)];
  const missing = media.filter((p) => !p || !exists(p));
  if (missing.length) { drop(`media file missing from the kit: ${missing.join(', ')}`); continue; }
  const own = w.syllables?.length > 0;
  const syllables = own ? w.syllables.map((s) => nfc(s.text)) : syllabify(w.display);
  if (!own && syllables.join('') !== nfc(w.display).toLowerCase().replace(/[^\p{L}\p{M}]/gu, '')) {
    drop('could not syllabify its spelling'); continue;
  }
  usable.push({
    id: w.id, person: w.person, speaker, category: w.category ?? 'uncategorised',
    entry: {
      displayText: nfc(w.display),
      syllables,
      definition: w.gloss,
      hint: englishHint(w.id, w.display),
      category: w.category,
      speaker,
      voice: w.voice,
      audioUrl: MEDIA + w.audio,
      imageUrl: MEDIA + w.image,
      // The word's own clip for each syllable, or null (legacy recordings have none).
      syllableAudio: own ? w.syllables.map((s) => MEDIA + s.audio) : syllables.map(() => null),
      syllableSource: own ? 'kit' : 'derived from spelling'
    }
  });
}
usable.sort((a, b) => a.id.localeCompare(b.id));

// ---------------------------------------------------------------- syllable bank
const bank = {};   // speaker -> syllable -> { audio, tone, source }
for (const s of canonicalKit.syllables) {
  const person = Object.keys(VOICES_OF).find((p) => VOICES_OF[p].includes(s.voice));
  if (!person || !s.canonical?.audio || !exists(s.canonical.audio)) continue;
  const sp = PERSON_SPEAKER[person];
  (bank[sp] ||= {})[nfc(s.syllable)] = { audio: MEDIA + s.canonical.audio, tone: toneOf(s.syllable), source: 'canonical' };
}
for (const u of usable) {
  u.entry.syllables.forEach((syl, i) => {
    const clip = u.entry.syllableAudio[i];
    if (!clip) return;
    const table = (bank[u.speaker] ||= {});
    if (!table[syl]) table[syl] = { audio: clip, tone: toneOf(syl), source: `own clip of ${u.id}` };
  });
}
const byId = Object.fromEntries(content.words.map((w) => [w.id, w]));
const canonFromExcluded = canonicalKit.syllables.filter((s) => byId[s.canonical?.wordId]?.inclusion?.path !== 'included')
  .map((s) => `${s.syllable}<${s.canonical?.wordId}`);
const toneMismatch = canonicalKit.syllables.filter((s) => s.tone && s.tone !== toneOf(s.syllable)).map((s) => s.syllable);

// ---------------------------------------------------------------- levels
const bySpeaker = (list) => {
  const m = new Map();
  for (const u of list) { if (!m.has(u.speaker)) m.set(u.speaker, []); m.get(u.speaker).push(u); }
  return [...m.entries()].sort(([a], [b]) => b.localeCompare(a));   // speaker3 (Femi, most words) first
};
// Even parts of at most `max`: 11 words make 6 + 5, not 8 + 3.
const parts = (list, max) => {
  const n = Math.ceil(list.length / max);
  const out = [];
  let at = 0;
  for (let k = 0; k < n; k++) {
    const size = Math.floor(list.length / n) + (k < list.length % n ? 1 : 0);
    out.push(list.slice(at, at + size));
    at += size;
  }
  return out;
};
// A stable, non-alphabetical order so a level is not "all the a- words".
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const mixed = (list) => list.slice().sort((a, b) => hash(a.id) - hash(b.id) || a.id.localeCompare(b.id));

const sessions = [];
const themeSkipped = [];
let levelNumber = 0;
for (const theme of THEMES) {
  const inTheme = usable.filter((u) => theme.categories.includes(u.category));
  const groups = bySpeaker(inTheme).filter(([sp, words]) => {
    if (words.length >= MIN_LEVEL_WORDS) return true;
    themeSkipped.push(`${theme.name} — ${sp}: only ${words.length} word(s) (${words.map((w) => w.id).join(', ')}); left to Random`);
    return false;
  });
  if (!groups.length) { if (!inTheme.length) themeSkipped.push(`${theme.name}: no usable words`); continue; }
  levelNumber++;
  for (const [sp, words] of groups) {
    const split = parts(mixed(words), MAX_LEVEL_WORDS);
    split.forEach((part, k) => sessions.push({
      levelId: `Level ${levelNumber}: ${theme.name}${split.length > 1 ? ` ${k + 1}` : ''} — ${sp}`,
      category: 'themed',
      validSpeakers: [sp],
      words: part.map((u) => u.id)
    }));
  }
}
// Random: every usable word of a speaker, in a stable mixed order, in rounds of 8.
for (const [sp, words] of bySpeaker(usable)) {
  parts(mixed(words), RANDOM_LEVEL_WORDS).forEach((part, k) => sessions.push({
    levelId: `Endless Practice ${k + 1} — ${sp}`,
    category: 'endless_practice',
    validSpeakers: [sp],
    words: part.map((u) => u.id)
  }));
}

// ---------------------------------------------------------------- per-game view
// Mirrors each game's own filter, so the report says what a player can reach.
const entryOf = Object.fromEntries(usable.map((u) => [u.id, u.entry]));
const games = {
  phonics: {
    speakers: null, categories: ['themed', 'endless_practice'], min: 3,   // phonics/app.js MIN_LEVEL_WORDS
    fits: (e) => e.syllables.every((s) => bank[e.speaker]?.[s]?.audio),
    why: (e) => `no clip for ${e.syllables.filter((s) => !bank[e.speaker]?.[s]?.audio).join(', ')}`
  },
  tones: { speakers: ['speaker2', 'speaker3'], categories: ['themed', 'endless_practice'], min: 1, fits: () => true },
  vocab: { speakers: ['speaker1', 'speaker2', 'speaker3'], categories: ['themed', 'endless_practice'], min: 2, fits: () => true }
};

const lines = [];
const say = (s = '') => lines.push(s);
say(`Kit: ${KIT}`);
say(`  built ${content.builtAt}; ${content.words.length} words; ${canonicalKit.syllables.length} canonical syllables`);
say(`Usable words: ${usable.length} (${bySpeaker(usable).map(([sp, w]) => `${sp} ${w.length}`).join(', ')}); ` +
  `${usable.filter((u) => u.entry.syllableSource !== 'kit').length} syllabified from spelling`);
say(`Syllabifier vs kit: agrees on ${kitSplit.length - disagree.length}/${kitSplit.length}` +
  (disagree.length ? ` (differs: ${disagree.map((w) => w.id).join(', ')})` : ''));
if (canonFromExcluded.length) say(`Canonical syllable clips cut from a word the audio gate excludes (used as the kit gives them): ` +
  `${canonFromExcluded.length}: ${canonFromExcluded.join(' ')}`);
if (toneMismatch.length) say(`WARNING canonical tone labels that differ from the marks: ${toneMismatch.join(' ')}`);
say(`Syllable bank: ${Object.entries(bank).map(([sp, t]) => `${sp} ${Object.keys(t).length} (` +
  `${Object.values(t).filter((x) => x.source !== 'canonical').length} own clips)`).join(', ')}`);
say();
for (const [game, g] of Object.entries(games)) {
  say(`== ${game} ==`);
  const reached = new Set();
  const left = [];
  for (const s of sessions) {
    if (!g.categories.includes(s.category)) continue;
    const sp = s.validSpeakers[0];
    if (g.speakers && !g.speakers.includes(sp)) continue;
    const words = s.words.filter((id) => g.fits(entryOf[id]));
    if (words.length < g.min) { left.push(s.levelId); continue; }
    words.forEach((id) => reached.add(id));
    const bankSize = new Set(words.flatMap((id) => entryOf[id].syllables)).size;
    say(`  ${String(words.length).padStart(2)} words${game === 'phonics' ? `, bank ${String(bankSize).padStart(2)}${bankSize > PHONICS_MAX_BANK ? '!' : ' '}` : ''}  ${s.levelId}`);
  }
  if (left.length) say(`  levels empty in this game: ${left.join('; ')}`);
  const out = usable.filter((u) => !reached.has(u.id));
  const reasons = {};
  for (const u of out) {
    const why = g.speakers && !g.speakers.includes(u.speaker) ? `speaker ${u.speaker} not offered`
      : !g.fits(u.entry) ? g.why(u.entry) : 'only in levels below its minimum (the game moves these into a "Random Mix" level)';
    (reasons[why] ||= []).push(u.id);
  }
  say(`  reaches ${reached.size}/${usable.length} usable words` + (out.length ? '; not reached:' : ''));
  for (const [why, ids] of Object.entries(reasons)) say(`    ${why}: ${ids.join(', ')}`);
  say('  (tone-pattern sets are built in the browser from these words)');
  say();
}
say(`Themes not made into a level: ${themeSkipped.length ? '' : 'none'}`);
themeSkipped.forEach((t) => say(`  ${t}`));
say();
const reasonCount = {};
dropped.forEach((d) => { const k = d.reason.replace(/:.*$/, ''); reasonCount[k] = (reasonCount[k] || 0) + 1; });
say(`Kit words dropped: ${dropped.length} (${Object.entries(reasonCount).map(([k, v]) => `${k} ${v}`).join('; ')})`);
for (const d of dropped) say(`  ${d.id.padEnd(34)} ${d.person.padEnd(7)} ${d.reason}`);
console.log(lines.join('\n'));

if (!CHECK_ONLY) {
  const write = (name, data) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2) + '\n');
  const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  write('vocab.json', entryOf);
  write('syllables.json', Object.fromEntries(Object.keys(bank).sort().map((sp) => [sp, sortKeys(bank[sp])])));
  write('sessions.json', sessions);
  console.log(`\nWrote vocab.json (${usable.length} words), syllables.json, sessions.json (${sessions.length} levels) to ${OUT}`);
}
