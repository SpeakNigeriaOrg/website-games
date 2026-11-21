// What Tickle the Giant can play: the body parts with a hit zone on art/giant.png. Pure module: app.js and the
// path page (Node too) share this one rule.

/** Our word for each part with a hit zone (the nose has a zone but no word: a tap there says nothing). */
export const WORDS = {
  eye: 'oju_eye', teeth: 'eyin_tooth', knee: 'orunkun_knee', finger: 'ika_owo_finger', palm: 'atelewo_palm', hair: 'irun_hair', leg: 'ese_leg',
  chest: 'aya_chest', ear: 'eti_ear', navel: 'idodo_navel', thigh: 'itan_thigh', nail: 'eekanna_nail',
};
/** Big separate parts come first; small ones later. */
export const EASY = ['hair', 'leg', 'eye', 'chest'], HARD = ['knee', 'palm', 'finger', 'teeth', 'ear', 'thigh', 'navel', 'nail'];

export const usable = (w) => !!(w && w.audio);

export const fit = {
  game: 'giant',
  job: 'practice',
  voices: 'any',
  minFocus: 1,
  roundSize: 7,
  curated: [...EASY, ...HARD].map((p) => WORDS[p]),
  canUse(w) { return usable(w) && this.curated.includes(w.id); },
};
