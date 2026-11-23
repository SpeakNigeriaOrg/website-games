# Learning path: what each game must support

The path page (`dev/games/path/`) strings the games into a scaffolded course: units follow the scenes and
order of the curriculum draft (`C:\Dev\curriculum\yoruba\v4`, Ìpele 1: My Day, Body, Mealtime, Feelings,
Washing, Family, Home, Dressed, Play, Animals, Review), built from our own recordings only. A unit is a row of
stepping stones; each stone is one game played with that stone's words. The scaffolding is implicit: the child
just plays; the path decides which words, how many choices, and which earlier words come back.

## How a game is opened

```
<game>/?path=<step id>&focus=<ids>&review=<ids>&level=<1|2|3>
```

- `focus`: the 1-4 words this stone is about (new in this unit, or the unit's words being practised).
- `review`: words from earlier stones/units to mix back in (spaced return).
- `level`: 1 = first meeting (Teach: the answer is findable on screen or there are only 2 clearly different
  choices; short round), 2 = practice (2-3 choices, old words mixed in), 3 = the game as it is today.
- Without `path`, every game behaves exactly as before (level 3, its own curated words). Existing play scripts
  must keep passing.

The engine (`engine/engine.js`) already provides `path` (`active`, `focus`, `review`, `level`,
`pickLevel([l1, l2, l3])`, `choose(candidates, n, rest)`, `done()`), applies the lenient `path` gate profile
when `path.active`, and `loadContent({ voices })`. The finale already records the step and shows a "back to
the path" button when `path.active`. Read the engine before changing a game.

## What each game needs

1. **`<game>/fit.js`**: a pure ES module (no DOM, no imports from engine.js; Node imports it too) exporting

   ```js
   export const fit = {
     game: 'hungry',               // folder name
     job: 'practice',              // 'teach' | 'practice' | 'sound' | 'check' (its main job on the path)
     voices: 'any',                // 'single' if it compares pitch or joins clips across words; else 'any'
     minFocus: 1,                  // the fewest path words that make this game worth placing on a stone
     roundSize: 6,                 // how many distinct words a round needs (curated words fill the gap)
     curated: ['buredi_bread', …], // its current hand-picked list, if it has one (the default round)
     canUse(w) { … },              // can this kit word (content.json shape) appear in this game?
   };
   ```

   `canUse` must be the game's real rule: its existing `usable()` checks plus what its art and logic require
   (a picture for picture games; clean syllable clips for syllable games; a food for the goat; an animal or
   person for the yard and the door; a body part with a hit zone for the giant; a command it can act out).
   Scene-bound games (giant, house, doit, say) accept only the words their scenes can show: `canUse` returns
   true only for those. Move the game's word lists and `usable()` into fit.js and import them in app.js, so
   there is one rule.

2. **`app.js`**: `loadContent({ voices: fit.voices })`. When `path.active`, the pool is the curated words that
   pass `canUse` plus any focus/review words that pass `canUse`; the round's words come from
   `path.choose(pool, n, defaultOrder)` (focus first, then review, then the game's own choice to make up the
   number). Keep anything the game does to avoid confusable pairs (e.g. yard's APART).

3. **Levels** (only when `path.active`; `path.pickLevel([l1, l2, l3])`): fewer choices and a shorter round at
   level 1, e.g. Hungry 2 plates and 4 clean feeds; Yard 2 animals; Pond 1 target in 3 frogs, foils from
   another category; Parrot silly words from another category; River/Rally 4 items; Giant only the big parts;
   Train only the missing-carriage level. A level-1 round should take about 1-2 minutes. Level 3 is today's
   game. Respect what each game's design already established (spam-proofing, clean turns only, a miss returns
   two items later) at every level.

4. **`window.__game.words`**: the ids of the words in the round (for tests).

5. **A path play script** `tools/devcheck/plays/<game>_path.js` that checks the round used the focus words
   (every focus word the game can use appears in `__game.words`) and plays the round to the finale, then
   confirms the finale shows the path button (`.path-btn`). Run it with
   `node tools/devcheck/check.mjs <game> tools/devcheck/plays/<game>_path.js --query="path=t1&focus=<ids>&level=1" --tag=path`.
   Pick focus ids from `content/content.json` that the game can use. Also re-run the game's existing play
   script(s) without a query: they must still pass. Look at the screenshots.

## Ground rules (from the curriculum and our games plan; do not break them)

- Pre-readers: nothing depends on reading; no English on screen or in audio.
- Nobody is out; a wrong answer is never a bare "no": the right word plays, and the item comes back.
- Only clean (first-try) turns count. Spam-tapping never wins.
- Yorùbá audio only from the kit (our database recordings). Never invent words, spellings or glosses.
- Keep each game's existing mechanics and art; this is plumbing and difficulty, not a redesign.
- Small, readable diffs in the style of the surrounding code (comment density, naming).
