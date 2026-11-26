# TOMRİS · Çekim planı (Blender, ~70 sn)

**Konsept:** Gün batımından mavi saate tek bir akşamda, adı konmamış bir su üstü temasına doğru limandan çıkan TOMRİS'i takip teknesi ve drone gözüyle, hızlı kesmelerle anlatan bir haber-lansman filmi.

**Sabitler:** 2100 kare = 70,00 sn @ 30 fps · 3D render 1861 kare (54 çekim, ort. 1,15 sn; doruk 0,5–0,8 sn) · HyperFrames 225 kare · siyah flaş 14 kare. Render 1920×804 (2.39:1, sensör 36 mm yatay sığdırma), teslim 1920×1080 siyah bantlı. Sert kesme, geçiş efekti yok. Tekne tek `.blend`'den **link** edilir; hiçbir sahnede yerel kopya ya da malzeme değişikliği yapılmaz (tutarlılık garantisi). Gövde mat saten gri, lekesiz; kıç lançerinde füzeler görünür.

## 1. Sahne kurulumları

| Kurulum | Işık | Deniz | Arka plan | Çekimler (kare) |
|---|---|---|---|---|
| **B · Liman, gün batımı kontrası** | Güneş 1°, vinçlerin arkasında (ters ışık); dünya: Nishita gökyüzü Cycles'ta bir kez EXR'ye pişirilir | Sakin, Hs ≈ 0,2 m | 6–8 low-poly vinç silüeti (~2 km), mendirek kutusu + fener, rıhtım ışıkları emisyon küresi (bokeh) | 2–10 (408) |
| **A · Açık deniz, gün batımı** | Güneş 3°, kıç-iskele omzundan sıcak sıyırma; EXR dünya #1; ufuk puslu (mist pass) | Deniz durumu 3, Hs ≈ 0,8 m, köpüklü | Açık ufuk, solda silik ada silüeti (master görseldeki gibi) | 11–23, 27, 29, 32, 34, 36 (594) |
| **A′ · Aynı deniz, mavi saat** | A dosyası; güneş −4°, EXR dünya #2; ana ışık gökyüzü + seyir fenerleri, zayıf soğuk dolgu | Rüzgâr 8 m/s, A'dan biraz sakin | A ile aynı | 39–58, E ve siyahlar hariç (468) |
| **E · EO/IR (A′ varyantı)** | View layer malzeme override: beyaz-sıcak; jet/egzoz ve hedef gövde sıcak | A′ | Bayraksız, adsız genel hedef gövde ufukta (açık soru 4) | 40, 43, 51 (54) |
| **C · Karanlık stüdyo** | Siyah dünya; ana ışık 2×1 m alan ışığı 45° ön-üst; iki şerit arka ışık (biri camgöbeği, biri turuncu) | Yok; parlak siyah zemin (roughness 0,15) | Sonsuz siyah | 26, 28, 30, 31, 33, 35, 37 (232) |
| **W · Tel kafes (C varyantı)** | C ışıkları kısık | Yok | Siyah | 24–25 (105) |

## 2. Çekim tablosu

Bölümler: I Açılış/liman 0–17,1 · II Açık deniz 17,1–32,4 · III Tel kafes 32,4–35,9 · IV Silah 35,9–48,3 · V Doruk 48,3–58,5 · VI Kapanış 58,5–70,0. Kamera yolu için takip teknesi = kamera, tekne kökünü izleyen boş nesneye bağlıdır; "tekneye bağlı" = kamera tekneye parent edilir.

| # | Giriş–çıkış (sn) | Süre sn / kare | Kur. | Kadraj | Kamera (lens, yol, hız) | Tekne | Bayrak | VO / ses | Risk |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.00–3.50 | 3.50 / 105 | HF | Siyah zemin, radar taraması, isimsiz Ege kıyı çizgisi, kırmızı temas noktası | — | — | — | VO1 0,5 sn'de başlar · radyo paraziti, radar bip, alçak drone müzik | Haritada ülke/ada adı yok |
| 2 | 3.50–7.50 | 4.00 / 120 | B | GENİŞ · liman ağzı, vinç silüetleri, güneş iki vinç arasında; tekne sağ 1/3'te küçük | 85 mm · drone 25 m, sağa yanal 1,5 m/s + 0,3 m/s yükselme | 8 kn, trim 0°, sakin iz | Küçük silüet (yavaş bake) | VO1 sürer | Güneş diski bloom'da patlamasın |
| 3 | 7.50–8.70 | 1.20 / 36 | B | DETAY · EO/IR küresi uyanır, 35° döner, lense güneş parlaması | 100 mm · statik + 0,2 m/s itme | 8 kn | — | Servo vızıltısı | Küre pivotu modelde ayrık olmalı |
| 4 | 8.70–9.70 | 1.00 / 30 | B | ORTA · ön planda vinç ışıkları bokeh, arkada tekne odakta soldan sağa | 135 mm · statik, f/1,8 DOF | 8 kn | Görünür | — | DOF örnek sayısı (EEVEE) düşük kalırsa gren |
| 5 | 9.70–10.50 | 0.80 / 24 | B | DETAY · seyir fenerleri yanar (kırmızı/yeşil/beyaz) | 85 mm · tekneye bağlı, statik | 8 kn | Kadraj kenarında | Röle tıkı | Fener = emisyon + küçük nokta ışık |
| 6 | 10.50–11.80 | 1.30 / 39 | B | DETAY · köşk yan camı; içi karanlık ve boş, konsol ekranları sönük mavi; camda vinç ışıkları | 50 mm · tekneye göre kıça yanal 0,6 m/s | 8 kn | — | VO2 "Liman komutanlığından tek bir emir çıktı." | Minimal iç mekân gerekli, yoksa cam opak |
| 7 | 11.80–13.00 | 1.20 / 36 | B | GENİŞ · tepeden 90°, tekne mendirek ağzından çıkar | 35 mm · drone 20 m, tekneyle ileri 5 m/s | 8→12 kn, iz açılır | Üstten görünür | — | Mendirek basit kutu yeter |
| 8 | 13.00–14.20 | 1.20 / 36 | B | DETAY · bayrak, direk, fenerler; güneş arkadan, kumaş ışık geçirir | 135 mm · tekneye bağlı, hafif el titremesi (noise 0,1°) | 12 kn | HERO (yavaş bake) | VO2 "Gemide tek bir asker yok." | Translucency yoksa bayrak kartona döner |
| 9 | 14.20–15.60 | 1.40 / 42 | B | DETAY-ALÇAK · kıç aynası, jetler devreye girer, wash patlar, kıç 2° çömelir, tekne uzaklaşır | 35 mm · su seviyesi +0,3 m, statik | 12→20 kn ivme | Küçük | Jet türbini yükselir → müzik vuruşu | Wash plume shader'ı en zor detay |
| 10 | 15.60–17.10 | 1.50 / 45 | B | GENİŞ · ön planda mendirek feneri, tekne arkasından hızla geçer, silüet | 50 mm · pan takibi 20°/sn | 25 kn, trim 3° pruva yukarı | Gergin silüet | — | — |
| 11 | 17.10–20.60 | 3.50 / 105 | A | GENİŞ · drone 40 m, tekne güneş parıltı yolunda silüet, güneş 3° | 35 mm · drone ileri 18 m/s, tilt 30°→45° | 35 kn, trim 4°, tam Kelvin izi | Küçük | VO3 "On üç metre." · müzik ritmi girer | Okyanus karo tekrarı ufukta görünmesin (sis) |
| 12 | 20.60–21.80 | 1.20 / 36 | A | ORTA · iskele yan, master referans açısı | 50 mm · takip teknesi 15 m yan, 1,2 m yükseklik; tekneyle aynı hız +0,5 m/s öne geçiş, bob 0,3° | 35 kn | Görünür, gergin | VO3 "On ton." | Referans görsele en yakın kare: tutarlılık testi bu |
| 13 | 21.80–22.70 | 0.90 / 27 | A | DETAY · kıç bordası TOMRİS / TCB-1601 yazısı, önünden spray damlaları | 100 mm · takip 6 m, odak yazıda | 35 kn | — | — | İ noktası ve tire doğru olmalı |
| 14 | 22.70–23.70 | 1.00 / 30 | A | GENİŞ-ALÇAK · su seviyesi önden, pruva kameraya gelir, spray lense | 24 mm · 0,4 m yükseklik, geri 16 m/s (tekne 2 m/s kapatır) | 35 kn | Arkada küçük | VO3 "Saatte otuz beş knot." | Lens damlası compositor'da, opsiyon |
| 15 | 23.70–24.70 | 1.00 / 30 | A | GENİŞ · sabit kamera suda, tekne soldan sağa fly-by | 24 mm · statik, geçişte 40° pan | 35 kn | Görünür | Doppler motor geçişi | Motion blur şart |
| 16 | 24.70–25.50 | 0.80 / 24 | A | DETAY · köşk üstü, radar çubuğu döner, arkada güneş | 85 mm · tekneye bağlı statik | 35 kn | Kenarda kırmızı leke | — | — |
| 17 | 25.50–26.60 | 1.10 / 33 | A | GENİŞ · tepeden 90°, tekne kadrajı çaprazlar, V iz | 35 mm · drone 30 m, tekneyle aynı hız, 2°/sn roll | 35 kn | Üstten | — | İz uzunluğu ≥ 60 m görünür |
| 18 | 26.60–27.50 | 0.90 / 27 | A | DETAY · kıç aynası, iki jet wash | 50 mm · takip arkadan 8 m, 0,8 m yükseklik | 35 kn | — | VO3 "İki su jetiyle," | — |
| 19 | 27.50–28.30 | 0.80 / 24 | A | DETAY · bayrak güneş diskinin önünde | 200 mm · alttan, tekneye bağlı | 35 kn | HERO (hızlı bake) | — | — |
| 20 | 28.30–29.50 | 1.20 / 36 | A | ORTA · sancak 3/4 ön; dalgaya biner, pruva kalkar, sert iner, spray perdesi | 50 mm · takip 12 m yan | 35 kn, pitch +6°→−1° / 0,5 sn | Görünür | VO3 "uzaktan ya da tamamen otonom." · slam darbesi | Elle anim; dalga tepesi gövdeyle çakışmasın |
| 21 | 29.50–30.30 | 0.80 / 24 | A | DETAY · chine ve siyah usturmaçayı yalayan su | 35 mm · gövdeden 1 m, alçak takip | 35 kn | — | — | Gövde içine su girmesin (maske) |
| 22 | 30.30–31.20 | 0.90 / 27 | A | ORTA · güverte arkasından köşk üstü, EO/IR + direk silüeti, ufuk | 24 mm · tekneye bağlı, titreşim 0,2° | 35 kn | Kadrajda | — | — |
| 23 | 31.20–32.40 | 1.20 / 36 | A | GENİŞ · drone orbit | 28 mm · 25 m yükseklik, orbit 6°/sn | 35 kn | Küçük | Motor gürlemesi, müzik nefes alır | — |
| 24 | 32.40–34.40 | 2.00 / 60 | W | GENİŞ · siyah; camgöbeği tel kafes yan profil pruvadan kıça çizilerek belirir | 50 mm · dolly 0,3 m/s | Sabit | — | VO "Yirmi insansız deniz aracı incelendi," · elektronik tik | Wireframe modifier + emisyon, maske animasyonu |
| 25 | 34.40–35.90 | 1.50 / 45 | W | ORTA · tel kafesten mat griye geçiş, 3/4 kıç | 35 mm · turntable 20°/sn | Sabit | Yavaş bake (fan) | VO "her ölçü hesapla doğrulandı." | — |
| 26 | 35.90–37.10 | 1.20 / 36 | C | DETAY · STAMP alttan; 40° traverse + 10° yükselme | 85 mm · 0,15 m/s itme | Sabit | — | VO4 "Burnunda ASELSAN STAMP," · servo | Azimut/yükselme pivotları ayrık |
| 27 | 37.10–38.00 | 0.90 / 27 | A | ORTA · silahın arkasından ileri, namlu ön planda, güneşe doğru | 50 mm · tekneye bağlı | 35 kn | — | — | — |
| 28 | 38.00–38.80 | 0.80 / 24 | C | DETAY · namlu ucu makro, rim ışığı parlaması | 135 mm · yanal 0,1 m/s | Sabit | — | VO4 "on iki koma yedi milimetre" | Bevel yoksa kenar sahte görünür |
| 29 | 38.80–39.70 | 0.90 / 27 | A | ORTA · denizde silah yana döner | 85 mm · takip yan 10 m | 35 kn | Görünür | — | — |
| 30 | 39.70–41.20 | 1.50 / 45 | C | ORTA · lançer kalkar 0→25°, 3/4 kıç | 50 mm · turntable 15°/sn | Sabit | — | VO4 "Kıçında iki L-UMTAS füzesi" · hidrolik | Füze sayısı: açık soru 1 |
| 31 | 41.20–42.20 | 1.00 / 30 | C | DETAY · dört füze burnu, odak ön sıra → arka sıra | 100 mm · statik, rack focus | Sabit | — | — | Cam arayıcı burun malzemesi |
| 32 | 42.20–43.20 | 1.00 / 30 | A | GENİŞ · silah + lançer birlikte yan profil, gün batımı | 85 mm · takip 25 m yan | 35 kn | Görünür | — | — |
| 33 | 43.20–44.20 | 1.00 / 30 | C | GENİŞ · lançer tepeden, burunlar hizalı | 50 mm · tepeden, 5°/sn dönüş | Sabit | — | — | — |
| 34 | 44.20–45.10 | 0.90 / 27 | A | ORTA · denizde kalkmış lançer, arkada güneş | 35 mm · tekneye bağlı kıç kamerası | 35 kn | Kadrajda | ÖNERİ VO4 eki "Menzil [MENZİL]." | Değer gelmezse cümle düşer |
| 35 | 45.10–45.90 | 0.80 / 24 | C | DETAY · EO/IR küresi kameraya döner | 100 mm · statik | Sabit | — | — | — |
| 36 | 45.90–46.70 | 0.80 / 24 | A | DETAY · denizde EO/IR camında güneş yansıması | 135 mm · takip | 35 kn | — | — | — |
| 37 | 46.70–48.13 | 1.43 / 43 | C | GENİŞ · tam turntable, parlak siyah zemin yansıması | 35 mm · 30°/sn | Sabit | Yavaş bake | Drop öncesi gerilim | Yansıma: EEVEE raytracing açık |
| 38 | 48.13–48.27 | 0.13 / 4 | K | SİYAH FLAŞ | — | — | — | Ses kesilir | — |
| 39 | 48.27–49.07 | 0.80 / 24 | A' | GENİŞ · mavi saat, fenerler yanık, tekne geçer | 35 mm · whip pan 60°/sn→0 | 35 kn | Görünür | VO5 "Hedef tespit edildi." · müzik drop | — |
| 40 | 49.07–49.77 | 0.70 / 21 | E | EO/IR beyaz-sıcak: ufukta isimsiz hedef silüeti, dijital crash zoom | 400 mm eşdeğeri · zoom 1→3× | — | — | — | Hedef: bayraksız genel gövde (açık soru 4) |
| 41 | 49.77–50.37 | 0.60 / 18 | A' | DETAY · EO/IR küresi hedefe döner | 85 mm · statik | 35 kn | — | — | — |
| 42 | 50.37–50.97 | 0.60 / 18 | A' | DETAY · silah döner, alttan | 50 mm · tekneye bağlı | 35 kn | — | Servo | — |
| 43 | 50.97–51.57 | 0.60 / 18 | E | Kilit: retikül daralır | 400 mm eşd. · statik | — | — | Kilit tonu | Retikül HF'den, yazısız |
| 44 | 51.57–52.27 | 0.70 / 21 | A' | ORTA · lançer kalkar, denizde | 35 mm · kıç kamerası | 35 kn | Kadrajda | VO5 "Görüntü, şifreli bağlantıyla" | — |
| 45 | 52.27–52.87 | 0.60 / 18 | A' | GENİŞ · tepeden, mavi-beyaz iz, fenerler | 24 mm · drone hızlı ileri | 35 kn | Üstten | — | — |
| 46 | 52.87–53.37 | 0.50 / 15 | A' | DETAY · bayrak kırmızı fener ışığında | 135 mm · tekneye bağlı | 35 kn | HERO (hızlı bake) | — | — |
| 47 | 53.37–53.97 | 0.60 / 18 | A' | ALÇAK-ÖN · pruva spray | 24 mm · geri 16 m/s | 35 kn | Arkada | VO5 "anında komuta merkezinde." | — |
| 48 | 53.97–54.47 | 0.50 / 15 | A' | DETAY · köşk camı, içi boş, ekran ışığı | 50 mm · yanal | 35 kn | — | — | — |
| 49 | 54.47–54.97 | 0.50 / 15 | A' | DETAY · jet wash | 50 mm · takip arkadan | 35 kn | — | — | — |
| 50 | 54.97–55.57 | 0.60 / 18 | A' | ORTA · yan takip, hız | 85 mm · takip 18 m/s | 35 kn | Görünür | — | — |
| 51 | 55.57–56.07 | 0.50 / 15 | E | Hedef ortada, kilitli | 400 mm eşd. | — | — | Kilit tonu sürekli | — |
| 52 | 56.07–56.57 | 0.50 / 15 | A' | DETAY · TOMRİS yazısı fener ışığında | 100 mm · takip | 35 kn | — | — | — |
| 53 | 56.57–57.17 | 0.60 / 18 | A' | DETAY · füze burunları yandan | 100 mm · tekneye bağlı | 35 kn | — | — | — |
| 54 | 57.17–57.37 | 0.20 / 6 | K | SİYAH FLAŞ | — | — | — | Sessizlik | — |
| 55 | 57.37–58.37 | 1.00 / 30 | A' | GENİŞ · drone kıçtan direğin yanından pruvanın önüne | 24 mm · drone 25 m/s | 35 kn | Kadrajı süpürür | Müzik zirvesi (açık soru 3: ateşleme burada) | — |
| 56 | 58.37–58.50 | 0.13 / 4 | K | SİYAH FLAŞ | — | — | — | — | — |
| 57 | 58.50–62.50 | 4.00 / 120 | A' | GENİŞ · drone geri çekilip yükselir, tekne ufka, iz, fenerler | 35 mm · geri 3 m/s, 5→40 m yükselme, yavaşlayarak | 35 kn, uzaklaşır | Küçük silüet | VO6 "TOMRİS, İstanbul Teknik Üniversitesi'nde tasarlandı." | — |
| 58 | 62.50–66.00 | 3.50 / 105 | A' | DETAY · direk, bayrak, fenerler, mavi gök | 85 mm · 0,2 m/s itme | 35 kn (tekneye bağlı) | HERO (hızlı bake) | VO "TOMRİS. Denizde, nöbette." | — |
| 59 | 66.00–70.00 | 4.00 / 120 | HF | Son kart: TOMRİS · TCB-1601 logosu, ekip adları, İTÜ Gemi İnşaatı ve Deniz Bilimleri Fakültesi | — | — | — | Müzik kuyruğu | Tek yazılı kare |

## 3. Spiker metni

Satırlar SENARYO'dan; rakamlar yalnız rapordan. Eski ekran HUD'u (35 KN, 2 × 441 kW, menzil halkaları) kalktı, bilgi yalnız seste.

| Çekim | Metin |
|---|---|
| 1–2 | **ÖNERİ** (kısaltma): "Son dakika. Ege'de kimliği belirsiz bir su üstü teması tespit edildi." ("gece saat üçü kırk geçe" gün batımıyla çelişiyor.) |
| 6, 8 | "Liman komutanlığından tek bir emir çıktı. / Gemide tek bir asker yok." |
| 11–20 | "On üç metre. On ton. Saatte otuz beş knot. İki su jetiyle, uzaktan ya da tamamen otonom." |
| 24–25 | **ÖNERİ** (S7'den taşındı): "Yirmi insansız deniz aracı incelendi, her ölçü hesapla doğrulandı." |
| 26–30 | "Burnunda ASELSAN STAMP on iki koma yedi milimetre uzaktan komutalı silah. Kıçında iki L-UMTAS füzesi." |
| 34 | **ÖNERİ** (ek, yalnız değer gelirse): "Menzil [MENZİL]." |
| 39–50 | "Hedef tespit edildi. Görüntü, şifreli bağlantıyla anında komuta merkezinde." |
| 57–58 | **ÖNERİ** (kısaltma): "TOMRİS, İstanbul Teknik Üniversitesi'nde tasarlandı." / "TOMRİS. Denizde, nöbette." |

## 4. Modelin taşıması gereken detaylar

- **Gövde yazısı** (13, 52): iki bordada kıçta "TOMRİS" / "TCB-1601", mat beyaz, eğik çizgi yok, İ noktalı; 100 mm'de okunur (4K decal ya da metin mesh).
- **STAMP** (26–29, 42): kaide, nişan ve mühimmat kutusu, delikli namlu ceketi, ağız freni; bevel 2 mm. Pivotlar `gun_az`, `gun_el`.
- **Lançer** (30–34, 44, 53): `launcher_el` (0→25°), 2+2 tüp, füze master_varA renginde, cam arayıcı burun ayrı malzeme, haç kanatlar. Makroda burun kusursuz olmalı.
- **EO/IR** (3, 35, 36, 41): çatal + küre, IR ve TV penceresi; `eoir_az`, `eoir_el`.
- **Direk** (5, 8, 16, 58): `radar_spin`, kırmızı/yeşil/beyaz fener (emisyon + nokta ışık), antenler, `flag_hoist`.
- **Köşk** (6, 48): koyu cam, boş iç mekân (konsol + sönük ekran, koltuk yok).
- **Kıç** (9, 18, 49): iki jet ağzı + ters kepçe; `jet_L`, `jet_R`.
- **Pruva/chine** (14, 21, 47): keskin chine, spray rayı, usturmaça; `spray_L`, `spray_R`.
- **Malzeme:** tek gövde malzemesi, roughness 0,55–0,65; kir, pas, sürtünme yok.

## 5. Simülasyon

**Okyanus** (Ocean modifier; başlangıç değeri, ilk test karesinde ayarlanır): A = size 100 m, repeat 3×3, render res 10 (kırılma varsa 12, RAM izle), JONSWAP, wind 10 m/s, choppiness 1,0, alignment 0,3, foam açık coverage 0,3; A′ = wind 8; B = wind 4, choppiness 0,6, foam kapalı. Ufuk tekrarını mist pass gizler. Tekne + kamera dünya içinde 18 m/s ilerler. Tekne hareketi noise F-curve (heave ±0,15 m, pitch ±1,5°, roll ±1°, 35 kn'de trim 4°). Gövdeye giren suyu GN tekne-yerel kutu maskesi siler.

**İz ve köpük:** (1) Okyanus foam niteliği → beyaz başlık. (2) Kelvin izi: tekneye bağlı 60 m V düzlemi (yarım açı ~19,5°), GN ile iki sırt, shader'da uzaklıkla sönen noise; UV −hız×zaman kayar, köpük dünyada sabit durur. (3) Jet izi: kıçtan genişleyen 3,5 m beyaz şerit. (4) Pruva spray/slam: GN Simulation Zone, chine'den 3–6 m/s, 0,6 sn ömür, ~5 bin nokta. (5) Jet wash: iki noise'lu koni + spray. Motion blur açık, shutter 0,5.

**Bayrak:** 0,60 × 0,90 m, 36×24 ızgara, gönder kenarı pinli, doku Python'da resmi ölçülerle, kırmızı #E30A17. Cotton preset, mass 0,15, bending 0,1, air viscosity 1,5, quality 10–15, self-collision kapalı. Tekne-yerel sabit sahnede rüzgâr + turbulence (80, size 0,5) ile iki bake, 300'er kare (ilk 60 oturma): **yavaş** (rüzgâr ~200) ve **hızlı** (~1000). Alembic → `flag_hoist`, çekim başına farklı ofset. Çift yüz, translucency 0,3.

**Render:** EEVEE, 64 örnek (doruk 32), screen-trace yansıma, hacim yok, AgX + compositor teal-orange + gren. Önce %50 viewport animatiği, kurgu ve VO kilitlenir. Sonra #12 tam render ile süre ölçülür (5 sn/kare ≈ 2,6 saat; 15 sn ≈ 7,8 saat). Kesme kolu yalnız 2, 11, 57, 58'de ±6 kare.

## 6. HyperFrames

**Var:** #1 radar açılışı (harita, tarama, kırmızı temas; **ÖNERİ:** yalnız burada küçük "SON DAKİKA" künyesi) · #40, 43, 51 EO/IR retikülü (yazısız) · #59 son kart · son kurgu, ses senkronu, bantlar.
**Yok:** bütün 3D çekimler. HUD, rakam, çağrı çizgisi, menzil halkası, alt bant olmaz.

## 7. Açık sorular

1. **Füze sayısı:** rapor ve VO "iki L-UMTAS", master_varA'da dört tüp dolu. Dört füze + VO "iki" mi, iki tüp boş mu, VO "dört" mü?
2. **[MENZİL]:** Sefa değer verecek mi? Gelmezse #34 cümlesi düşer (varsayılan).
3. **Doruk (#55):** gerçek füze ateşlemesi (alev + duman simi, 8 GB'da ek risk) mi, yalnız lançer kalkışı + kilit mi (varsayılan)?
4. **Hedef:** EO/IR'da bayraksız, adsız genel gemi silüeti görünsün mü (basit ek model), yoksa yalnız retikül + boş ufuk mu?
