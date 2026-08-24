#!/usr/bin/env python3
"""Generate HuntFlow favicon + PWA icon set from the crimson logo.

Source: static/icons/huntflow-logo.png (1254x1254, transparent).
- Transparent PNG favicons (crisp on light or dark tab bars).
- Opaque near-black (#111111) tiles for apple-touch + PWA "any".
- A maskable variant with extra safe-zone padding.
- A multi-size favicon.ico (16/32/48).
"""
from PIL import Image

SRC = "static/icons/huntflow-logo.png"
BG = (17, 17, 17, 255)  # #111111 — matches the manifest tile color

logo = Image.open(SRC).convert("RGBA")
bbox = logo.getbbox()          # trim the transparent margins
if bbox:
    logo = logo.crop(bbox)
lw, lh = logo.size


def scaled(frac_side):
    scale = min(frac_side / lw, frac_side / lh)
    nw, nh = max(1, round(lw * scale)), max(1, round(lh * scale))
    return logo.resize((nw, nh), Image.LANCZOS)


def make(target, frac, bg, out):
    canvas = Image.new("RGBA", (target, target), bg if bg else (0, 0, 0, 0))
    art = scaled(int(target * frac))
    nw, nh = art.size
    canvas.alpha_composite(art, ((target - nw) // 2, (target - nh) // 2))
    canvas.save(out)
    print("wrote", out, f"{target}x{target}")


# Transparent favicons
make(32, 0.98, None, "static/icons/favicon-32.png")
# Opaque brand tiles
make(180, 0.80, BG, "static/icons/apple-touch-icon.png")
make(192, 0.80, BG, "static/icons/icon-192.png")
make(512, 0.80, BG, "static/icons/icon-512.png")
# Maskable (extra padding so OS masks don't clip the circuit traces)
make(512, 0.62, BG, "static/icons/icon-512-maskable.png")

# favicon.ico (transparent, downsampled from a 256 render)
base = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
art = scaled(int(256 * 0.98))
nw, nh = art.size
base.alpha_composite(art, ((256 - nw) // 2, (256 - nh) // 2))
base.save("static/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
print("wrote static/favicon.ico 16/32/48")
