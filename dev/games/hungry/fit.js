// What You're Hungry! can play with, for the learning path (dev/games/path/SPEC.md). Pure module: app.js and
// Node both import it, so this is the one rule for which words reach the goat.

// Foods whose pictures are clear and distinct (no two bananas; water's picture is a river, milk's is cheese).
export const FOODS = ['buredi_bread', 'ogede_banana', 'osan_orange', 'ibepe_papaya', 'guafa_guava', 'iresi_rice', 'isu_yam',
  'akara_oyinbo_cake', 'eyin_egg', 'alubosa_onion', 'ata_pepper', 'ewuro_bitterleaf'];
// Foods the goat never asks for: their pictures show something else, or every food is one.
const NOT_ON_A_PLATE = new Set(['omi_water', 'wara_milk', 'ounje_food']);
// Never on the table together (look alike): when a path word is one of a pair, the other stays off.
export const APART = [['ogede_banana', 'ogede_agbagba_plantain'], ['oka_grain', 'oka_baba_sorghum']];

export const usable = (w) => !!(w && w.image && w.audio);

export const fit = {
  game: 'hungry',
  job: 'practice',
  voices: 'any',
  minFocus: 1,
  roundSize: 4,
  curated: FOODS,
  canUse(w) {
    if (!usable(w)) return false;
    if (FOODS.includes(w.id)) return true;
    // other foods from the kit: a food the goat can eat, with a picture the judge had no doubts about
    return w.category === 'food' && !w.imageCheck && !NOT_ON_A_PLATE.has(w.id);
  },
};
