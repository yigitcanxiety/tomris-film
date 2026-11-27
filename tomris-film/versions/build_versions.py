#!/usr/bin/env python3
"""TOMRİS · three finished versions from ONE picture.

    bash tomris-film/versions/build_versions.sh <picture.mp4> [aksiyon milli osmanli]

Per version: narration lines placed on their start frames, music bed with volume-automation ducking under the
narration, a low layer of tomris-audio/sfx_waves.mp3, music fade-out with the end card, -14 LUFS / <= -1 dBTP.
Video: the picture is stream-copied; only the GOPs that change are re-encoded (end card 1890-2099 when the version
has its own backdrop still, plus any "inserts" listed in edit.json). Outputs tomris-film/tomris_<version>.mp4.

Inputs (read, never written):
  versions/versions.json             scripts: per version narration lines (text + start frame), music file, ducking.
                                      Read tolerantly (see load_versions); if it does not exist yet, DEFAULTS is used.
  tomris-audio/versions/<v>/vo_NN.mp3 narration line NN (1-based, in script order), written by make_vo.py.
  versions/edit.json                 our own knobs: end-card stills and the insert hook (see README.md).
env: ONLY_AUDIO=1 (no video), KEEP=1 (keep temp dir), FULL=1 (re-encode the whole picture instead of stream copy)
"""
import glob, json, math, os, re, shutil, subprocess, sys, tempfile, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
AUD = os.path.join(ROOT, "tomris-audio")
FPS, NF, DUR = 30, 2100, 70.0
EC0 = 1890                                    # end card first frame
NICE = ["nice", "-n", "10"]
X264 = ["-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "18", "-maxrate", "9M", "-bufsize", "18M",
        "-pix_fmt", "yuv420p", "-r", "30", "-g", "60",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]          # identical to build.sh, so SPS/PPS match for stream concat


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode:
        sys.stderr.write(" ".join(cmd)[:2000] + "\n" + r.stderr[-3000:] + "\n"); raise SystemExit(f"command failed: {cmd[0:4]}")
    return r


def ff(*a): return run(NICE + ["ffmpeg", "-nostdin", "-hide_banner", "-v", "error", "-y", *a])


def probe(f, *a): return run(["ffprobe", "-v", "error", *a, f]).stdout.strip()


def dur(f): return float(probe(f, "-show_entries", "format=duration", "-of", "csv=p=0"))


def slug(s):
    s = unicodedata.normalize("NFKD", str(s).replace("ı", "i").replace("İ", "I")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


# ---------------------------------------------------------------- flashes (no narration over them)
def flashes():
    try:
        d = json.load(open(os.path.join(ROOT, "tomris-shots/shots.json")))
        L = [(s["startFrame"], s["startFrame"] + s["frames"] - 1) for s in d["shots"] if s["kind"] == "black"]
        if L: return L
    except Exception: pass
    return [(1444, 1447), (1715, 1720), (1751, 1754)]


# ---------------------------------------------------------------- versions.json, read tolerantly
def pick(d, *keys, default=None):
    if not isinstance(d, dict): return default
    for k in keys:
        if k in d and d[k] not in (None, ""): return d[k]
    lk = {slug(k): v for k, v in d.items()}
    for k in keys:
        if slug(k) in lk and lk[slug(k)] not in (None, ""): return lk[slug(k)]
    return default


def num(x, default=None):
    if x is None: return default
    if isinstance(x, (int, float)): return float(x)
    m = re.search(r"-?\d+(\.\d+)?", str(x)); return float(m.group()) if m else default


def norm_line(L, i):
    if isinstance(L, str): return dict(n=i + 1, text=L, frame=None)
    fr = pick(L, "start_frame", "startFrame", "frame", "start", "in_frame", "at_frame")
    if fr is None and pick(L, "start_s", "start_sec", "time", "t") is not None:
        fr = num(pick(L, "start_s", "start_sec", "time", "t")) * FPS
    return dict(n=int(num(pick(L, "n", "index", "id", "no"), i + 1)) if str(pick(L, "n", "index", "id", "no", default="")).strip().isdigit() else i + 1,
                text=str(pick(L, "text", "line", "tr", "say", "vo", default="")).strip(),
                frame=int(round(num(fr))) if fr is not None else None,
                gain=num(pick(L, "gain_db", "gainDb", "gain"), 0.0),
                file=pick(L, "file", "vo_file", "audio", "clip"),
                end_frame=num(pick(L, "must_end_by_frame", "end_frame", "endFrame", "max_end_frame", "until_frame")),
                fallback_text=pick(L, "fallback_text"))


def norm_version(vid, V):
    lines = pick(V, "narration", "lines", "vo", "voiceover", "script", default=[])
    if isinstance(lines, dict): lines = pick(lines, "lines", "items", default=list(lines.values()))
    lines = [norm_line(L, i) for i, L in enumerate(lines)]
    lines = [L for L in lines if L["text"] and L["frame"] is not None]
    mus = pick(V, "music", "music_file", "bed", "score")
    mg = None; mdict = {}; mtarget = None
    if isinstance(mus, dict):
        mdict = mus
        mg = num(pick(mus, "gain_db", "gainDb", "gain", "level_db")); mus = pick(mus, "file", "path", "name", "src")
        lu = num(pick(mdict, "loudness_lufs", "lufs"))
        if lu is not None: mtarget = lu + (mg or 0); mg = 0.0          # music target loudness = its stated LUFS + gain
    duck = pick(V, "ducking", "duck", "music_ducking", default=None)
    if duck is None: duck = {"depth_db": pick(mdict, "duck_db", "ducking_db", "duck")} if pick(mdict, "duck_db", "ducking_db", "duck") is not None else {}
    if isinstance(duck, (int, float, str)) and not isinstance(duck, dict): duck = {"depth_db": num(duck)}
    return dict(id=vid, title=pick(V, "title", "name", "label", default=vid),
                lines=lines, music=mus, music_target=mtarget, music_offset=num(pick(mdict, "file_offset_s", "offset_s"), 0.0),
                music_gain=mg if mg is not None else num(pick(V, "music_gain_db", "music_gain")),
                duck_db=abs(num(pick(duck, "depth_db", "duck_db", "amount_db", "db", "depth", "reduction_db", "amount"), 9.0)),
                duck_attack=num(pick(duck, "attack_s", "attack"), 0.25), duck_release=num(pick(duck, "release_s", "release"), 0.5),
                music_fade=num(pick(V, "music_fade_out_s", "fade_out_s", "music_fade"), None),
                raw=V)


def load_versions():
    f = os.path.join(HERE, "versions.json")
    if not os.path.exists(f): return None
    D = json.load(open(f))
    items = []
    if isinstance(D, dict) and "versions" in D: D = D["versions"]
    if isinstance(D, dict):
        items = [(k, v) for k, v in D.items() if isinstance(v, dict)]
    elif isinstance(D, list):
        items = [(pick(v, "id", "key", "slug", "name", "version"), v) for v in D]
    out = {}
    for k, v in items:
        vid = slug(k)
        for canon in ("aksiyon", "milli", "osmanli"):
            if canon in vid: vid = canon
        out[vid] = norm_version(vid, v)
    return out


# Fallback when versions.json is not there yet: the action version on the existing narration (vo_2..vo_7) cues.
def defaults():
    V = {}
    try:
        d = json.load(open(os.path.join(ROOT, "tomris-shots/shots.json")))
        L = [dict(n=i + 1, text=re.sub(r"\s*\(.*\)$", "", c["text"]), frame=c["frame"], gain=0.0,
                  file=os.path.join("..", c["clip"]), clip_in=c["in"] or 0, clip_out=c["out"], end_frame=None)
             for i, c in enumerate(c for c in d["audio"]["vo"] if os.path.exists(os.path.join(AUD, c["clip"])))]
    except Exception: L = []
    V["aksiyon"] = dict(id="aksiyon", title="AKSİYON (yedek: mevcut vo_2…vo_7)", lines=L, music="music_aksiyon.mp3",
                        music_gain=None, duck_db=9.0, duck_attack=0.25, duck_release=0.5, music_fade=None, raw={})
    V["milli"] = dict(V["aksiyon"], id="milli", title="MİLLİ", lines=[], music="music_izmir.mp3")
    V["osmanli"] = dict(V["aksiyon"], id="osmanli", title="OSMANLI", lines=[], music="music_mehter.mp3")
    return V


DEFAULT_MUSIC = {"aksiyon": "music_aksiyon.mp3", "milli": "music_izmir.mp3", "osmanli": "music_mehter.mp3"}


def edit_cfg():
    f = os.path.join(HERE, "edit.json")
    return json.load(open(f)) if os.path.exists(f) else {}


# ---------------------------------------------------------------- audio
def ebur(f, extra_af=""):
    af = (extra_af + "," if extra_af else "") + "ebur128=peak=true"
    r = subprocess.run(NICE + ["ffmpeg", "-nostdin", "-hide_banner", "-nostats", "-i", f, "-af", af, "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    s = r[r.rfind("Summary:"):]
    g = lambda pat: (float(re.search(pat, s).group(1)) if re.search(pat, s) else float("nan"))
    return dict(I=g(r"I:\s+(-?[\d.]+|-inf) LUFS"), LRA=g(r"LRA:\s+(-?[\d.]+) LU"), TP=g(r"Peak:\s+(-?[\d.]+|-inf) dBFS"))


def speech_span(f, i=0.0, o=None):
    """(lead, end) of speech inside [i, o) of file f, seconds relative to i"""
    o = dur(f) if o is None else o
    r = subprocess.run(["ffmpeg", "-hide_banner", "-ss", str(i), "-t", str(o - i), "-i", f, "-af", "silencedetect=n=-45dB:d=0.06",
                        "-f", "null", "-"], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", r)]; en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r)]
    lead = en[0] if st and st[0] <= 0.02 and en else 0.0
    end = st[-1] if st and len(st) > len(en) else (o - i)
    return max(0.0, lead), max(lead + 0.05, end)


def vo_lines(v):
    """resolve files, measure speech, return list with abs start/end seconds"""
    out = []
    for L in v["lines"]:
        f = L.get("file")
        if f and not os.path.isabs(f):
            f = os.path.normpath(os.path.join(AUD, "versions", v["id"], f)) if not f.startswith("..") else os.path.normpath(os.path.join(AUD, "versions", f))
        if not f or not os.path.exists(f):
            f = os.path.join(AUD, "versions", v["id"], f"vo_{L['n']:02d}.mp3")
        if not os.path.exists(f):
            print(f"    line {L['n']:02d} @ {L['frame']}: MISSING {os.path.relpath(f, ROOT)}  \"{L['text'][:50]}\""); continue
        ci, co = L.get("clip_in", 0) or 0, L.get("clip_out")
        lead, end = speech_span(f, ci, co)
        t0 = L["frame"] / FPS
        out.append(dict(L, path=f, cin=ci + lead, cout=ci + end + 0.12, t0=t0, t1=t0 + (end - lead)))
    return out


def check_timing(v, lines):
    bad = []
    FL = flashes()
    for k, L in enumerate(sorted(lines, key=lambda x: x["t0"])):
        f0, f1 = L["t0"] * FPS, L["t1"] * FPS
        for a, b in FL:
            if f0 <= b and f1 >= a: bad.append(f"line {L['n']:02d} frames {f0:.0f}-{f1:.0f} overlaps black flash {a}-{b}")
        nxt = sorted(lines, key=lambda x: x["t0"])[k + 1]["t0"] * FPS if k + 1 < len(lines) else NF
        if f1 > nxt: bad.append(f"line {L['n']:02d} ends at frame {f1:.0f}, after the next line starts ({nxt:.0f})")
        if L.get("end_frame") and f1 > L["end_frame"]: bad.append(f"line {L['n']:02d} ends at {f1:.0f} > its end_frame {L['end_frame']:.0f}")
        print(f"    line {L['n']:02d}  frames {f0:5.0f}-{f1:5.0f}  ({L['t1'] - L['t0']:.2f} s)  {os.path.relpath(L['path'], ROOT)}  \"{L['text'][:60]}\"")
    return bad


def duck_expr(lines, depth, att, rel):
    """volume expression (dB->gain) that dips the music by `depth` dB around every narration line"""
    if not lines: return "1"
    terms = []
    for L in lines:
        a, b = L["t0"] - 0.08, L["t1"] + 0.15        # fully ducked over [a,b], ramps att before / rel after
        terms.append(f"clip(min((t-{a - att:.3f})/{att:.3f}\\,({b + rel:.3f}-t)/{rel:.3f})\\,0\\,1)")
    m = terms[0]
    for t in terms[1:]: m = f"max({m}\\,{t})"
    return f"pow(10\\,-{depth:.2f}*{m}/20)"


def build_audio(v, tmp, picture):
    print(f"  audio · {v['id']}")
    lines = vo_lines(v)
    bad = check_timing(v, lines)
    for b in bad: print("    WARNING:", b)
    if bad and os.environ.get("STRICT") == "1": raise SystemExit("timing errors (STRICT=1)")
    # music
    mus = v.get("music") or DEFAULT_MUSIC.get(v["id"])
    mpath = None
    if mus:
        for c in (mus, os.path.join(AUD, mus), os.path.join(AUD, os.path.basename(mus)), os.path.join(ROOT, mus)):
            if os.path.isfile(c) and os.path.getsize(c) > 50000: mpath = c; break
    print(f"    music: {os.path.relpath(mpath, ROOT) if mpath else 'NONE (' + str(mus) + ' missing)'}")
    VO_T, MUS_T, WAV_T = -16.0, -19.0, -34.0                  # pre-mix loudness targets (LUFS) before the final -14 gain
    args, fc, n = [], [], 0
    vo_lab = []
    for L in lines:
        g = VO_T - ebur(L["path"], f"atrim={L['cin']:.3f}:{L['cout']:.3f}")["I"] + (L.get("gain") or 0)
        if not math.isfinite(g): g = 0
        ms = int(round(L["t0"] * 1000))
        args += ["-i", L["path"]]
        fc.append(f"[{n}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim={L['cin']:.3f}:{L['cout']:.3f},asetpts=PTS-STARTPTS,"
                  f"afade=t=in:d=0.015,afade=t=out:st={L['cout'] - L['cin'] - 0.06:.3f}:d=0.06,volume={g:.2f}dB,adelay={ms}|{ms}[l{n}]")
        vo_lab.append(f"[l{n}]"); n += 1
    args += ["-f", "lavfi", "-t", str(DUR), "-i", "anullsrc=r=48000:cl=stereo"]; z = n; n += 1
    fc.append(f"[{z}:a]anull[z0]")
    fc.append("".join(vo_lab) + f"[z0]amix=inputs={len(vo_lab) + 1}:normalize=0:duration=longest,atrim=0:{DUR}[vo]")
    fade = v.get("music_fade") or 4.0
    if mpath:
        mi = ebur(mpath, f"atrim=0:{DUR}")["I"]
        mt = v.get("music_target") if v.get("music_target") is not None else MUS_T
        mg = (v["music_gain"] if v.get("music_gain") is not None else 0.0) + (mt - mi if math.isfinite(mi) else 0)
        args += ["-ss", f"{v.get('music_offset') or 0:.3f}", "-i", mpath]
        fc.append(f"[{n}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:{DUR},asetpts=PTS-STARTPTS,volume={mg:.2f}dB,"
                  f"afade=t=out:st={DUR - fade:.2f}:d={fade - 0.15:.2f},apad,atrim=0:{DUR},asplit=2[mraw][mpre]")
        fc.append(f"[mpre]volume='{duck_expr(lines, v['duck_db'], v['duck_attack'], v['duck_release'])}':eval=frame[mus]"); n += 1
    else:
        fc.append("anullsrc=r=48000:cl=stereo,atrim=0:70[mus]"); fc.append("anullsrc=r=48000:cl=stereo,atrim=0:70[mraw]")
    w = os.path.join(AUD, "sfx_waves.mp3")
    if os.path.exists(w):
        wi = ebur(w)["I"]; wg = WAV_T - wi if math.isfinite(wi) else -20
        args += ["-stream_loop", "-1", "-i", w]
        # low bed from the harbour (frame 150) to the end card, out under the end-card fade
        fc.append(f"[{n}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:{EC0 / FPS - 150 / FPS + 2:.3f},asetpts=PTS-STARTPTS,"
                  f"afade=t=in:d=1.5,afade=t=out:st={EC0 / FPS - 150 / FPS - 1:.3f}:d=3,volume={wg:.2f}dB,adelay=5000|5000[wav]"); n += 1
    else:
        fc.append("anullsrc=r=48000:cl=stereo,atrim=0:70[wav]")
    fc.append(f"[vo]asplit=2[vo1][vo2]")
    fc.append(f"[mus]asplit=2[mus1][mus2]")
    fc.append(f"[vo1][mus1][wav]amix=inputs=3:normalize=0:duration=longest,atrim=0:{DUR},asetpts=N/SR/TB[mix]")
    raw, stv, stm, stu = (os.path.join(tmp, f"{v['id']}_{k}.wav") for k in ("raw", "vo", "mus", "musraw"))
    fc = [x for x in fc if x]
    run(NICE + ["ffmpeg", "-nostdin", "-v", "error", "-y", *args, "-filter_complex", ";".join(fc),
                "-map", "[mix]", "-c:a", "pcm_s24le", raw, "-map", "[vo2]", "-c:a", "pcm_s24le", stv,
                "-map", "[mus2]", "-c:a", "pcm_s24le", stm, "-map", "[mraw]", "-c:a", "pcm_s24le", stu])
    # loudness: static gain + 4x oversampled limiter, measured and corrected once (as mix.sh)
    I0 = ebur(raw)["I"]
    def lim(g, out, ceil=0.75):
        ff("-i", raw, "-af", f"volume={g:.2f}dB,aresample=192000,alimiter=limit={ceil}:attack=1:release=60:level=disabled,"
           f"aresample=48000,apad,atrim=0:{DUR}", "-ar", "48000", "-c:a", "pcm_s24le", out)
    G1 = -14 - I0; l1 = os.path.join(tmp, f"{v['id']}_l1.wav"); lim(G1, l1)
    I1 = ebur(l1)["I"]; G2 = G1 + (-14 - I1); final = os.path.join(tmp, f"{v['id']}_mix.wav"); lim(G2, final)
    M = ebur(final)
    print(f"    mix: raw {I0:.1f} LUFS, gain {G2:+.2f} dB -> I {M['I']:.1f} LUFS, TP {M['TP']:.1f} dBFS, LRA {M['LRA']:.1f} LU")
    # narration vs music per line (same final gain applied to the stems)
    rep = []
    for L in lines:
        a, b = L["t0"], L["t1"]
        af = f"atrim={a:.3f}:{b:.3f},volume={G2:.2f}dB"
        lv, lm, lu = ebur(stv, af)["I"], ebur(stm, af)["I"], ebur(stu, af)["I"]
        rep.append(dict(n=L["n"], t0=a, t1=b, vo=lv, mus=lm, mus_undiucked=lu))
    for r in rep:
        print(f"    line {r['n']:02d} {r['t0']:5.1f}-{r['t1']:5.1f}s  VO {r['vo']:6.1f}  music ducked {r['mus']:6.1f}  "
              f"(undducked {r['mus_undiucked']:6.1f})  VO-music {r['vo'] - r['mus']:+5.1f} LU")
    return final, dict(I=M["I"], TP=M["TP"], LRA=M["LRA"], lines=rep, music=mpath, warnings=bad,
                       vo=[(L["n"], os.path.relpath(L["path"], ROOT), L["frame"]) for L in lines])


# ---------------------------------------------------------------- video
def sync_frames(pic):
    out = probe(pic, "-select_streams", "v", "-show_entries", "packet=pts_time,flags", "-of", "csv=p=0")
    return sorted({int(round(float(t) * FPS)) for t, fl in (l.split(",")[:2] for l in out.splitlines()) if "K" in fl})


def find_still(vid, cfg):
    s = (cfg.get("endcards") or {}).get(vid)
    if isinstance(s, dict): s = s.get("still")
    if s:
        p = s if os.path.isabs(s) else os.path.join(ROOT, s)
        if os.path.exists(p): return p
        print(f"    end-card still {s} not found")
    kw = {"aksiyon": ["aksiyon", "action", "storm", "firtina", "sea"], "milli": ["milli", "ulusal", "national", "ataturk", "sunset"],
          "osmanli": ["osmanli", "ottoman", "ornament", "bordo", "burgundy"]}[vid] if vid in ("aksiyon", "milli", "osmanli") else [vid]
    C = [f for f in sorted(glob.glob(os.path.join(ROOT, "tomris-ai/stills/*"))) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
    for k in kw:
        for f in C:
            b = slug(os.path.basename(f))
            if k in b and ("end" in b or "kart" in b or "card" in b or "son" in b): return f
    for k in kw[:2]:
        for f in C:
            if k in slug(os.path.basename(f)): return f
    return None


def endcard_comp(vid, still, ec, out, look):
    """210-frame end card: darkened still with a slow push-in, the end-card overlay screened on top"""
    dim, band, zoom = look.get("dim", 0.42), look.get("band", 0.55), look.get("zoom", 0.06)
    # soft horizontal band behind the boat/title/names (y 0.2-0.8), darker in the middle
    mask = f"geq=r='255*(1-{band}*exp(-pow((Y/H-0.52)/0.2\\,2)))':g='255*(1-{band}*exp(-pow((Y/H-0.52)/0.2\\,2)))':b='255*(1-{band}*exp(-pow((Y/H-0.52)/0.2\\,2)))'"
    fc = (f"[0:v]scale=3840:2160:force_original_aspect_ratio=increase:flags=lanczos,crop=3840:2160,setsar=1,"
          f"zoompan=z='1+{zoom}*on/209':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=210:s=1920x1080:fps=30,"
          f"format=yuv420p,vignette=PI/4.5,fade=t=in:st=0.45:d=1.1,fade=t=out:st=6.25:d=0.7,format=gbrp,"   # vignette/fade must run on yuv: on gbrp they tint
          f"colorchannelmixer=rr={dim}:gg={dim}:bb={dim}[bg0];"
          f"color=white:s=1920x1080:r=30:d=0.034,format=gbrp,{mask},loop=loop=-1:size=1:start=0,trim=end_frame=210[m];"
          f"[bg0][m]blend=all_mode=multiply:shortest=1[bg];"   # (fade lives in yuv above: fade on planar RGB tints green here)
          f"[1:v]trim=end_frame=210,setpts=PTS-STARTPTS,fps=30,format=gbrp[card];"
          f"[bg][card]blend=all_mode=screen,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,"
          f"setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709[v]")   # else tagged GBR -> magenta
    ff("-loop", "1", "-framerate", "30", "-i", still, "-i", ec, "-filter_complex", fc, "-map", "[v]", "-frames:v", "210",
       "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p", *X264[-8:], out)


def build_video(v, picture, tmp, cfg):
    """returns path of a video-only mp4 of exactly 2100 frames + a note on what was re-encoded"""
    vid = v["id"]
    still = find_still(vid, cfg)
    inserts = [i for i in (cfg.get("inserts", {}).get(vid, []) + cfg.get("inserts", {}).get("all", [])) if i.get("enabled", True)]
    if not still and not inserts and os.environ.get("FULL") != "1":
        out = os.path.join(tmp, f"{vid}_video.mp4"); ff("-i", picture, "-map", "0:v:0", "-c", "copy", out)
        return out, "picture stream-copied (no backdrop still, no inserts): end card as in the picture"
    ec = os.path.join(ROOT, cfg.get("endcard_overlay", "tomris-overlays/renders/endcard.mp4"))
    look = dict((cfg.get("endcard_look") or {}).get("default", {}), **(cfg.get("endcard_look") or {}).get(vid, {}))
    comp = None
    if still:
        comp = os.path.join(tmp, f"{vid}_endcard.mp4"); endcard_comp(vid, still, ec, comp, look)
    # dirty ranges -> GOP-aligned pieces
    K = sync_frames(picture)
    dirty = ([(EC0, NF)] if still else []) + [(int(i["from"]), int(i["to"]) + 1) for i in inserts]
    dirty.sort(); merged = []
    for a, b in dirty:
        a = max(k for k in K if k <= a); bb = [k for k in K if k >= b]; b = bb[0] if bb else NF
        if merged and a <= merged[-1][1]: merged[-1] = (merged[-1][0], max(merged[-1][1], b))
        else: merged.append((a, b))
    if os.environ.get("FULL") == "1": merged = [(0, NF)]
    pieces, cur = [], 0
    for a, b in merged:
        if a > cur: pieces.append(("copy", cur, a))
        pieces.append(("enc", a, b)); cur = b
    if cur < NF: pieces.append(("copy", cur, NF))
    files = []
    for j, (kind, a, b) in enumerate(pieces):
        p = os.path.join(tmp, f"{vid}_p{j}.mp4")
        if kind == "copy":
            ff(*(["-ss", f"{a / FPS:.6f}"] if a else []), "-i", picture, "-map", "0:v:0", "-frames:v", str(b - a), "-c", "copy", "-avoid_negative_ts", "make_zero", p)
        else:
            ins = ["-ss", f"{a / FPS:.6f}", "-i", picture] if a else ["-i", picture]
            fc = [f"[0:v]trim=end_frame={b - a},setpts=PTS-STARTPTS,format=yuv420p[b0]"]; last = "b0"; k = 1
            for i, I in enumerate(inserts):           # hook: replace frames from..to with clip (offset s, crop w:h:x:y, box x:y:w:h)
                fa, fb = int(I["from"]), int(I["to"])
                if fb < a or fa >= b: continue
                bx = [int(x) for x in str(I.get("box", "0:138:1920:804")).split(":")]
                ins += ["-ss", str(I.get("offset", 0)), "-i", os.path.join(ROOT, I["clip"])]
                crop = f"crop={I['crop']}," if I.get("crop") else f"crop=1920:804:0:{I.get('y', 138)},"   # 2.39 band of a 16:9 clip
                speed = float(I.get("speed", 0.8))            # 0.8 = 24 fps source frames played at 30 fps (no duplicates)
                grade = I.get("grade", "eq=contrast=0.94:saturation=0.92")
                fc.append(f"[{k}:v]setpts=(PTS-STARTPTS)*{speed},fps=30,trim=end_frame={fb - fa + 1},{crop}"
                          f"scale={bx[2]}:{bx[3]}:force_original_aspect_ratio=increase:flags=lanczos,crop={bx[2]}:{bx[3]},setsar=1,"
                          f"{grade + ',' if grade else ''}format=yuv420p,setpts=PTS-STARTPTS+{(fa - a) / FPS:.6f}/TB[i{k}]")
                fc.append(f"[{last}][i{k}]overlay={bx[0]}:{bx[1]}:eof_action=pass:enable='between(n,{fa - a},{fb - a})'[o{k}]"); last = f"o{k}"; k += 1
            if comp and a <= EC0 < b + 1 and b == NF:
                ins += ["-i", comp]
                fc.append(f"[{last}]trim=end_frame={EC0 - a},setpts=PTS-STARTPTS[h]")
                fc.append(f"[{k}:v]setpts=PTS-STARTPTS,format=yuv420p[ecv]")
                fc.append(f"[h][ecv]concat=n=2:v=1:a=0[out]"); last = "out"
            ff(*ins, "-filter_complex", ";".join(fc), "-map", f"[{last}]", "-frames:v", str(b - a), *X264, "-an", p)
        got = int(probe(p, "-count_packets", "-select_streams", "v", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0"))
        if got != b - a: raise SystemExit(f"piece {j} {kind} {a}-{b}: {got} frames, expected {b - a}")
        files.append(p)
    hashes = {probe(p, "-select_streams", "v", "-show_entries", "stream=extradata_hash", "-show_data_hash", "md5", "-of", "csv=p=0") for p in files}
    if len(hashes) > 1 and len(files) > 1:
        print("    SPS/PPS differ between copied and re-encoded pieces -> re-encoding the whole picture (FULL)")
        os.environ["FULL"] = "1"; r = build_video(v, picture, tmp, cfg); os.environ.pop("FULL"); return r
    lst = os.path.join(tmp, f"{vid}_list.txt")
    open(lst, "w").write("".join(f"file '{p}'\n" for p in files))
    out = os.path.join(tmp, f"{vid}_video.mp4")
    ff("-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", out)
    note = ", ".join(f"{k} {a}-{b - 1}" for k, a, b in pieces)
    return out, f"pieces: {note}; end-card backdrop: {os.path.relpath(still, ROOT) if still else 'none (as in picture)'}; inserts: {len(inserts)}"


# ---------------------------------------------------------------- main
def main():
    a = [x for x in sys.argv[1:]]
    if not a: raise SystemExit(__doc__)
    picture = os.path.abspath(a[0]); want = a[1:]
    nf = int(probe(picture, "-count_packets", "-select_streams", "v", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0"))
    if nf != NF: raise SystemExit(f"{picture}: {nf} frames, expected {NF}")
    V = load_versions()
    src = "versions.json"
    if not V: V, src = defaults(), "DEFAULTS (versions.json missing)"
    for vid in [x.strip() for x in os.environ.get("LEGACY_VO", "").split(",") if x.strip()]:
        # stop-gap: the old narration files whose text still fits (vo_5 weapons and vo_6 target lines are dropped)
        L = [l for l in defaults()["aksiyon"]["lines"] if not re.search(r"vo_[56]_", l["file"])]
        V[vid] = dict(V[vid], lines=L, title=f"{V[vid].get('title')} (eski spiker vo_2/3/4/7)"); src += f" + LEGACY_VO for {vid}"
    print(f"picture: {picture}  ({nf} frames)   scripts: {src}")
    cfg = edit_cfg()
    want = want or [k for k in ("aksiyon", "milli", "osmanli") if k in V]
    tmp = tempfile.mkdtemp(prefix="tomris_versions_")
    report = {}
    try:
        for vid in want:
            v = V[vid]
            print(f"== {vid}: {v.get('title')}")
            wav, A = build_audio(v, tmp, picture)
            if os.environ.get("ONLY_AUDIO") == "1":
                shutil.copy(wav, os.path.join(ROOT, f"tomris-film/versions/{vid}_mix.wav")); report[vid] = A; continue
            vfile, note = build_video(v, picture, tmp, cfg)
            print("    video:", note)
            out = os.path.join(ROOT, f"tomris-film/tomris_{vid}.mp4")
            part = out + ".part.mp4"
            ff("-i", vfile, "-i", wav, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
               "-t", f"{DUR}", "-movflags", "+faststart", "-metadata", f"title=TOMRİS (TCB-1601) · {v.get('title') or vid}", part)
            os.replace(part, out)
            info = probe(out, "-count_packets", "-select_streams", "v", "-show_entries",
                         "stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_packets", "-of", "csv=p=0")
            ainfo = probe(out, "-select_streams", "a", "-show_entries", "stream=codec_name,sample_rate,channels", "-of", "csv=p=0")
            d = dur(out); size = os.path.getsize(out) / 1048576
            M = ebur(out)
            dec = subprocess.run(NICE + ["ffmpeg", "-v", "error", "-i", out, "-f", "null", "-"], capture_output=True, text=True).stderr.strip()
            print(f"    -> {os.path.relpath(out, ROOT)}: {info} | {ainfo} | {d:.3f} s | {size:.1f} MB | in file: I {M['I']:.1f} LUFS, TP {M['TP']:.1f} dBFS"
                  f" | decode errors: {'none' if not dec else dec[:300]}")
            if not info.endswith(",2100"): raise SystemExit("frame count wrong")
            A.update(file=os.path.relpath(out, ROOT), video=info, audio=ainfo, duration=d, size_mb=round(size, 1), file_I=M["I"], file_TP=M["TP"], video_note=note,
                     decode_errors=dec[:300])
            report[vid] = A
    finally:
        if os.environ.get("KEEP") == "1": print("temp:", tmp)
        else: shutil.rmtree(tmp, ignore_errors=True)
    rp = os.path.join(HERE, "last_build.json")
    old = json.load(open(rp)) if os.path.exists(rp) else {}
    old.update({k: dict(v, picture=os.path.relpath(picture, ROOT) if picture.startswith(ROOT) else picture) for k, v in report.items()})
    json.dump(old, open(rp, "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
