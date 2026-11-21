// Who does what: the grid of subjects x actions shared by Puppet Theatre (theatre/) and Windows (windows/).
// The audio is the sentence "<animal> ń <action>" ("ajá ń sùn", the dog is sleeping), stitched from the kit's single-word
// recordings and Femi's recorded ń (tools/artgen/stitch_combo.mjs -> combo_say.js; the owner chose this over two bare
// words, 2026-11-21); a combination without a stitched sentence falls back to its two words. The pictures are ours: one still per
// combination (art/combo/<animal>_<action>.png), each animal drawn from one fixed description so it keeps one look
// (tools/artgen/gen_combo.mjs), and a short clip per combination where a good one exists (art/combo/<name>.mp4,
// generated from the still as its first frame: tools/artgen/combo_video.py). Pure module: Node imports it too.
import { SAY } from './combo_say.js';

export const SUBJECTS = [
  { id: 'aja_dog', key: 'dog' },
  { id: 'adiye_chicken', key: 'chicken' },
  { id: 'maluu_cow', key: 'cow' },
  { id: 'ehoro_rabbit', key: 'rabbit' },
];
// MOTION: the gentle loop a still gets when no clip is shown (classes in combo_scene.css).
export const ACTIONS = [
  { id: 'sun_to_sleep', key: 'sleep', motion: 'breathe' },
  { id: 'jeun_eat', key: 'eat', motion: 'munch' },
  { id: 'sare_run', key: 'run', motion: 'run' },
  { id: 'rin_to_walk', key: 'walk', motion: 'walk' },
  { id: 'mu_to_drink', key: 'drink', motion: 'sip' },
];
// The order above is the games' own preference: the most different actions first (sleep and eat at level 1).
// sáré and rìn are never the only two actions in a round (their pictures and meanings are close: verbs.js VERB_APART).
export const ACTION_APART = [['sare_run', 'rin_to_walk']];

// Stills chosen from art_candidates/combo/<name>/v*.png (looked at side by side; the same animal kept recognisably the
// same): v1 for every dog action but drink (v3); hen sleep/eat/walk v1, drink v3 (v0-v2 grew a second head), run from
// chicken_run2 v1 (the first batch walked); cow sleep v2, eat v1, run v2, walk v1, drink v1; rabbit sleep/eat/run v1,
// walk v0, drink v0. Portraits: dog v1, hen v1, cow v2, rabbit v1.
/** Combinations with a chosen clip (each looked at as a frame strip, from art_candidates/combo_videos/<name>/s*.mp4).
 * The rest play their still with a gentle motion. */
export const VIDEOS = new Set(['chicken_drink', 'chicken_eat', 'chicken_run', 'chicken_sleep', 'chicken_walk', 'cow_drink', 'cow_eat', 'cow_run', 'cow_sleep', 'cow_walk', 'dog_drink', 'dog_eat', 'dog_run', 'dog_sleep', 'dog_walk', 'rabbit_drink', 'rabbit_eat', 'rabbit_run', 'rabbit_sleep', 'rabbit_walk']);

const subjectIds = new Set(SUBJECTS.map((s) => s.id)), actionIds = new Set(ACTIONS.map((a) => a.id));
/** Has a take, passes the path's inclusion gates and stands alone (the brief: only words that pass). */
export const usable = (w) => !!(w && w.audio && (!w.inclusion || w.inclusion.path === 'included') && w.standalone !== false);
export const isSubject = (w) => usable(w) && subjectIds.has(w.id);
export const isAction = (w) => usable(w) && actionIds.has(w.id);
export const subjectOf = (id) => SUBJECTS.find((s) => s.id === id);
export const actionOf = (id) => ACTIONS.find((a) => a.id === id);

/** One combination: its name (dog_sleep), still, clip (or null), the still's fallback motion, and its sentence
 * (say: { audio, actionAt } with audio relative to art/, or null). */
export function combo(subjectId, actionId) {
  const s = subjectOf(subjectId), a = actionOf(actionId), name = `${s.key}_${a.key}`;
  return { name, subject: subjectId, action: actionId, still: `combo/${name}.png`, video: VIDEOS.has(name) ? `combo/${name}.mp4` : null, motion: a.motion,
    say: SAY[name] ? { audio: SAY[name].audio, actionAt: SAY[name].actionAt } : null };
}
export const portrait = (subjectId) => `combo/${subjectOf(subjectId).key}.png`;

/** How many subjects and actions a round shows, by path level (1 first meeting, 2 practice, 3 all). */
export const GRID_BY_LEVEL = [[2, 2], [3, 3], [4, 5]];

/** Actions in a round: never sáré and rìn as the only two (their meanings are too close for a first meeting). */
export function apartOk(actions) {
  const ids = actions.map((a) => a.id ?? a);
  return !(ids.length === 2 && ACTION_APART.some(([x, y]) => ids.includes(x) && ids.includes(y)));
}
