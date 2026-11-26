#!/usr/bin/env python3
"""Audio cue list from tomris-shots/shots.json ("audio": vo + beds) for mix.sh.
usage: cues.py slots      -> one line per cue: bus|file|frame|gain_dB|in_s|out_s|length_s|note  (missing files included)
       cues.py check      -> VO timing table; exit 1 if a VO cue overruns the next VO cue (speech end measured on the file)"""
import json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "tomris-audio"); FPS = 30
D = json.load(open(os.path.join(ROOT, "tomris-shots/shots.json")))

def dur(f):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f],
                                capture_output=True, text=True, check=True).stdout)

def speech_end(f, i, o):
    """last non-silent moment (s, clip time) inside [i, o)"""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-ss", str(i), "-t", str(o - i), "-i", f, "-af", "silencedetect=n=-40dB:d=0.08", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r)]; en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r)]
    if st and len(st) > len(en): return i + st[-1]        # trailing silence
    return o

def vo():
    out = []
    for c in D["audio"]["vo"]:
        f = os.path.join(A, c["clip"]); ok = os.path.exists(f)
        i = c["in"] or 0; o = c["out"] if c["out"] is not None else (dur(f) if ok else 0)
        out.append(dict(c, path=f, ok=ok, i=i, o=o, end=c["frame"] + ((speech_end(f, i, o) - i) * FPS if ok else 0)))
    return out

if __name__ == "__main__":
    if sys.argv[1] == "slots":
        for c in vo():
            print(f"vo|{c['clip']}|{c['frame']}|0|{c['i']}|{c['o'] if c['ok'] else 0}|0|#{c['shot']}")
        for b in D["audio"]["beds"]:
            print(f"{b['bus']}|{b['clip']}|{b['frame']}|{b['gainDb']}|0|0|{b['lengthS']}|{b['note']}")
    elif sys.argv[1] == "check":
        V = sorted(vo(), key=lambda c: c["frame"]); bad = 0
        print(f"{'clip':24s} {'shot':>4s} {'start':>5s} {'speech end':>10s} {'next':>5s}  gap")
        for k, c in enumerate(V):
            nxt = V[k + 1]["frame"] if k + 1 < len(V) else D["totalFrames"]
            gap = nxt - c["end"]; flag = "" if gap >= 0 else "  OVERRUN"
            if gap < 0: bad = 1
            print(f"{c['clip'] + ('' if c['ok'] else ' (missing)'):24s} {c['shot']:4d} {c['frame']:5d} {c['end']:10.1f} {nxt:5d} {gap:5.1f}f{flag}")
        sys.exit(bad)
