"""Local click-to-segment authoring tool for the tap-the-story game.

Serves the authoring UI, runs SAM 2 point-prompt segmentation on images in
dev/story-media/, and reads/writes the story JSON files the game consumes
(dev/story/stories/<id>.json plus the dev/story/stories.json index).

Run:  .venv/bin/python server.py   ->  http://localhost:5001
The sam2.1_b.pt checkpoint (~155 MB) downloads into this folder on first
launch; both it and .venv/ are gitignored.
"""

import json
import re
from pathlib import Path

import cv2
import numpy as np
from flask import Flask, jsonify, request, send_from_directory

REPO_ROOT = Path(__file__).resolve().parents[2]
MEDIA_DIR = REPO_ROOT / "dev" / "story-media"
STORY_DIR = REPO_ROOT / "dev" / "story" / "stories"
INDEX_PATH = REPO_ROOT / "dev" / "story" / "stories.json"

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
STORY_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")

# Contours smaller than this fraction of the largest contour's area are
# SAM noise (stray pixels), not a genuinely occlusion-split part of the
# object.
MIN_CONTOUR_AREA_FRACTION = 0.002
# approxPolyDP tolerance as a fraction of contour perimeter - the knob to
# turn if polygons look too blocky (lower) or too heavy (higher).
SIMPLIFY_EPSILON_FRACTION = 0.004

app = Flask(__name__, static_url_path="/static")

print("Loading SAM 2 (downloads sam2.1_b.pt on first launch)...")
from ultralytics import SAM  # noqa: E402  (import after the message; it's slow)

model = SAM(str(Path(__file__).resolve().parent / "sam2.1_b.pt"))
print("Model ready.")


@app.get("/")
def home():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/media/<path:relpath>")
def media(relpath):
    return send_from_directory(MEDIA_DIR, relpath)


@app.get("/api/stories")
def list_stories():
    """Story ids = subfolders of dev/story-media/ that contain images."""
    stories = []
    for folder in sorted(MEDIA_DIR.iterdir()) if MEDIA_DIR.is_dir() else []:
        if folder.is_dir() and any(
            f.suffix.lower() in IMAGE_EXTENSIONS for f in folder.iterdir()
        ):
            stories.append(
                {"id": folder.name, "hasJson": (STORY_DIR / f"{folder.name}.json").is_file()}
            )
    return jsonify({"stories": stories})


@app.get("/api/images/<story_id>")
def list_images(story_id):
    folder = MEDIA_DIR / story_id
    if not STORY_ID_RE.match(story_id) or not folder.is_dir():
        return jsonify({"error": f"no media folder dev/story-media/{story_id}"}), 404
    images = sorted(
        f.name for f in folder.iterdir() if f.suffix.lower() in IMAGE_EXTENSIONS
    )
    return jsonify({"images": images})


@app.post("/api/segment")
def segment():
    """Run SAM 2 with the accumulated point prompts for one object.

    Body: {"image": "<story-id>/<file>", "points": [[x,y],...],
           "labels": [1,0,...]}   (natural-pixel coords; 1=object, 0=not)
    Returns normalized polygon rings for the single best mask.
    """
    body = request.get_json(force=True)
    image_path = (MEDIA_DIR / body["image"]).resolve()
    if MEDIA_DIR.resolve() not in image_path.parents or not image_path.is_file():
        return jsonify({"error": f"image not found: {body['image']}"}), 404

    points = body["points"]
    labels = body["labels"]
    if not points or len(points) != len(labels):
        return jsonify({"error": "points/labels mismatch"}), 400

    # One object, many refinement points: ultralytics expects the nested
    # (objects x points x 2) form for multi-point single-object prompts.
    results = model(str(image_path), points=[points], labels=[labels], verbose=False)
    masks = results[0].masks
    if masks is None or len(masks.data) == 0:
        return jsonify({"polygons": [], "bbox_frac": [0, 0]})

    mask = masks.data[0].cpu().numpy().astype(np.uint8)
    height, width = mask.shape
    polygons = mask_to_polygons(mask, width, height)
    if not polygons:
        return jsonify({"polygons": [], "bbox_frac": [0, 0]})

    xs = [x for ring in polygons for x, _ in ring]
    ys = [y for ring in polygons for _, y in ring]
    return jsonify(
        {
            "polygons": polygons,
            "bbox_frac": [round(max(xs) - min(xs), 4), round(max(ys) - min(ys), 4)],
            "imageSize": [width, height],
        }
    )


def mask_to_polygons(mask, width, height):
    """Binary mask -> list of simplified polygon rings in 0-1 coords."""
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return []
    largest_area = max(cv2.contourArea(c) for c in contours)
    polygons = []
    for contour in contours:
        if cv2.contourArea(contour) < largest_area * MIN_CONTOUR_AREA_FRACTION:
            continue
        epsilon = SIMPLIFY_EPSILON_FRACTION * cv2.arcLength(contour, True)
        simplified = cv2.approxPolyDP(contour, epsilon, True)
        if len(simplified) < 3:
            continue
        polygons.append(
            [
                [round(float(x) / width, 4), round(float(y) / height, 4)]
                for [[x, y]] in simplified
            ]
        )
    return polygons


@app.get("/api/story/<story_id>")
def load_story(story_id):
    if not STORY_ID_RE.match(story_id):
        return jsonify({"error": "bad story id"}), 400
    path = STORY_DIR / f"{story_id}.json"
    if path.is_file():
        return jsonify(json.loads(path.read_text(encoding="utf-8")))
    return jsonify({"id": story_id, "title": "", "titleEnglish": "", "scenes": []})


@app.post("/api/story/<story_id>")
def save_story(story_id):
    if not STORY_ID_RE.match(story_id):
        return jsonify({"error": "bad story id"}), 400
    story = request.get_json(force=True)
    story["id"] = story_id
    STORY_DIR.mkdir(parents=True, exist_ok=True)
    path = STORY_DIR / f"{story_id}.json"
    path.write_text(
        json.dumps(story, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    update_index()
    return jsonify({"saved": str(path.relative_to(REPO_ROOT))})


def update_index():
    """Rebuild dev/story/stories.json from the individual story files."""
    entries = []
    for path in sorted(STORY_DIR.glob("*.json")):
        story = json.loads(path.read_text(encoding="utf-8"))
        scenes = story.get("scenes", [])
        entries.append(
            {
                "id": story["id"],
                "title": story.get("title", story["id"]),
                "titleEnglish": story.get("titleEnglish", ""),
                "cover": scenes[0]["image"] if scenes else None,
                "sceneCount": len(scenes),
            }
        )
    INDEX_PATH.write_text(
        json.dumps({"stories": entries}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    app.run(port=5001, debug=False)
