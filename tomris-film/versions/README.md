# TOMRİS · üç versiyon (AKSİYON · MİLLİ · OSMANLI)

Tek resim → üç bitmiş 70 sn film. Resim (kurgu, AI eklemeleri) üçünde aynı; müzik, spiker ve son kart arka planı değişir.

| Çıktı | Müzik | Spiker | Son kart arka planı |
|---|---|---|---|
| `tomris-film/tomris_aksiyon.mp4` | `music_aksiyon.mp3` (Sascha Ende, CC BY 4.0) | **geçici:** eski vo_2/vo_3/vo_4/vo_7 (silah ve hedef cümleleri vo_5, vo_6 çıkarıldı) | `endcard_a_aksiyon_2` (fırtınalı deniz) |
| `tomris-film/tomris_milli.mp4` | `music_izmir.mp3` (İzmir Marşı, sentez tek ses; biraz daha alçak) | **yok** (üretilemedi) | `endcard_b_ulusal_2` (gün batımında Atatürk silueti, sağda; başlık solunda) |
| `tomris-film/tomris_osmanli.mp4` | `music_mehter.mp3` (Ceddin Deden) | **yok** (üretilemedi) | `endcard_c_osmanli_1` (bordo-altın tezhip, 2.39 bandında, siyah bantlar filmdeki gibi) |

Spiker durumu ve üretim yolu: `tomris-audio/versions/VO.md`.

## Yeni resimle yeniden üretme

```sh
# depo kökünden; resim 1920x1080, 30 fps, tam 2100 kare olmalı (build.sh --edit-only çıktısı)
LEGACY_VO=aksiyon bash tomris-film/versions/build_versions.sh tomris-film/tomris_v1.mp4            # üçü
LEGACY_VO=aksiyon bash tomris-film/versions/build_versions.sh tomris-film/tomris_v1.mp4 aksiyon    # tek versiyon
```

Yeni spiker dosyaları `tomris-audio/versions/<versiyon>/vo_NN.mp3` olarak geldiğinde `LEGACY_VO=aksiyon` kaldırılır.
Versiyon başına süre bu makinede (4 çekirdek, arkada render): ~6 dk. Sonuç ve ölçümler `versions/last_build.json`'a yazılır.

## Ne yapıyor

**Ses** (`build_versions.py` → `build_audio`)
- Metin, kareler, müzik dosyası, müzik seviyesi (`loudness_lufs + gain_db`) ve ducking (`duck_db`): `versions.json` (başka ajanın dosyası; yalnız okunur, şekline uyulur).
- Her spiker satırı kendi başlangıç karesine konur (baştaki sessizlik kırpılır), satırlar −16 LUFS'a eşitlenir.
- Müzik, spiker konuşurken ses otomasyonuyla `duck_db` kadar alçalır (0,25 sn iniş, 0,5 sn çıkış); son 4 sn'de (son kartla) kararır.
- `sfx_waves.mp3` alçak bir katman olarak liman başından (kare 150) son karta kadar.
- Denetim: satır siyah flaşlarla (1444–1447, 1715–1720, 1751–1754) çakışırsa, sonraki satıra ya da `must_end_by_frame`'e taşarsa uyarı (`STRICT=1` ile durur).
- Ses yüksekliği: sabit kazanç + 4× örneklemeli limiter, ölçüp bir kez düzeltme → −14 LUFS, ≤ −2 dBTP (AAC sonrası ≤ −1).
- Her satır için ölçüm: spiker / ducklı müzik / ducksız müzik (aynı pencerede LUFS) — çıktıda yazılır.

**Görüntü** (`build_video`)
- Resim akış kopyası. Yalnız değişen GOP'lar yeniden kodlanır (anahtar karelere hizalı parçalar, build.sh ile aynı x264 ayarı,
  SPS/PPS karşılaştırılır; uyuşmazsa bütün film yeniden kodlanır).
- Son kart (1890–2099): `tomris-overlays/renders/endcard.mp4`, karartılmış, yavaşça yaklaşan duran görüntünün üstüne *screen* karışımıyla.
  Ayarlar `edit.json → endcard_look`: `dim`, `band` / `band_y` / `band_w` (yazı arkası koyu bant), `zoom`, `zoom0`, `shift_x`, `fit`
  (geniş görseli 2.39 bandına sığdır). Görsel yoksa son kart resimdeki gibi kalır.
- AI eklemeleri: `edit.json → inserts` (`all` = üç versiyon). Her kayıt: `from`/`to` (dahil, shots.json'daki çekim kareleri), `clip`,
  `offset` (kaynak sn), `speed` (0.8 = 24 fps kareler 30 fps'te birer kez), `y` (2.39 kırpım bandının üst kenarı, vars. 138),
  `crop`, `box`, `grade` (ffmpeg filtresi), `enabled`. Sert kesme, kare sayısı korunur.

| Çekim | Kareler | Klip |
|---|---|---|
| #14 | 681–710 | `02_pruva_kopuk` |
| #20 | 849–884 | `03_gunbatimi_alcak_yan_takip` |
| #23 | 936–971 | `05_havadan_takip_iz` |
| #39 | 1448–1471 | `01_mavi_saat_yan_takip` |
| #55 | 1721–1750 | `07_direk_bayrak_radar` |
| #57 | 1755–1829 | `08_kapanis_kahraman_yaklasma` (hafif mavi grade) |

## Dosyalar

| Dosya | Ne |
|---|---|
| `build_versions.sh` / `build_versions.py` | boru hattı |
| `edit.json` | bizim ayarlar: son kart görselleri ve görünümü, AI eklemeleri |
| `make_vo.py` | spiker: plan (metin, ses, dosya), indirme ve kayıt (`tomris-audio/versions/VO.md`) |
| `last_build.json` | son derlemenin ölçümleri (LUFS, dBTP, satır başı spiker/müzik, ffprobe) |
| `versions.json`, `aksiyon.md`, `milli.md`, `osmanli.md` | metinler ve müzik kararları (başka ajan) |

Çevre değişkenleri: `LEGACY_VO=aksiyon` (eski spiker), `ONLY_AUDIO=1`, `FULL=1` (bütün resmi yeniden kodla), `STRICT=1`, `KEEP=1`.

## Eksikler

- Yeni spiker yok (bkz. VO.md). AKSİYON eski metinle konuşuyor; MİLLİ ve OSMANLI sessiz anlatımlı.
- `versions.json`'daki ek SFX (riser, kös, çan, düdük, impact) dosyaları yok; uygulanmadı.
- Müzik atıfları (CC BY) son kartta yok; sunumda kaynak sayfasına yazılmalı (bkz. `tomris-audio/MUZIK.md`).
