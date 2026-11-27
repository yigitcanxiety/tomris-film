# Higgsfield kredi defteri (TOMRİS AI eklemeleri)

Bütçe: en fazla 250 kredi. Her `generate create` öncesi aynı parametrelerle `generate cost` çalıştırıldı.

Hesap başlangıç: **2543.2 kredi** (account status, iş başı)

| # | İş kimliği | Model | Girdi / parametreler | Maliyet | Toplam | Karar |
|---|---|---|---|---|---|---|
| 1 | 31d2f01f | kling3_0_turbo | i2v, #39 kare 1460 (16:9 kırpım), 5 sn, 1080p, 16:9 | 10 | 10 | **seçildi** model testi → `clips/01_mavi_saat_yan_takip.mp4` |
| 2 | 0d8b14ed | veo3_1_lite | i2v, aynı kare + aynı prompt, 6 sn, 16:9, ses kapalı | 9 | 19 | ret: kamera tekneyi geçiyor, radar/direk değişiyor, yazı kayboluyor (ilk ~1,5 sn sadık) |
| 3 | 93d331ee | seedance_2_0_mini | i2v, aynı kare + aynı prompt, 5 sn, 720p, ses kapalı | 5 | 24 | ret: tekne çok sadık ama su/köpük CG'den belirgin iyi değil, 720p |
| 4 | 6a33bec3 | nano_banana_2 | görüntü düzenleme: #32 kare 1290 (2.39:1) → 16:9 genişletme (gök + deniz), 2k | 2 | 26 | tutuldu: kapanış klibinin başlangıç karesi (`frames/s169_32_f1290_outpaint.png`) |
