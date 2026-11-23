"""Who-does-what clips: one short video per combination (dog sleeping, hen eating, ...), each starting FROM the chosen
still, so the animal in the clip is the same character as in the still and in every other clip.

MiniMax-H3's `fl2va` workflow (first and/or last keyframe) uses the same `transformer/` checkpoint as the `t2va`
workflow videogen already runs, so nothing new is downloaded. The loader below is videogen's
(`videogen/src/videogen/generate.py: load_video_pipeline`, int8 weight-only + block-level CPU offload) with the
workflow switched to `fl2va`. Local files only: no database, no R2.

Run with the image project's environment (it has diffusers main with MiniMax-H3, torchao, av):
    uv run --project C:/Dev/yoruba_student_dict_platform/imagegen python tools/artgen/combo_video.py PLAN.json OUT_DIR
Plan: [{"name": "dog_sleep", "still": "dev/games/art/combo/dog_sleep.png", "prompt": "<MiniMax prompt>", "seeds": [0]}]
Writes OUT_DIR/<name>/s<seed>.mp4 (and a .txt with the prompt); existing clips are skipped, so a run can be resumed or
extended. Takes the GPU lock and keeps it fresh (gpulock treats a lock older than 2 hours as abandoned).
--max=N: make at most N clips, then release the lock (combo_video_each.sh runs one clip per process, so other GPU jobs
get the card between clips: fl2va runs at ~100 s per step here, about 80 min per 5 s clip, against ~10 s for t2va)."""
import json
import math
import os
import sys
import threading
import time
from pathlib import Path

# Never download: the Hub's main moved past the revision in the local cache (a run without this started pulling the
# new revision's ~80 GB). Load only the cached revision, offline.
os.environ["HF_HUB_OFFLINE"] = "1"
import torch  # noqa: E402
from PIL import Image  # noqa: E402

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, "C:/Dev/yoruba_student_dict_platform/videogen/src")
from gpulock import LOCK, gpu_lock  # noqa: E402

MODEL_ID = "MiniMaxAI/MiniMax-H3"
CACHE_DIR = "D:/Dev/hf-video-models"
REVISION = "42ed227ee7df40d41602854ae760620d6eb651fe"  # the snapshot videogen generated with
SIZE = 512
FPS = 24


def num_frames(seconds=5):
    return max(5, 17 * math.ceil((seconds * FPS - 5) / 17) + 5)


def load():
    from diffusers import MiniMaxH3Transformer3DModel, ModularPipeline, TorchAoConfig
    from diffusers.hooks import apply_group_offloading
    from torchao.quantization import Int8WeightOnlyConfig
    from transformers import Qwen3VLForConditionalGeneration
    from transformers import TorchAoConfig as TransformersTorchAoConfig

    pipe = ModularPipeline.from_pretrained(MODEL_ID, cache_dir=CACHE_DIR)  # offline: refs/main is the cached snapshot (it asks the Hub API when given a revision)
    pipe.update_components(
        transformer=MiniMaxH3Transformer3DModel.from_pretrained(
            MODEL_ID, subfolder="transformer", dtype=torch.bfloat16, cache_dir=CACHE_DIR, revision=REVISION, local_files_only=True,
            quantization_config=TorchAoConfig(Int8WeightOnlyConfig(version=2), modules_to_not_convert=[
                "proj_in", "audio_proj_in", "context_embedder", "time_embedder", "time_proj",
                "token_refiner", "norm_out", "proj_out", "audio_proj_out"]),
        ),
        text_encoder=Qwen3VLForConditionalGeneration.from_pretrained(
            MODEL_ID, subfolder="text_encoder", dtype=torch.bfloat16, cache_dir=CACHE_DIR, revision=REVISION, local_files_only=True,
            quantization_config=TransformersTorchAoConfig(Int8WeightOnlyConfig(version=2), modules_to_not_convert=[
                "model.visual", "model.language_model.embed_tokens", "model.language_model.norm", "lm_head"]),
        ),
    )
    pipe.load_components(workflow="fl2va", dtype=torch.bfloat16, cache_dir=CACHE_DIR, local_files_only=True)
    # the processor straight from the cached snapshot folder: offline, the hub lookup fails on an optional file that
    # online would simply be missing, and the modular loader then leaves `processor` as None (see videogen's note)
    from transformers import Qwen3VLProcessor
    pipe.update_components(processor=Qwen3VLProcessor.from_pretrained(f"{CACHE_DIR}/models--MiniMaxAI--MiniMax-H3/snapshots/{REVISION}/processor"))
    pipe.transformer.requires_grad_(False)
    pipe.text_encoder.requires_grad_(False)
    offload = dict(onload_device=torch.device("cuda"), offload_device=torch.device("cpu"), use_stream=True)
    pipe.transformer.enable_group_offload(offload_type="block_level", num_blocks_per_group=1, **offload)
    apply_group_offloading(pipe.text_encoder.model, offload_type="leaf_level", **offload)
    pipe.vae.to("cuda")
    pipe.audio_vae.to("cuda")
    return pipe


def keep_lock_fresh(stop):
    while not stop.wait(600):
        try:
            LOCK.touch()
        except OSError:
            pass


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    most = next((int(a[6:]) for a in sys.argv[1:] if a.startswith("--max=")), None)
    plan, out_dir = json.loads(Path(args[0]).read_text(encoding="utf-8")), Path(args[1])
    todo = [(job, s) for job in plan for s in job["seeds"] if not (out_dir / job["name"] / f"s{s}.mp4").exists()]
    todo = todo[:most] if most else todo
    if not todo:
        print("nothing to do")
        return
    with gpu_lock():
        stop = threading.Event()
        threading.Thread(target=keep_lock_fresh, args=(stop,), daemon=True).start()
        try:
            run(todo, out_dir)
        finally:
            stop.set()


def run(todo, out_dir):
    from videogen.encode import encode_video

    pipe = load()
    for job, seed in todo:
        folder = out_dir / job["name"]
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / f"s{seed}.mp4"
        if target.exists():
            continue
        still = Image.open(job["still"]).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
        t = time.time()
        result = pipe(prompt=job["prompt"], image=still, height=SIZE, width=SIZE, num_frames=num_frames(),
                      generator=torch.Generator().manual_seed(seed), output=["videos", "audio", "sampling_rate"])
        encode_video(result["videos"][0], fps=FPS, output_path=str(target),
                     audio=result["audio"][0], audio_sample_rate=result["sampling_rate"])
        (folder / f"s{seed}.txt").write_text(job["prompt"], encoding="utf-8")
        print(f"{job['name']} s{seed} done in {time.time() - t:.0f}s", flush=True)


if __name__ == "__main__":
    main()
