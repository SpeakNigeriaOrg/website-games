// Stretchy Word on the learning path: which words it can use. Pure module (the path page imports it too).
// A picture for the creature's back, 2 to 4 syllables (one notch each), every syllable clip present, a clean take,
// and a syllable count nobody would argue about (Beat the Drum's rule: the bumps count the syllables).
import { countIsClear } from '../drum/fit.js';
import { REJECTED } from '../verbs.js';

export const WORDS = { // 2 to 4 syllables, clear pictures, syllable counts nobody would argue about
  2: ['aja_dog', 'aga_chair', 'eyin_egg', 'ata_pepper', 'oju_eye', 'keke_bicycle', 'moto_automobile', 'bata_shoe', 'isu_yam', 'mama_mother', 'awo_plate'],
  3: ['ehoro_rabbit', 'elede_pig', 'sokoto_pants', 'ijapa_tortoise', 'okere_squirrel', 'iresi_rice', 'amala_amala', 'ewuro_bitterleaf', 'patewo_clap'],
  4: ['alupupu_motorcycle', 'ketekete_donkey', 'atelewo_palm', 'amotekun_cheetah', 'tolotolo_turkey'],
};
export const PER_ROUND = { 2: 3, 3: 3, 4: 2 };

// A verb whose picture was looked at and rejected (verbs.js) is never taught with it: Stretchy has no wrong answer,
// but it is often the child's first meeting with the word's meaning.
export const usable = (w) => !!w && !REJECTED[w.id] && !!w.image && !!w.audio && w.syllables.length >= 2 && w.syllables.length <= 4
  && w.syllables.every((x) => x.audio) && countIsClear(w)
  && !w.flags.some((f) => /clip|no_speech|more_than_one|repair_rejected/.test(f));

export const fit = {
  game: 'stretchy',
  job: 'teach', // no wrong answer: pull it long and it says itself slowly
  voices: 'single', // plays the word's syllable clips one after another
  minFocus: 1,
  roundSize: Object.values(PER_ROUND).reduce((a, b) => a + b, 0),
  curated: Object.values(WORDS).flat(),
  canUse: usable,
};
