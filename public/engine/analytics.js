// Analytics for the suite games, through the same scripts and events as the older games (Phonics, Tones,
// Vocabulary): consent.js, track.js and game-events.js in the site's /analytics/ (copies of the yorubadict repo's
// analytics/, the shared contract with its events.schema.json). A round is a "level": game_start when the first
// round begins, level_complete at each round's finale (the primary Google Ads conversion).
//
// Loaded only on the deployed site (*.speaknigeria.org) or with ?analytics=1, so the dev server, which has no
// /analytics/, and the play-through tests stay silent.
import { path } from './engine.js';

const GAME = location.pathname.split('/').filter(Boolean)[0] || 'unknown';
const enabled = /(^|\.)speaknigeria\.org$/.test(location.hostname) || new URLSearchParams(location.search).has('analytics');

let ready = null;
function load(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

/** Loads consent, tracking and game events in order (each needs the one before) and starts the session. */
function init() {
  if (!enabled) return Promise.resolve(false);
  ready ??= load('/analytics/consent.js?v=1').then(() => load('/analytics/track.js?v=3')).then(() => load('/analytics/game-events.js?v=3'))
    .then(() => {
      // ?analytics=debug also prints every event (for tests: tools/devcheck/check.mjs shows page console lines)
      if (new URLSearchParams(location.search).get('analytics') === 'debug' && window.snTrack) {
        const send = window.snTrack;
        window.snTrack = (name, props) => { console.log('snTrack ' + name + ' ' + JSON.stringify(props)); return send(name, props); };
      }
      window.snGame?.start(GAME, [{ levelId: levelId(), words: [...path.focus, ...path.review] }]); return true; })
    .catch(() => false);
  return ready;
}

/** The round's id: the path step it was opened for, else the game's own free play at its level. */
const levelId = () => (path.active ? `${GAME} ${path.step}` : `${GAME} free play L${path.level}`);
const category = () => (path.active ? 'path' : 'free_play');

let placeCache = null;
async function pathPlace() {
  try {
    placeCache ??= await (await fetch(new URL('../path/path.json', import.meta.url))).json();
    const stones = placeCache.units.flatMap((u) => u.meetings.flatMap((m) => m.stones.map((s) => ({ id: s.id, unit: u.id }))));
    const i = stones.findIndex((s) => s.id === path.step);
    return i < 0 ? {} : { pathUnit: stones[i].unit, pathStone: i + 1, pathStones: stones.length };
  } catch { return {}; }
}

let round = null, lastTurns = 0; // a game may build its Queue before or after the start button
export const analytics = {
  /** The page has loaded (the start screen is showing). */
  init,
  /** A round begins (the start button, or "play again"). game_start (once per page, as in the older games) goes
   * through game-events.js. */
  async roundStart() {
    round = { levelId: levelId(), category: category(), words: Array.from({ length: lastTurns }, (_, i) => `t${i}`), startedAt: Date.now(), wrong: 0 };
    if (await init()) window.snGame?.levelLoaded(round, null);
  },
  /** The round's turns, once known (games that keep a Queue of turns report its length). */
  turns(n) { lastTurns = n; if (round) round.words = Array.from({ length: n }, (_, i) => `t${i}`); },
  /** The child got a turn wrong (the game re-queues the word; counted once per turn). */
  miss() { if (round) round.wrong++; },
  /** The round's finale: level_complete, with the same properties game-events.js sends for the older games. */
  async complete() {
    if (!round || !(await init()) || !window.snTrack) return;
    // games without a turn queue (Fishing, House, Visit, Stretchy) report the words the round was given
    const wordCount = round.words.length || new Set([...path.focus, ...path.review]).size;
    const props = { game: GAME, levelId: round.levelId, category: round.category, wordCount,
      durationMs: Date.now() - round.startedAt, totalWrong: round.wrong };
    // On the path, where in it the child is: the unit and the stone's place in the whole path (1-based), so how far
    // people get can be read off these events (per browser: progress is not synced between devices).
    if (path.active) Object.assign(props, await pathPlace());
    window.snTrack('level_complete', props);
  },
};
init();
