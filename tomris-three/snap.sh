#!/bin/sh
# usage: sh snap.sh 1.5,4.5,7.5,10.5   -> renders/snap/frame-*.png
cd "$(dirname "$0")" && npx --yes hyperframes@0.9.94 snapshot --at "${1:-1.5,4.5,7.5,10.5}" --no-end --timeout 170000 -o renders/snap 2>&1 | grep -E "rror|saved|snapshot:" | head -20
