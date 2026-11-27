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
# director's rules: design showcase (no sensor beat, no HUD, launcher stowed at sea)
if "E" in d["setups"]: errs.append("kurulum E hâlâ var")
for s in d["shots"]:
    if "overlay" in s or (s.get("camera") or {}).get("digitalZoom"): errs.append(f"#{s['n']}: retikül/overlay/digitalZoom")
    if s["kind"]=="3d" and s["setup"] not in ("C","W"):
        for an in s["anim"]:
            if an["target"]=="launcher_el" and (an["fromDeg"] or an["toDeg"]): errs.append(f"#{s['n']}: lançer denizde kalkıyor")
# structure: opening 150 / endcard 210 / 3D between
st=d.get("structure",{}); sh={s["n"]:s for s in d["shots"]}
if (sh[1]["kind"],sh[1]["startFrame"],sh[1]["frames"])!=("overlay",0,150): errs.append("#1 açılış 0/150 değil")
if (sh[59]["kind"],sh[59]["startFrame"],sh[59]["frames"])!=("overlay",1890,210): errs.append("#59 son kart 1890/210 değil")
if st.get("opening",{}).get("frames")!=150 or st.get("endcard",{}).get("start")!=1890: errs.append("structure alanı tutarsız")
if [s["n"] for s in d["shots"] if s["kind"]=="overlay"]!=[1,59]: errs.append("overlay yalnız #1 ve #59 olmalı")
# audio cues inside the film, VO in frame order
vo=d.get("audio",{}).get("vo",[])
fr=[c["frame"] for c in vo]
if fr!=sorted(fr) or any(not 0<=f<2100 for f in fr): errs.append("VO kareleri sıralı/aralıkta değil")
print("kind:",dict(collections.Counter(s["kind"] for s in d["shots"])))
print("setup:",dict(collections.Counter(s["setup"] for s in d["shots"] if s["kind"]=="3d")))
print("toplam kare:",pos,"çekim:",len(d["shots"]))
print("HATA:" if errs else "GEÇTİ",*errs,sep="\n")
sys.exit(1 if errs else 0)
