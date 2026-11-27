# TOMRİS filmi: devir notu (buluttan lokale)

Dal: `film-v1`. Bu not, işi lokalde sürdürecek oturum içindir.

## Hedef

Aynı görüntüden üç 70 saniyelik video: `tomris-film/tomris_aksiyon.mp4`, `tomris_milli.mp4`, `tomris_osmanli.mp4`.
Yalnızca müzik, anlatım ve kapanış kartı farklı. Film bir tasarım tanıtımı: insan yok, hedef/atış yok.

## Hazır olanlar

- **Üç bitmiş versiyon (render v2 görüntüsünden, 2. doğrulama turu geçti):** `tomris-film/tomris_aksiyon.mp4`, `tomris_milli.mp4`,
  `tomris_osmanli.mp4`. Her biri H.264 High 1920x1080, 30 fps, 2100 kare, 70.000 sn, AAC 48 kHz, ~68–69 MB, −14.2 LUFS,
  gerçek tepe −2.2 / −2.3 / −1.3 dBFS, tam çözümlemede hata yok. Ölçümler: `tomris-film/versions/last_build.json`.
- Görüntü (render v2, fix1 düzeltmeleriyle, SUB=6): `tomris-film/tomris_v1.mp4` (eski seslendirme miksiyle) ve parçalar
  `tomris-film/chunks/c_00…c_13.mp4`. Render süresi ve ölçümler: `tomris-film/RENDER.md`. Önceki render: `chunks_v1/`.
- Açılış ve son kart (`tomris-overlays/renders/opening.mp4`, `endcard.mp4`) bayrakta hilal-yıldızla yeniden render edildi.
- Çekim başına kare (yeni görüntü): `tomris-film/contact.jpg`; AKSİYON'dan numaralı kare dizisi (2. tur): `tomris-film/contact_v2.jpg`.
- AI eklemeleri (`tomris-film/versions/edit.json`): #14, #20, #23, #39, #57 açık; #55 kapalı (düzeltilmiş CG daha temiz).
  #57'nin bej teknesi nötr mavi-griye çekildi. Her eklemenin ilk/son karesi shots.json'daki çekimle birebir (kontrol edildi).
- MİLLİ son kartı: siluet bütünüyle 2.39 bandında, sağ üçte birde (`versions/endcard_layout.py` →
  `tomris-ai/stills/endcard_b_ulusal_2_layout.jpg`); kartın ufuk çizgisi yüzden önce söner (`card_fade`).
- Kurgu hattı ve ayarlar: `tomris-film/versions/README.md`, `build_versions.sh|py`, `edit.json`.
- Metinler, müzikler, spiker: `versions/versions.json`, `tomris-audio/` (`MUZIK.md`, `versions/VO.md`).
- Hızlı sürümler (eski): `tomris-film/tomris_hizli_*.mp4`.

## Yapılacaklar

1. **İzmir Marşı** (`tomris-audio/music_izmir.mp3`) sentez tek ses; iyi bir bando kaydı aynı adla konursa
   `bash tomris-film/versions/build_versions.sh tomris-film/tomris_v1.mp4 milli` yeter (~1 dk).
2. **Atatürk silueti** AI üretimi; benzerlik zayıf, kalpak kutu gibi. Bilinen bir fotoğraftan elle çizilmiş siluet bulunursa
   `endcard_layout.py`'deki kaynak/ölçek değiştirilir.
3. 2. turdan kalan, kurguda düzeltilemeyen zayıflıklar (3D yeniden render gerektirir):
   #7 şamandıralar düşük poligon; #13 yazı yakın planı düz gri duvar gibi; #27 tekne neredeyse yok (namlu kenarda);
   #23 AI klipte sağda ince çapraz çizgi ve ilk karelerde bozuk "TCB-1601"; #57 AI klipte TOMRİS yazısı su çizgisine yakın.
4. Müzik atıfları (CC BY) sunum/kaynak sayfasına yazılmalı (`tomris-audio/MUZIK.md`); `versions.json`'daki ek SFX dosyaları yok.
5. PR: yigitcanxiety/tomris-film#1 güncel tutulmalı.

## Kurallar

- Tekne görünümü: `tomris-ref/tekne-v3/master_varA_2K.jpg`. Tekne rakamları yalnızca `tomris-blender/CEKIM-PLANI.md`.
- Higgsfield: toplam tavan 400 kredi, 164 harcandı (defter: `tomris-ai/LEDGER.md`).
- Küçük commit'ler, `film-v1` dalına gönder. PR: yigitcanxiety/tomris-film#1.

## Açık sorular (Sefa'ya e-postayla soruldu)

- Raporda iki füze yazıyor, modelde dört var.
- Model gövde derinliği yaklaşık 2 m, raporda 1,7 m.
