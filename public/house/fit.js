// What Wake the House can play: the things drawn into its rooms (a picture to wake; the second tap says the word
// slowly from its syllable clips, or says it again when it has none). Pure module: app.js and the path page (Node
// too) share this one rule.

// Home words with a clear picture, by room. Rooms hold up to six things, none two of the same kind (one plate
// per room, one radio, one pen). Added rooms use only words the path's gates include.
export const ROOMS = [
  { name: 'living room', bg: '../art/bg_room_empty.png', words: ['aga_chair', 'mama_mother', 'aja_dog', 'bata_shoe', 'sokoto_pants', 'redio_radio'] },
  { name: 'kitchen', bg: '../art/bg_kitchen.png', words: ['ikoko_pot', 'sibi_spoon', 'obe_knife', 'awo_plate', 'isu_yam', 'ata_pepper'] },
  { name: 'yard', bg: '../art/bg_yard.png', words: ['keke_bicycle', 'moto_automobile', 'aja_dog', 'adiye_chicken', 'okuta_stone', 'ewe_leaf'] },
  { name: 'bathroom', bg: '../art/bg_bathroom.png', words: ['ose_soap', 'inura_towel', 'ifoyin_toothbrush', 'digi_mirror'] },
  { name: 'dining room', bg: '../art/bg_dining.png', words: ['iresi_rice', 'iyan_pounded_yam', 'eyin_egg', 'buredi_bread', 'ogede_banana', 'osan_orange', 'abo_plate'] },
  { name: 'bedroom', bg: '../art/bg_bedroom.png', words: ['ibusun_bed', 'fila_hat', 'aso_cloth', 'ileke_beads', 'kalamu_pen'] },
  { name: 'play corner', bg: '../art/bg_playroom.png', words: ['isere_toy', 'oko_panapana_firetruck', 'alupupu_motorcycle', 'gege_pencil', 'moto_automobile'] },
];

/** A picture and a recording; syllable clips, when the word has them, must all be there. */
export const usable = (w) => !!(w && w.image && w.audio && w.syllables.every((s) => s.audio));

export const fit = {
  game: 'house',
  job: 'teach',
  voices: 'any',
  minFocus: 1,
  roundSize: 5,
  curated: [...new Set(ROOMS.flatMap((r) => r.words))],
  canUse(w) { return usable(w) && this.curated.includes(w.id); },
};
