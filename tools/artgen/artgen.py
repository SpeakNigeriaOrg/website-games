"""Game art for the dev games: scenes and character sprites from the local Z-Image-Turbo model.

Each asset in a spec file gets a few seeded variants; sprites are drawn on plain white and cut out by a
flood fill from the image border (flat clip-art with outlines separates cleanly), then cropped.

Run with the image project's environment (it has the model and torch):
    uv run --project C:/Dev/yoruba_student_dict_platform/imagegen python tools/artgen/artgen.py SPEC.json OUT_DIR
Spec: [{"name": "frog", "prompt": "...", "width": 768, "height": 768, "sprite": true, "variants": 3}, ...]
Writes OUT_DIR/<name>/v<i>.png; existing variants are skipped, so a run can be resumed or extended."""
import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from gpulock import gpu_lock  # noqa: E402

STYLE = ("flat vector clip-art illustration for a children's picture book, simple flat shapes, bright solid colors, "
         "bold clean dark outlines, crisp and legible, no text, no letters, no watermark")
SPRITE = "isolated on a plain pure white background, nothing else in the picture, no shadow on the ground"


def cutout(image, tolerance=24):
    """Make the white region connected to the border transparent, feather the edge by a pixel, crop."""
    rgb = np.asarray(image.convert("RGB")).astype(np.int16)
    h, w, _ = rgb.shape
    near_white = (255 - rgb).max(axis=2) <= tolerance
    background = np.zeros((h, w), bool)
    queue = deque((y, x) for y in range(h) for x in (0, w - 1)) + deque((y, x) for x in range(w) for y in (0, h - 1))
    while queue:
        y, x = queue.popleft()
        if 0 <= y < h and 0 <= x < w and near_white[y, x] and not background[y, x]:
            background[y, x] = True
            queue.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    alpha = Image.fromarray(np.where(background, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = image.convert("RGBA")
    out.putalpha(alpha)
    box = out.getbbox()
    return out.crop(box) if box else out


def main():
    with gpu_lock():
        run()


def run():
    spec, out_dir = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")), Path(sys.argv[2])
    from diffusers import ZImagePipeline

    pipe = ZImagePipeline.from_pretrained("Tongyi-MAI/Z-Image-Turbo", dtype=torch.bfloat16, low_cpu_mem_usage=False).to("cuda")
    for asset in spec:
        folder = out_dir / asset["name"]
        folder.mkdir(parents=True, exist_ok=True)
        prompt = f"{asset['prompt']}, {SPRITE if asset.get('sprite') else 'full scene filling the frame'}, {STYLE}"
        (folder / "prompt.txt").write_text(prompt, encoding="utf-8")
        for i in range(asset.get("variants", 3)):
            target = folder / f"v{i}.png"
            if target.exists():
                continue
            image = pipe(prompt=prompt, width=asset.get("width", 768), height=asset.get("height", 768), num_inference_steps=9,
                         guidance_scale=0.0, generator=torch.Generator("cuda").manual_seed(1000 + i)).images[0]
            (cutout(image) if asset.get("sprite") else image).save(target)
            print(f"{asset['name']} v{i}", flush=True)


if __name__ == "__main__":
    main()
