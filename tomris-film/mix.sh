#!/bin/bash
# TOMRİS audio mix -> tomris-film/mix.wav (exactly 70.0 s, 48 kHz stereo, -14 LUFS integrated, -1.5 dBTP).
# Cues come from tomris-shots/shots.json "audio" (vo + beds) via cues.py: VO lands on the frames the shot list assigns
# (a clip may be cut into segments on its silences), beds/SFX are named slots. A slot whose file does not exist in
# tomris-audio/ is skipped, so music and SFX drop in later: save e.g. tomris-audio/music.mp3 and re-run.
#   bash tomris-film/mix.sh [out.wav]
set -euo pipefail
P="$(cd "$(dirname "$0")/.." && pwd)"; A="$P/tomris-audio"; OUT="${1:-$P/tomris-film/mix.wav}"
FPS=30; DUR=70

echo "VO timing (speech end vs next cue):"
python3 "$P/tomris-film/cues.py" check || { echo "VO overrun: fix the cue frames in tomris-shots/gen.py"; exit 1; }

ARGS=(); VO=""; SFX=""; MUS=""; i=0; F=""
while IFS='|' read -r bus file frame gain tin tout len note; do
  [ -z "$bus" ] && continue
  if [ ! -f "$A/$file" ]; then echo "  (empty slot) $bus $file @ frame $frame  [$note]"; continue; fi
  ms=$(( frame * 1000 / FPS ))
  if [ "$len" != "0" ]; then                         # bed: loop, cut to length, fade in/out
    ARGS+=(-stream_loop -1 -i "$A/$file")
    trim="atrim=0:$len,afade=t=in:d=0.6,afade=t=out:st=$(awk "BEGIN{printf \"%.3f\", $len - 1.2}"):d=1.2,"
  else
    ARGS+=(-i "$A/$file")
    if [ "$tout" != "0" ]; then trim="atrim=$tin:$tout,asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=$(awk "BEGIN{printf \"%.3f\", $tout - $tin - 0.04}"):d=0.04,"; else trim=""; fi
  fi
  F+="[$i:a]aformat=sample_rates=48000:channel_layouts=stereo,${trim}volume=${gain}dB,adelay=${ms}|${ms}[a$i];"
  case $bus in vo) VO+="[a$i]";; sfx) SFX+="[a$i]";; mus) MUS+="[a$i]";; esac
  printf "  %-3s %-24s @ frame %4d  %5s dB  %s\n" "$bus" "$file" "$frame" "$gain" "$( [ "$tout" != "0" ] && echo "clip ${tin}-${tout}s" )"
  i=$((i+1))
done < <(python3 "$P/tomris-film/cues.py" slots)

# silent base so every bus exists and the mix is exactly DUR long
ARGS+=(-f lavfi -t $DUR -i "anullsrc=r=48000:cl=stereo"); Z=$i
n() { printf '%s' "$1" | tr -cd '[' | wc -c | tr -d ' '; }
F+="[$Z:a]asplit=3[z0][z1][z2];"
F+="${VO}[z0]amix=inputs=$(( $(n "$VO") + 1 )):normalize=0:duration=longest,asplit=2[vo][key];"
F+="${SFX}[z1]amix=inputs=$(( $(n "$SFX") + 1 )):normalize=0:duration=longest[sfx];"
F+="${MUS}[z2]amix=inputs=$(( $(n "$MUS") + 1 )):normalize=0:duration=longest[mus];"
# music ducks under the voice (about -9 dB while VO speaks)
F+="[mus][key]sidechaincompress=threshold=0.02:ratio=8:attack=30:release=450:makeup=1[musd];"
F+="[vo][sfx][musd]amix=inputs=3:normalize=0:duration=longest,atrim=0:$DUR,asetpts=N/SR/TB[mix]"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
ffmpeg -v error -y "${ARGS[@]}" -filter_complex "$F" -map "[mix]" -c:a pcm_s24le "$TMP/raw.wav"
# loudness: static gain to -14 LUFS integrated + a 4x-oversampled peak limiter (-2 dBFS ceiling ~ -1.5 dBTP);
# measured, corrected once more, measured again. (loudnorm alone cannot reach -14 here: the dry VO-only mix has
# ~9 dB more peak than loudness headroom allows, so it falls back to dynamic mode and lands near -17.)
meas() { ffmpeg -hide_banner -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1 | grep -A12 Summary | awk '/ I:/{print $2}'; }
I0=$(meas "$TMP/raw.wav")
lim() { ffmpeg -v error -y -i "$1" -af "volume=${3}dB,aresample=192000,alimiter=limit=0.79:attack=1:release=60:level=disabled,aresample=48000,apad,atrim=0:$DUR" -ar 48000 -c:a pcm_s24le "$2"; }
G1=$(awk "BEGIN{printf \"%.2f\", -14 - ($I0)}"); lim "$TMP/raw.wav" "$TMP/l1.wav" "$G1"
I1=$(meas "$TMP/l1.wav"); G2=$(awk "BEGIN{printf \"%.2f\", $G1 + (-14 - ($I1))}"); lim "$TMP/raw.wav" "$TMP/l2.wav" "$G2"
ffmpeg -v error -y -i "$TMP/l2.wav" -c:a pcm_s16le "$OUT"
echo "mix: $OUT  (raw $I0 LUFS; gain $G2 dB + limiter)"
echo "duration: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT") s"
ffmpeg -hide_banner -nostats -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -A20 "Summary" | grep -E "I:|LRA:|Peak:" | sed 's/^ */  /'
