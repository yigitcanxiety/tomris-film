#!/bin/bash
# TOMRİS audio bed -> tomris-film/mix.wav (70.0 s, 48 kHz stereo, -14 LUFS integrated, VO on top).
# Every slot below is optional: a file that does not exist yet is skipped, so music and SFX drop in later
# by just saving them under tomris-audio/ with the slot's name and re-running this script.
set -euo pipefail
P="$(cd "$(dirname "$0")/.." && pwd)"; A="$P/tomris-audio"; OUT="${1:-$P/tomris-film/mix.wav}"
FPS=30; DUR=70

# ---- slots: bus | file | start frame | gain dB | length s (0 = whole file, loops if longer than the file) ----
# frames are film frames (shots.json); VO frames are the shots' VO frames, vo_1 is still missing (slot stays silent)
SLOTS="
vo  |vo_1.mp3             |  15 |   0 | 0
vo  |vo_2_liman_gemide.mp3| 315 |   0 | 0
vo  |vo_3_olcu.mp3        | 513 |   0 | 0
vo  |vo_4_yirmi_arac.mp3  | 972 |   0 | 0
vo  |vo_5_stamp_umtas.mp3 |1077 |   0 | 0
vo  |vo_6_hedef.mp3       |1448 |   0 | 0
vo  |vo_7_tomris.mp3      |1755 |   0 | 0
mus |music.mp3            |   0 |  -6 | 70
sfx |sfx_waves.mp3        | 140 | -15 | 12.6
sfx |sfx_radar.mp3        |   0 | -12 | 0
sfx |sfx_radar.mp3        | 741 | -16 | 0
sfx |sfx_radar.mp3        |1667 | -16 | 0
sfx |sfx_waterjet.mp3     | 426 | -10 | 0
sfx |sfx_wind.mp3         | 513 | -18 | 15.3
sfx |sfx_wind.mp3         |1448 | -18 | 14.7
sfx |sfx_impact.mp3       | 972 |  -8 | 0
sfx |sfx_impact.mp3       |1444 |  -6 | 0
sfx |sfx_impact.mp3       |1715 |  -6 | 0
sfx |sfx_impact.mp3       |1751 |  -6 | 0
sfx |sfx_impact.mp3       |1890 |  -8 | 0
"

ARGS=(); VO=""; SFX=""; MUS=""; i=0; F=""
while IFS='|' read -r bus file frame gain len; do
  bus=$(echo $bus); file=$(echo $file); [ -z "$bus" ] && continue
  [ -f "$A/$file" ] || { echo "  (empty slot) $file @ frame $(echo $frame)"; continue; }
  frame=$(echo $frame); gain=$(echo $gain); len=$(echo $len)
  ms=$(( frame * 1000 / FPS ))
  if [ "$len" != "0" ]; then ARGS+=(-stream_loop -1 -i "$A/$file"); trim="atrim=0:$len,afade=t=in:d=0.6,afade=t=out:st=$(echo "$len - 1.2" | bc):d=1.2,"
  else ARGS+=(-i "$A/$file"); trim=""; fi
  F+="[$i:a]aformat=sample_rates=48000:channel_layouts=stereo,${trim}volume=${gain}dB,adelay=${ms}|${ms}[a$i];"
  case $bus in vo) VO+="[a$i]";; sfx) SFX+="[a$i]";; mus) MUS+="[a$i]";; esac
  echo "  $bus  $file @ frame $frame (${gain} dB)"
  i=$((i+1))
done <<< "$SLOTS"

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
# two-pass EBU R128 to -14 LUFS, true peak -1.5 dBTP
M=$(ffmpeg -hide_banner -i "$TMP/raw.wav" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$M" | grep "\"$1\"" | sed -E 's/.*: "([^"]*)".*/\1/'; }
ffmpeg -v error -y -i "$TMP/raw.wav" -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" -ar 48000 -c:a pcm_s16le "$OUT"
echo "mix: $OUT  (measured before norm: $(g input_i) LUFS)"
ffmpeg -hide_banner -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|Peak:)" | tail -2
