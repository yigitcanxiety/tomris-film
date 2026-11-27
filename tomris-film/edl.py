#!/usr/bin/env python3
"""The cut, straight from tomris-shots/shots.json (the single source of truth for timing).
usage: edl.py                 -> table: n start frames kind setup
       edl.py mids [N..]      -> comma list of mid-shot FRAMES of the 3D shots (all, or the given shot numbers)
       edl.py beats           -> the film's beats with frame ranges"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30

def doc():
    return json.load(open(os.path.join(ROOT, "tomris-shots/shots.json")))

def shots():
    return [dict(n=s["n"], f0=s["startFrame"], frames=s["frames"], kind=s["kind"], setup=s["setup"], vo=s["vo"], note=s["note"])
            for s in doc()["shots"]]

def overlay(n):
    s = next(x for x in shots() if x["n"] == n)
    return s["f0"], s["frames"]

OPENING, ENDCARD = overlay(1), overlay(59)

if __name__ == "__main__":
    S = shots()
    if len(sys.argv) > 1 and sys.argv[1] == "mids":
        want = set(map(int, sys.argv[2:]))
        print(",".join(str(s["f0"] + s["frames"] // 2) for s in S if s["kind"] == "3d" and (not want or s["n"] in want)))
    elif len(sys.argv) > 1 and sys.argv[1] == "beats":
        for b in doc().get("beats", []):
            print(f"{b['from']:5d}-{b['to']:5d}  {(b['to'] - b['from'] + 1) / FPS:5.2f} s  {b['name']}")
    else:
        for s in S: print(s["n"], s["f0"], s["frames"], s["kind"], s["setup"] or "-")
