// What Hide and Seek can play with, for the learning path (dev/games/path/SPEC.md). Pure module: app.js and
// Node both import it, so this is the one rule for who hides in the yard.

// Animals with clear, distinct pictures (no bunny in a bush, no second turtle, no leopard next to the cheetah).
export const ANIMALS = ['ehoro_rabbit', 'elede_pig', 'olongbo_cat', 'odo_agutan_lamb', 'ketekete_donkey', 'aja_dog', 'agunfon_giraffe',
  'esinsin_fly', 'adiye_chicken', 'maluu_cow', 'erin_elephant', 'kiniun_lion', 'ketekete_abila_zebra', 'okere_squirrel',
  'amotekun_cheetah', 'ijapa_tortoise', 'tolotolo_turkey'];
// Never in the yard together (look or sound alike). Path words may bring the second of a pair; the yard keeps
// them apart instead of leaving them out.
export const APART = [['ketekete_donkey', 'ketekete_abila_zebra'], ['ehoro_rabbit', 'omo_ehoro_baby_bunny'],
  ['olongbo_cat', 'omo_ologbo_kitten'], ['ijapa_tortoise', 'ijapa_inu_omi_aquatic_turtle'], ['amotekun_cheetah', 'ekun_leopard'],
  ['agba_adult', 'egbon_older_sibling', 'mama_mother'], ['omo_child', 'omo_mi_my_baby']];
// Filed as animals in the kit but not one: ẹkùn "district" shares its spelling with the leopard.
const NOT_ANIMALS = new Set(['ekun_district']);

export const usable = (w) => !!(w && w.image && w.audio);

export const fit = {
  game: 'yard',
  job: 'practice',
  voices: 'any',
  minFocus: 1,
  roundSize: 3,
  maxFocus: 3, // the yard holds at most three animals
  curated: ANIMALS,
  canUse(w) {
    if (!usable(w)) return false;
    if (ANIMALS.includes(w.id)) return true;
    // any animal or person who can hide in a bush, with a picture the judge had no doubts about
    return (w.category === 'animal' || w.category === 'people') && !w.imageCheck && !NOT_ANIMALS.has(w.id);
  },
};
