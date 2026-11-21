// What Fishing with Grandma can play with, for the learning path (dev/games/path/SPEC.md). Pure module: app.js
// and Node both import it, so this is the one rule for which words the fish call and which Grandma asks for.
// The rules are Frog Pond's (pond/fit.legacy.js), which this game replaces on the path.

const BAD = /clip|no_speech|repair_rejected|more_than_one_utterance/;
// Things a picture can show on Grandma's basket.
export const CONCRETE = new Set(['animal', 'food', 'object', 'body', 'placeNature', 'people']);
// Filed as an animal in the kit but not one: ẹkùn "district" shares its spelling with the leopard.
const NOT_CONCRETE = new Set(['ekun_district']);

/** A word a fish can call (a foil): single words only (a fish calls one word), clean takes. */
export const croakable = (w) => !!(w && w.audio && !w.flags.some((f) => BAD.test(f)) && !/\s/.test(w.display.trim()));

export const fit = {
  game: 'fish',
  job: 'practice',
  voices: 'any',
  minFocus: 1,
  roundSize: 3, // requests (one target each); foils come from any word a fish can call
  curated: [], // no hand-picked list: Grandma chooses her requests from the kit each game
  /** A request: a fish can call it, and it has a clear picture of a concrete thing (on the basket; the caught fish
   *  turns into it). */
  canUse(w) { return croakable(w) && !!w.image && !w.imageCheck && CONCRETE.has(w.category) && !NOT_CONCRETE.has(w.id); },
};
