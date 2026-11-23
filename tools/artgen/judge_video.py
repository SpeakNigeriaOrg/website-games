"""Judge for the who-does-what clips (art/combo/<animal>_<action>.mp4), built like imagegen's strict picture checks:
ask what the game asks of a learner, without saying which answer is right, and measure what a model can't be trusted
to report.

Per clip:
  - action, blind: the clip shown to Qwen3-VL as video, "which one is the animal doing?" among the five actions the
    games use plus "none of these", in two orders; must be right both times. Also asked of the still alone and the
    clip's last frame: the clip starts from the still, so a right answer on the video proves little unless the still
    and the end agree, and a wrong last frame means the clip drifted into another action.
  - animal, blind: the same over the four animals, on the video.
  - change, asked alone: does the animal change shape, gain or lose legs or heads, or turn into another animal?
  - motion, measured: mean change between frames sampled at 4 per second (grey levels, 0-1), so a clip that barely
    moves shows up as a number, not an impression.
  - drift, measured: SigLIP 2 similarity of each sampled frame to the still; the lowest is where the clip strays.

Validation cases built from the clips themselves, with known answers:
  - frozen: the still repeated for the clip's length. No motion; must not pass the motion check.
  - splice: the first half of one animal's clip and the second half of another's. Must fail the change check or drift.

Run with the image project's environment (Qwen3-VL, SigLIP 2, av):
    uv run --project C:/Dev/yoruba_student_dict_platform/imagegen python tools/artgen/judge_video.py [OUT.json]
"""
import json
import random
import re
import sys
from pathlib import Path

import av
import numpy as np
import torch
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
COMBO = ROOT / "dev/games/art/combo"
ANIMALS = {"dog": "a dog", "chicken": "a chicken", "cow": "a cow", "rabbit": "a rabbit"}
ACTIONS = {"sleep": "sleeping", "eat": "eating", "run": "running", "walk": "walking", "drink": "drinking"}
LETTERS = "ABCDEFG"
SAMPLE_FPS = 4
QWEN = "Qwen/Qwen3-VL-8B-Instruct"
SIGLIP = "google/siglip2-so400m-patch14-384"
CHANGE_Q = ("Watch the animal through the whole clip. Does it change shape unnaturally, gain or lose legs or heads, "
            "or turn into a different animal? Answer yes or no.")


def frames(path, fps=SAMPLE_FPS):
    with av.open(str(path)) as c:
        s = c.streams.video[0]
        rate = float(s.average_rate)
        all_frames = [f.to_image() for f in c.decode(s)]
    step = max(1, round(rate / fps))
    return all_frames[::step], rate


def motion(fr):
    g = [np.asarray(f.convert("L"), dtype=np.float32) / 255 for f in fr]
    return float(np.mean([np.abs(a - b).mean() for a, b in zip(g, g[1:])])) if len(g) > 1 else 0.0


class Judge:
    def __init__(self):
        from transformers import AutoModelForImageTextToText, AutoProcessor
        self.model = AutoModelForImageTextToText.from_pretrained(QWEN, dtype=torch.bfloat16, device_map="cuda").eval()
        self.proc = AutoProcessor.from_pretrained(QWEN)

    @torch.no_grad()
    def ask(self, media, text, max_new_tokens=4):
        """media: one PIL image, or a list of PIL frames (shown as video)."""
        item = {"type": "video", "video": media} if isinstance(media, list) else {"type": "image", "image": media}
        messages = [{"role": "user", "content": [item, {"type": "text", "text": text}]}]
        kw = {"fps": SAMPLE_FPS} if isinstance(media, list) else {}
        inputs = self.proc.apply_chat_template(messages, tokenize=True, add_generation_prompt=True, return_dict=True,
                                               return_tensors="pt", **kw).to(self.model.device)
        out = self.model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=False)
        return self.proc.batch_decode(out[:, inputs["input_ids"].shape[1]:], skip_special_tokens=True)[0].strip()

    def choose(self, media, question, options, right):
        """Two orders; returns the chosen option each time."""
        got = []
        for order in (options, options[1:] + options[:1]):
            opts = list(order) + ["none of these"]
            text = question + " Reply with the letter only.\n" + "\n".join(f"{LETTERS[i]}) {o}" for i, o in enumerate(opts))
            m = re.search(r"[A-G]", self.ask(media, text).upper())
            i = LETTERS.index(m.group(0)) if m else -1
            got.append(opts[i] if 0 <= i < len(opts) else None)
        return {"chosen": got, "correct": all(g == right for g in got)}

    def unload(self):
        del self.model
        torch.cuda.empty_cache()


def siglip_drift(items):
    from transformers import AutoModel, AutoProcessor
    model = AutoModel.from_pretrained(SIGLIP, dtype=torch.float16).to("cuda").eval()
    proc = AutoProcessor.from_pretrained(SIGLIP)

    @torch.no_grad()
    def feats(images):
        f = model.get_image_features(pixel_values=proc(images=images, return_tensors="pt").to("cuda")["pixel_values"].half())
        f = getattr(f, "pooler_output", f)
        return torch.nn.functional.normalize(f.float(), dim=-1)

    out = {}
    for key, (still, fr) in items.items():
        s, f = feats([still]), feats(fr)
        sims = (f @ s.T).squeeze(1).tolist()
        out[key] = {"min": round(min(sims), 4), "end": round(sims[-1], 4)}
    del model
    torch.cuda.empty_cache()
    return out


def judge_candidates(paths):
    """Candidate clips (art_candidates/combo_videos/<name>/s*.mp4): the same questions, and motion against the
    accepted clips of the same action by the other animals. Prints one line per clip, best first."""
    judge = Judge()
    rows = []
    for p in paths:
        name = p.parent.name
        animal, action = name.split("_")
        fr, _ = frames(p)
        acts, anis = list(ACTIONS.values()), list(ANIMALS.values())
        q_act = "This is from a children's game. Which one is the animal doing?"
        r = {"clip": str(p), "action_video": judge.choose(fr, q_act, acts, ACTIONS[action])["correct"],
             "action_end": judge.choose(fr[-1], q_act, acts, ACTIONS[action])["correct"],
             "animal_video": judge.choose(fr, "Which animal is this?", anis, ANIMALS[animal])["correct"],
             "change": judge.ask(fr, CHANGE_Q).lower().startswith("yes"), "motion": round(motion(fr), 5)}
        others = [motion(frames(q)[0]) for q in COMBO.glob(f"*_{action}.mp4") if q.stem.split("_")[0] != animal]
        r["motion_vs_others"] = round(r["motion"] / float(np.median(others)), 2)
        r["ok"] = r["action_video"] and r["action_end"] and r["animal_video"] and not r["change"] and r["motion_vs_others"] >= 0.5
        rows.append(r)
    judge.unload()
    for r in sorted(rows, key=lambda r: (-r["ok"], -r["motion_vs_others"])):
        print(json.dumps(r))


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--candidates":
        return judge_candidates([Path(p) for p in sys.argv[2:]])
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dev/games/art_candidates/combo_videos/judge_video.json"
    clips = {p.stem: p for p in sorted(COMBO.glob("*_*.mp4"))}
    data, cases = {}, {}
    for name, p in clips.items():
        animal, action = name.split("_")
        fr, rate = frames(p)
        data[name] = {"animal": animal, "action": action, "frames": fr, "still": Image.open(COMBO / f"{name}.png").convert("RGB")}
    rng = random.Random(0)
    names = list(data)
    for name in names[:4]:  # frozen: the still for the clip's length
        d = data[name]
        cases[f"frozen:{name}"] = {**d, "frames": [d["still"]] * len(d["frames"]), "expect": "no motion"}
    for a, b in [("dog_run", "cow_run"), ("rabbit_walk", "chicken_walk"), ("dog_eat", "rabbit_eat"), ("cow_sleep", "dog_sleep")]:
        fa, fb = data[a]["frames"], data[b]["frames"]
        cases[f"splice:{a}+{b}"] = {**data[a], "frames": fa[: len(fa) // 2] + fb[len(fb) // 2:], "expect": "change"}
    judge = Judge()
    results = {}
    for key, d in list(data.items()) + list(cases.items()):
        fr, right_action, right_animal = d["frames"], ACTIONS[d["action"]], ANIMALS[d["animal"]]
        acts = list(ACTIONS.values())
        rng.shuffle(acts)
        anis = list(ANIMALS.values())
        rng.shuffle(anis)
        q_act = "This is from a children's game. Which one is the animal doing?"
        r = {
            "action_video": judge.choose(fr, q_act, acts, right_action),
            "action_still": judge.choose(d["still"], q_act, acts, right_action),
            "action_end": judge.choose(fr[-1], q_act, acts, right_action),
            "animal_video": judge.choose(fr, "Which animal is this?", anis, right_animal),
            "change": judge.ask(fr, CHANGE_Q).lower().startswith("yes"),
            "motion": round(motion(fr), 5),
            "expect": d.get("expect"),
        }
        results[key] = r
        print(key, {k: (v["correct"] if isinstance(v, dict) else v) for k, v in r.items()}, flush=True)
    judge.unload()
    drift = siglip_drift({k: (d["still"], d["frames"]) for k, d in list(data.items()) + list(cases.items())})
    for k in results:
        results[k]["drift"] = drift[k]
    real = {k: v for k, v in results.items() if ":" not in k}
    mot = sorted(v["motion"] for v in real.values())
    summary = {
        "clips": len(real),
        "action_video_right": sum(v["action_video"]["correct"] for v in real.values()),
        "action_still_right": sum(v["action_still"]["correct"] for v in real.values()),
        "action_end_right": sum(v["action_end"]["correct"] for v in real.values()),
        "animal_video_right": sum(v["animal_video"]["correct"] for v in real.values()),
        "change_said_yes": [k for k, v in real.items() if v["change"]],
        "motion_range": [mot[0], mot[len(mot) // 2], mot[-1]],
        "frozen_motion": {k: v["motion"] for k, v in results.items() if k.startswith("frozen")},
        "splice_caught": {k: {"change": v["change"], "drift_min": v["drift"]["min"]} for k, v in results.items() if k.startswith("splice")},
        "real_drift_min": sorted((v["drift"]["min"], k) for k, v in real.items())[:5],
        # Asking the model can't tell a clip that barely moves (frozen copies passed the action question 3 of 4
        # times), so motion is compared within an action: under half the median of the other animals doing it.
        "low_motion": [k for k, v in real.items()
                       if v["motion"] < 0.5 * float(np.median([o["motion"] for o_k, o in real.items()
                                                               if o_k != k and o_k.split("_")[1] == k.split("_")[1]]))],
    }
    out_path.write_text(json.dumps({"summary": summary, "results": results}, indent=1), encoding="utf-8")
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
