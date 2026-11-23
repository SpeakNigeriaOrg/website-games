// What Grandma's Errand can play: things a child can pick up and carry to Grandma, with a clear picture.
// Pure module: app.js and the path page (Node too) share this one rule.

// Every word Grandma may ask for, by kind. Objects, foods, clothes, toys and small household things only:
// no body parts, places, people, or animals. Left out on purpose (with their reason):
//   irin_iron (the picture is a metal plate), obe_knife (no child carries a knife to Grandma), abo_plate (judge's
//   doubts), ileke_beads (the picture is mostly an arm), aga_chair (furniture), goomu_gum (a white lump like soap),
//   wara_milk (its picture is cheese), amala_amala and oka_baba_sorghum (pictures of people at work), oka_grain
//   (a tiny sprig), ounje_food (every food is one), vehicles, the bed, timber.
export const CARRY = {
  object: ['ikoko_pot', 'ose_soap', 'redio_radio', 'ero_asoromagbesi_radio', 'okuta_stone', 'ifoyin_toothbrush', 'inura_towel',
    'digi_mirror', 'kalamu_pen', 'gege_pencil', 'sibi_spoon'],
  clothes: ['sokoto_pants', 'aso_cloth', 'bata_shoe', 'fila_hat'],
  toy: ['isere_toy'],
  food: ['akara_oyinbo_cake', 'ogede_banana', 'ogede_agbagba_plantain', 'ewa_beans', 'kasu_cashew', 'ibepe_papaya', 'osan_orange',
    'alubosa_onion', 'isu_yam', 'iyan_pounded_yam', 'iresi_rice', 'buredi_bread', 'ewuro_bitterleaf'],
  nature: ['ewe_leaf'],
};
export const CARRYABLE = Object.values(CARRY).flat();

// Never in the room together: the same thing by two names, or pictures that look alike, or one word that names
// the other (aṣọ is any cloth: a towel or trousers would be a right answer too).
export const APART = [['ogede_banana', 'ogede_agbagba_plantain'], ['redio_radio', 'ero_asoromagbesi_radio'], ['gege_pencil', 'kalamu_pen'],
  ['isu_yam', 'iyan_pounded_yam'], ['ewe_leaf', 'ewuro_bitterleaf'], ['aso_cloth', 'inura_towel', 'sokoto_pants']];

// The default room off the path: things from around the house and the table.
export const CURATED = ['ikoko_pot', 'ose_soap', 'bata_shoe', 'fila_hat', 'ogede_banana', 'osan_orange', 'buredi_bread', 'isere_toy',
  'sibi_spoon', 'ifoyin_toothbrush', 'digi_mirror', 'ibepe_papaya'];

export const usable = (w) => !!(w && w.image && w.audio && !w.imageCheck);

export const fit = {
  game: 'errand',
  job: 'apply',
  voices: 'any',
  minFocus: 2,
  roundSize: 6,
  curated: CURATED,
  canUse(w) { return usable(w) && CARRYABLE.includes(w.id); },
};
