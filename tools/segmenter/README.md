# Story segmenter — authoring tool for the tap-the-story game

A local Flask app that turns clicks into tap-target polygons using SAM 2
(Segment Anything), and writes the story JSON the game in `dev/story/`
consumes. Nothing here deploys; it's a pre-processing step.

## Setup (once)

```
cd tools/segmenter
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

The SAM checkpoint (`sam2.1_b.pt`, ~155 MB) downloads into this folder the
first time the server starts — expect a pause. Both `.venv/` and `*.pt`
are gitignored.

If the pip install ever fails on the system Python (3.9 is near
end-of-support for torch/ultralytics), install a newer Python
(`brew install python@3.12`) and rebuild the venv with it.

## Authoring workflow

1. Drop scene images into `dev/story-media/<story-id>/` — one folder per
   story, lowercase-and-dashes folder name, images in story order
   (`scene01.webp`, `scene02.webp`, …). Prefer WebP, ≤1536 px wide,
   under ~300 KB each — they'll be loaded on phones.
2. `cd tools/segmenter && .venv/bin/python server.py` → open
   <http://localhost:5001>.
3. Pick the story, add scenes, then for each scene:
   - **Click an object** to segment it. SAM runs on the CPU — each click
     takes a few seconds. **Shift-click** adds a "not this" refinement
     point if the mask grabs too much; plain click adds more "this"
     points if it grabs too little.
   - **Accept** the mask with a label (author-facing only) and mark it as
     a tap **target** or leave it as a decoy. A ⚠ appears if the object
     is likely too small to tap comfortably on a phone.
   - Fill in the **instruction** (what to tap) and the
     **after-description** (what happens next), both in Yoruba.
   - Use **Preview taps** to test the hit areas exactly the way the game
     does — hits flash green, decoys flash red, background does nothing.
4. **Save story** — this writes `dev/story/stories/<story-id>.json` and
   refreshes the `dev/story/stories.json` index.
5. Play it: `python3 -m http.server 8000 --directory dev` (from the repo
   root) → <http://localhost:8000/story/>. Port 8000 matters: it's how
   the game knows to load images from `/story-media/` instead of R2.
   For a phone test, use the same port via your Mac's LAN IP.

Audio: `instruction.audio` and `after.audio` are `null` placeholders in
the JSON until recordings exist; they'll become R2-relative paths like the
phonics game's audio.

## Promotion to production

When a story (and the game) is ready to ship:

1. Copy the game into the deploy root (story JSON ships with it;
   `dev/story-media/` deliberately does not):

   ```
   rm -rf public/story && cp -R dev/story public/story
   ```

2. Upload the images to the R2 bucket behind
   `gamemedia.speaknigeria.org` under a `story/` prefix (bucket name is in
   the Cloudflare dashboard; needs `wrangler login` or an API token):

   ```
   cd dev/story-media
   for f in <story-id>/*; do
     npx wrangler r2 object put "<BUCKET_NAME>/story/$f" --file "$f" --remote
   done
   ```

   Spot-check one URL, e.g.
   `https://gamemedia.speaknigeria.org/story/<story-id>/scene01.webp`.

3. Add a game card to `public/index.html` (inside `<div class="cards">`,
   same markup as the phonics card, link `href="/story/"`).

4. Bump the `?v=` query strings in `public/story/index.html` on any asset
   that changed since the last deploy — Pages caches assets for 4 hours
   regardless of `_headers`.

5. Commit `public/story` + `public/index.html`, push; Pages deploys.
