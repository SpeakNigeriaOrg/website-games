// Word Train on the learning path: which words it can use. Pure module (the path page imports it too).
// A clear picture for the engine's cloud, 2 or 3 clean syllable clips, a clean take, and no two syllables that
// differ only in tone (or are the same): identical-looking carriages, so the order must be audible.

// Words with clean syllable clips (River Crossing's filters, plus Beat the Drum's clear syllable count), each with
// a picture for the engine's cloud. No two syllables of a word differ only in tone, so the order is always audible.
export const TWO = ['aja_dog', 'awo_plate', 'oju_eye', 'ata_pepper', 'wara_milk', 'iyan_pounded_yam', 'oka_grain',
  'aga_chair', 'bata_shoe', 'moto_automobile', 'irun_hair', 'eyin_tooth', 'erin_elephant', 'luwe_swim', 'peja_to_fish'];
export const THREE = ['elede_pig', 'ehoro_rabbit', 'sokoto_pants', 'ijapa_tortoise', 'okere_squirrel', 'iresi_rice', 'amala_amala',
  'ewuro_bitterleaf', 'isere_toy', 'ileke_beads', 'kiniun_lion', 'patewo_clap'];

export const toneless = (s) => s.normalize('NFD').replace(/[̀́̄]/g, '').normalize('NFC').toLowerCase();
export const cleanSyl = (s) => s.audio && !s.flags.some((f) => /continues|source_sample_clipping|starts_well_before/.test(f));
export const usable = (w) => !!w && !!w.audio && !!w.image && !w.imageCheck && w.syllables.every(cleanSyl)
  && !w.flags.some((f) => /clip|no_speech|more_than_one|repair_rejected/.test(f));
/** The order is audible: no two syllables the same once tone marks are set aside. */
const orderAudible = (w) => new Set(w.syllables.map((s) => toneless(s.text))).size === w.syllables.length;

export const fit = {
  game: 'train',
  job: 'sound',
  voices: 'single', // joins the child's carriages (syllable clips) and adds a syllable from another word
  minFocus: 1,
  roundSize: 6,
  curated: [...TWO, ...THREE],
  canUse: (w) => usable(w) && w.syllables.length >= 2 && w.syllables.length <= 3 && orderAudible(w),
};
