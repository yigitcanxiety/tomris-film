# TOMRİS · MİLLİ versiyonu

Müzik İzmir Marşı. Sıcak ve gururlu; Cumhuriyet'e, Türk gençliğine ve denizcilik hayaline seslenir, kimseye karşı değil.
Resim son kartta büyük bir Atatürk siluetinin önünde başlıkla biter. Makine okunur hali: `versions.json` → `milli`.
Rakamların tek kaynağı `tomris-blender/CEKIM-PLANI.md`; ekip sayısı (beş) son karttaki isimlerden.

## Spiker metni

| # | Başlangıç karesi (sn) | Bitmeli (kare) | Tahmini | Resim | Metin |
|---|---|---|---|---|---|
| 1 | **30** (1,00) | 149 | 2,2 sn | #1 açılış, çizgi profil | Her şey, bir çizgiyle başladı. |
| 2 | **165** (5,50) | 425 | 4,6 sn | #2–#5 liman, gün batımı | İstanbul Teknik Üniversitesi'nden beş Türk genci. Tek bir hayal. |
| 3 | **520** (17,33) | 848 | 3,4 sn | #11–#12 açık deniz | On üç metre, on ton. Gemide tek bir asker yok. |
| 4 | **975** (32,50) | 1443 | 5,4 sn | #24–#26 tel kafes → stüdyo | Yirmi insansız deniz aracı incelendi; her ölçü, hesapla doğrulandı. |
| 5 | **1455** (48,50) | 1714 | 3,2 sn | #39–#41 mavi saat | Cumhuriyet'in gençlerinden, Mavi Vatan'a. |
| 6 | **1757** (58,57) | 2050 | ≈ 8,5 sn | #57–#58 kapanış → son kart, Atatürk silueti | Ey Türk gençliği! Birinci vazifen, Türk istiklâlini, Türk Cumhuriyetini, ilelebet muhafaza ve müdafaa etmektir. |

6 satır, tahmini toplam ≈ 27 sn (sınır 30 sn). Siyah flaşlarda (1444–1447, 1715–1720, 1751–1754) ses yok; bayrak doruğu
(1721–1750) sessiz, yalnız müzik.

**Satır 6 alıntıdır:** Mustafa Kemal Atatürk, *Gençliğe Hitabe* (1927, Nutuk'un sonu), ilk cümle, kelimesi kelimesine.
Siyah flaştan sonraki ilk karede (1757) başlar, kare 2050'ye kadar bitmelidir (son kart 2053'te kararmaya başlar);
yaklaşık 8–8,5 sn'lik okuma gerekir. Sığmazsa alıntı kısaltılmaz (kelimesi değişmiş bir alıntı Atatürk'e atfedilmemeli),
onun yerine bu özgün, atıfsız satır okunur: **"Bu denizler, onu tasarlayan gençlere emanet."** (~2,6 sn, kare 1757).

## Ses yönetimi

- **Kadın, 30–45 yaş** (yedek: sıcak erkek bariton, 40–55). Sıcak, gururlu, içten; tören sunucusu gibi ama abartısız,
  slogan gibi değil. Kimseye meydan okumaz; gençlere ve denize döner.
- Tempo orta; virgüllerde kısa nefes. Satır 2'de "beş Türk genci" ile "Tek bir hayal" arasında belirgin durak.
- Satır 6 ağır, net ve tane tane; "Ey Türk gençliği!" sonrası yarım saniye durak; "ilelebet" ve "müdafaa" açık okunur,
  bağırılmaz. Son kelime marşın son akorundan (kare 2036) hemen önce bitsin.
- Telaffuz: "istiklâl" (uzun â), "Cumhuriyet'in", "Mavi Vatan'a", "TOMRİS".

## Müzik

`tomris-audio/music_izmir.mp3` — İzmir'in Dağlarında / İzmir Marşı, Takabeg icrası (beste kamu malı, icra CC BY-SA 3.0).
Film karesi 0'dan başlar, dosya içi ofset 0. Kazanç −7 dB, spiker altında ~9 dB ducking. Marşın kendi bitişi kare 2036.

⚠ **Zayıf kaynak:** Commons'taki tek İzmir Marşı kaydı sentezlenmiş tek bir ses (mono, bando değil). Bir bando/orkestra
enstrümantal kaydı aynı ada (`tomris-audio/music_izmir.mp3`, ≥ 70 sn, −16 LUFS) konursa bu versiyon aynen çalışır.
Ayrıntı ve kurgu önerisi: `tomris-audio/MUZIK.md`.

## Son kart (kare 1890–2099)

Ortak kart + **büyük Atatürk silueti başlığın arkasında** (ayrı adım hazırlıyor):

- **TOMRİS**
- **TCB-1601**
- Fatma Beyza Şahin · Muhammed Sefa Coşgun · Ekin Çağan Teymur · Tunahan Yaylı · Azra Gülhan
- İTÜ Gemi İnşaatı ve Deniz Bilimleri Fakültesi
- (isteğe bağlı, küçük, fakülte satırının altında) *Mustafa Kemal Atatürk · Gençliğe Hitabe* — yalnız satır 6 alıntı olarak
  okunursa; yedek satır kullanılırsa bu satır kalkar.

## SFX önerileri

Sinematik darbeler yumuşatılır; dalga, rüzgâr, jet aynen kalır.

| Kare | Ses | Kazanç | Not |
|---|---|---|---|
| 354 | `sfx_horn.mp3` (yeni) | −16 dB | mendirekten çıkarken uzak gemi düdüğü |
| 1444, 1715, 1751 | `sfx_impact.mp3` | −12 dB | siyah flaşlar: braam yerine yumuşak timpani vuruşu tercih edilir |
| 1890 | — | — | son kart darbesi yok; marşın son akoru taşısın |
