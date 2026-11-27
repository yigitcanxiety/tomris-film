# TOMRİS · AKSİYON versiyonu

Fragman dili: soğukkanlı, iddialı, heyecanlı. Kısa cümleler, aralarında müziğe uzun boşluk. Resim aynı; yalnız müzik,
spiker ve son kart değişir. Makine okunur hali: `versions.json` → `aksiyon`. Rakamların tek kaynağı
`tomris-blender/CEKIM-PLANI.md` (13 m, 10 ton, 35 knot, iki su jeti, uzaktan/otonom, 20 araç incelendi, ölçüler hesapla
doğrulandı, İTÜ'de tasarlandı, gemide asker yok). Silah, menzil, hedef yok.

## Spiker metni

| # | Başlangıç karesi (sn) | Bitmeli (kare) | Tahmini | Resim | Metin |
|---|---|---|---|---|---|
| 1 | **45** (1,50) | 149 | 1,4 sn | #1 açılış, çizgi profil | Önce bir çizgiydi. |
| 2 | **318** (10,60) | 425 | 1,8 sn | #6 köşk camı, içi boş | Gemide tek bir asker yok. |
| 3 | **513** (17,10) | 680 | 3,0 sn | #11–#13 açık deniz | On üç metre. On ton. Otuz beş knot. |
| 4 | **849** (28,30) | 971 | 2,3 sn | #20 pruva dalgaya biner | Uzaktan ya da tamamen otonom. |
| 5 | **972** (32,40) | 1140 | 4,0 sn | #24–#25 tel kafes | Yirmi insansız araç incelendi. Her ölçü doğrulandı. |
| 6 | **1452** (48,40) | 1714 | 1,8 sn | #39 mavi saat, siyah flaştan hemen sonra | Gün biter. Nöbet başlar. |
| 7 | **1758** (58,60) | 1889 | 3,2 sn | #57 drone geri çekilir | İstanbul Teknik Üniversitesi'nde tasarlandı. |
| 8 | **1940** (64,67) | 2050 | 0,8 sn | son kart, TOMRİS harfleri yükselirken | TOMRİS. |

8 satır, tahmini toplam ≈ 18 sn (sınır 30 sn). Siyah flaşlarda (1444–1447, 1715–1720, 1751–1754) ses yok; doruk
(1721–1750) bilerek sessiz, yalnız müzik vuruşu.

Satır 3'teki üç parça, kesmelere oturacak şekilde aralıklı okunur: "On üç metre." (#11) · "On ton." (#12'ye, kare 618
civarı) · "Otuz beş knot." (#14'e, kare 681 civarı). Tek dosya olarak üretilirse duraklar ~0,6 sn olsun; mix adımı
isterse eski vo_3 gibi sessizliklerden bölebilir.

## Ses yönetimi

- **Erkek, 35–45 yaş.** Derin, hafif kısık, fragman spikeri; bağırmadan, soğukkanlı ve kendinden emin.
- Tempo yavaş; her cümleden sonra nefes. Nokta = tam durak. Vurgular: "**tek** bir asker", "**on üç** metre", "**otonom**",
  "**yirmi**", "**nöbet**", "**TOMRİS**".
- Satır 8 tek kelime, alçak ve yakın (mikrofona yakın, hafif fısıltıya yakın), müzikteki son vuruşun önünde.
- Telaffuz: "TOMRİS" (Tom-ris, İ noktalı), "knot" (not değil, k'siz değil: "knot"), "otonom".

## Müzik

`tomris-audio/music_aksiyon.mp3` — Sascha Ende, *Cinema Blockbuster Trailer 3 (F60 long edit)*, CC BY 4.0.
Film karesi 0'dan başlar, dosya içi ofset 0 (kurgu dosyada yapılmış; kaynak ofseti 13,40 sn). Kazanç −4 dB, spiker altında
~10 dB ducking. Müzik vuruşları: kare 10, **1720** (bayrak doruğu), **1900** (son kart), 2041; en yüksek bölüm film 57–62 sn.
Yedek: `music_aksiyon_alt1.mp3` (Kevin MacLeod, *Exciting Trailer*, CC BY 3.0; büyük dönüş kare 1444'te). Ayrıntı:
`tomris-audio/MUZIK.md`.

## Son kart (kare 1890–2099)

Mevcut kart (`tomris-overlays/endcard/`), değişiklik yok:

- **TOMRİS**
- **TCB-1601**
- Fatma Beyza Şahin · Muhammed Sefa Coşgun · Ekin Çağan Teymur · Tunahan Yaylı · Azra Gülhan
- İTÜ Gemi İnşaatı ve Deniz Bilimleri Fakültesi

(Atıf zorunluluğu olan müzik için kartın sonuna ya da sunumun kaynak sayfasına: "Müzik: Sascha Ende — Cinema Blockbuster
Trailer 3, CC BY 4.0".)

## SFX önerileri

Mevcut yuvalar (dalga, rüzgâr, jet, radar, darbe) aynen kalır; ek olarak:

| Kare | Ses | Kazanç | Not |
|---|---|---|---|
| 930 | `sfx_riser.mp3` (yeni) | −14 dB | tel kafese geçişten önce 1,4 sn yükselen whoosh |
| 1444 | `sfx_impact.mp3` | −4 dB | ilk siyah flaş: derin braam / sub drop |
| 1660 | `sfx_riser.mp3` | −12 dB | doruğa gerilim, 1715'te keskin kesilir (siyah flaşta tam sessizlik) |
| 1721 | `sfx_impact.mp3` | −6 dB | bayrak doruğu, müzik vuruşuyla aynı kare |
| 1940 | `sfx_impact.mp3` | −9 dB | TOMRİS başlığı belirirken |
