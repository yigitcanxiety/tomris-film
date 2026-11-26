#!/bin/bash
# TOMRİS · full re-render and edit -> tomris-film/tomris_v1.mp4 (+ mix.wav, contact.jpg)
#   bash tomris-film/build.sh                 render all 3D chunks, re-use existing overlay renders
#   bash tomris-film/build.sh --overlays      also re-render opening + endcard from tomris-overlays/
#   bash tomris-film/build.sh --edit-only     no rendering: re-cut and re-mix from the existing chunks
#   CHUNKS="25 35" bash tomris-film/build.sh  re-render only the chunks that start at these seconds
# Shared-machine rule: every HyperFrames render takes tomris-three/.render.lock and holds it for one chunk only.
set -euo pipefail
P="$(cd "$(dirname "$0")/.." && pwd)"; F="$P/tomris-film"; LOCK="$P/tomris-three/.render.lock"
HF="npx --yes hyperframes@0.9.94"
# 3D picture runs 5.0 s (after the opening) to 63.0 s (endcard); chunks of <= 300 frames
BOUNDS=(5 15 25 35 45 55 63)
OVERLAYS=0; EDIT_ONLY=0
for a in "$@"; do case $a in --overlays) OVERLAYS=1;; --edit-only) EDIT_ONLY=1;; esac; done
mkdir -p "$F/chunks"

locked() {            # run a command under the render lock; release on success and on failure
  until mkdir "$LOCK" 2>/dev/null; do echo "  waiting for render lock..."; sleep 20; done
  local rc=0; "$@" || rc=$?; rmdir "$LOCK" 2>/dev/null || true; return $rc
}

T0=$(date +%s)
if [ $EDIT_ONLY = 0 ]; then
  cp "$P/tomris-shots/shots.json" "$P/tomris-three/assets/shots.json"
  if [ $OVERLAYS = 1 ] || [ ! -f "$P/tomris-overlays/renders/opening.mp4" ] || [ ! -f "$P/tomris-overlays/renders/endcard.mp4" ]; then
    for o in opening endcard; do
      echo "overlay $o"
      (cd "$P/tomris-overlays/$o" && locked $HF render --quality looks --workers 1 -o "$P/tomris-overlays/renders/$o.mp4" > "$F/chunks/$o.log" 2>&1)
    done
  fi
  for ((k = 0; k < ${#BOUNDS[@]} - 1; k++)); do
    s=${BOUNDS[$k]}; e=${BOUNDS[$((k+1))]}; name=$(printf "c_%02d" $s)
    if [ -n "${CHUNKS:-}" ] && [[ " $CHUNKS " != *" $s "* ]]; then continue; fi
    echo "3D chunk $s-$e s"; t=$(date +%s)
    (cd "$P/tomris-three" && locked $HF render --quality looks --workers 1 --start $s --end $e -o "$F/chunks/$name.mp4" > "$F/chunks/$name.log" 2>&1)
    echo "  $(( $(date +%s) - t )) s, $(ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames -of csv=p=0 "$F/chunks/$name.mp4") frames"
  done
fi

echo "audio"; bash "$F/mix.sh" "$F/mix.wav" | grep -v "empty slot"

echo "edit"
IN=(-i "$P/tomris-overlays/renders/opening.mp4"); FC="[0:v]trim=end_frame=150,setpts=PTS-STARTPTS,fps=30,format=yuv420p[v0];"; n=1
for ((k = 0; k < ${#BOUNDS[@]} - 1; k++)); do
  s=${BOUNDS[$k]}; e=${BOUNDS[$((k+1))]}
  IN+=(-i "$F/chunks/$(printf "c_%02d" $s).mp4")
  FC+="[$n:v]trim=end_frame=$(( (e - s) * 30 )),setpts=PTS-STARTPTS,fps=30,format=yuv420p[v$n];"; n=$((n+1))
done
IN+=(-i "$P/tomris-overlays/renders/endcard.mp4"); FC+="[$n:v]trim=end_frame=210,setpts=PTS-STARTPTS,fps=30,format=yuv420p[v$n];"; n=$((n+1))
for ((j = 0; j < n; j++)); do FC+="[v$j]"; done
FC+="concat=n=$n:v=1:a=0[v]"
IN+=(-i "$F/mix.wav")
ffmpeg -v error -y "${IN[@]}" -filter_complex "$FC" -map "[v]" -map "$n:a" -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p \
  -r 30 -c:a aac -b:a 256k -movflags +faststart -shortest "$F/tomris_v1.mp4"
ffprobe -v error -count_frames -show_entries stream=codec_name,width,height,r_frame_rate,nb_read_frames -of csv=p=0 "$F/tomris_v1.mp4"

echo "contact sheet"; python3 "$F/contact.py" "$F/tomris_v1.mp4" "$F/contact.jpg"
echo "done in $(( $(date +%s) - T0 )) s"
