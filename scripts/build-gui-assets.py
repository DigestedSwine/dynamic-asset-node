#!/usr/bin/env python3
"""
Build GUI asset files for Commander Chronicle.
Generates 20×20 icon BMPs and writes assets/gui_manifest.json.

Requirements: Pillow  (pip install pillow)
"""

import hashlib, json, os, struct
from PIL import Image, ImageDraw

ICON_S   = 20
BASE_URL = "https://digestedswine.github.io/dynamic-asset-node/assets/GUI/"
ICONS_DIR    = "assets/GUI/icons"
MANIFEST_OUT = "assets/gui_manifest.json"

os.makedirs(ICONS_DIR, exist_ok=True)

# ──────────────────────────────────────────────────────────────
#  BMP writer — 24-bit BGR, bottom-up (matches firmware decodeBmp24)
# ──────────────────────────────────────────────────────────────

def write_bmp24(path: str, img: Image.Image):
    img = img.convert("RGB")
    w, h = img.size
    stride    = (w * 3 + 3) & ~3
    data_size = stride * h
    file_size = 54 + data_size
    pixels    = list(img.getdata())
    with open(path, "wb") as f:
        f.write(b"BM")
        f.write(struct.pack("<I", file_size))
        f.write(struct.pack("<HH", 0, 0))
        f.write(struct.pack("<I", 54))        # pixel data offset
        f.write(struct.pack("<I", 40))        # DIB header size
        f.write(struct.pack("<i", w))
        f.write(struct.pack("<i", h))         # positive = bottom-up
        f.write(struct.pack("<H", 1))         # colour planes
        f.write(struct.pack("<H", 24))        # bits per pixel
        f.write(struct.pack("<I", 0))         # compression
        f.write(struct.pack("<I", data_size))
        f.write(struct.pack("<ii", 2835, 2835))
        f.write(struct.pack("<II", 0, 0))
        for y in range(h - 1, -1, -1):       # bottom row first
            row = b""
            for x in range(w):
                r, g, b = pixels[y * w + x]
                row += bytes([b, g, r])       # BGR order
            row += b"\x00" * (stride - w * 3)
            f.write(row)


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


# ──────────────────────────────────────────────────────────────
#  Icon generators — white shapes on black (black = transparent)
# ──────────────────────────────────────────────────────────────

W, K = (255, 255, 255), (0, 0, 0)


def icon_skull(s: int = ICON_S) -> Image.Image:
    img = Image.new("RGB", (s, s), K)
    d   = ImageDraw.Draw(img)
    cx, cy = s // 2, s // 2 - 1
    r  = s // 2 - 2
    # Cranium
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=W)
    # Eye sockets
    er = max(1, r // 3)
    eo = r // 2
    d.ellipse([cx - eo - er, cy - er, cx - eo + er, cy + er], fill=K)
    d.ellipse([cx + eo - er, cy - er, cx + eo + er, cy + er], fill=K)
    # Jaw teeth notches at bottom of cranium
    jy = cy + r - 1
    for i in range(3):
        jx = cx - 2 + i * 2
        d.point([(jx, jy)], fill=K)
    return img


def icon_crown(s: int = ICON_S) -> Image.Image:
    img = Image.new("RGB", (s, s), K)
    d   = ImageDraw.Draw(img)
    by  = s * 11 // 16     # band top y
    # Three upward peaks (left, centre, right)
    lx, cx, rx = s // 6, s // 2, s * 5 // 6
    peak_y = 2
    d.polygon([(1, by),         (lx, peak_y),  (s // 3, by)],       fill=W)
    d.polygon([(s // 3, by),    (cx, peak_y),  (s * 2 // 3, by)],   fill=W)
    d.polygon([(s * 2 // 3, by),(rx, peak_y),  (s - 2, by)],        fill=W)
    # Horizontal base band
    d.rectangle([1, by, s - 2, s - 2], fill=W)
    return img


def icon_sword(s: int = ICON_S) -> Image.Image:
    img = Image.new("RGB", (s, s), K)
    d   = ImageDraw.Draw(img)
    cx  = s // 2
    # Blade (thin vertical)
    d.rectangle([cx - 1, 1, cx + 1, s * 3 // 4], fill=W)
    # Crossguard (horizontal)
    gy  = s * 3 // 5
    d.rectangle([2, gy - 1, s - 3, gy + 1], fill=W)
    # Pommel (small circle at base)
    d.ellipse([cx - 2, s - 4, cx + 2, s - 1], fill=W)
    return img


def icon_diamond(s: int = ICON_S) -> Image.Image:
    img = Image.new("RGB", (s, s), K)
    d   = ImageDraw.Draw(img)
    cx, cy = s // 2, s // 2
    r  = s // 2 - 2
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=W)
    return img


# ──────────────────────────────────────────────────────────────
#  Generate icons
# ──────────────────────────────────────────────────────────────

icon_defs = [
    ("skull",   icon_skull(),   "icons/skull_20.bmp",   "/gui/skull.bmp",   ICON_S, ICON_S),
    ("crown",   icon_crown(),   "icons/crown_20.bmp",   "/gui/crown.bmp",   ICON_S, ICON_S),
    ("sword",   icon_sword(),   "icons/sword_20.bmp",   "/gui/sword.bmp",   ICON_S, ICON_S),
    ("diamond", icon_diamond(), "icons/diamond_20.bmp", "/gui/diamond.bmp", ICON_S, ICON_S),
]

print("Generating icons...")
for name, img, rel, _sd, _w, _h in icon_defs:
    path = os.path.join("assets/GUI", rel)
    write_bmp24(path, img)
    print(f"  {name}: {path}")

# ──────────────────────────────────────────────────────────────
#  Build asset entries
# ──────────────────────────────────────────────────────────────

def make_entry(name, rel_gui_path, sd_path, w, h):
    abs_path = os.path.join("assets/GUI", rel_gui_path)
    if not os.path.exists(abs_path):
        return None
    return {
        "name":    name,
        "url":     BASE_URL + rel_gui_path,
        "sd_path": sd_path,
        "w":       w, "h": h,
        "sha256":  sha256_file(abs_path),
        "size":    os.path.getsize(abs_path),
    }


assets = []

# Settings icon (pre-existing large icon)
e = make_entry("settings", "settings_40x40.bmp", "/gui/settings.bmp", 40, 40)
if e:
    assets.append(e)

# Small game icons
for name, _img, rel, sd, w, h in icon_defs:
    e = make_entry(name, rel, sd, w, h)
    if e:
        assets.append(e)

# ──────────────────────────────────────────────────────────────
#  Version bump — increment gui_version if any hash changed
# ──────────────────────────────────────────────────────────────

gui_version = 1
if os.path.exists(MANIFEST_OUT):
    try:
        with open(MANIFEST_OUT) as f:
            prev = json.load(f)
        gui_version  = prev.get("gui_version", 1)
        prev_hashes  = {a["name"]: a["sha256"] for a in prev.get("assets", [])}
        new_hashes   = {a["name"]: a["sha256"] for a in assets}
        if new_hashes != prev_hashes:
            gui_version += 1
            print(f"Assets changed — gui_version → {gui_version}")
        else:
            print(f"No changes — gui_version remains {gui_version}")
    except Exception as exc:
        print(f"Could not read existing manifest ({exc}); starting at v1")

# ──────────────────────────────────────────────────────────────
#  Write manifest
# ──────────────────────────────────────────────────────────────

manifest = {"gui_version": gui_version, "assets": assets}
with open(MANIFEST_OUT, "w") as f:
    json.dump(manifest, f, indent=2)
print(f"Wrote {MANIFEST_OUT}  (gui_version={gui_version}, {len(assets)} assets)")
