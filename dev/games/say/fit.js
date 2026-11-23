// What Say the Right Thing can play: the phrases its drawn scenes call for. A phrase also serves as the other
// balloon in scenes it clearly does not fit. Pure module: app.js and the path page (Node too) share this one rule.

// phrase: the right formula; not: phrases that clearly don't fit (one is drawn as the other balloon)
export const SCENES = [
  { id: 'trip', phrase: 'pele_sorry', not: ['o_se_thank_you', 'o_ti_to_enough', 'ebi_n_pa_e_you_hungry'] },
  { id: 'gift', phrase: 'o_se_thank_you', not: ['pele_sorry', 'o_gbona_hot', 'o_doti_dirty', 'ebi_n_pa_e_you_hungry'] },
  { id: 'pour', phrase: 'o_ti_to_enough', not: ['ebi_n_pa_e_you_hungry', 'o_gbona_hot'] },
  { id: 'hot', phrase: 'o_gbona_hot', not: ['o_se_thank_you', 'o_ti_to_enough'] },
  { id: 'dirty', phrase: 'o_doti_dirty', not: ['o_se_thank_you', 'o_gbona_hot'] },
  { id: 'hungry', phrase: 'ebi_n_pa_e_you_hungry', not: ['o_se_thank_you', 'o_gbona_hot'] },
];

export const usable = (w) => !!(w && w.audio);

export const fit = {
  game: 'say',
  job: 'practice',
  voices: 'any',
  minFocus: 1,
  roundSize: 6,
  curated: SCENES.map((s) => s.phrase),
  canUse(w) { return usable(w) && this.curated.includes(w.id); },
};
