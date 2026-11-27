# Higgsfield kredi defteri (TOMRİS AI eklemeleri)

Bütçe: en fazla 250 kredi. Her `generate create` öncesi aynı parametrelerle `generate cost` çalıştırıldı.

Hesap başlangıç: **2543.2 kredi** (account status, iş başı)

| # | İş kimliği | Model | Girdi / parametreler | Maliyet | Toplam | Karar |
|---|---|---|---|---|---|---|
| 1 | 31d2f01f | kling3_0_turbo | i2v, #39 kare 1460 (16:9 kırpım), 5 sn, 1080p, 16:9 | 10 | 10 | **seçildi** model testi → `clips/01_mavi_saat_yan_takip.mp4` |
| 2 | 0d8b14ed | veo3_1_lite | i2v, aynı kare + aynı prompt, 6 sn, 16:9, ses kapalı | 9 | 19 | ret: kamera tekneyi geçiyor, radar/direk değişiyor, yazı kayboluyor (ilk ~1,5 sn sadık) |
| 3 | 93d331ee | seedance_2_0_mini | i2v, aynı kare + aynı prompt, 5 sn, 720p, ses kapalı | 5 | 24 | ret: tekne çok sadık ama su/köpük CG'den belirgin iyi değil, 720p |
| 4 | 6a33bec3 | nano_banana_2 | görüntü düzenleme: #32 kare 1290 (2.39:1) → 16:9 genişletme (gök + deniz), 2k | 2 | 26 | tutuldu: kapanış klibinin başlangıç karesi (`frames/s169_32_f1290_outpaint.png`) |
| 5 | 27a06d21 | kling3_0_turbo | i2v, #14 kare 700, 5 sn, 1080p, 16:9 — pruva-karşıdan sprey | 10 | 36 | (bkz. alttaki not) |
| 6 | be30dcf2 | kling3_0_turbo | i2v, #20 kare 866 (yeni render), 5 sn, 1080p | 10 | 46 | kısmi: 2,5 sn'de sert kesme + kıç aynasına uydurma "TOMRİS" → yalnız 0–2,5 sn (`03x_…kismi`) |
| 7 | 3220a974 | kling3_0_turbo | i2v, #10 kare 505 (yeni render), 5 sn, 1080p | 10 | 56 | **ret**: ~1,5 sn'den sonra köprüüstünde insan, yazı "TCG-160" saçmalığı, lançer yer değiştiriyor (indirilmedi, depoda yok) |
| 8 | 0d8c8c79 | kling3_0_turbo | i2v, #23 kare 960, 5 sn, 1080p | 10 | 66 | **tutuldu** `05_havadan_takip_iz` |
| 9 | 9e5a4075 | kling3_0_turbo | i2v, #2 kare 200, 5 sn, 1080p | 10 | 76 | kısmi: 3,0 sn'de başka bir tekneye sert kesme → yalnız 0–3,0 sn (`06_…kismi`) |
| 10 | 1a6dfe32 | kling3_0_turbo | i2v, #55 kare 1745, 5 sn, 1080p | 10 | 86 | **tutuldu** `07_direk_bayrak_radar` (radar gerçekten dönüyor; kenardan görünüşü bir an kameraya benziyor) |
| 11 | c65838ff | kling3_0_turbo | i2v, #32 kare 1290 → genişletilmiş 16:9 kare (iş 4), 5 sn, 1080p | 10 | 96 | **tutuldu** `08_kapanis_kahraman_yaklasma` |
| 12 | 6cc4a5d5 | kling3_0_turbo | i2v, #57 kare 1790, 5 sn, 1080p | 10 | 106 | **tutuldu** (iki parça: 0–2,5 sn geri çekilme, 2,5 sn'de kesme, 2,5–5 sn geniş havadan) `09_…` |
| 13 | 1b96bae5 | nano_banana_2 | t2i 21:9 2k — son kart A aksiyon 1 | 2 | 108 | tutuldu |
| 14 | c46a04c9 | nano_banana_2 | t2i 21:9 2k — son kart A aksiyon 2 | 2 | 110 | tutuldu |
| 15 | 57fc56a9 | nano_banana_2 | t2i 21:9 2k — son kart B ulusal 1 | 2 | 112 | zayıf (bkz. README) |
| 16 | 23930da9 | nano_banana_2 | t2i 16:9 2k — son kart B ulusal 2 | 2 | 114 | zayıf/kullanılabilir (bkz. README) |
| 17 | 5f0593ca | nano_banana_2 | t2i 21:9 2k — son kart C Osmanlı 1 | 2 | 116 | tutuldu |
| 18 | c4777e6a | nano_banana_2 | t2i 16:9 2k — son kart C Osmanlı 2 | 2 | 118 | tutuldu |
| 19 | ede52815 | nano_banana_2 | t2i 16:9 2k — doku: altın toz | 2 | 120 | tutuldu |
| 20 | 549a12da | nano_banana_2 | t2i 16:9 2k — doku: deniz sisi | 2 | 122 | tutuldu |
| 21 | 041e97c7 | nano_banana_2 | t2i 16:9 2k — doku: gün ışığı su | 2 | 124 | tutuldu |
| 22 | bb918d5d | kling3_0_turbo | i2v, #10 kare 505, sıkı süreklilik promptu (tek çekim, köprüüstü boş), 5 sn, 1080p — bilinçli tek tekrar | 10 | 134 | **tutuldu** `04_gunbatimi_kontra_gecis` (sadık ama hareket az) |
| 23 | e92b7cac | kling3_0_turbo | i2v, #20 kare 866, sıkı süreklilik promptu, 5 sn, 1080p — bilinçli tek tekrar | 10 | 144 | **tutuldu** `03_gunbatimi_alcak_yan_takip` |
| 24 | 8c5b95fc | kling3_0_turbo | t2v plaka: gün batımı güneş yolu, 5 sn, 1080p | 10 | 154 | **tutuldu** `10_plaka_…` |
| 25 | a4487914 | kling3_0_turbo | t2v plaka: mavi saat dalga, 5 sn, 1080p | 10 | 164 | **tutuldu** `11_plaka_…` |

Ara kontrol (account status, 25 iş sonrası): **2379.2 kredi** → harcanan 164.0 (deftere birebir uyuyor).
