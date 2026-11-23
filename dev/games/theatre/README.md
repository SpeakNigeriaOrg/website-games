# Puppet Theatre (and Windows): pictures and clips

Both games share the Who-does-what grid in `../combo.js`: 4 animals (ajá, adìyẹ, màlúù, ehoro) x 5 actions (sùn, jẹun,
sáré, rìn, mu). The audio is always two single kit words, animal then action, never a spliced sentence.

- **Stills** (all 20 combinations): `../art/combo/<animal>_<action>.png`, chosen from `../art_candidates/combo/`
  (spec: `tools/artgen/gen_combo.mjs` writes `tools/artgen/combo.json`; one fixed description per animal keeps one look).
  Without a clip, a still plays with a gentle motion of its own (`../combo_scene.css`).
- **Clips**: `../art/combo/<name>.mp4`, listed in `VIDEOS` in `../combo.js`. A combination uses its clip when listed,
  over its still (never a blank). Each clip starts from its still (MiniMax-H3 `fl2va`, first keyframe), so the switch
  is seamless and the animal stays the same character. As of 2026-11-18 only `dog_sleep` has one.

## Resuming clip generation (when the GPU is free)

Video generation was stopped because another project's long job holds most of the GPU. `fl2va` runs at about
80-100 s per denoising step on this card (about 80 min per 5 s clip; text-only `t2va` is about 10 s per step), so the
remaining 19 clips need roughly a day of GPU time. Run one clip per process, so other GPU jobs get the card in between
(each run takes and releases `tools/artgen/gpulock.py`'s lock); from the repo root:

```sh
sh tools/artgen/combo_video_each.sh        # plan: tools/artgen/combo_video_plan.json; clips: dev/games/art_candidates/combo_videos/
```

(One clip by hand: `uv run --project C:/Dev/yoruba_student_dict_platform/imagegen python tools/artgen/combo_video.py tools/artgen/combo_video_plan.json dev/games/art_candidates/combo_videos --max=1`.)
The plan lists level-1 combinations first (dog/hen x sleep/eat). Existing clips are skipped. The script runs offline,
pinned to the cached model snapshot: never let it download (the Hub's `main` has moved past the cached revision).
Regenerate the plan with `node tools/artgen/gen_combo_video_plan.mjs [seeds] [names]` (e.g. `1 chicken_run` for a second
variant).

Then look at each clip as a frame strip (`ffmpeg -i s0.mp4 -vf "fps=2,scale=200:-1,tile=6x2" -frames:v 1 strip.png`).
Reject corruption, a changed character or the wrong action, and accept the good ones:

```sh
node tools/artgen/accept_combo_video.mjs dog_eat 0 chicken_sleep 0   # copies without sound to art/combo/, adds to VIDEOS
```
