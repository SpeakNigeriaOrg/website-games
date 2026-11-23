// What Sort It can play: words for things that clearly belong in one of its places. Pure module: app.js and the
// path page (Node too) share this one rule.
//
// The kit's categories are too coarse for places ('object' holds clothes, vehicles, washing things, tools...), so
// every place lists its words by hand, except the table (foods) and the pen (animals), which take their category
// less the words whose picture or meaning does not fit. A place is used only while it has three usable words.

// Foods whose picture is something else (milk is cheese), is every food, or shows people cooking.
const NOT_ON_THE_TABLE = new Set(['wara_milk', 'ounje_food', 'omi_water', 'oka_grain', 'amala_amala', 'oka_baba_sorghum']);
// Animals that do not stay in a fenced pen.
const NOT_IN_THE_PEN = new Set(['esinsin_fly']);

export const PLACES = [
  { id: 'table', art: 'sort_table.png', has: (w) => w.category === 'food' && !NOT_ON_THE_TABLE.has(w.id) },
  { id: 'pen', art: 'sort_pen.png', has: (w) => w.category === 'animal' && !NOT_IN_THE_PEN.has(w.id) },
  // things you wear
  { id: 'wardrobe', art: 'sort_wardrobe.png', ids: ['sokoto_pants', 'aso_cloth', 'bata_shoe', 'fila_hat', 'ileke_beads'] },
  // vehicles: real ones in their pictures (a car, a motorbike with its rider), so a garage rather than a toy box
  { id: 'garage', art: 'sort_garage.png', ids: ['moto_automobile', 'keke_bicycle', 'alupupu_motorcycle', 'oko_panapana_firetruck'] },
  // washing things (not the mirror: it hangs in many rooms)
  { id: 'bath', art: 'sort_bath.png', ids: ['ose_soap', 'ifoyin_toothbrush', 'inura_towel'] },
];
// No kitchen shelf: a spoon, a pot or a knife could as well go on the dining table, and the Mealtime unit mixes
// them with foods, so the two places could never share a scene.
// The order the game prefers places in (most different first), when the path does not decide.
export const PLACE_ORDER = ['table', 'pen', 'wardrobe', 'garage', 'bath'];

export const usable = (w) => !!(w && w.image && w.audio);
/** The place a word belongs in, or null. */
export const placeOf = (w) => (usable(w) && PLACES.find((p) => (p.ids ? p.ids.includes(w.id) : p.has(w)))) || null;

export const fit = {
  game: 'sort',
  job: 'apply', // demonstrate understanding: late in a unit, the heard word put where it belongs, no picture to match
  voices: 'any',
  minFocus: 2,
  roundSize: 6,
  canUse(w) { return !!placeOf(w); },
};
