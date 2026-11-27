#!/usr/bin/env python3
"""TOMRİS · narration files for the three versions (ElevenLabs speech, driven from a Claude session).

The speech itself is generated with the ElevenLabs MCP tools (creative_generate_speech -> poll
creative_get_flow_run_status -> audio URL); this script is the bookkeeping around those calls:

  python3 tomris-film/versions/make_vo.py plan [version]        what to generate: line, file, text to send, characters
  python3 tomris-film/versions/make_vo.py fetch <version> <NN> <audio-url> [--flow FLOW_ID] [--chars N]
                                                               curl the result to tomris-audio/versions/<v>/vo_NN.mp3, log it
  python3 tomris-film/versions/make_vo.py md                    rewrite tomris-audio/versions/VO.md from the log

Rules (each generation is charged): one call per line, generations_count=1, never call again to "retry";
voice_id only from creative_list_voices. Voices and model are fixed below so a re-run keeps the same sound.
"""
import json, os, subprocess, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "tomris-audio", "versions")
LOG = os.path.join(OUT, "vo_log.json")
MODEL = "eleven_v4"
VOICES = {   # the voices the narration was actually generated with (commit aa65530); keep them for re-takes
    "aksiyon": dict(name="Alp", id="HV5rAif1q1ITHdvxqyMw", why="aksiyon spikeri"),
    "milli": dict(name="GİZEM", id="YHK57o4iMmVGSTo059Sj", why="kadın, sıcak (milli.md birinci tercih: kadın)"),
    "osmanli": dict(name="Seyfullah Kartal", id="mF7tIc9VLrznhGooGjaT", why="yaşlı (age=old), tok; ağır anlatıcı"),
}
# first pick in this session (not used for the delivered files): ATLAS jsAsQQM7mnaoyDprCcPp, Kadri 2ImXB5YHogCVayUIqok7
TAGS = {"aksiyon": "[serious]", "milli": "[warmly]", "osmanli": "[slowly]"}   # eleven_v3 delivery tags (not spoken)


def lines(vid):
    sys.path.insert(0, HERE)
    import build_versions as b
    V = b.load_versions() or {}
    return V.get(vid, {}).get("lines", [])


def plan(only=None):
    tot = 0
    for vid in ("aksiyon", "milli", "osmanli"):
        if only and vid != only: continue
        v = VOICES[vid]
        print(f"== {vid}: {v['name']} ({v['id']}), {MODEL}")
        for L in lines(vid):
            f = os.path.join(OUT, vid, f"vo_{L['n']:02d}.mp3")
            text = f"{TAGS[vid]} {L['text']}"
            tot += len(L["text"])
            print(f"  vo_{L['n']:02d}  frame {L['frame']:4d}  end<= {L.get('end_frame') or '-'}  {'HAVE' if os.path.exists(f) else 'todo'}  {len(L['text']):3d} ch  {text}")
    print(f"total characters: {tot}")


def log():
    return json.load(open(LOG)) if os.path.exists(LOG) else []


def fetch(vid, nn, url, flow=None, chars=None):
    os.makedirs(os.path.join(OUT, vid), exist_ok=True)
    f = os.path.join(OUT, vid, f"vo_{int(nn):02d}.mp3")
    subprocess.run(["curl", "-sSfL", "--retry", "3", "-o", f, url], check=True)
    d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f],
                             capture_output=True, text=True, check=True).stdout)
    L = next((x for x in lines(vid) if x["n"] == int(nn)), {})
    rec = dict(version=vid, n=int(nn), file=os.path.relpath(f, ROOT), text=L.get("text"), voice=VOICES[vid]["name"], voice_id=VOICES[vid]["id"],
               model=MODEL, chars=int(chars) if chars else len(L.get("text") or ""), flow=flow, duration_s=round(d, 2),
               at=datetime.datetime.now().isoformat(timespec="seconds"))
    R = [r for r in log() if not (r["version"] == vid and r["n"] == int(nn))] + [rec]
    json.dump(R, open(LOG, "w"), ensure_ascii=False, indent=1)
    print(f"{rec['file']}: {d:.2f} s"); md()


def md():
    R = log()
    os.makedirs(OUT, exist_ok=True)
    o = ["# TOMRİS · spiker kayıtları (ElevenLabs)", "",
         f"Model: `{MODEL}`. Kural: her satır bir kez üretilir (generations_count=1, tekrar yok). Araç: `tomris-film/versions/make_vo.py`. "
         f"Üretilmiş satır: {len(R)}.", "",
         "| Versiyon | Ses | voice_id |", "|---|---|---|"]
    for k, v in VOICES.items(): o.append(f"| {k} | {v['name'].replace('|', '/')} — {v['why']} | `{v['id']}` |")
    o += ["", "| Versiyon | Satır | Dosya | Süre | Karakter | Metin |", "|---|---|---|---|---|---|"]
    for r in sorted(R, key=lambda r: (r["version"], r["n"])):
        o.append(f"| {r['version']} | {r['n']:02d} | `{r['file']}` | {r['duration_s']} sn | {r['chars']} | {r['text']} |")
    o += ["", f"Toplam karakter: {sum(r['chars'] for r in R)}", ""]
    st = os.path.join(OUT, "STATUS.md")
    if os.path.exists(st): o += [open(st).read()]
    open(os.path.join(OUT, "VO.md"), "w").write("\n".join(o) + "\n")


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: raise SystemExit(__doc__)
    if a[0] == "plan": plan(a[1] if len(a) > 1 else None)
    elif a[0] == "fetch":
        kw = dict(zip(a[4::2], a[5::2]))
        fetch(a[1], a[2], a[3], kw.get("--flow"), kw.get("--chars"))
    elif a[0] == "md": md()
    elif a[0] == "register":     # log files that were generated elsewhere (already on disk): register <version>...
        sys.path.insert(0, HERE); import build_versions as bv
        R = log()
        for vid in a[1:]:
            for L in lines(vid):
                f = os.path.join(OUT, vid, L["file"]) if L.get("file") else os.path.join(OUT, vid, f"vo_{L['n']:02d}.mp3")
                if not os.path.exists(f): continue
                R = [r for r in R if not (r["version"] == vid and r["n"] == L["n"])] + [dict(
                    version=vid, n=L["n"], file=os.path.relpath(f, ROOT), text=L["text"], voice=VOICES[vid]["name"], voice_id=VOICES[vid]["id"],
                    model=MODEL, chars=len(L["text"]), flow=None, duration_s=round(bv.dur(f), 2), at=None)]
        json.dump(R, open(LOG, "w"), ensure_ascii=False, indent=1); md()
    else: raise SystemExit(__doc__)
