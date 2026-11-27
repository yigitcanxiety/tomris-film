#!/bin/bash
# TOMRİS · three finished versions from one picture. See tomris-film/versions/README.md.
#   bash tomris-film/versions/build_versions.sh <picture.mp4> [aksiyon] [milli] [osmanli]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
[ $# -ge 1 ] || { echo "usage: $0 <picture.mp4> [aksiyon milli osmanli]"; exit 1; }
exec python3 "$HERE/build_versions.py" "$@"
