// What Who Came to Visit? can play with, for the learning path (dev/games/path/SPEC.md). Pure module: app.js
// and Node both import it, so this is the one rule for who waits at the door.

export const GUESTS = ['aja_dog', 'olongbo_cat', 'adiye_chicken', 'maluu_cow', 'agunfon_giraffe', 'ehoro_rabbit', 'elede_pig',
  'ketekete_donkey', 'erin_elephant', 'kiniun_lion', 'ijapa_tortoise', 'okere_squirrel', 'amotekun_cheetah',
  'tolotolo_turkey', 'oba_king', 'mama_mother', 'esinsin_fly'];
// Never at the door together (look or sound alike): a path word may bring the second of a pair.
export const APART = [['mama_mother', 'omo_mi_my_baby'], ['ketekete_donkey', 'ketekete_abila_zebra'], ['ehoro_rabbit', 'omo_ehoro_baby_bunny'],
  ['olongbo_cat', 'omo_ologbo_kitten'], ['ijapa_tortoise', 'ijapa_inu_omi_aquatic_turtle'], ['amotekun_cheetah', 'ekun_leopard'],
  ['agba_adult', 'egbon_older_sibling', 'mama_mother'], ['omo_child', 'omo_mi_my_baby']];
// Filed as animals in the kit but not one: ẹkùn "district" shares its spelling with the leopard.
const NOT_ANIMALS = new Set(['ekun_district']);

export const usable = (w) => !!(w && w.audio && w.image && !w.imageCheck && !w.flags.some((f) => /clip|no_speech|more_than_one|repair_rejected/.test(f)));

export const fit = {
  game: 'visit',
  job: 'teach',
  voices: 'any',
  minFocus: 1,
  roundSize: 4, // three waiting at the door and a stranger
  maxFocus: 3,  // the guests who introduce themselves
  curated: GUESTS,
  canUse(w) {
    if (!usable(w)) return false;
    // a guest: an animal or a person
    return GUESTS.includes(w.id) || ((w.category === 'animal' || w.category === 'people') && !NOT_ANIMALS.has(w.id));
  },
};
