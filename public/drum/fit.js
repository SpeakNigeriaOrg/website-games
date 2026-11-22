// Beat the Drum on the learning path: which words it can use. Pure module (the path page imports it too).
// Words whose syllable count nobody would argue about, with every syllable clip present and a clean take.

export const LEVELS = [ // words whose syllable count nobody would argue about (no syllabic nasal, no split long vowel)
  { take: 3, ids: ['aja_dog', 'aga_chair', 'awo_plate', 'eyin_egg', 'ata_pepper', 'oju_eye', 'keke_bicycle', 'moto_automobile', 'bata_shoe', 'isu_yam', 'mama_mother', 'gbo_to_bark', 'mu_to_drink', 'sun_to_sleep', 'we_to_bathe'] },
  { take: 3, ids: ['ehoro_rabbit', 'elede_pig', 'sokoto_pants', 'ijapa_tortoise', 'okere_squirrel', 'iresi_rice', 'amala_amala', 'ewuro_bitterleaf', 'patewo_clap'] },
  { take: 2, ids: ['alupupu_motorcycle', 'ketekete_donkey', 'atelewo_palm', 'amotekun_cheetah', 'tolotolo_turkey'] },
];

const toneless = (s) => s.normalize('NFD').replace(/[̀́̄]/g, '').normalize('NFC').toLowerCase();
/** True when every syllable has a vowel and none is a bare repeat of the previous vowel (be.é.lú). */
export function countIsClear(w) {
  const syl = w.syllables.map((s) => toneless(s.text));
  return syl.every((s, i) => {
    if (!/[aeiouẹọ]/.test(s)) return false; // syllabic nasal (n, ń, m)
    if (i && /^[aeiouẹọ]n?$/.test(s)) return (syl[i - 1].match(/[aeiouẹọ]/g) || []).pop() !== s[0];
    return true;
  });
}
// a picture is required: the drum shows it, and a word without one must not be played (owner, 2026-11-21)
export const usable = (w) => !!w && !!w.audio && !!w.image && !w.imageCheck && w.syllables.length > 0 && w.syllables.every((s) => s.audio) && countIsClear(w)
  && !w.flags.some((f) => /clip|no_speech|more_than_one|repair_rejected/.test(f));

export const fit = {
  game: 'drum',
  job: 'sound',
  voices: 'single', // the drum plays the word's syllable clips in turn
  minFocus: 1,
  roundSize: LEVELS.reduce((n, l) => n + l.take, 0),
  curated: LEVELS.flatMap((l) => l.ids),
  canUse: usable,
};
