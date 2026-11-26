# TOMRİS · render and edit

Output: `tomris-film/tomris_v1.mp4`: H.264 High, yuv420p, 1920×1080, 30 fps, exactly 2100 frames (70.0 s), AAC 48 kHz
stereo 256 kb/s, faststart, capped at 9 Mb/s (about 80 MB at most). Alongside it are `tomris-film/mix.wav` and
`tomris-film/contact.jpg` (the middle frame of every shot, numbered, taken from the final mp4).

## Where the film is defined

| What | File |
|---|---|
| Shot list: timing, setups, lenses, camera paths, boat speed, pivots, flag, beats, audio cues | `tomris-shots/gen.py`, which writes `shots.json` and `shots.md`. Edit gen.py, then run `python3 gen.py && python3 validate.py` |
| 3D page (copies of `shots.json` go into `tomris-three/assets/`) | `tomris-three/index.html`, `assets/js/film.js` (`EDIT` holds only GLB-precision re-aims) |
| Opening (frames 0–149) and end card (frames 1890–2099) | `tomris-overlays/renders/opening.mp4` (150 f), `endcard.mp4` (210 f) |
| Mix | `tomris-film/mix.sh` (cues come from `shots.json` → `audio`, via `cues.py`) |
| Edit, mux and contact sheet | `tomris-film/build.sh`, `contact.py`, `edl.py` |

Structure (`python3 tomris-film/edl.py beats`):

| Frames | Beat |
|---|---|
| 0–149 | Opening overlay (HyperFrames) |
| 150–512 | Harbour, sunset (B) #2–#10 |
| 513–971 | Open sea, sunset (A) #11–#23 |
| 972–1076 | Wireframe intermission (W) #24–#25 |
| 1077–1443 | Dark studio turntable, intercut with sea (C + A) #26–#37 |
| 1444–1447 | Black flash #38 |
| 1448–1714 | Blue hour (A′) #39–#53 |
| 1715–1720 | Black flash #54 |
| 1721–1750 | Backlit flag at the climax (A′) #55 |
| 1751–1754 | Black flash #56 |
| 1755–1889 | Close (A′) #57–#58 |
| 1890–2099 | End card overlay (HyperFrames) |

The 3D page renders the whole 70 s timeline. Frames outside the 3D range render black, and the edit uses only frames
150–1889. The edit also forces the black-flash frames to black.

## Commands

Everything runs from the repository root.

```sh
# 1. fast look at every shot (no HyperFrames, ~5 min): tomris-film/preview/f<frame>.jpg + tomris-film/preview_contact.jpg
bash tomris-film/preview.sh            # or: bash tomris-film/preview.sh 12 43 55

# 2. full render + edit (final quality). Skips chunks that are already complete. Safe to stop and re-run.
SUB=8 bash tomris-film/build.sh

# list the chunks and how far each one has got
bash tomris-film/build.sh --list

# re-render some chunks only (numbers from --list), e.g. after a fix in shots 26-31
CHUNKS="7 8" FORCE=1 SUB=8 bash tomris-film/build.sh --render-only

# re-cut, re-mix and re-mux from the existing chunks (missing chunks become black, or the preview stills)
bash tomris-film/build.sh --edit-only
FILL=preview bash tomris-film/build.sh --edit-only      # animatic: each shot's preview still held for its length

# audio only
bash tomris-film/mix.sh                # -> tomris-film/mix.wav, prints the VO timing check and the loudness
```

### Chunks

The 3D range is split into 14 chunks of up to 132 frames (`c_00` = 150–263, `c_01` = 264–395, …, `c_13` = 1848–1889).
The 132-frame grid is HyperFrames' own capture plan for a 2100-frame composition. A span that crosses one of its slice
boundaries starts a second browser session, which costs another page load, shader compile and warm-up (~75 s). Each
chunk is rendered to `chunks/c_kk.part.mp4` and moved into place only when it has the right frame count, so a failure
loses at most one chunk. The log is `chunks/c_kk.log` and the timings go to `chunks/timings.txt`.

### Knobs

| Knob | Where | Effect |
|---|---|---|
| `SUB=n` | env of build.sh | motion-blur sub-frames per frame (default 8). It reaches the page as a HyperFrames variable (`--variables '{"sub":n}'`, declared in index.html's `data-composition-variables`), with `assets/render.json` as a fallback. Render time scales roughly linearly with n |
| `?sub=&scale=&warm=` | preview URL / tools/shot.js | preview only (query strings are not available under `hyperframes render`) |
| `PAR=n` | env of build.sh | chunks rendered side by side (sets `HYPERFRAMES_RENDER_LOCK=off`). See timings below |
| `HF_ARGS` | env of build.sh | extra `hyperframes render` flags, e.g. `--browser-gpu` |
| `--quality looks` + x264 `-crf 18 -maxrate 9M` | build.sh | chunk intermediate quality and final delivery bitrate |
| `LAMP_B` | film.js | quay lamp boost at sunset (lamps bloom as points) |
| look parameters (exposure, fog, bloom, lampGain) | `assets/js/looks.js` | water/grade workstream |

## Measured on this machine (4 cores, no GPU: SwiftShader WebGL, other agents' jobs running at the same time)

| Measurement | Result |
|---|---|
| Preview still (`tools/shot.js`, sub 1, scale 0.5) | first ~20 s (compile), then ~4.5–6 s each; 54 shots in 5 min 24 s |
| HyperFrames chunk `c_13`, 42 frames, SUB=1, full 1920×804 | 331 s wall: ~74 s startup (plan + reference background ~48 s + page/shader warm-up), 196 s capture (**4.7 s/frame**), ~60 s encode/finish |
| HyperFrames 30 frames crossing a slice boundary (21.2–22.2 s), SUB=1 | 15 min wall (two sessions, heavy contention from another agent's GLB export: ~20 s/frame) |
| Two chunks side by side (PAR=2), SUB=1 | PAR_RESULT |
| Estimate for the full 3D range, SUB=8 | 1740 frames × 8 × ~4.5 s ≈ 17 h + 14 × ~2 min overhead, unless the water/grade workstream's sub-frame speed-up lands (they measured ~7 s per sub-frame earlier). With SUB=4 it is about half that |
| Edit + mix + mux + contact sheet (`--edit-only`) | EDIT_TIME |
| Loudness of mix.wav | LOUDNESS |

## On an Apple-silicon Mac (GPU)

```sh
brew install ffmpeg node python@3.12      # python3 needs Pillow for the contact sheet: pip3 install pillow
git clone <repo> && cd tomris-film && git checkout film-v1
npx --yes playwright@1 install chromium   # only for tools/shot.js previews
HF_ARGS="--browser-gpu" SUB=8 PAR=1 bash tomris-film/build.sh
```

With a real GPU, WebGL is one to two orders of magnitude faster than SwiftShader, and the capture and encode overheads
take over. Run with `PAR=1` first. If `chunks/timings.txt` shows that the GPU is mostly idle, try `PAR=2`. `SUB=16`
becomes affordable there. The scripts use only bash, ffmpeg, ffprobe, awk, python3 and node, and the GNU-only flags
they used have been avoided, but `stat -c` in the size print falls back silently on macOS (the size line is cosmetic).

## Music and SFX

Put the files in `tomris-audio/` under these names and re-run `bash tomris-film/mix.sh` (or `build.sh --edit-only`).
A missing file leaves its slot empty and nothing else changes. The slots are defined in `tomris-shots/gen.py` (`AUDIO`).

| File | Frame(s) | Gain | Use |
|---|---|---|---|
| `vo_1.mp3` | 15 | 0 dB | opening line (missing, so the slot is silent) |
| `music.mp3` | 0, 70 s | −6 dB | score; ducks ~9 dB under the VO (sidechain) |
| `sfx_waves.mp3` (present) | 150, 12.1 s | −15 dB | under the harbour section #2–#10 |
| `sfx_waterjet.mp3` | 426 | −10 dB | #9 jets engage |
| `sfx_wind.mp3` | 513 (15.3 s), 1448 (14.7 s) | −18 dB | open sea and blue hour beds |
| `sfx_radar.mp3` | 741, 1667 | −16 dB | radar turning #16, #51 |
| `sfx_impact.mp3` | 849, 1444, 1715, 1751, 1890 | −6…−10 dB | slam #20, the three black flashes, end card |

Loudness: the mix is gained to −14 LUFS integrated and run through a 4× oversampled limiter at −2 dBFS (≈ −1.5 dBTP),
then measured and corrected once. `mix.sh` refuses to run if a VO cue's speech overruns the next cue.
