# TOMRİS · spiker kayıtları (ElevenLabs)

Model: `eleven_v4`. Kural: her satır bir kez üretilir (generations_count=1, tekrar yok). Araç: `tomris-film/versions/make_vo.py`. Üretilmiş satır: 22.

| Versiyon | Ses | voice_id |
|---|---|---|
| aksiyon | Alp — aksiyon spikeri | `HV5rAif1q1ITHdvxqyMw` |
| milli | GİZEM — kadın, sıcak (milli.md birinci tercih: kadın) | `YHK57o4iMmVGSTo059Sj` |
| osmanli | Seyfullah Kartal — yaşlı (age=old), tok; ağır anlatıcı | `mF7tIc9VLrznhGooGjaT` |

| Versiyon | Satır | Dosya | Süre | Karakter | Metin |
|---|---|---|---|---|---|
| aksiyon | 01 | `tomris-audio/versions/aksiyon/vo_aks_01.mp3` | 1.38 sn | 18 | Önce bir çizgiydi. |
| aksiyon | 02 | `tomris-audio/versions/aksiyon/vo_aks_02.mp3` | 1.65 sn | 25 | Gemide tek bir asker yok. |
| aksiyon | 03 | `tomris-audio/versions/aksiyon/vo_aks_03.mp3` | 3.06 sn | 35 | On üç metre. On ton. Otuz beş knot. |
| aksiyon | 04 | `tomris-audio/versions/aksiyon/vo_aks_04.mp3` | 2.22 sn | 29 | Uzaktan ya da tamamen otonom. |
| aksiyon | 05 | `tomris-audio/versions/aksiyon/vo_aks_05.mp3` | 3.55 sn | 51 | Yirmi insansız araç incelendi. Her ölçü doğrulandı. |
| aksiyon | 06 | `tomris-audio/versions/aksiyon/vo_aks_06.mp3` | 2.3 sn | 24 | Gün biter. Nöbet başlar. |
| aksiyon | 07 | `tomris-audio/versions/aksiyon/vo_aks_07.mp3` | 2.43 sn | 44 | İstanbul Teknik Üniversitesi'nde tasarlandı. |
| aksiyon | 08 | `tomris-audio/versions/aksiyon/vo_aks_08.mp3` | 0.65 sn | 7 | TOMRİS. |
| milli | 01 | `tomris-audio/versions/milli/vo_mil_01.mp3` | 2.32 sn | 30 | Her şey, bir çizgiyle başladı. |
| milli | 02 | `tomris-audio/versions/milli/vo_mil_02.mp3` | 4.34 sn | 64 | İstanbul Teknik Üniversitesi'nden beş Türk genci. Tek bir hayal. |
| milli | 03 | `tomris-audio/versions/milli/vo_mil_03.mp3` | 4.0 sn | 46 | On üç metre, on ton. Gemide tek bir asker yok. |
| milli | 04 | `tomris-audio/versions/milli/vo_mil_04.mp3` | 5.09 sn | 67 | Yirmi insansız deniz aracı incelendi; her ölçü, hesapla doğrulandı. |
| milli | 05 | `tomris-audio/versions/milli/vo_mil_05.mp3` | 2.72 sn | 41 | Cumhuriyet'in gençlerinden, Mavi Vatan'a. |
| milli | 06 | `tomris-audio/versions/milli/vo_mil_06.mp3` | 8.7 sn | 111 | Ey Türk gençliği! Birinci vazifen, Türk istiklâlini, Türk Cumhuriyetini, ilelebet muhafaza ve müdafaa etmektir. |
| osmanli | 01 | `tomris-audio/versions/osmanli/vo_osm_01.mp3` | 2.61 sn | 28 | Her gemi, önce bir çizgidir. |
| osmanli | 02 | `tomris-audio/versions/osmanli/vo_osm_02.mp3` | 3.87 sn | 55 | Barbaros'un yelken açtığı denizlerde, yeni bir nöbetçi. |
| osmanli | 03 | `tomris-audio/versions/osmanli/vo_osm_03.mp3` | 3.5 sn | 33 | On üç metre. On ton. İki su jeti. |
| osmanli | 04 | `tomris-audio/versions/osmanli/vo_osm_04.mp3` | 3.06 sn | 30 | Ne kürek, ne yelken, ne tayfa. |
| osmanli | 05 | `tomris-audio/versions/osmanli/vo_osm_05.mp3` | 5.17 sn | 67 | Yirmi insansız deniz aracı incelendi; her ölçü, hesapla doğrulandı. |
| osmanli | 06 | `tomris-audio/versions/osmanli/vo_osm_06.mp3` | 4.78 sn | 74 | Tersane-i Âmire'nin şehrinde, İstanbul Teknik Üniversitesi'nde tasarlandı. |
| osmanli | 07 | `tomris-audio/versions/osmanli/vo_osm_07.mp3` | 3.29 sn | 40 | Denizlere hâkim olan, cihana hâkim olur. |
| osmanli | 08 | `tomris-audio/versions/osmanli/vo_osm_08.mp3` | 0.84 sn | 7 | TOMRİS. |

Toplam karakter: 926

## Durum (2026-11-27)

- Bu oturumdan üretim yapılamadı: 1. deneme `Free generations are busy right now ... Nothing was charged`, 2. deneme oturumun
  izin denetimince reddedildi. İlk teslim (`tomris_aksiyon.mp4`, commit b2d9c65) bu yüzden eski vo_2/3/4/7 ile çıktı.
- Dosyalar sonra başka bir oturumda üretildi (commit aa65530, `eleven_v4`, yukarıdaki sesler; baş/son sessizlik kırpılmış).
  Hesap kullanımı (free tier): 1387 / 10 000 karakter (metinlerin toplamı ~926 karakter; fark etiketler/denemeler).
- Ek satır üretmek için: `python3 tomris-film/versions/make_vo.py plan`, satır başına bir creative_generate_speech
  (generations_count=1) → creative_get_flow_run_status → `make_vo.py fetch <versiyon> <NN> <url>`.

