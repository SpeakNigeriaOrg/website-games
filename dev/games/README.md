# dev/games: the new experimental games (local only, never deployed)

Each game is a folder (`river/`, `rally/`, ...) with `index.html`, `app.js`, `style.css`, built on the shared
engine in `engine/`. Plain HTML/CSS/ES modules, no build step. Content (Femi's recordings, pictures) is a
generated kit in `content/`; game art is in `art/`.

## Run

```sh
node tools/devcheck/serve.mjs dev/games 8000            # from the repo root (no Python needed)
# open http://localhost:8000/ (landing page) or http://localhost:8000/river/
```

ES modules and `fetch` need the server; opening the files directly won't work.

## Test

```sh
node tools/devcheck/check.mjs river                     # load, tap start, screenshots, fail on console errors
node tools/devcheck/check.mjs river path/to/play.js     # plus a scripted play-through evaluated in the page
```

Every game has a play script in `tools/devcheck/plays/<game>.js` (extra scenarios as `<game>_<name>.js`); `sh tools/devcheck/all.sh` plays them all in portrait and landscape.
Screenshots land in `tools/devcheck/out/`. Look at them: a game that throws no errors can still be laid out badly.
A play script runs in the page after the start tap; it can call `window.__shot('name')` and should return a short
summary string. Games expose `window.__game` (state the script can read) where useful.

## Content kit (`content/content.json`)

Built by `yoruba_student_dict_platform/scripts/buildDevGameKit.mjs` (read-only against the database). One voice
(the speaker with the most recordings). Audio is the v5 processor's output, exported locally.

```js
{ voice, processor, builtAt, words: [{
  id, display, gloss, category,        // category: body animal food object placeNature action transfer mental state
                                       //   command social people time number spatial pronoun particle manner prefix abstract
  audio, durationS, flags, repair,     // natural take (mp3); flags from capture checks and repair
  syllables: [{ text, audio, durationS, flags }],   // clips cut from the slow take, in order
  naturalSyllables, alignStatus, tone, // where each syllable is in the natural take; see below (null when not annotated)
  image, imageSource, imageCheck,      // webp or null; 'approved' or 'judge-pick' (provisional); judge's doubts
  components: [wordId, ...],
  boundParts: [{ id, display }],       // the bound pieces among the components (the ì- of ìgbálẹ̀), which are never in
                                       //   the kit; Put It Together shows them as written bubbles (absent when none)
  standalone, notStandalone,           // false for bound pieces (prefixes, interfixes, infixes, suffixes), pronoun
                                       //   pieces and particles, proper names: never prompts, foils or fillers in
                                       //   these games (loadContent drops them). They can be taught, in a game made for them.
  person, voice, gates, inclusion }] }
```

`loadContent()` resolves every path to a URL and adds `content.byId`.
Prefer words with empty or harmless `flags`; avoid `imageCheck` pictures where a clear one matters.

### Syllables inside the natural take, and tone probabilities

From tone_lab's `annotate` (`yoruba_student_dict_platform/analysis`). Present only for words with both a natural
take and a slow syllable take by the same speaker (Femi's account; his legacy `speaker3` words have none: all three
fields are `null`).

```js
naturalSyllables: [{ text, startS, endS, confidence }]   // in order; seconds in the word's own mp3 (the delivered,
                                                        //   trimmed clip: 0 = start of the file). Contiguous.
alignStatus: 'ok' | 'low_confidence' | 'possible_repeat' | 'failed' | 'trim_mismatch' | null
tone: { pSequence,                                      // P(the whole written tone sequence is right)
        perSyllable: [{ text, written, pWritten }],     // written: 'high' | 'mid' | 'low'
        alternative: { sequence: ['high', ...], p } }   // the most probable other sequence
```

- **Spans.** Found by sliding Femi's slow syllables along the natural take (subsequence DTW over XLS-R speech
  features). The word's first start and last end are the energy trim's speech edges when the two agree. A
  monosyllable's span is the whole detected speech. Boundaries between syllables are approximate (see the
  validation figures in the platform's `analysis/README.md`, "annotate"): fine for highlighting a syllable while
  the word plays, not for cutting syllables out of the word.
- **`confidence`** is the mean cosine similarity between the slow syllable and the stretch it matched: a match
  score, not a probability. Correct matches typically score 0.3 to 0.6.
- **`alignStatus`**: `possible_repeat` means a second, nearly as good match exists (the word may be said twice in
  the take; the spans point at the better one, but the mp3 contains both). `low_confidence`: a poor match.
  `trim_mismatch`: the annotation's trim did not match this mp3 to the sample, so no spans are given.
  Use spans only when `ok`.
- **`tone`** probabilities are the speaker tone model's outputs, scored with the word left out of the fit.
  They are **not calibrated** against listeners, and pitch alone rarely confirms a tone: most syllables sit near the
  prior that the written tone is right. A low `pSequence` is a reason to have someone listen, never a reason
  to drop a word automatically, and never a statement that the spelling is wrong.

## Syllable inventory (`content/syllables.json`)

One canonical clip per toned syllable (`bá`, `ba`, `bà` are separate) for the kit's voice, for Phonics-style games.

```js
{ builtAt, dataThrough, selection, caveats, syllables: [{
  voice, syllable, base, tone,             // base: tone marks stripped, underdots kept (ṣẹ́ -> ṣẹ)
  recordings, words, baseWords,            // clips of this toned syllable; words containing it; words with its base
  siblingEvidence,                         // false: the base occurs in no other word, nothing to compare against
  notes,                                   // e.g. 'single recording of this toned syllable: no same-tone alternative'
  canonical: { observationId, audio, wordId, position, durationS, toneSupport, toneClear, siblingOutlier, notes },
  alternatives: [ ...same shape, best first ] }] }
```

Choice: not far from its siblings, measurable pitch, pitch clearly in the written tone (model), then the most
typical clip (closest to the same syllable in Femi's other words), then preferring clips without cut-quality
export flags. The matcher cannot hear tone, so tone is judged by pitch only; a syllable also sounds different by
position in the word, so the "most typical" clip is evidence, not a rule. `toneClear: false` or `null` on a
canonical clip means no clip of that syllable has clear pitch support. `loadContent()` does not read this file:
fetch `content/syllables.json` yourself; audio paths are relative to `content/` (the mp3s are in the same `audio/`).


`tone.learner` is the learner's question, from the audio alone (held-out, no spelling prior): `matchesWritten` (the audio's most probable tone equals the written one on every syllable), `pWrittenSequence`, `heard` (the most probable sequence), `disagreements` (severity `high-low` for a swap, `mid` for confusions with mid), `highLowSwaps`. Prefer `matchesWritten` words for tone games. `tone.pSequence` is the older plausibility score (spelling as a strong prior): it only says the audio doesn't clearly contradict the spelling.


`gates` and `inclusion` come from the inclusion gates (yoruba_student_dict_platform `scripts/computeGates.mjs`, rules in `shared/src/inclusionGates.ts`): `gates.<entry|capture|content|tone|quality|processing|toneStrict>` is `"pass"` or `{outcome, reasons}`; `inclusion.<profile>` is `included | excluded | pending`. Add `?gates` (or `?gates=<profile>`) to a game's URL to play only included recordings. Off by default while thresholds are calibrated.

## Engine (`engine/engine.js`)

- `loadContent()`, `shuffle(a)`, `pick(a)`, `sleep(ms)`, `el(tag, cls, html)`, `centre(node)`.
- `audio.play(url, {rate, gain})` (resolves when it ends), `audio.sequence(urls, gapMs, onEach)`, `audio.preload(urls)`, `audio.stop()`, `audio.ctx`.
- `sfx.pop() tap() splash() boing() bump() whoosh() drum(pitch) cheer() win() soft()`: synthesised, no files.
- `createShell({ onStart, replay, onIdle, onPause })`: start overlay (first tap unlocks audio), replay button
  bottom-left, pulsing ear while locked, idle replay after 6 s. `shell.prompt(asyncFn)` runs a prompt with
  input locked; `shell.lock()/unlock()`; `shell.locked`; `shell.armIdle(ms)`.
- `onTap(node, handler)`: tap that ignores drags.
- `new Queue(items, { cleanToWin })`: `next()`, `miss()` (re-queues two items later, once per turn), `done()` (true if clean), `finished`.
- `memory.seen(id, clean)`, `memory.order(words)` (due words first): per-player spacing in localStorage.
- `progressStrip(shell, total, icon)`: `.add(html)` fills the next slot.
- `animate(node, keyframes, options)`, `confetti(x, y)`, `ghost.hoverEach(nodes)`, `ghost.tap(node)`, `finale(html, onAgain)`.
- `engine.css`: `.stage`, `.playfield` (dimmed while locked), `.card-pic`, `.wobble`, `.glow`, start/replay/ear/progress styles.

## Conventions (every game)

From the games plan's interaction ground rules:
1. One start tap. 2. Replay button bottom-left replays the current prompt. 3. Input locked while the prompt
plays. 4. Choices are taps; sound choices speak in turn. 5. Simplicity weighed for pre-readers.
6. Idle: replay after 6 s; ghost hand only in teaching rounds or after two misses. 7. Misses are short and
gentle, successes big. 8. Only clean (first-try) turns count for progress; a miss re-queues the item two
later. 9. The listening test: nothing on screen may give the answer away; guessing can't fill progress.
10. First play taught by doing (ghost hand), no text, no English.

No text during play (pre-readers). `?read` in the URL may switch on written Yorùbá where a game supports it.

## Art

- `art/` holds chosen game art (backgrounds, sprites). Candidates: `art_candidates/<name>/v*.png`.
- New art: add entries to a spec JSON and run
  `uv run --project C:/Dev/yoruba_student_dict_platform/imagegen python tools/artgen/artgen.py SPEC.json dev/games/art_candidates`
  (local Z-Image-Turbo; sprites are cut out of a white background). It takes the GPU lock
  (`tools/artgen/gpulock.py`); any other GPU job must take it too.
- Word pictures come from the content kit, not from here.

## Rules for building here

- Yorùbá audio only from the content kit (our database). Other sounds: the engine's synthesised effects, or
  free CC0 sounds from the web (note the source in the game's folder).
- No placeholders: generate art you need; no "TODO" boxes in a game.
- Never write to the remote database. No commits unless the project owner asks.

## Learning path (`path/`)

The games strung into a scaffolded course: `path/index.html` (open http://localhost:8000/path/).

- **Build:** `node dev/games/path/build.mjs` after the kit is rebuilt. Inputs: `content/content.json`, `path/scenes.json`
  (our own scenes from a child's day, in order, each with its words, everyday first; the idea of scenes comes from the
  curriculum draft, which suggests words for some scenes via `suggestedBy`), `path/curriculum.json` (the draft's items
  matched to our dictionary by sense) and every game's `fit.js`. Output: `path/path.json`, including a `report`
  (words, how many get a meaning stone, verb share as a direction, review counts, words no game can show yet).
- **Order:** units are our scenes; a scene with fewer than three playable words opens the next unit.
  Up to four new words per sitting; a compound comes after its parts (Put It Together), parts pulled forward when needed.
- **A sitting:** warm-up (earlier words due on a 1/3/7/15-sitting schedule, in a game that can show them), teach
  (level 1), practice (new words with known words as fillers), then a syllable game for words whose meaning was
  shown; tone stones (Silly Parrot, the silly word is the tone partner) when both words of a same-speaker tone pair
  are known; a true-or-silly check ends each unit.
- **Games on the path** read `?path=&focus=&review=&level=` (and `pairs=` for tone stones); see `path/SPEC.md`.
  Opened from the path, the engine applies the lenient `path`/`pathTone` gate profiles and drops pronouns, particles
  and prefixes; single-voice games play Femi only.
- **Tests:** `node tools/devcheck/path_sweep.mjs` plays every game on real stones; `plays/path_page.js` and
  `plays/path_scroll.js` check the page. `tools/devcheck/all.sh` skips path-mode scripts.
- **What to record next:** `path/RECORD_NEXT.md`, ranked by what a recording unlocks (tone pairs, a compound's last part,
  everyday verbs, the day's words, re-records). `path/COVERAGE.md` is a reference map of the curriculum draft's items to
  our recordings, not a target.
