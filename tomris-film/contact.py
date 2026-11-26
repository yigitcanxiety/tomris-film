#!/usr/bin/env python3
"""Numbered contact sheet, one frame per shot (shots.json numbers; black flashes are skipped).
usage: contact.py <film.mp4> <out.jpg>                 middle frame of every shot, picture area of the delivered film
       contact.py --dir <preview_dir> <out.jpg>         preview stills f<frame>.jpg from tomris-three/tools/shot.js
                                                         (3D shots at their middle frame; missing stills stay grey)
Labels: shot number, start frame, setup."""
import os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from edl import shots

COLS, TW, TH = 6, 480, 201                       # picture area 1920x804 scaled 1/4

def items(only3d=False):
    S = []
    for s in shots():
        if s["kind"] == "black" or (only3d and s["kind"] != "3d"): continue
        f = s["f0"] + (s["frames"] * 2 // 3 if s["kind"] == "overlay" else s["frames"] // 2)
        S.append(dict(n=s["n"], f=f, f0=s["f0"], setup=s["setup"] or s["kind"]))
    return S

def font(sz):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"):
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

def sheet(S, tiles, out):
    rows = (len(S) + COLS - 1) // COLS
    img = Image.new("RGB", (COLS * TW, rows * TH), (24, 24, 24)); d = ImageDraw.Draw(img); F, f2 = font(30), font(16)
    for i, (s, t) in enumerate(zip(S, tiles)):
        x, y = (i % COLS) * TW, (i // COLS) * TH
        if t is not None: img.paste(t.resize((TW, TH)), (x, y))
        d.rectangle([x, y, x + TW - 1, y + TH - 1], outline=(0, 0, 0), width=2)
        d.rectangle([x + 4, y + 4, x + 70, y + 40], fill=(0, 0, 0)); d.text((x + 10, y + 6), str(s["n"]), font=F, fill=(255, 255, 255))
        d.text((x + 76, y + 6), f"{s['f0']} {s['setup']}", font=f2, fill=(255, 230, 120))
    img.save(out, quality=88); print(out, len(S), "tiles")

if __name__ == "__main__":
    if sys.argv[1] == "--dir":
        src, out = sys.argv[2], sys.argv[3]; S = items(only3d=True)
        tiles = []
        for s in S:
            p = os.path.join(src, f"f{s['f']:04d}.jpg")
            tiles.append(Image.open(p).convert("RGB") if os.path.exists(p) else None)
        sheet(S, tiles, out)
    else:
        src, out = sys.argv[1], sys.argv[2]; S = items()
        with tempfile.TemporaryDirectory() as d:
            sel = "+".join(f"eq(n\\,{s['f']})" for s in S)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", f"select='{sel}',crop=1920:804:0:138,scale={TW}:{TH}",
                            "-fps_mode", "passthrough", os.path.join(d, "t%03d.png")], check=True)
            tiles = [Image.open(os.path.join(d, f"t{i + 1:03d}.png")).convert("RGB") for i in range(len(S))]
            sheet(S, tiles, out)
