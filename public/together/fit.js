// What Put It Together can play with, for the learning path (dev/games/path/SPEC.md). Pure module: app.js and
// Node both import it, so this is the one rule for which compounds reach the pot.
//
// A compound is a kit word with `components` (curriculum: "building blocks first": the whole comes after its
// parts). It is playable when it has a picture and a clean take, and every component is a word in the loaded kit
// with a picture and a clean take: the child hears and sees both parts before guessing the whole. So canUse needs the
// rest of the kit, and takes it as a second argument:
//
//   fit.canUse(w, kit)   kit: the kit's words by id, either loadContent()'s `content.byId` (a plain object) or a
//                        Map (the path builder's `byId`). Without a kit it answers false: a compound whose parts
//                        cannot be checked is never played.

// The take must be one clean utterance (the whole word plays as the reward; the parts play as the prompt).
const BAD = /clip|no_speech|more_than_one|repair_rejected|unexpectedly_long/;
export const clean = (w) => !!(w && w.audio && w.image && !w.flags?.some((f) => BAD.test(f)));

// Compounds whose pictures do not show the meaning link: dìde nlẹ̀ "get up" (nlẹ̀'s picture is a crawling baby,
// the whole's a man falling).
// paná: never built from pa here; pa is the root verb "kill" (a swatted fly), a different word from pa + iná (owner).
const NOT_TOGETHER = new Set(['dide_nle_get_up', 'pana_extinguish_fire']);

// Foils: clear, everyday pictures from categories far from any compound's meaning. A turn takes its foil from the
// first category that neither the compound nor its parts belong to, so the wrong answer is absurd, never close.
export const FOILS = {
  animal: ['aja_dog', 'adiye_chicken', 'maluu_cow', 'erin_elephant', 'agunfon_giraffe', 'ijapa_tortoise', 'pepeye_duck', 'kiniun_lion'],
  food: ['ogede_banana', 'osan_orange', 'ibepe_papaya', 'buredi_bread', 'isu_yam', 'iresi_rice'],
  body: ['eti_ear', 'oju_eye', 'ese_leg', 'irun_hair'],
};

const get = (kit, id) => (kit instanceof Map ? kit.get(id) : kit?.[id]);

/** The compound's parts as kit words, or null when any part is missing from the kit or lacks a picture or a clean take. */
export function partsOf(w, kit) {
  if (!w?.components?.length || w.components.length < 2 || !kit) return null;
  const parts = w.components.map((id) => get(kit, id));
  return parts.every(clean) ? parts : null;
}

export const fit = {
  game: 'together',
  job: 'teach',
  voices: 'any',
  minFocus: 1,
  roundSize: 3,
  canUse(w, kit) {
    return clean(w) && !NOT_TOGETHER.has(w.id) && !!partsOf(w, kit);
  },
};
