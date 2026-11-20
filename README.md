# Speak Nigeria games

Cloudflare Pages games used during Speak Nigeria Yoruba lessons. Plain
HTML/CSS/vanilla JS, no build step. Only `public/` deploys.

## Layout

```
public/            - everything deployed (wrangler pages_build_output_dir -> "public")
  index.html       - games landing page (its own styles in assets/landing.css;
                     its pictures in assets/img/, webp copies of dev/games art
                     and screenshots of the games)
  phonics/         - phonics game: match syllables to build words, hear each
                     word and syllable pronounced, see per-tone visualization
  tones/           - tone game: hear a word, pick the high/mid/low tone of
                     each syllable. Reads the phonics game's vocab/sessions/
                     syllables JSON directly (../phonics/*.json) so there's
                     one generated copy for all three games. Its High/Mid/Low
                     buttons are synthesized, not recorded - the pitches and
                     contours come from the acoustic tone study in the
                     yoruba_student_dict_platform repo (analysis/build/
                     legacy-tone-report); see TONE_MODEL in tones/app.js.
  vocab/           - vocabulary game: see the card image, pick the right Yoruba
                     word from a few choices. Deliberately silent at the start -
                     the other two games are listening games, this one is a
                     reading game - and it plays the word once you get it right.
                     The hint is the English half of the word id.
                     Reads the same ../phonics/*.json as the tone game.
dev/               - local-only development area, never deployed
  story/           - tap-the-story game (in trial; promoted to public/story/
                     when ready - see tools/segmenter/README.md)
  story-media/     - working scene images for the story game (master copies;
                     mirrored to R2 at deploy time, never copied to public/)
tools/
  segmenter/       - local SAM-2 click-to-segment authoring tool for the
                     story game (see its README)
  smoke/           - headless-Chrome check of the three games
  kit_to_practice.mjs - builds the three games' data from the suite's kit
wrangler.toml      - Cloudflare Pages deploy config
```

## Game data (Phonics, Tones, Vocabulary)

The three practice games play the Yoruba game suite's checked content kit
(`dev/games/content/`: gated recordings, one picture per word), served on the
site at `/content/` once the suite deploys. They load no media from R2.
`public/phonics/vocab.json`, `syllables.json` and `sessions.json` are generated
from that kit, with every audio and image URL spelled out:

```
node tools/kit_to_practice.mjs                 # kit at dev/games/content
node tools/kit_to_practice.mjs --kit <dir>     # another kit folder
node tools/kit_to_practice.mjs --check         # print the coverage report only
```

Rerun it after every kit rebuild and commit the three files with the kit: the
report lists words per level for each game and every kit word left out, with
the reason. A word is used only if the suite's audio gate includes it
(`inclusion.path`), it is standalone by the suite's rule, and it has a picture.
The header of `tools/kit_to_practice.mjs` explains the rest.

The old hand-off from the dictionary repo (`sync_dictionary_data.py`, which wrote
the R2-based shape) has been removed; these files come only from the kit.

Check the games against the kit locally (the kit must be at `/content/`):

```
# a folder with public/ plus dev/games/content copied in as content/
node ../syllable_game_concept/tools/devcheck/serve.mjs <that folder> 8137
BASE=http://localhost:8137 CHROME_PATH=<chrome> node tools/smoke/check.mjs
```

## Local dev

```
python3 -m http.server --directory public          # deployed games
python3 -m http.server 8000 --directory dev        # story game in trial
```

The story game expects port 8000 locally - that's how it decides to load
images from `/story-media/` instead of R2 (see `dev/story/app.js`).
