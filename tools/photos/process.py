#!/usr/bin/env python3
"""
Gobblepaws photo pipeline: image processing only, no generative AI.

Reads originals from assets/user/photos/originals/ (git-ignored, never pushed)
and the registry in tools/photos/registry.json, then writes small, web-ready
derivatives into assets/user/photos/ which the build embeds:

  <name>-portrait.jpg   square crop centred on the face (or the subject), 512 px
  <name>-stamp.png      round "postage stamp" cut-out with a cream border, 256 px
  <name>-poster.jpg     storybook poster look (smoothed, colour-quantised, inked edges), 640 px
  <name>-toon.png       caricature-style cartoon (bold edges, flat colour), 384 px

Anything listed in a registry entry's "blur" polygons is blurred before any
crop, so it can never leak into a derivative.

Usage:
  python3 tools/photos/process.py            # process everything in the registry
  python3 tools/photos/process.py oli-front  # just one entry
  python3 tools/photos/process.py --check    # validate the registry, no output

It never skips silently: every failure is listed at the end and the exit code is 1.
"""

import json
import sys
from pathlib import Path

try:
    import cv2
    import numpy as np
except ImportError:
    sys.exit("Needs OpenCV and numpy:  pip install opencv-python-headless pillow numpy")

ROOT = Path(__file__).resolve().parents[2]
ORIG = ROOT / "assets/user/photos/originals"
OUT = ROOT / "assets/user/photos"
REGISTRY = Path(__file__).with_name("registry.json")
CREAM = (232, 246, 255)  # BGR for #fff6e8

CASCADES = {
    "human": ["haarcascade_frontalface_default.xml", "haarcascade_profileface.xml"],
    "cat": ["haarcascade_frontalcatface_extended.xml", "haarcascade_frontalcatface.xml"],
}


def load_registry():
    if not REGISTRY.exists():
        return []
    data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    entries = data.get("photos", [])
    seen = set()
    for e in entries:
        for k in ("name", "source", "kind"):
            if k not in e:
                raise ValueError(f"registry entry missing '{k}': {e}")
        if e["name"] in seen:
            raise ValueError(f"duplicate registry name: {e['name']}")
        seen.add(e["name"])
        for poly in e.get("blur", []):
            if len(poly) < 3:
                raise ValueError(f"{e['name']}: blur polygon needs 3+ points")
    return entries


def apply_blur(img, polys):
    """Polygons are lists of [x, y] in 0..1 fractions of the image size."""
    if not polys:
        return img
    h, w = img.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    for poly in polys:
        pts = np.array([[int(x * w), int(y * h)] for x, y in poly], np.int32)
        cv2.fillPoly(mask, [pts], 255)
    k = max(31, (min(h, w) // 12) | 1)
    blurred = cv2.GaussianBlur(img, (k, k), 0)
    # pixelate on top so it's properly unreadable
    small = cv2.resize(blurred, (max(1, w // 24), max(1, h // 24)), interpolation=cv2.INTER_LINEAR)
    pix = cv2.resize(small, (w, h), interpolation=cv2.INTER_NEAREST)
    out = img.copy()
    out[mask > 0] = pix[mask > 0]
    return out


def find_subject(img, kind, hint=None):
    """Returns (cx, cy, size) in pixels: a square around the face or subject."""
    h, w = img.shape[:2]
    if hint:  # manual override in the registry: {"x":0.5,"y":0.4,"size":0.5}
        return int(hint["x"] * w), int(hint["y"] * h), int(hint["size"] * min(w, h))
    gray = cv2.equalizeHist(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))
    for name in CASCADES.get(kind, []):
        path = Path(cv2.data.haarcascades) / name
        if not path.exists():
            continue
        cas = cv2.CascadeClassifier(str(path))
        faces = cas.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(min(w, h) // 10,) * 2)
        if len(faces):
            x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
            return x + fw // 2, y + fh // 2, int(max(fw, fh) * 2.2)
    # Dogs and props: saliency-ish fallback (strongest edges, weighted to the centre)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 40, 120).astype(np.float32)
    yy, xx = np.mgrid[0:h, 0:w]
    weight = np.exp(-(((xx - w / 2) / (w * 0.35)) ** 2 + ((yy - h / 2) / (h * 0.35)) ** 2))
    e = edges * weight
    total = e.sum()
    if total <= 0:
        return w // 2, h // 2, min(w, h)
    cx, cy = int((e * xx).sum() / total), int((e * yy).sum() / total)
    return cx, cy, int(min(w, h) * 0.8)


def square_crop(img, cx, cy, size):
    h, w = img.shape[:2]
    size = max(32, min(size, w, h))
    x0 = int(np.clip(cx - size // 2, 0, w - size))
    y0 = int(np.clip(cy - size // 2, 0, h - size))
    return img[y0:y0 + size, x0:x0 + size]


def stamp(sq, px=256):
    img = cv2.resize(sq, (px, px), interpolation=cv2.INTER_AREA)
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    mask = np.zeros((px, px), np.uint8)
    cv2.circle(mask, (px // 2, px // 2), px // 2 - 2, 255, -1, cv2.LINE_AA)
    ring = np.zeros((px, px), np.uint8)
    cv2.circle(ring, (px // 2, px // 2), px // 2 - 2, 255, max(6, px // 22), cv2.LINE_AA)
    rgba[ring > 0, :3] = CREAM
    rgba[:, :, 3] = mask
    return rgba


def poster(img, px=640, k=8):
    h, w = img.shape[:2]
    s = px / max(h, w)
    img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    smooth = img
    for _ in range(3):
        smooth = cv2.bilateralFilter(smooth, 9, 60, 60)
    data = smooth.reshape(-1, 3).astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centres = cv2.kmeans(data, k, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    # warm the palette a touch for the storybook look
    centres = np.clip(centres * np.array([0.95, 1.0, 1.06]) + 6, 0, 255).astype(np.uint8)
    quant = centres[labels.flatten()].reshape(smooth.shape)
    gray = cv2.cvtColor(smooth, cv2.COLOR_BGR2GRAY)
    edges = cv2.adaptiveThreshold(cv2.medianBlur(gray, 7), 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 9, 4)
    ink = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
    out = cv2.bitwise_and(quant, ink)
    return cv2.addWeighted(out, 0.85, quant, 0.15, 0)


def toon(sq, px=384):
    img = cv2.resize(sq, (px, px), interpolation=cv2.INTER_AREA)
    # gentle "caricature" bulge: enlarge the centre (eyes and nose) a bit
    yy, xx = np.mgrid[0:px, 0:px].astype(np.float32)
    dx, dy = (xx - px / 2) / (px / 2), (yy - px * 0.45) / (px / 2)
    r = np.sqrt(dx * dx + dy * dy)
    f = np.where(r < 1, 0.78 + 0.22 * r, 1.0)
    mapx = (px / 2 + dx * f * (px / 2)).astype(np.float32)
    mapy = (px * 0.45 + dy * f * (px / 2)).astype(np.float32)
    img = cv2.remap(img, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    flat = img
    for _ in range(5):
        flat = cv2.bilateralFilter(flat, 9, 80, 80)
    flat = (flat // 32) * 32 + 16
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.adaptiveThreshold(cv2.medianBlur(gray, 5), 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 9, 6)
    out = cv2.bitwise_and(flat, cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR))
    return stamp(out, px)


def process(entry):
    src = ORIG / entry["source"]
    if not src.exists():
        raise FileNotFoundError(f"missing original: {src.relative_to(ROOT)}")
    img = cv2.imread(str(src), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"could not decode {src.name} (unsupported format? HEIC needs converting to JPG first)")
    if max(img.shape[:2]) > 3000:  # keep it quick
        s = 3000 / max(img.shape[:2])
        img = cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    img = apply_blur(img, entry.get("blur", []))
    cx, cy, size = find_subject(img, entry["kind"], entry.get("subject"))
    sq = square_crop(img, cx, cy, size)
    name = entry["name"]
    outputs = entry.get("outputs", ["portrait", "stamp", "poster", "toon"])
    written = []
    if "portrait" in outputs:
        p = OUT / f"{name}-portrait.jpg"
        cv2.imwrite(str(p), cv2.resize(sq, (512, 512), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 82])
        written.append(p)
    if "stamp" in outputs:
        p = OUT / f"{name}-stamp.png"
        cv2.imwrite(str(p), stamp(sq))
        written.append(p)
    if "poster" in outputs:
        p = OUT / f"{name}-poster.jpg"
        cv2.imwrite(str(p), poster(img), [cv2.IMWRITE_JPEG_QUALITY, 80])
        written.append(p)
    if "toon" in outputs:
        p = OUT / f"{name}-toon.png"
        cv2.imwrite(str(p), toon(sq))
        written.append(p)
    return written


def main(argv):
    check_only = "--check" in argv
    only = [a for a in argv if not a.startswith("--")]
    try:
        entries = load_registry()
    except Exception as e:  # noqa: BLE001
        print(f"Registry problem: {e}")
        return 1
    if only:
        entries = [e for e in entries if e["name"] in only]
    if check_only:
        print(f"Registry OK: {len(entries)} entries")
        return 0
    if not entries:
        print("Nothing to do: add entries to tools/photos/registry.json and originals to assets/user/photos/originals/")
        return 0
    OUT.mkdir(parents=True, exist_ok=True)
    failures = []
    total = 0
    for e in entries:
        try:
            files = process(e)
            for f in files:
                kb = f.stat().st_size / 1024
                total += kb
                print(f"  {f.relative_to(ROOT)}  {kb:.0f} KB")
        except Exception as ex:  # noqa: BLE001
            failures.append((e["name"], str(ex)))
    print(f"Done: {len(entries) - len(failures)}/{len(entries)} photos, {total / 1024:.2f} MB of derivatives")
    if failures:
        print("\nFAILED (not skipped quietly, please look):")
        for n, msg in failures:
            print(f"  {n}: {msg}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
