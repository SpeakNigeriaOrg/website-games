// River Crossing on the learning path: which words it can use. Pure module (the path page imports it too).
// Every 2- or 3-syllable word whose syllable clips are all there and whose take is clean; no curated list.
export const fit = {
  game: 'river',
  job: 'sound',
  voices: 'single', // joins one word's syllable clips with distractor syllables from other words
  minFocus: 1,
  roundSize: 6,
  curated: [],
  canUse(w) {
    return !!w && w.syllables.length >= 2 && w.syllables.length <= 3
      && !w.flags.some((f) => /clip|no_speech|repair_rejected/.test(f))
      && w.syllables.every((s) => s.audio);
  },
};
