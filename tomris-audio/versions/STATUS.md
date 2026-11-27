## Durum (2026-11-27)

- Bu oturumdan üretim yapılamadı: 1. deneme `Free generations are busy right now ... Nothing was charged`, 2. deneme oturumun
  izin denetimince reddedildi. İlk teslim (`tomris_aksiyon.mp4`, commit b2d9c65) bu yüzden eski vo_2/3/4/7 ile çıktı.
- Dosyalar sonra başka bir oturumda üretildi (commit aa65530, `eleven_v4`, yukarıdaki sesler; baş/son sessizlik kırpılmış).
  Hesap kullanımı (free tier): 1387 / 10 000 karakter (metinlerin toplamı ~926 karakter; fark etiketler/denemeler).
- Ek satır üretmek için: `python3 tomris-film/versions/make_vo.py plan`, satır başına bir creative_generate_speech
  (generations_count=1) → creative_get_flow_run_status → `make_vo.py fetch <versiyon> <NN> <url>`.
