# TOMRİS filmi: devir notu (buluttan lokale)

Dal: `film-v1`. Bu not, işi lokalde sürdürecek oturum içindir.

## Hedef

Aynı görüntüden üç 70 saniyelik video: `tomris-film/tomris_aksiyon.mp4`, `tomris_milli.mp4`, `tomris_osmanli.mp4`.
Yalnızca müzik, anlatım ve kapanış kartı farklı. Film bir tasarım tanıtımı: insan yok, hedef/atış yok.

## Hazır olanlar

- İlk kurgu (görüntü + eski seslendirme): `tomris-film/tomris_v1.mp4`.
- Hızlı sürümler (ilk kurgu + müzik, eski seslendirme): `tomris-film/tomris_hizli_aksiyon.mp4`, `_milli.mp4`, `_osmanli.mp4`.
- Üç versiyonun metinleri, kare zamanları, müzik eşlemesi: `tomris-film/versions/versions.json`, `aksiyon.md`, `milli.md`, `osmanli.md`.
- 70 sn müzikler: `tomris-audio/music_aksiyon.mp3`, `music_izmir.mp3`, `music_mehter.mp3` (kaynaklar: `tomris-audio/MUZIK.md`).
  `music_izmir.mp3` zayıf (tek sesli sentetik kayıt); iyi bir bando kaydı bulunursa aynı adla değiştir.
- Yapay zekâ klipleri ve kapanış görselleri: `tomris-ai/` (tablo `tomris-ai/README.md`, önizleme `tomris-ai/contact.jpg`).
- Kurgu hattı (yarım olabilir, önce oku): `tomris-film/versions/build_versions.sh`, `build_versions.py`, `edit.json`.
- İlk doğrulama turunun düzeltmeleri kodda (önce/sonra: `tomris-film/fix1_contact.jpg`); bunlarla film baştan render edilmeli.

## Yapılacaklar (sırayla)

1. **Render (düzeltilmiş görüntü).** `tomris-film/RENDER.md` dosyasını oku, sonra:
   `SUB=6 FORCE=1 HF_ARGS="--browser-gpu" bash tomris-film/build.sh --render-only`
   ardından `SUB=6 bash tomris-film/build.sh --edit-only` → `tomris-film/tomris_v1.mp4` yenilenir.
   Önce tek parça dene: `CHUNKS="7" SUB=6 FORCE=1 HF_ARGS="--browser-gpu" bash tomris-film/build.sh --render-only`.
2. **Yapay zekâ kliplerini görüntüye yerleştir** (çekim kareleri `tomris-shots/shots.json`):
   #14 ← `02_pruva_kopuk`, #20 ← `03_gunbatimi_alcak_yan_takip`, #23 ← `05_havadan_takip_iz`,
   #39 ← `01_mavi_saat_yan_takip`, #55 ← `07_direk_bayrak_radar`, #57 ← `08_kapanis_kahraman_yaklasma`.
   Klipler 24 fps: 120 kareyi 30 fps olarak oynat (`setpts=PTS*0.8`), 2.39:1 banda kırp (1920x804, y=138),
   komşu planlara göre hafif renk eşle. Kısmi klipleri yalnızca README'deki aralıkta kullan. Toplam 2100 kare kalmalı.
3. **Seslendirme.** `versions.json` içindeki cümleleri üç ayrı sesle üret (aksiyon: derin fragman sesi;
   milli: sıcak, gururlu; Osmanlı: ağır, yaşlı anlatıcı). Dosyalar: `tomris-audio/versions/<versiyon>/vo_NN.mp3`.
   Siyah karelerde (1444-1447, 1715-1720, 1751-1754) anlatım olmaz.
4. **Kapanış kartları.** Mevcut kart `tomris-overlays/renders/endcard.mp4` (koyu zemin, açık yazı) şu görsellerin
   üzerine "screen" ile bindirilir: aksiyon `tomris-ai/stills/endcard_a_aksiyon_2`, milli `endcard_b_ulusal_2`
   (Atatürk silüeti; zayıf, daha iyi bir silüet görseli bulunursa değiştir), Osmanlı `endcard_c_osmanli_1`.
5. **Miks ve çıktı.** Müzik anlatımın altında kısılır; yaklaşık -14 LUFS, tepe ≤ -1 dBFS.
   H.264, 1920x1080, 30 fps, 2100 kare, AAC 48 kHz, her dosya < 90 MB.
6. **Kontrol.** Her videodan kareler çıkarıp bak: tekne kesmelerde değişmemeli, yazı okunmalı, kapanış yazısı okunmalı.

## Kurallar

- Tekne görünümü: `tomris-ref/tekne-v3/master_varA_2K.jpg`. Tekne rakamları yalnızca `tomris-blender/CEKIM-PLANI.md`.
- Higgsfield: toplam tavan 400 kredi, 164 harcandı (defter: `tomris-ai/LEDGER.md`).
- Küçük commit'ler, `film-v1` dalına gönder. PR: yigitcanxiety/tomris-film#1.

## Açık sorular (Sefa'ya e-postayla soruldu)

- Raporda iki füze yazıyor, modelde dört var.
- Model gövde derinliği yaklaşık 2 m, raporda 1,7 m.
