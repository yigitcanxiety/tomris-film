# TOMRİS · AI ekleme klipleri ve son kart görselleri

Amaç: CG filmin (tomris_v1 / v2) zayıf kaldığı yerlerde — su, sprey, iz, ışık, atmosfer — kısa AI eklemeleriyle reklam hissini artırmak; tekne tasarımını bozmadan. Bütün tekne klipleri **bizim karelerimizden image-to-video** üretildi (başlangıç kareleri `frames/`), böylece tekne bizim modelimiz olarak başlıyor.

- Toplu bakış: `contact.jpg` (her klipten başlangıç / orta / son; sarı çizgiler 2.39:1 kırpım bandı) + bütün durağan görseller.
- Kredi defteri: `LEDGER.md` (her işin kimliği, parametreleri, maliyeti, kararı).
- Klipler 1920×1080, 24 fps, 5 sn, **sessiz** (model ses izi ekliyordu, kopyalarken atıldı; video yeniden kodlanmadı). 2.39:1'e kendimiz kırpıyoruz: 1920×804 bandı, y = 138 (dikey kaydırmayla kadraj ayarlanabilir).
- Başlangıç kareleri 2.39:1 film karesinden 1430×804 orta (veya kaydırılmış) kırpım + 1920×1080'e büyütme. #32 karesi tekneyi kesmeden 16:9'a sığmadığı için bir görüntü-düzenleme işiyle gök + deniz eklenerek genişletildi (`frames/s169_32_f1290_outpaint.png`).

## Model seçimi

Aynı kare (#39, kare 1460) + aynı prompt üç modelde denendi:

| Model | Sonuç |
|---|---|
| **Kling 3.0 Turbo (1080p, 10 kr)** | **seçildi.** Gövde biçimi, renk, direk, bayrak, lançer 5 sn boyunca aynı; "TOMRİS / TCB-1601" okunur kalıyor; sprey ve köpük CG'den belirgin biçimde daha inandırıcı; 1080p. Zaafı: bazı kliplerde kendiliğinden 2,5–3 sn'de **sert kesme** ekliyor ve geniş açı değişiminde tekneyi yeniden yorumluyor (bkz. 03x, 06, 09). "Tek çekim, kesme yok, köprüüstü boş" promptu bunu düzeltti (03, 04). |
| Veo 3.1 Lite (6 sn, 9 kr) | ret: en dramatik su, ama kamera tekneyi geçiyor, radar/direk biçimi değişiyor, yazı kayboluyor. Sadık kısım ~ilk 1,5 sn. |
| Seedance 2.0 Mini (720p, 5 kr) | ret: tekneye en sadık, ama su/köpük CG'den belirgin iyi değil ve 720p — kazanç yok. |

## Klipler

| Dosya | Kaynak çekim / kare | Model | Prompt (özet) | Kredi | Karar | Kullanılabilir aralık | Filmde nerede |
|---|---|---|---|---|---|---|---|
| `clips/01_mavi_saat_yan_takip.mp4` | #39, kare 1460 (v1) | Kling 3.0 Turbo | mavi saat, yanda aynı hızda alçak takip, pruva spreyi, beyaz iz | 10 | tutuldu | 0–5 sn | #39 yerine / #50 ile birlikte |
| `clips/02_pruva_kopuk.mp4` | #14, kare 700 (v1) | Kling 3.0 Turbo | su seviyesinde pruva-karşıdan, iki yana açılan ağır sprey, kamera geri çekilir | 10 | tutuldu | 0–5 sn | #14 yerine ("Saatte otuz beş knot"), #47 alternatifi |
| `clips/03_gunbatimi_alcak_yan_takip.mp4` | #20, kare 866 (yeni render) | Kling 3.0 Turbo | ters ışık gün batımı, alçak yan takip, kıçta yükselen sprey/horoz kuyruğu; tek çekim | 10 | tutuldu | 0–5 sn | #20 yerine/uzatma ("uzaktan ya da tamamen otonom") |
| `clips/03x_gunbatimi_yan_takip_kismi.mp4` | #20, kare 866 | Kling 3.0 Turbo | aynı fikir, ilk prompt | 10 | kısmi | **yalnız 0–2,5 sn** (2,5'te kıç yakın planına kesme; orada kıç aynasına uydurma "TOMRİS" yazısı ve farklı kıç) | #20 kısa alternatif |
| `clips/04_gunbatimi_kontra_gecis.mp4` | #10, kare 505 (yeni render) | Kling 3.0 Turbo | sabit alçak kamera, tekne aynı açıda ilerler, ters ışıkta parlayan sis/sprey; tek çekim, köprüüstü boş | 10 | tutuldu (sadık, hareket az) | 0–5 sn | #10 yerine; CG'ye göre kazanç ılımlı |
| `clips/05_havadan_takip_iz.mp4` | #23, kare 960 (v1) | Kling 3.0 Turbo | alacakaranlık, yukarıdan aynı hızda takip, uzun beyaz köpüklü iz | 10 | tutuldu | 0–5 sn (sağda ince bir çizgi/anten yansıması var, 2.39 kırpımda büyük ölçüde kalır) | #23 yerine; #11/#17 alternatifi |
| `clips/06_liman_gunbatimi_kismi.mp4` | #2, kare 200 (v1) | Kling 3.0 Turbo | liman, vinçler sisli ışıkta, şamandıralar arasında rölantide tekne, yavaş yaklaşma | 10 | kısmi | **yalnız 0–3,0 sn** (3,0'te başka bir tekneye sert kesme — o kısım kullanılmaz) | #2 yerine (tekne küçük, ışık/su daha canlı) |
| `clips/07_direk_bayrak_radar.mp4` | #55, kare 1745 (v1) | Kling 3.0 Turbo | mavi saat, direkte rüzgârda dalgalanan bayrak, seyir fenerleri, yavaş dönen radar | 10 | tutuldu | 0–5 sn (radar dönerken kenardan görünüp an an kamera gibi okunuyor; fizik olarak doğru) | #55 / #58 / #46 |
| `clips/08_kapanis_kahraman_yaklasma.mp4` | #32, kare 1290 (yeni render, 16:9'a genişletilmiş) | Kling 3.0 Turbo | alacakaranlık, bulutlar/dağlar, düz çizgide yavaş yaklaşma, yörünge yok | 10 | tutuldu | 0–5 sn | kapanış: #57 yerine veya son kart öncesi |
| `clips/09_mavi_saat_geri_cekilme.mp4` | #57, kare 1790 (v1) | Kling 3.0 Turbo | mavi saat, arkadan yükselip geri çekilen drone, V izi | 10 | tutuldu (iki çekim) | **0–2,5 sn** geri çekilme; **2,5–5 sn** ayrı geniş havadan çekim (tekne küçük, sorun yok) | #57 yerine / son kart altı |
| `clips/10_plaka_gunbatimi_gunes_yolu.mp4` | — (metinden video) | Kling 3.0 Turbo | ufukta güneş, suda parıldayan güneş yolu, hafif ileri kayma; tekne yok | 10 | tutuldu | 0–5 sn | geçiş, açılış sonrası veya son kart arka planı |
| `clips/11_plaka_dalga_mavi_saat.mp4` | — (metinden video) | Kling 3.0 Turbo | mavi saatte kıran dalga, köpük, damlacıklar; tekne yok | 10 | tutuldu | 0–5 sn (kıyı dalgası karakterinde, açık deniz değil) | #38/#54/#56 siyah flaşların çevresi, A′ bölümüne geçiş |

Reddedilip depoya konmayanlar: #10 ilk deneme (kare 505; ~1,5 sn'den sonra köprüüstünde **insanlar**, yazı "TCG-160" saçmalığı, lançer yer değiştiriyor — yalnız 0–1,25 sn sadık), model testindeki Veo ve Seedance klipleri. İş kimlikleri `LEDGER.md`'de.

## Durağan görseller (`stills/`)

| Dosya | Tür | Model | Kredi | Değerlendirme |
|---|---|---|---|---|
| `endcard_a_aksiyon_1.jpg` (21:9) | son kart A: fırtına ışığı, koyu deniz | Nano Banana (2k) | 2 | iyi; ufuk orta-üstte, alt üçte bir koyu ve boş |
| `endcard_a_aksiyon_2.jpg` (21:9) | son kart A: teal-turuncu, köpüklü dalgalar | Nano Banana | 2 | iyi; en "reklam" duran seçenek |
| `endcard_b_ulusal_1.jpg` (21:9) | son kart B: Atatürk kalpaklı profil silueti | Nano Banana | 2 | **zayıf**: siluet bir burun/kaya üzerinde anıt gibi duruyor, kalpak fazla uzun, profil tanınır değil |
| `endcard_b_ulusal_2.jpg` (16:9) | son kart B: büyük profil sağda, gün batımı | Nano Banana | 2 | kullanılabilir ama benzerlik zayıf; kalpak kutu gibi. **Öneri**: siluet bilinen bir fotoğraftan elle çizilip bu gök/deniz arka planına (veya `endcard_a_*`'ya) bindirilsin — AI benzerliği bu hassas konuda güvenilir değil |
| `endcard_c_osmanli_1.jpg` (21:9) | son kart C: bordo-altın tezhip köşeleri, şemse, kalyon siluetleri | Nano Banana | 2 | iyi; yazı/hat yok; orta-alt boş |
| `endcard_c_osmanli_2.jpg` (16:9) | son kart C: üst-alt rumi bordürler, ortada kalyon | Nano Banana | 2 | iyi; üstteki şemse biraz "güneş/lotus" gibi |
| `doku_altin_toz.jpg` | geçiş dokusu: siyah üstünde altın toz | Nano Banana | 2 | iyi (screen/add ile bindirilir) |
| `doku_deniz_sisi.jpg` | geçiş dokusu: mavi saatte deniz sisi | Nano Banana | 2 | iyi, çok koyu |
| `doku_gun_isigi_su.jpg` | geçiş dokusu: su üstünde altın parıltı | Nano Banana | 2 | iyi |

## Genel yargı

- **Kullanılabilir:** 01, 02, 03, 05, 07, 08 tekneyi değiştirmeden CG'nin yanına kesilebilir; özellikle su/sprey/iz (02, 03, 05) CG'den açıkça daha iyi. Aynı ışık ayarlarından türedikleri için renk eşleştirmesi kolay; yine de AI klipler biraz daha kontrastlı/keskin, hafif grade gerekir.
- **Kısa kullan:** 03x (0–2,5), 06 (0–3,0), 09 (iki parça). Bu modelin kendiliğinden kesme eklemesine dikkat.
- **AI kullanmayın:** yazı yakın planları (#13, #52), detay/ekipman yakınları (#3, #16, #22, #26–#31, #35–#36, #41–#42, #53), köprüüstü camı (#6, #48) ve stüdyo/tel kafes bölümleri (#24–#37). Bunlarda AI ekipmanı ve yazıyı uyduruyor, köprüüstüne insan koyabiliyor; CG zaten güçlü. Büyük yörünge/açı değişimli çekimler de (#25, #37) aynı nedenle CG kalmalı.
