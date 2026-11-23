"""Measure each candidate road (vanishing point, edge slopes) and warp it affinely so its road matches Gate Rally's
geometry: VP at (0.502, 0.243) of the frame, road edge reaching the frame side at y = 0.785. Writes warped/<name>.png
and an overlay sheet with the game's road edges drawn in."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SRC = Path(sys.argv[1])
OUT = SRC / "warped"
OUT.mkdir(exist_ok=True)
W, H = 832, 1216
VPX, HY = 0.502, 0.243
EDGE = 0.502 / (0.785 - 0.243)          # half-width (fraction of W) per unit of y (fraction of H)
SLOPE_PX = EDGE * W / H                  # target dx/dy in pixels


def measure(img, strict=False):
    a = np.asarray(img.convert("RGB")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    road = (r > 150) & (r - g > 55) & (r - b > 80) & (g > 50)
    if strict:
        road &= (r - g > 90) & (g < 128)
    rows, lefts, rights = [], [], []
    cx = W // 2
    for y in range(int(H * 0.55), int(H * 0.97), 6):
        line = road[y]
        if not line[cx - 30:cx + 30].mean() > 0.6:   # the centre dashes break the run; look beside them
            continue
        x = cx
        # walk outward allowing short gaps (dashes / kerb lines)
        def walk(step):
            x, gap, last = cx, 0, cx
            while 0 <= x < W:
                if line[x]:
                    last, gap = x, 0
                else:
                    gap += 1
                    if gap > 25:
                        break
                x += step
            return last
        l, rr = walk(-1), walk(1)
        if l <= 2 or rr >= W - 3:
            continue
        rows.append(y); lefts.append(l); rights.append(rr)
    rows, lefts, rights = map(np.array, (rows, lefts, rights))
    if len(rows) < 8:
        return None
    pl = np.polyfit(rows, lefts, 1); pr = np.polyfit(rows, rights, 1)   # x = m*y + c
    vy = (pr[1] - pl[1]) / (pl[0] - pr[0]); vx = pl[0] * vy + pl[1]
    slope = (pr[0] - pl[0]) / 2                                         # half-width growth per px of y
    return vx, vy, slope, len(rows)


def warp(img, vx, vy, slope):
    # output (xo, yo) px <- source: ys = vy + (yo - HY*H)/sy, xs = vx + (xo - VPX*W)/sx
    sy_min = max(HY * H / vy, (H - HY * H) / (H - vy))
    sx_cov = max((VPX * W) / vx, (W - VPX * W) / (W - vx))   # the source must cover the frame horizontally
    sy = max(sy_min, sx_cov * slope / SLOPE_PX)                # a wide road: stretch taller (crops road at the bottom)
    sx = max(sx_cov, sy * SLOPE_PX / slope)
    # affine for PIL: source = A * output
    coeffs = (1 / sx, 0, vx - VPX * W / sx, 0, 1 / sy, vy - HY * H / sy)
    return img.transform((W, H), Image.AFFINE, coeffs, resample=Image.BICUBIC), sx, sy


def overlay(img):
    o = img.convert("RGB").copy(); d = ImageDraw.Draw(o)
    for side in (-1, 1):
        d.line([(VPX * W, HY * H), ((VPX + side * EDGE * (1 - HY)) * W, H)], fill=(0, 255, 255), width=4)
    d.line([(0, HY * H), (W, HY * H)], fill=(255, 0, 255), width=2)
    return o


tiles = []
for f in sorted(SRC.glob("track_*/v*.png")):
    img = Image.open(f).convert("RGB")
    m = measure(img) if "savanna" not in f.parent.name else measure(img, True)
    name = f"{f.parent.name}_{f.stem}"
    if not m:
        print(name, "no road found"); continue
    vx, vy, slope, n = m
    out, sx, sy = warp(img, vx, vy, slope)
    out.save(OUT / f"{name}.png")
    print(f"{name}: vp=({vx/W:.3f},{vy/H:.3f}) slope={slope:.3f} rows={n} -> sx={sx:.2f} sy={sy:.2f} aniso={sx/sy:.2f}")
    tiles.append(overlay(out).resize((208, 304)))
sheet = Image.new("RGB", (208 * 4, 304 * ((len(tiles) + 3) // 4)), "white")
for i, t in enumerate(tiles):
    sheet.paste(t, ((i % 4) * 208, (i // 4) * 304))
sheet.save(OUT / "sheet.png")
