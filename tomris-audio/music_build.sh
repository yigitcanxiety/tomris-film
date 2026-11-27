#!/bin/bash
# Builds the three 70.0 s music beds (and alternates) from the Commons downloads in music_src/.
# Each bed: edit/trim with ffmpeg -> 48 kHz stereo -> static gain to -16 LUFS integrated + 4x-oversampled
# limiter (-1.5 dBFS ceiling) -> MP3 256 kb/s, exactly 70.0 s. Sources, offsets and licences: MUZIK.md.
#   bash tomris-audio/music_build.sh            (all)      bash tomris-audio/music_build.sh aksiyon
set -euo pipefail
A="$(cd "$(dirname "$0")" && pwd)"; M="$A/music_src"; DUR=70; TARGET=-16
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
FF=(nice -n 19 ffmpeg -v error -y)

meas() { nice -n 19 ffmpeg -hide_banner -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1 | grep -A12 Summary | awk '/ I:/{print $2}'; }
# finish <in.wav> <out.mp3>: loudness to TARGET, limiter, pad/cut to DUR, mp3
finish() {
  local I0 G
  I0=$(meas "$1"); G=$(awk "BEGIN{printf \"%.2f\", $TARGET - ($I0)}")
  "${FF[@]}" -i "$1" -af "volume=${G}dB,aresample=192000,alimiter=limit=0.84:attack=1:release=80:level=disabled,aresample=48000,apad,atrim=0:$DUR" \
    -ar 48000 -ac 2 -c:a pcm_s16le "$TMP/fin.wav"
  I0=$(meas "$TMP/fin.wav"); G=$(awk "BEGIN{printf \"%.2f\", $TARGET - ($I0)}")   # one correction pass
  "${FF[@]}" -i "$TMP/fin.wav" -af "volume=${G}dB,alimiter=limit=0.84:attack=1:release=80:level=disabled,apad,atrim=0:$DUR" \
    -ar 48000 -ac 2 -c:a libmp3lame -b:a 256k "$2"
  printf '  %-28s %s s  ' "$(basename "$2")" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$2")"
  nice -n 19 ffmpeg -hide_banner -nostats -i "$2" -af ebur128=peak=true -f null - 2>&1 | grep -A20 Summary | awk '/ I:/{i=$2} /Peak:/{p=$2} END{print "I", i, "LUFS, true peak", p, "dBFS"}'
}
S48="aformat=sample_rates=48000:channel_layouts=stereo"

aksiyon() {
  # Sascha Ende - Cinema Blockbuster Trailer 3 (F60 long edit). Source 13.40 s -> film 0. Hits land on: film 0.35 (src 13.75),
  # 57.35 = flag climax frame 1721 (src 70.75), 63.35 = end card (src 76.75), 68.05 last hit (src 81.45). Fade 67.6-70.
  "${FF[@]}" -ss 13.40 -t $DUR -i "$M/ende_blockbuster3_f60.mp3" -af "$S48,afade=t=in:d=0.15,afade=t=out:st=67.6:d=2.4" "$TMP/a.wav"
  finish "$TMP/a.wav" "$A/music_aksiyon.mp3"
  # alt 1: Kevin MacLeod - Exciting Trailer. Source 3.90 s -> film 0 (snare pulse on the second); the full orchestra returns
  # at src 52.0 = film 48.1 (black flash, frame 1444); natural ending ~film 69.4.
  "${FF[@]}" -ss 3.90 -t $DUR -i "$M/km_exciting_trailer.ogg" -af "$S48,afade=t=in:d=0.05" "$TMP/a1.wav"
  finish "$TMP/a1.wav" "$A/music_aksiyon_alt1.mp3"
}

izmir() {
  # İzmir'in Dağlarında / İzmir Marşı (Takabeg, synthesised solo-melody performance, mono, 4 s bars with silent gaps).
  # Bar 1 (src 0-4) is played twice so the march's own ending (src 63.85) lands at film 67.85, on the end card.
  # Light room echo to soften the dry synth.
  "${FF[@]}" -i "$M/izmir_takabeg.mp3" -filter_complex \
    "[0:a]$S48,asplit=2[x][y];[x]atrim=0:4,asetpts=PTS-STARTPTS[b1];[y]atrim=0:64.8,asetpts=PTS-STARTPTS[b2];\
[b1][b2]concat=n=2:v=0:a=1,aecho=0.85:0.6:45|90:0.18|0.10,afade=t=out:st=68.0:d=2.0[o]" -map "[o]" "$TMP/i.wav"
  finish "$TMP/i.wav" "$A/music_izmir.mp3"
}

mehter() {
  # Ceddin Deden (Mahmoud Gul). Source 3.70 s -> film 0 (first davul at src 3.75). Strong hit at src 61.00 = film 57.30,
  # two frames before the flag climax (frame 1721). The file stops mid-march, so the end is a fade under the end card (65.5-70).
  "${FF[@]}" -ss 3.70 -t $DUR -i "$M/ceddin_deden_gul.ogg" -af "$S48,afade=t=in:d=0.05,afade=t=out:st=65.5:d=4.5" "$TMP/m.wav"
  finish "$TMP/m.wav" "$A/music_mehter.mp3"
  # alt 1: Küre Mehteran Konseri 2020 (field recording from a video). Band only (src 12.40-64.24), the two video-cut dropouts
  # (21.40-21.64, 41.45-41.67) spliced out; to reach 70 s the third segment's head (src 41.67-61.00) plays first and the
  # whole third segment again after the black flash (film 48.13), where the splice is covered by the impact SFX.
  "${FF[@]}" -i "$M/kure_mehteran_2020_audio.webm" -filter_complex \
    "[0:a]$S48,asplit=4[p][q][r][s];\
[p]atrim=12.40:21.40,asetpts=PTS-STARTPTS,afade=t=in:d=0.3,afade=t=out:st=8.985:d=0.015[s1];\
[q]atrim=21.64:41.44,asetpts=PTS-STARTPTS,afade=t=in:d=0.015,afade=t=out:st=19.785:d=0.015[s2];\
[r]atrim=41.67:61.00,asetpts=PTS-STARTPTS,afade=t=in:d=0.015,afade=t=out:st=19.30:d=0.03[s3];\
[s]atrim=41.67:64.24,asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st=19.37:d=2.5[s4];\
[s1][s2][s3][s4]concat=n=4:v=0:a=1[o]" -map "[o]" "$TMP/m1.wav"
  finish "$TMP/m1.wav" "$A/music_mehter_alt1.mp3"
  # alt 2: Sivastopol Marşı (Rifat Bey), historic band-limited (~150 Hz-4.5 kHz) archive recording. Source 17.20 s -> film 0
  # (full band entry at src 17.2); fade 66-70.
  "${FF[@]}" -ss 17.20 -t $DUR -i "$M/sivastopol_marsi.mp3" -af "$S48,afade=t=in:d=0.05,afade=t=out:st=66.0:d=4.0" "$TMP/m2.wav"
  finish "$TMP/m2.wav" "$A/music_mehter_alt2.mp3"
}

for v in "${@:-aksiyon izmir mehter}"; do for w in $v; do echo "$w:"; $w; done; done
