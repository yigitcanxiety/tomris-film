# TOMRİS · Sürüş ve fotoğraf

TOMRİS'i (TCB-1601) denizde sürüp fotoğrafını çektiğin küçük, oynanabilir bir sayfa. Tanıtım filmini çizen
three.js motorunu (`tomris-three/assets/js/`) ve aynı varlıkları (tekne modeli, gökyüzü HDRI'ları, şamandıralar,
film görüntüsünün renk ayarları) kullanır. Kurulum, derleme ya da npm yok.

## Çalıştırma

Depo kökünde:

```sh
python3 -m http.server 8000
```

sonra tarayıcıda **http://localhost:8000/tomris-play/** adresini aç. (WebGL2 gerekir: güncel Chrome, Edge, Firefox
ya da Safari; donanım hızlandırma açık olmalı.)

İsteğe bağlı adres parametreleri: `?look=harbour` / `?look=bluehour` (başlangıç saati), `?scale=0.7` (sabit
çözünürlük ölçeği, uyarlanır ölçeği kapatır), `?debug=1` (kare süresi ve ölçek), `?intro=0` (rehberi gösterme),
`?touch=1` (dokunmatik denetimleri masaüstünde de göster), `?quality=film` (film kalitesi, çok yavaş).

## Denetimler

| Tuş | İş |
|---|---|
| W · ↑ | gazı aç (kol: bırakınca yerinde kalır) |
| S · ↓ | gazı kıs; sıfırda durur, yeniden basınca geri vites |
| A · ← / D · → | dümen iskeleye / sancağa (bırakınca ortalanır) |
| C | kamera: takip ↔ serbest |
| P | fotoğraf modu (aç / kapat) |
| H | göstergeleri gizle / göster |
| R | başa dön |
| ? | tuş listesi |
| Esc | listeyi ya da fotoğraf modunu kapat |
| fare sürükle · tekerlek | serbest kamerayı döndür · yakınlaş / uzaklaş |

Dokunmatik ekranda: solda dikey **GAZ** kolu, sağda **DÜMEN** alanı (parmağı yana kaydır), üstünde **Kamera** ve
**Foto** düğmeleri. Serbest kamerada ekranı tek parmakla sürükleyerek döndür, iki parmakla yakınlaş.

**Fotoğraf modu** benzetimi durdurur, kamerayı serbest bırakır, göstergeleri gizler ve filmin tam renk ayarını
(LOOKS + post zinciri: ton eğrisi, teal-turuncu ayar, vinyet, film greni) uygular. Saat seçilebilir: **Gün batımı**,
**Liman**, **Mavi saat** (filmin üç ışık kurgusu, denizi de onlarla birlikte). **2.39:1** film oranı şeritlerini açar
(kaydedilen PNG o orana kırpılır), objektif 24 / 35 / 50 / 85 mm arasında değişir, **Kaydet** PNG indirir (uzun kenar
en az 1920 px'e çıkarılarak yeniden çizilir).

Açılışta 4 adımlı kısa bir rehber çıkar (gaz ver → dümen kır → kamerayı değiştir → fotoğraf modu); her adım sen
o işi yapınca geçer, **Geç** ile atlanır, bir kez bitince bir daha gösterilmez.

## Neyin benzetimi yapılıyor

- **Hız:** kayıcı (planing) tekne. Gaz kolu itme gücüne yavaşça ulaşır; direnç eğrisinde 12–14 kn civarında bir
  "tümsek" vardır, tam gazda direnç 35 kn'de itmeye eşitlenir (projenin planındaki azami hız; başka bir değer
  uydurulmadı). Yaklaşık 4 sn'de 10 kn, 8 sn'de 20 kn (kızakta), 12.6 sn'de 30 kn, 17 sn'de 34 kn; 35 kn'yi aşmaz.
  Düşük gazda (≈%25) tekne tümseği aşamaz ve ~10 kn'de deplasman rejiminde kalır.
- **Trim:** düşük hızda neredeyse düz; tümsek hızında baş kalkar (≈4.9°), kızağa çıkınca ≈2.8°'ye yerleşir;
  hızlanırken biraz daha kalkar. Tümsekte kıç hafifçe çöker, kızakta gövde yükselir.
- **Dönüş:** dönüş yarıçapı hızla büyür (≈19 m @ 8.5 kn, ≈106 m @ 33 kn), dümende hız düşer (35 → 33 kn), tekne
  dönüşün içine yatar (≈9° yüksek hızda, ≈2° düşük hızda). Su jeti sayesinde neredeyse dururken de biraz döner.
- **Dalga:** filmin dalga fonksiyonu (Gerstner) teknenin baş-kıç ve iskele-sancak noktalarından örneklenir; tekne
  suyun üstünde oturur, dalgayla yükselip iner. İz (Kelvin kolları, jet köpüğü) ve serpinti filmin sistemleridir,
  kaydedilen gerçek rota ve hızdan beslenir.
- **Kameralar:** takip kamerası yaylı; teknenin arkasında durur, ileriye bakar, dönüşte geride kalıp dışa savrulur.
  Serbest kamera tekne çevresinde döner. İkisi de hiçbir zaman su yüzeyinin altına inmez (kameranın altındaki dalga
  yüksekliği + 0.9 m).
- **Uyarlanır çözünürlük:** kare süresi 24 ms'yi geçerse çözünürlük düşer, 14.5 ms'nin altındaysa yeniden yükselir
  (saniyede en çok bir kez, cihaz piksel oranının en fazla 1.5 katına kadar).

## Bilinen sınırlar

- Elle ayarlanmış bir el hissi modeli; gerçek hidrodinamik hesap değil. Tek gerçek proje verisi 35 kn azami hızdır;
  ivme, dönüş yarıçapı, trim ve yatma değerleri tahmini ve görsel amaçlıdır.
- Çarpışma yok: tekne şamandıraların içinden geçer. Kıyı, liman ve başka tekne yok; açık deniz.
- Fotoğraf modu zamanı dondurur (dalgalar, serpinti ve bayrak da durur).
- GPU'suz makinelerde (yazılım WebGL) çok yavaştır: burada 960×540'ta kare başına ~1 sn, en düşük ölçekte bile
  ~0.7 sn. Gerçek bir GPU gerekir; telefonlarda çözünürlük otomatik düşer ama eski telefonlar yine zorlanabilir.
- Dikey telefon ekranında takip kamerası için objektif uzatılır; yine de iz köpüğünün kenarında, düşük çözünürlükte
  basamaklanma görülebilir.
- Tekne modeli filmdeki modelin aynısıdır; sayfada yalnızca sürüş ve fotoğraf vardır.

## Test

Yazılım GL ile, deterministik adımlama kancası üzerinden (`?test=1` → `window.__play.step(dt)`, `setInput()`,
`getState()`):

```sh
node tomris-play/tools/test.js            # ölçümler JSON olarak yazılır, kareler /tmp/tomris-play-test/
```

Diğer GL işleriyle çakışmamak için `tomris-three/tools/shot.js` ile aynı `/tmp/tomris-gl.lock` kilidini alır.
`shots/` klasöründeki kareler bu testten alınmıştır.

## Dosyalar

- `index.html`, `play.css`: sayfa, Türkçe arayüz (kapanış kartının yazı tipleri, `tomris-overlays/endcard/assets/fonts`)
- `js/main.js`: motor kurulumu, gerçek zamanlı döngü, uyarlanır çözünürlük, arayüz, rehber, fotoğraf modu, test kancası
- `js/sim.js`: tekne hareket modeli ve iz için rota geçmişi
- `js/cameras.js`: takip ve serbest kamera
- `js/input.js`: klavye, dokunmatik, fare
- `tools/test.js`: Playwright testi

Motorda (`tomris-three/assets/js/`) yalnızca isteğe bağlı eklemeler var, film yolu aynı kaldı: `boatPose` verilirse
`trim` / `heel` / `lift` değerlerini kullanır, `engine.resize()` ve `post.setSize()` uyarlanır çözünürlük içindir.
