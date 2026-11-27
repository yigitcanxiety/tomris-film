#!/usr/bin/env python3
"""MİLLİ end-card backdrop layout: endcard_b_ulusal_2.jpg (2752x1536, silhouette jammed right, kalpak top cropped
by the 16:9 push-in) -> a 1920x1080 still with the WHOLE profile (kalpak top to shoulders) inside the film's 2.39 band
(y 138-942) at the right third, the sky/sea extended top and left by blurred edge fill.

    python3 tomris-film/versions/endcard_layout.py [scale] [dx] [dy]
writes tomris-ai/stills/endcard_b_ulusal_2_layout.jpg (used by edit.json -> endcards.milli).
Defaults: scale 0.66 of the source, placed at (+180, +116) -> silhouette about x 1433-1860, y 180-845 in the frame.
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "tomris-ai/stills/endcard_b_ulusal_2.jpg")
OUT = os.path.join(ROOT, "tomris-ai/stills/endcard_b_ulusal_2_layout.jpg")
W, H = 1920, 1080
scale = float(sys.argv[1]) if len(sys.argv) > 1 else 0.66
dx = int(sys.argv[2]) if len(sys.argv) > 2 else 180
dy = int(sys.argv[3]) if len(sys.argv) > 3 else 116

im = Image.open(SRC).convert("RGB")
sw, sh = round(im.width * scale), round(im.height * scale)
sc = np.asarray(im.resize((sw, sh), Image.LANCZOS)).astype(np.float32)
# canvas: the scaled still with its edges smeared outwards (np.pad 'edge'), then blurred -> background fill
padl, padt = max(0, dx), max(0, dy)
padr, padb = max(0, W - (dx + sw)), max(0, H - (dy + sh))
big = np.pad(sc, ((padt, padb), (padl, padr), (0, 0)), mode="edge")
ox, oy = padl - dx, padt - dy                      # canvas origin inside `big`
fill = Image.fromarray(big.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(45))
fill = np.asarray(fill).astype(np.float32)
# feathered alpha: 1 inside the sharp still, ramps to 0 over 90 px towards the filled edges
a = np.zeros(big.shape[:2], np.float32)
a[padt:padt + sh, padl:padl + sw] = 1
F = 90
yy = np.arange(big.shape[0])[:, None]; xx = np.arange(big.shape[1])[None, :]
ramp = np.ones_like(a)
if padt: ramp = np.minimum(ramp, np.clip((yy - padt) / F, 0, 1))
if padl: ramp = np.minimum(ramp, np.clip((xx - padl) / F, 0, 1))
a = (a * ramp)[..., None]
sharp = big                                         # identical inside the still; outside it alpha is 0
comp = sharp * a + fill * (1 - a)
comp = comp[oy:oy + H, ox:ox + W]
Image.fromarray(comp.clip(0, 255).astype(np.uint8)).save(OUT, quality=95)
print(f"{os.path.relpath(OUT, ROOT)}: scale {scale}, offset ({dx},{dy}); silhouette ~ x {1898*scale+dx:.0f}-{2546*scale+dx:.0f}, "
      f"y {97*scale+dy:.0f}-{1104*scale+dy:.0f}")
