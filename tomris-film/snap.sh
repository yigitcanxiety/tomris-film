#!/bin/sh
# Review stills of the 3D composition, under the shared render lock.
# usage: sh tomris-film/snap.sh <times,comma,separated> <outdir>     (times in seconds of the film)
P="$(cd "$(dirname "$0")/.." && pwd)"; LOCK="$P/tomris-three/.render.lock"
until mkdir "$LOCK" 2>/dev/null; do sleep 20; done
trap 'rmdir "$LOCK" 2>/dev/null' EXIT INT TERM
cp "$P/tomris-shots/shots.json" "$P/tomris-three/assets/shots.json"
cd "$P/tomris-three" && npx --yes hyperframes@0.9.94 snapshot --at "$1" --no-end --timeout 170000 -o "$2" 2>&1 | grep -E "rror|saved|snapshot:|fail" | head -20
