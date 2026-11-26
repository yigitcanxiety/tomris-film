#!/bin/bash
# Fast preview of the cut without HyperFrames: one still per 3D shot at its middle frame (tools/shot.js, sub 1,
# half resolution) -> tomris-film/preview/f<frame>.jpg + tomris-film/preview_contact.jpg (numbered).
#   bash tomris-film/preview.sh            all 3D shots (~5 min on 4 cores, software WebGL)
#   bash tomris-film/preview.sh 2 12 43    only these shot numbers (the contact sheet keeps older stills)
# The stills also serve `FILL=preview bash tomris-film/build.sh --edit-only` (an animatic of the cut).
set -euo pipefail
P="$(cd "$(dirname "$0")/.." && pwd)"; F="$P/tomris-film"
cp "$P/tomris-shots/shots.json" "$P/tomris-three/assets/shots.json"
FR=$(python3 "$F/edl.py" mids "$@")
node "$P/tomris-three/tools/shot.js" --frames "$FR" --sub 1 --scale 0.5 --out "$F/preview" | grep -E "ready|ERROR|error" || true
python3 "$F/contact.py" --dir "$F/preview" "$F/preview_contact.jpg"
