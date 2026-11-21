// What Where It Happens can play: verbs with one obvious place in a home yard, where the boy can go and do it.
// Pure module: app.js and the path page (Node too) share this one rule.
//
// One place per verb, each where only that action happens. Left out on purpose: verbs without one obvious place
// (rìn and ìrìn walk, sáré run, ṣeré play, wò look: anywhere), dáná cook (no child at the fire), lùwẹ̀ swim (no
// river in a yard), mu omi (a phrase; mu is here). A place is used only while its verb is in the kit and passes.
export const PLACES = [
  { id: 'bed', verb: 'sun_to_sleep', art: 'where_bed.png' },
  { id: 'mat', verb: 'jeun_eat', art: 'where_mat.png' },
  { id: 'gate', verb: 'lo_go', art: 'where_gate.png' },
  { id: 'basin', verb: 'we_to_bathe', art: 'where_basin.png' },
  { id: 'chair', verb: 'jokoo_sit', art: 'where_chair.png' },
  { id: 'cup', verb: 'mu_to_drink', art: 'where_cup.png' },
];
// The order above is the game's own preference (most different actions first: sleep and eat at level 1).
export const VERBS = PLACES.map((p) => p.verb);

/** Has a take, passes the path's inclusion gates and stands alone (the brief: only verbs that pass). */
export const usable = (w) => !!(w && w.audio && (!w.inclusion || w.inclusion.path === 'included') && w.standalone !== false);
export const placeOf = (w) => (usable(w) && PLACES.find((p) => p.verb === w.id)) || null;

export const fit = {
  game: 'where',
  job: 'practice',
  voices: 'any',
  minFocus: 1,
  roundSize: 2,
  curated: VERBS,
  canUse(w) { return !!placeOf(w); },
};
