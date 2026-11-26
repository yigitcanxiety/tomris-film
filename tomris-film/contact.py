#!/usr/bin/env python3
"""Contact sheet: the middle frame of every shot of the cut, numbered (shots.json numbers).
usage: contact.py <film.mp4> <out.jpg>      (this ffmpeg has no drawtext: numbers are a pixel-font PAM overlay)"""
import os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from edl import shots, OPENING, ENDCARD

COLS, TW, TH = 6, 480, 201                       # picture area 1920x804 scaled 1/4
FONT = {"0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001111001111", "4": "101101111001001",
        "5": "111100111001111", "6": "111100111101111", "7": "111001010010010", "8": "111101111101111", "9": "111101111001111"}

def items():
    S = [dict(n=1, f=OPENING[0] + OPENING[1] // 2)]
    S += [dict(n=s["n"], f=s["f0"] + s["frames"] // 2) for s in shots()]
    S += [dict(n=59, f=ENDCARD[0] + ENDCARD[1] * 2 // 3)]
    return S

def labels(S, W, H, path):
    px = bytearray(W * H * 4)
    def rect(x0, y0, w, h, rgba):
        for y in range(y0, min(H, y0 + h)):
            for x in range(x0, min(W, x0 + w)): px[(y * W + x) * 4:(y * W + x) * 4 + 4] = bytes(rgba)
    sc = 5
    for i, s in enumerate(S):
        x0, y0 = (i % COLS) * TW + 6, (i // COLS) * TH + 6
        txt = str(s["n"]); rect(x0, y0, len(txt) * 4 * sc + 2 * sc, 7 * sc, (0, 0, 0, 200))
        for k, ch in enumerate(txt):
            for b, bit in enumerate(FONT[ch]):
                if bit == "1": rect(x0 + sc + k * 4 * sc + (b % 3) * sc, y0 + sc + (b // 3) * sc, sc, sc, (255, 255, 255, 255))
    with open(path, "wb") as f:
        f.write(f"P7\nWIDTH {W}\nHEIGHT {H}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n".encode()); f.write(px)

if __name__ == "__main__":
    src, out = sys.argv[1], sys.argv[2]
    S = items(); rows = (len(S) + COLS - 1) // COLS
    with tempfile.TemporaryDirectory() as d:
        labels(S, COLS * TW, rows * TH, os.path.join(d, "l.pam"))
        sel = "+".join(f"eq(n\\,{s['f']})" for s in S)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-i", os.path.join(d, "l.pam"), "-filter_complex",
                        f"[0:v]select='{sel}',crop=1920:804:0:138,scale={TW}:{TH},tile={COLS}x{rows}[t];[t][1:v]overlay=0:0",
                        "-frames:v", "1", "-fps_mode", "passthrough", "-q:v", "3", out], check=True)
    print(out, len(S), "shots")
