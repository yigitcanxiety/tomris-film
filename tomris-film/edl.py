#!/usr/bin/env python3
"""Effective shot list of the cut (shots.json + the timing edits in tomris-three/assets/js/film.js EDIT).
usage: edl.py            -> table
       edl.py mids [N..] -> comma list of mid-shot times (s) for 3D shots (all, or the given shot numbers)"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# keep in sync with film.js EDIT (startFrame/frames) and build.sh (overlay placement)
TIMING = {2: (150, 75), 57: (1755, 75), 58: (1830, 60)}
OPENING, ENDCARD = (0, 150), (1890, 210)
REPLACED = {40: "masthead wake", 43: "200mm harbour compression", 51: "radar vs afterglow"}

def shots():
    d = json.load(open(os.path.join(ROOT, "tomris-shots/shots.json")))
    out = []
    for s in d["shots"]:
        f0, n = TIMING.get(s["n"], (s["startFrame"], s["frames"]))
        if s["kind"] == "overlay": continue
        out.append(dict(n=s["n"], f0=f0, frames=n, kind=s["kind"], setup="Ap" if s["n"] in REPLACED else s["setup"], vo=s["vo"]))
    return out

if __name__ == "__main__":
    S = shots()
    if len(sys.argv) > 1 and sys.argv[1] == "mids":
        want = set(map(int, sys.argv[2:]))
        print(",".join(f"{(s['f0'] + s['frames'] / 2) / 30:.3f}" for s in S if s["kind"] == "3d" and (not want or s["n"] in want)))
    else:
        for s in S: print(s["n"], s["f0"], s["frames"], s["kind"], s["setup"], REPLACED.get(s["n"], ""))
