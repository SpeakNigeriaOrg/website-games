"""Seamless loop versions of the who-does-what clips, for games that loop them (Windows).

A clip played on loop jumps from its last frame back to its first: the background snaps back and clouds that drifted
in vanish. A crossfade hides the jump but ghosts anything that moves (cow_drink grew a see-through second head; the
running hen doubled her legs), so instead each clip is cut between the two most alike frames at least 2.5 s apart.

Writes art_candidates/combo_loops/<name>.mp4 and art_candidates/combo_videos/loop_points.json (cut frames, the jump at
the cut and the clip's median frame step, both mean grey-level differences at 128 px).

Run with the image project's environment (av, numpy):
    uv run --project C:/Dev/yoruba_student_dict_platform/imagegen python tools/artgen/loop_clips.py
"""
import json
import subprocess
from pathlib import Path

import av
import numpy as np

ROOT = Path(__file__).resolve().parents[2] / "dev/games"
FPS, MIN_SECONDS = 24, 2.5


def frames(path):
    with av.open(str(path)) as c:
        return [np.asarray(f.to_image().convert("L").resize((128, 128)), dtype=np.float32) / 255 for f in c.decode(c.streams.video[0])]


def main():
    out_dir = ROOT / "art_candidates/combo_loops"
    out_dir.mkdir(parents=True, exist_ok=True)
    points = {}
    for clip in sorted((ROOT / "art/combo").glob("*_*.mp4")):
        fr = frames(clip)
        steps = [float(np.abs(a - b).mean()) for a, b in zip(fr, fr[1:])]
        # start in the first third, so the loop keeps most of the clip
        jump, start, end = min((float(np.abs(fr[i] - fr[j]).mean()), i, j)
                               for i in range(len(fr) // 3) for j in range(i + int(MIN_SECONDS * FPS), len(fr)))
        points[clip.stem] = {"start": start, "end": end, "jump": round(jump, 4), "median_step": round(float(np.median(steps)), 4),
                             "seconds": round((end - start) / FPS, 2)}
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(clip), "-vf",
                        f"select='between(n\\,{start}\\,{end - 1})',setpts=N/{FPS}/TB", "-an", "-c:v", "libx264", "-crf", "18",
                        "-pix_fmt", "yuv420p", str(out_dir / clip.name)], check=True)
        print(clip.stem, points[clip.stem], flush=True)
    (ROOT / "art_candidates/combo_videos/loop_points.json").write_text(json.dumps(points, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
