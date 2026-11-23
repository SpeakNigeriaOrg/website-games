// Gate Rally on the learning path: which words it can use. Pure module (the path page imports it too).
// The path plays the syllables lap by default (hear which gate's syllable is in the word): a one-word, 2- or
// 3-syllable take with clean syllable clips. `modes` lists every mode for the path builder; the path opens one
// with ?mode=syllables|pictures|sequence.
export const BAD = /clip|no_speech|repair_rejected|more_than_one_utterance/;
export const CONCRETE = new Set(['animal', 'food', 'object', 'body', 'placeNature', 'people']);

/** A single word of min-max syllables, clean take, clean syllable clips. */
const cleanWord = (w, min, max) => !!w && w.syllables.length >= min && w.syllables.length <= max && !/\s/.test(w.display.trim())
  && !w.flags.some((f) => BAD.test(f)) && w.syllables.every((s) => s.audio && !s.flags.some((f) => BAD.test(f)));
/** Syllables mode: a single word of 2-3 syllables, clean take, clean syllable clips. */
export const syllableWord = (w) => cleanWord(w, 2, 3);
/** Sequence mode (build the word gate by gate, its syllables in order): the same rule, 2-4 syllables (the level
 * sets the most: 2, 3, 4). */
export const sequenceWord = (w) => cleanWord(w, 2, 4);
/** Pictures mode: a clear (not doubted) picture of something concrete. */
import { VERBS } from '../verbs.js';
// Pictures mode: concrete things, and the vetted verbs (an action picture on a gate works as well).
export const pictureWord = (w) => !!w && !!w.image && !w.imageCheck && (CONCRETE.has(w.category) || VERBS.includes(w.id)) && !w.flags.some((f) => BAD.test(f));

export const fit = {
  game: 'rally',
  job: 'sound',
  voices: 'single', // the gates speak syllables cut from other words
  minFocus: 1,
  roundSize: 8,
  curated: [],
  canUse: syllableWord,
};

/** Every mode, for the path builder (rally/?path=..&mode=<mode>; no mode: syllables). canUse is pure. */
export const modes = [
  { mode: 'syllables', job: 'sound', canUse: syllableWord, roundSize: 8 },   // which gate's syllable is in the word
  { mode: 'pictures', job: 'practice', canUse: pictureWord, roundSize: 8 },  // steer through the word's picture
  { mode: 'sequence', job: 'sound', canUse: sequenceWord, roundSize: 4 },    // the word's syllables gate by gate, in order
];
