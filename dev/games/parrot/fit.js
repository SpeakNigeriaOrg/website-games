// What Silly Parrot can play with, for the learning path (dev/games/path/SPEC.md). Pure module: app.js and
// Node both import it, so this is the one rule for what the parrot holds up and says.

// Clear pictures with clean recordings; one word per meaning (no two cars, no plantain next to banana).
export const WORDS = [
  'adiye_chicken', 'aja_dog', 'olongbo_cat', 'maluu_cow', 'elede_pig', 'kiniun_lion', 'ehoro_rabbit',
  'ketekete_donkey', 'esinsin_fly', 'tolotolo_turkey', 'agunfon_giraffe', 'ijapa_tortoise',
  'ogede_banana', 'osan_orange', 'buredi_bread', 'alubosa_onion', 'ibepe_papaya', 'ata_pepper', 'elegede_pumpkin',
  'aga_chair', 'sibi_spoon', 'digi_mirror', 'moto_automobile', 'ibusun_bed', 'ikoko_pot', 'okuta_stone',
  'redio_radio', 'keke_bicycle', 'ifoyin_toothbrush', 'oju_eye', 'ese_leg', 'atelewo_palm',
];
export const BAD_FLAGS = /clip|no_speech|repair_rejected|more_than_one_utterance|unexpectedly_long/;
import { VERBS, VERB_APART } from '../verbs.js';

// Things a picture can show on the parrot's sign (and the vetted verbs: an action picture works as well).
const PICTURABLE = new Set(['animal', 'food', 'object', 'body', 'people', 'placeNature']);
// Never in a round together (one word per meaning, or pictures that look alike): a path word may bring the
// second of a pair, so the parrot's own one stays out.
export const APART = [...VERB_APART, ['ogede_banana', 'ogede_agbagba_plantain'], ['moto_automobile', 'oko_ayokele_car'],
  ['redio_radio', 'ero_asoromagbesi_radio'], ['gege_pencil', 'kalamu_pen'],
  ['ketekete_donkey', 'ketekete_abila_zebra'], ['ehoro_rabbit', 'omo_ehoro_baby_bunny'], ['olongbo_cat', 'omo_ologbo_kitten'],
  ['ijapa_tortoise', 'ijapa_inu_omi_aquatic_turtle'], ['amotekun_cheetah', 'ekun_leopard']];

export const usable = (w) => !!(w && w.image && w.audio && !w.flags.some((f) => BAD_FLAGS.test(f)));

export const fit = {
  game: 'parrot',
  job: 'check',
  voices: 'any',
  minFocus: 1,
  roundSize: 4,
  curated: WORDS,
  /** A tone stone (path.pairs): both words of a tone pair, any category, as long as each has a picture. */
  canUseInPair: usable,
  canUse(w) {
    if (!usable(w)) return false;
    // other kit words: something a picture shows, with a picture the judge had no doubts about
    return WORDS.includes(w.id) || VERBS.includes(w.id) || (PICTURABLE.has(w.category) && !w.imageCheck && w.id !== 'ekun_district');
  },
};
