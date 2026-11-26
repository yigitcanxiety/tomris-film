#!/bin/bash
# TOMRİS · render + edit -> tomris-film/tomris_v1.mp4 (H.264 high, yuv420p, 1920x1080, 30 fps, 2100 frames, AAC 48 kHz)
#                          + tomris-film/mix.wav + tomris-film/contact.jpg (numbered, one frame per shot, from the mp4)
#
#   bash tomris-film/build.sh                  render every missing 3D chunk, then edit
#   bash tomris-film/build.sh --edit-only      no rendering: cut + mix + mux from whatever chunks exist
#   bash tomris-film/build.sh --render-only    render chunks, no edit
# env:
#   SUB=8          motion-blur sub-frames per frame (passed to the page as a HyperFrames variable)
#   CHUNKS="3 4"   only these chunk numbers (see the list printed by --list)
#   FORCE=1        re-render chunks even if a complete one exists
#   PAR=1          chunks rendered side by side (each a separate Chrome; 2 is safe, see RENDER.md for whether it helps)
#   FILL=black     a missing chunk in the edit becomes black; FILL=preview holds tomris-film/preview/f<mid>.jpg per shot
#   HF_ARGS=""     extra arguments for `hyperframes render` (e.g. "--browser-gpu" on a Mac)
#   --list         print the chunk table and exit
#
# Structure (shots.json "structure"): opening.mp4 frames 0-149 | 3D frames 150-1889 (black flashes 1444-1447,
# 1715-1720, 1751-1754 forced black in the edit) | endcard.mp4 frames 1890-2099.
# 3D chunks are <= 132 frames (HyperFrames slice grid, below). A chunk is "done" when
# tomris-film/chunks/c_kk.mp4 exists with exactly its frame count; its log is chunks/c_kk.log.
set -euo pipefail
P="$(cd "$(dirname "$0")/.." && pwd)"; F="$P/tomris-film"; C="$F/chunks"
HF="npx --yes hyperframes@0.9.94"
SUB="${SUB:-8}"; PAR="${PAR:-1}"; FILL="${FILL:-black}"; FORCE="${FORCE:-0}"
MODE=all; for a in "$@"; do case $a in --edit-only) MODE=edit;; --render-only) MODE=render;; --list) MODE=list;; esac; done
mkdir -p "$C"

# Chunks follow HyperFrames' own capture plan for this 2100-frame composition (16 slices of 132 frames from frame 0,
# see /tmp/hf-render-span-*/plan/meta/chunks.json): a span crossing a slice boundary costs a second browser session
# (page load + shader compile + warm-up), so chunk k = the 3D part of slice k. All chunks are <= 132 frames.
S3D=150; E3D=1890; CH=132
K0=$(( S3D / CH )); K1=$(( (E3D - 1) / CH ))
NCH=$(( K1 - K0 + 1 ))
chunk_range() { local k=$(( $1 + K0 )); local a=$(( CH * k )); local b=$(( a + CH )); [ $a -lt $S3D ] && a=$S3D; [ $b -gt $E3D ] && b=$E3D; echo "$a $b"; }
frames_of() { [ -f "$1" ] && ffprobe -v error -count_packets -select_streams v -show_entries stream=nb_read_packets -of csv=p=0 "$1" 2>/dev/null || echo 0; }

if [ $MODE = list ]; then
  for ((k = 0; k < NCH; k++)); do read a b < <(chunk_range $k); n=$(printf "c_%02d" $k)
    echo "$n  frames $a-$((b-1))  ($((b-a)) f, ${a}/30-${b}/30 s)  done: $(frames_of "$C/$n.mp4")"; done; exit 0
fi

render_chunk() {      # k -> chunks/c_kk.mp4 (rendered to a temp name, moved in place only when complete)
  local k=$1 a b n; read a b < <(chunk_range $k); n=$(printf "c_%02d" $k)
  local want=$(( b - a ))
  if [ "$FORCE" != 1 ] && [ "$(frames_of "$C/$n.mp4")" = "$want" ]; then echo "$n: done, skipped"; return 0; fi
  local s e t0; s=$(awk "BEGIN{printf \"%.6f\", $a/30}"); e=$(awk "BEGIN{printf \"%.6f\", $b/30}"); t0=$(date +%s)
  echo "$n: frames $a-$((b-1)) SUB=$SUB  -> $C/$n.mp4  (log $C/$n.log)"
  ( cd "$P/tomris-three" && $HF render --workers 1 --quality looks --start "$s" --end "$e" \
      --variables "{\"sub\":$SUB}" ${HF_ARGS:-} -o "$C/$n.part.mp4" ) > "$C/$n.log" 2>&1 || { echo "$n: FAILED (see log)"; return 1; }
  local got; got=$(frames_of "$C/$n.part.mp4")
  if [ "$got" != "$want" ]; then echo "$n: wrong frame count $got != $want (kept as $n.part.mp4)"; return 1; fi
  mv "$C/$n.part.mp4" "$C/$n.mp4"
  local dt=$(( $(date +%s) - t0 )); echo "$n: $want frames in $dt s ($(awk "BEGIN{printf \"%.1f\", $dt/$want}") s/frame)" | tee -a "$C/timings.txt"
}
export -f render_chunk chunk_range frames_of; export P C HF SUB FORCE S3D E3D CH K0 HF_ARGS

T0=$(date +%s)
if [ $MODE != edit ]; then
  cp "$P/tomris-shots/shots.json" "$P/tomris-three/assets/shots.json"
  printf '{"sub": %d}\n' "$SUB" > "$P/tomris-three/assets/render.json"      # fallback if variables are not delivered
  LIST="${CHUNKS:-$(seq 0 $((NCH - 1)))}"
  if [ "$PAR" -gt 1 ]; then export HYPERFRAMES_RENDER_LOCK=off; fi           # else HyperFrames queues renders itself
  printf '%s\n' $LIST | xargs -P "$PAR" -I{} bash -c 'render_chunk {}' || echo "some chunks failed; re-run to retry only those"
  [ $MODE = render ] && { echo "render done in $(( $(date +%s) - T0 )) s"; exit 0; }
fi

echo "audio"; bash "$F/mix.sh" "$F/mix.wav" | grep -vE "empty slot|^  (vo|sfx|mus) "

echo "edit (missing chunks: $FILL)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
IN=(-i "$P/tomris-overlays/renders/opening.mp4"); FC="[0:v]trim=end_frame=150,setpts=PTS-STARTPTS,fps=30,format=yuv420p,setsar=1[v0];"; n=1
for ((k = 0; k < NCH; k++)); do
  read a b < <(chunk_range $k); name=$(printf "c_%02d" $k); want=$(( b - a ))
  if [ "$(frames_of "$C/$name.mp4")" = "$want" ]; then
    IN+=(-i "$C/$name.mp4")
  elif [ "$FILL" = preview ]; then          # hold each shot's preview still for the frames of the shot inside the chunk
    python3 - "$a" "$b" "$F/preview" "$TMP/$name.txt" <<'PY'
import sys, os, json
a, b, d, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3], sys.argv[4]
S = json.load(open(os.path.join(os.path.dirname(d), "..", "tomris-shots", "shots.json")))["shots"]
L = []
for s in S:
    f0, f1 = max(a, s["startFrame"]), min(b, s["startFrame"] + s["frames"])
    if f1 <= f0: continue
    img = os.path.join(d, f"f{s['startFrame'] + s['frames'] // 2:04d}.jpg")
    if s["kind"] != "3d" or not os.path.exists(img): img = "BLACK"
    L.append(f"{img}|{f1 - f0}")
open(out, "w").write("\n".join(L))
PY
    segs=(); j=0
    while IFS='|' read -r img cnt; do
      if [ "$img" = BLACK ]; then ffmpeg -v error -y -f lavfi -i "color=black:s=1920x1080:r=30" -frames:v "$cnt" -pix_fmt yuv420p -c:v libx264 -crf 30 "$TMP/${name}_$j.mp4"
      else ffmpeg -v error -y -loop 1 -framerate 30 -i "$img" -vf "scale=1920:804,pad=1920:1080:0:138:black,format=yuv420p" -frames:v "$cnt" -c:v libx264 -crf 22 "$TMP/${name}_$j.mp4"; fi
      echo "file '$TMP/${name}_$j.mp4'" >> "$TMP/$name.lst"; j=$((j+1))
    done < "$TMP/$name.txt"
    ffmpeg -v error -y -f concat -safe 0 -i "$TMP/$name.lst" -c copy "$TMP/$name.mp4"
    IN+=(-i "$TMP/$name.mp4"); echo "  $name: preview stills"
  else
    IN+=(-f lavfi -i "color=black:s=1920x1080:r=30:d=$(awk "BEGIN{printf \"%.4f\", $want/30}")"); echo "  $name: black"
  fi
  FC+="[$n:v]trim=end_frame=$want,setpts=PTS-STARTPTS,fps=30,format=yuv420p,setsar=1[v$n];"; n=$((n+1))
done
IN+=(-i "$P/tomris-overlays/renders/endcard.mp4"); FC+="[$n:v]trim=end_frame=210,setpts=PTS-STARTPTS,fps=30,format=yuv420p,setsar=1[v$n];"; n=$((n+1))
for ((j = 0; j < n; j++)); do FC+="[v$j]"; done
# black flashes from shots.json (kind "black"), forced black over whatever the chunk holds
BL=$(python3 -c "import json;d=json.load(open('$P/tomris-shots/shots.json'));print('+'.join(f\"between(n\\\\,{s['startFrame']}\\\\,{s['startFrame']+s['frames']-1})\" for s in d['shots'] if s['kind']=='black'))")
FC+="concat=n=$n:v=1:a=0,drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='$BL'[v]"
IN+=(-i "$F/mix.wav")
ffmpeg -v error -y "${IN[@]}" -filter_complex "$FC" -map "[v]" -map "$n:a" -frames:v 2100 \
  -c:v libx264 -profile:v high -preset slow -crf 18 -maxrate 9M -bufsize 18M -pix_fmt yuv420p -r 30 -g 60 \
  -c:a aac -b:a 256k -ar 48000 -t 70 -movflags +faststart "$F/tomris_v1.mp4"
echo "tomris_v1.mp4: $(ffprobe -v error -count_frames -select_streams v -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames -of csv=p=0 "$F/tomris_v1.mp4")"
echo "  audio: $(ffprobe -v error -select_streams a -show_entries stream=codec_name,sample_rate,channels -of csv=p=0 "$F/tomris_v1.mp4")  duration $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$F/tomris_v1.mp4") s  size $(( $(stat -c %s "$F/tomris_v1.mp4") / 1048576 )) MB"

echo "contact sheet"; python3 "$F/contact.py" "$F/tomris_v1.mp4" "$F/contact.jpg"
echo "done in $(( $(date +%s) - T0 )) s"
