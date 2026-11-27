# TOMRİS · OSMANLI versiyonu

Müzik mehter. Vakur, klasik bir dil; Osmanlı denizcilik mirasını (Barbaros Hayreddin, Tersane-i Âmire) hürmetle anar,
hiçbir millete ya da topluluğa karşı değildir. Makine okunur hali: `versions.json` → `osmanli`. Rakamların tek kaynağı
`tomris-blender/CEKIM-PLANI.md`.

## Spiker metni

| # | Başlangıç karesi (sn) | Bitmeli (kare) | Tahmini | Resim | Metin |
|---|---|---|---|---|---|
| 1 | **40** (1,33) | 149 | 2,2 sn | #1 açılış, çizgi profil | Her gemi, önce bir çizgidir. |
| 2 | **200** (6,67) | 425 | 4,5 sn | #2–#5 liman, gün batımı | Barbaros'un yelken açtığı denizlerde, yeni bir nöbetçi. |
| 3 | **520** (17,33) | 848 | 3,0 sn | #11–#12 açık deniz | On üç metre. On ton. İki su jeti. |
| 4 | **849** (28,30) | 971 | 2,6 sn | #20 pruva dalgaya biner | Ne kürek, ne yelken, ne tayfa. |
| 5 | **985** (32,83) | 1443 | 6,0 sn | #24–#27 tel kafes → stüdyo | Yirmi insansız deniz aracı incelendi; her ölçü, hesapla doğrulandı. |
| 6 | **1455** (48,50) | 1714 | 6,3 sn | #39–#47 mavi saat | Tersane-i Âmire'nin şehrinde, İstanbul Teknik Üniversitesi'nde tasarlandı. |
| 7 | **1760** (58,67) | 1889 | 3,8 sn | #57–#58 kapanış | Denizlere hâkim olan, cihana hâkim olur. |
| 8 | **1945** (64,83) | 2050 | 0,9 sn | son kart, başlık | TOMRİS. |

8 satır, tahmini toplam ≈ 29 sn (sınır 30 sn; yavaş okunduğu için en sıkı versiyon bu — satır 5 ve 6 için 6 sn'yi geçmeyin).
Siyah flaşlarda (1444–1447, 1715–1720, 1751–1754) ses yok; bayrak doruğu (1721–1750) sessiz, mehter vuruşu (kare 1719) taşır.

- Satır 4 "ne tayfa": teknede mürettebat yok (plan: "Gemide tek bir asker yok"; uzaktan ya da otonom); kürek ve yelken
  yerine su jeti. Şiirsel bir ifade, sayı içermez.
- Satır 6: Tersane-i Âmire, Osmanlı'nın İstanbul Haliç'teki büyük tersanesi; "şehrinde" = İstanbul'da.
- **Satır 7 alıntıdır ve atfedilir:** "Denizlere hâkim olan cihana hâkim olur." yaygın olarak Barbaros Hayreddin Paşa'ya
  atfedilir; kesin bir kaynağı bilinmediği için seslendirmede "Barbaros dedi ki" denmez, son kartta
  "Barbaros Hayreddin Paşa'ya atfedilir" diye yazılır.

## Ses yönetimi

- **Erkek, 55–70 yaş.** Ağır, vakur, sıcak bas; vakanüvis ya da belgesel anlatıcısı. Klasik Türkçe diksiyon:
  "hâkim", "Âmire" uzun â; "cihan" yumuşak. Düşmanlık, öfke ya da meydan okuma yok; hürmet ve sükûnet var.
- Tempo yavaş; cümle sonlarında davulun bir vuruşunu bekler gibi durak. Satır 3'teki üç parça ayrı ayrı, kesmelere oturarak.
- Satır 7 en ağır cümle: "Denizlere hâkim olan," — durak — "cihana hâkim olur."
- Satır 8 alçak, tek kelime.

## Müzik

`tomris-audio/music_mehter.mp3` — *Ceddin Deden*, Mahmoud Gul (Commons), CC BY-SA 4.0. Film karesi 0'dan başlar, dosya içi
ofset 0 (kaynak ofseti 3,70 sn; ilk davul kare 2'de). Kaynaktaki güçlü vuruş **kare 1719**'a, doruğun iki kare önüne düşer.
Kazanç −7 dB, spiker altında **~11 dB** ducking (zurna konuşma bandının ortasında). Kayıt marş ortasında kesildiği için
65,5–70 sn arası çıkışla biter.
Yedekler: `music_mehter_alt1.mp3` (Küre Mehteran Konseri 2020, saha kaydı, CC BY 3.0) ve `music_mehter_alt2.mp3`
(Sivastopol Marşı, Rifat Bey, tarihî kayıt, kamu malı). Ayrıntı: `tomris-audio/MUZIK.md`.

## Son kart (kare 1890–2099)

- **TOMRİS**
- **TCB-1601**
- Fatma Beyza Şahin · Muhammed Sefa Coşgun · Ekin Çağan Teymur · Tunahan Yaylı · Azra Gülhan
- İTÜ Gemi İnşaatı ve Deniz Bilimleri Fakültesi
- (isteğe bağlı, küçük epigraf) “Denizlere hâkim olan cihana hâkim olur.” — Barbaros Hayreddin Paşa'ya atfedilir

## SFX önerileri

Sinematik darbeler yerine kös / büyük davul; dalga ve rüzgâr aynen kalır.

| Kare | Ses | Kazanç | Not |
|---|---|---|---|
| 291 | `sfx_bell.mp3` (yeni) | −16 dB | fenerler yanarken tek gemi çanı |
| 1444, 1715, 1751 | `sfx_kos.mp3` (yeni) | −6 dB | siyah flaşlar: kös vuruşu (sfx_impact yerine) |
| 1890 | `sfx_kos.mp3` | −8 dB | son kart |
