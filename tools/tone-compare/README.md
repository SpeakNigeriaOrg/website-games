# tone-compare

Renders the tone game's synthetic tones to WAV files and measures them, so a
change to the synthesis can be **listened to** side by side rather than argued
about. Nothing here deploys; it is a local authoring aid, like `tools/segmenter`.

## Use

```sh
python3 -m http.server 8000 --directory public      # serve the game
node tools/tone-compare/render.mjs                  # render + measure
python3 -m http.server 8010 --directory tools/tone-compare/build
```

Then open <http://localhost:8010/>. Every row is one tone (plus the three-note
hint melody); every column is a candidate voice. `build/` is gitignored - it is
about 4 MB of WAVs and regenerates in a minute.

Requires Google Chrome. Override with `CHROME_PATH=... TONE_GAME_URL=...` if
either differs.

## Adding a candidate

Add an entry to `VOICES` in `render.mjs`. Those objects are passed straight to
the game's `buildToneGraph(ctx, tone, speaker, start, voice)` as its `voice`
argument, so candidates exercise the real synthesis - there is no second
implementation to drift out of sync. The one exception is `original`, a frozen
copy of the six-sine version kept as a fixed reference point; leave it alone.

## Why this exists

The tones went through four versions, and reasoning alone got two of them wrong:

1. **Six sine harmonics at 1/n.** Pitch-accurate but sounded mournful whatever
   the pitch. Six harmonics is a hard ceiling at six times the fundamental -
   about 1.5 kHz for speaker2, only 833 Hz for speaker3, where a real vowel
   carries energy past 4 kHz. Muffled reads as sad.
2. **Sawtooth through two sharp formant filters.** Fixed the dullness; harsh and
   angry. Doubled brightness (304 → 519 Hz) but nearly doubled crest too
   (2.6 → 4.2).
3. **Additive with a steeper rolloff.** Measured *darker* than version 1. The
   brightness had been coming from the shallow rolloff all along.
4. **One `PeriodicWave` with Schroeder phase**, which is what ships. A parameter
   sweep showed brightness and crest were locked together - every setting
   brighter than v1 was harsher than v1 - which pointed at the real cause:
   **phase**. Harmonics that all start at zero sum to a spike, and a spike is
   what a sawtooth is. The same spectrum with phases spread by `-pi*n^2/N`
   measured crest 6.78 → 3.59 at identical brightness. It is also twelve times
   cheaper: one oscillator per tone instead of a stack.

The shipped settings are the `soft` row, chosen by ear from a four-way
comparison. `warm` and `clear` are brighter and were both judged too edgy; they
are kept as candidates in case that judgement changes.

## What the numbers mean

- **Brightness** - spectral centroid, where the energy sits on average.
- **95% below** - the frequency under which 95% of the energy falls, i.e. how
  far up the sound actually reaches.
- **Crest** - peak divided by average level. It tracked the harshness heard in
  listening tests, but it is a proxy and not a perceptual measure. Use it to
  see which way a change moves, not to decide.

Melodies are excluded from the statistics: three tones overlap in one, which
inflates the peak for every variant equally and makes crest meaningless.

## What must not change

The pitches and contours in `TONE_MODEL` are measurements from the speakers'
own recordings (see the `analysis/` directory of the `yoruba_student_dict_platform`
repo). Four of the six glides fall, and the low-to-high span is 325-353 cents -
between a minor and a major third - which is why the tones sound plaintive
however they are voiced. That is a fact about Yoruba tone, not a synthesis
artifact, and flattering it would mean teaching something untrue. The honest
lever for more drama is `TONE_SPREAD`, which exaggerates the glides without
moving the pitches apart.
