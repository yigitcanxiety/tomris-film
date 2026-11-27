# TOMRİS · müzik (üç versiyon)

Hepsi Wikimedia Commons'tan indirilmiş gerçek kayıtlar (yapay zekâ üretimi yok). Kurgu, kesme ve ses seviyesi
`tomris-audio/music_build.sh` ile yeniden üretilir: her yatak 70,0 sn, 48 kHz stereo, −16 LUFS (entegre), tepe ≤ −1,5 dBFS,
MP3 256 kb/s. (MP3 kodlayıcı dolgusu yüzünden ffprobe 70,03 sn gösterir; `mix.sh` zaten 70,0 sn'de keser.)
Kaynak dosyalar `music_src/` içinde. Commons orijinallerinin bir kısmı indirme sınırına (HTTP 429) takıldığı için
Commons'un kendi dönüştürülmüş kopyası (`/transcoded/…`) alındı; hangisi olduğu aşağıda yazıyor.

Kare = film karesi (30 fps). Doruk = kare 1721 (57,37 sn), son kart = kare 1890 (63,0 sn).

## 1 · AKSİYON → `music_aksiyon.mp3`

| | |
|---|---|
| Eser | *Cinema Blockbuster Trailer 3 (F60 LONG EDIT)* |
| Sahibi | Sascha Ende (filmmusic.io) |
| Lisans | CC BY 4.0 — atıf: "Cinema Blockbuster Trailer 3 by Sascha Ende, CC BY 4.0" |
| Sayfa | https://commons.wikimedia.org/wiki/File:Cinema_Blockbuster_Trailer_3_(F60_LONG_EDIT)_by_Sascha_Ende.ogg |
| Dosya | `music_src/ende_blockbuster3_f60.mp3` (Commons'un MP3 dönüşümü; orijinal OGG, 93,5 sn) |
| Kesit | kaynak 13,40 → 83,40 sn; 0,15 sn giriş, 67,6–70 sn çıkış (fade) |

Neden bu kesit: parça 75. saniyeye kadar sürekli büyüyen bir fragman yapısında (ölçülen kısa süreli ses yüksekliği
−11 → −6 LUFS). 13,40 sn ofsetiyle vuruşlar resme oturuyor: kaynak 13,75 → **kare 10** (açılış), 70,75 → **kare 1720**
(bayrak doruğu, 1721'e bir kare), 76,75 → **kare 1900** (son kart), son vuruş 81,45 → kare 2041; ardından sönüyor.
En yüksek bölüm film 57–62 sn (doruk + kapanış).

**Yedek 1 · `music_aksiyon_alt1.mp3`** — Kevin MacLeod, *Exciting Trailer* (ISRC USUAN1100494), CC BY 3.0
(atıf: "Exciting Trailer — Kevin MacLeod (incompetech.com), CC BY 3.0"),
https://commons.wikimedia.org/wiki/File:Exciting_Trailer_(ISRC_USUAN1100494).mp3 · dosya `music_src/km_exciting_trailer.ogg`
(Commons OGG dönüşümü). Kaynak 3,90 sn → film 0. Saniyede bir trampet darbesi; lirik ara bölümden sonra tam orkestra
kaynak 52,0 sn'de döner = **kare 1444** (ilk siyah flaş). Kendi doğal bitişi ~film 69,4 sn. Doruğu 1721'de değil
1444'te; daha "marş"lı, daha az modern.

Bakılıp elenenler: Rafael Krux *Epic Trailer* (düz, vuruşsuz büyüme), *Dramatic Trailer* (baştan sona −6 LUFS, nefes yok),
Kevin MacLeod *Strength of the Titans* (61,9 sn, kısa; indirme 429'a takıldı).

## 2 · MİLLİ → `music_izmir.mp3` ⚠ zayıf kaynak

| | |
|---|---|
| Eser | *İzmir'in Dağlarında* / İzmir Marşı (Kafkas Marşı'ndan, 1914/1922; beste: Commons sayfasına göre Mehmet Ali Bey ya da İzzettin Hümayi Elçioğlu) |
| İcra | Commons kullanıcısı Takabeg, 2012 |
| Lisans | beste kamu malı (PD-Ottoman); icra CC BY-SA 3.0 (Takabeg) |
| Sayfa | https://commons.wikimedia.org/wiki/File:%C4%B0zmir%27in_Da%C4%9Flar%C4%B1nda_(Takabeg).ogg |
| Dosya | `music_src/izmir_takabeg.mp3` (Commons MP3 dönüşümü; orijinal OGG 64,8 sn) |
| Kesit | ilk 4 sn'lik ölçü iki kez, sonra parçanın tamamı; marşın kendi bitişi **kare 2036**'da (son kartta); hafif oda yankısı eklendi |

**Uyarı:** Commons'ta İzmir Marşı'nın bando, orkestra ya da vokal **gerçek bir kaydı yok**. Bulunan iki dosya:
bu Takabeg icrası ve `Izmir.mid` (MIDI, kayıt değil). Takabeg dosyası spektrogramda açıkça **sentezlenmiş tek ses**:
mono, sabit dalga biçimli saf harmonikler, her 4 sn'de bir tam sessizlik, baştan sona sabit −6 LUFS. Melodi doğru
ve kullanılabilir, ama bando gibi değil; bir tören filmi kapanışı için zayıf. "İzmir", "Izmir Marsi", "Izmir March",
"İzmir'in dağlarında", bando/ordu/donanma bandosu, video aramalarında başka sonuç çıkmadı.

**Sahibin koyması gereken dosya:** İzmir Marşı'nın bir askerî bando ya da orkestra enstrümantal kaydı
(ör. bir TSK bandosu icrası), en az 70 sn, aynı adla `tomris-audio/music_izmir.mp3` olarak (−16 LUFS, 48 kHz stereo
idealdir; olmazsa `music_build.sh`'ye ham dosyayı `music_src/` altına koyup `izmir()` bölümünü ona çevirmek yeter).
Kurgu önerisi: güçlü bir nakarat girişi kare 1721'e (57,37 sn), marşın son akoru son kartta 66–68 sn'ye.
Yedek yok (İstiklâl Marşı fon müziği olarak kullanılmamalı; bu yüzden eklenmedi).

## 3 · OSMANLI → `music_mehter.mp3`

| | |
|---|---|
| Eser | *Ceddin Deden* (mehter marşı) |
| İcra / yükleyen | Mahmoud Gul (Commons'ta "own work", 2023-12-01, kategori: Mehter) |
| Lisans | CC BY-SA 4.0 |
| Sayfa | https://commons.wikimedia.org/wiki/File:Ceddin_Deden.ogg |
| Dosya | `music_src/ceddin_deden_gul.ogg` (orijinal, 136 sn, 48 kHz stereo) |
| Kesit | kaynak 3,70 → 73,70 sn; çıkış 65,5–70 sn (fade) |

Neden bu kesit: kayıt 3,75. saniyede ilk davul darbesiyle başlıyor (ofset 3,70 → kare 2), ve kaynak 61,00 sn'deki
güçlü vuruş **kare 1719**'a düşüyor (doruk 1721'den iki kare önce). Mehter baştan sona sabit yoğunlukta (LRA 1,4 LU),
yani doruğu müzik değil vuruşlar ve SFX taşır. Dosya marş ortasında kesildiği için doğal bitiş yok; son kartta
4,5 sn'lik çıkışla bitiyor. Spektrum ~11 kHz'de kesik (kaynağı muhtemelen sıkıştırılmış bir kayıt), zurna ve davul net.

**Yedek 1 · `music_mehter_alt1.mp3`** — *Küre Mehteran Konseri, 23 Nisan 2020*, OtuzYedi TV (kaynak: Küre Kaymakamlığı),
CC BY 3.0, https://commons.wikimedia.org/wiki/File:K%C3%BCre_Mehteran_Konseri,_23_Nisan_2020.webm · dosya
`music_src/kure_mehteran_2020_audio.webm` (videonun 480p dönüşümünden ses akışı, yeniden kodlamadan). Açık hava saha kaydı,
daha canlı ama daha kirli. Videodaki iki kesme boşluğu (kaynak 21,40–21,64 ve 41,45–41,67 sn) çıkarıldı; 70 sn'ye
ulaşmak için üçüncü bölümün başı (41,67–61,00) kare 1444'e kadar, bölümün tamamı siyah flaştan sonra yeniden çalınıyor
(ek yeri flaşın darbe sesinin altında).

**Yedek 2 · `music_mehter_alt2.mp3`** — *Sivastopol Marşı*, Rifat Bey, tarihî kayıt, kamu malı,
https://commons.wikimedia.org/wiki/File:Sivastopol_Mar%C5%9F%C4%B1_-_19th_Century_Turkish_Military_Music.opus
(Commons'a göre YouTube'dan arşivlenmiş) · dosya `music_src/sivastopol_marsi.mp3` (Commons MP3 dönüşümü).
Bant genişliği ~150 Hz–4,5 kHz (eski plak sesi). Kaynak 17,20 sn → film 0 (bandonun tam girişi), 66–70 sn çıkış.
Mehter değil, 19. yy askerî marşı; "eski kayıt" dokusu isteniyorsa.

Bakılıp elenenler: *Mehteran military band MSPO2* (19,8 sn, mono 32 kHz, kısa), *Vatan Marşı* (Mızıka-i Hümayun; Commons'taki
lisans bilgisi şüpheli, ticari bir albümden), Mahmudiye/Mecidiye/Hamidiye marşları (saray marşı, mehter değil).
"Hücum Marşı", "Estergon Kalesi", "Mehter Marşı" adıyla Commons'ta ses dosyası yok.

## Mix notu

`versions.json` her versiyon için `gain_db` (mix.sh'deki müzik kanalı kazancı; bugünkü değer −6) ve `duck_db` (spiker
konuşurken müziğin inmesi gereken miktar; mix.sh bugün ~9 dB yapıyor) verir. Mehter zurnası konuşma bandının ortasında
olduğu için OSMANLI'da daha derin (11 dB) ducking öneriliyor.
