// LEGACY (renamed from fit.js): Frog Pond is replaced on the learning path by Fishing with Grandma (fish/fit.js).
// The path builder only reads files named fit.js, so this one keeps Pond playable without putting it on the path.
// What Frog Pond can play with, for the learning path (dev/games/path/SPEC.md). Pure module: app.js and Node
// both import it, so this is the one rule for which words the frogs croak and which become targets.

const BAD = /clip|no_speech|repair_rejected|more_than_one_utterance/;
// Things a picture can show on Grandma's card.
export const CONCRETE = new Set(['animal', 'food', 'object', 'body', 'placeNature', 'people']);
// Filed as an animal in the kit but not one: ẹkùn "district" shares its spelling with the leopard.
const NOT_CONCRETE = new Set(['ekun_district']);

/** A word a frog can croak (a foil): single words only (frogs croak one word), clean takes. */
export const croakable = (w) => !!(w && w.audio && !w.flags.some((f) => BAD.test(f)) && !/\s/.test(w.display.trim()));

export const fit = {
  game: 'pond',
  job: 'sound',
  voices: 'any',
  minFocus: 1,
  roundSize: 3, // targets (one per round); foils come from any croakable word
  curated: [], // no hand-picked list: the pond chooses its targets from the kit each game
  /** A target: croakable, with a clear picture of a concrete thing (Grandma holds it up; the frog turns into it). */
  canUse(w) { return croakable(w) && !!w.image && !w.imageCheck && CONCRETE.has(w.category) && !NOT_CONCRETE.has(w.id); },
};
