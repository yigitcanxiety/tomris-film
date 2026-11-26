import json, sys, collections, os
d=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"shots.json")))
errs=[];pos=0
for s in d["shots"]:
    if s["startFrame"]!=pos: errs.append(f"#{s['n']}: gap/overlap start {s['startFrame']} != {pos}")
    pos=s["startFrame"]+s["frames"]
    if s["kind"]=="3d":
        if s["setup"] not in d["setups"]: errs.append(f"#{s['n']}: setup yok")
        if not 14<=s["lensMm"]<=200: errs.append(f"#{s['n']}: lens {s['lensMm']}")
        c=s["camera"];a,b=c["from"],c["to"]
        for i in range(21):
            t=i/20;p={k:a[k]+(b[k]-a[k])*t for k in "xyz"}
            if p["y"]<0.15: errs.append(f"#{s['n']}: y<0.15 t={t}")
            if abs(p["x"])<6.8 and 0<p["y"]<3.5 and abs(p["z"])<1.9: errs.append(f"#{s['n']}: gövde içinde t={t}")
    elif s["setup"] is not None: errs.append(f"#{s['n']}: overlay/black setup olmamalı")
if pos!=d["totalFrames"]!=2100 or pos!=2100: errs.append(f"toplam {pos}")
print("kind:",dict(collections.Counter(s["kind"] for s in d["shots"])))
print("setup:",dict(collections.Counter(s["setup"] for s in d["shots"] if s["kind"]=="3d")))
print("toplam kare:",pos,"çekim:",len(d["shots"]))
print("HATA:" if errs else "GEÇTİ",*errs,sep="\n")
sys.exit(1 if errs else 0)
