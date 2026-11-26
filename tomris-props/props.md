# TOMRİS arka plan prop'ları

`build_props.py` ile üretildi (Blender 5.3, `-b -P build_props.py -- [harbour coast target buoy] [--norender]`).
Ham sayılar `props_stats.json` içinde. Önizlemeler `previews/` klasöründe.

## Ortak kurallar

- Birim metre. GLB'de +Y yukarı. Her prop'un orijini su seviyesinde (y = 0).
- Tekne referansı `tomris-blender/build.py` dosyasından alındı: TOMRİS'in pruvası Blender'da +X yönünde, iskelesi +Y yönünde. GLB'ye (+Y yukarı) aktarınca **pruva three.js'te +X, iskele −Z, sancak +Z** oluyor. Aşağıdaki konumlar teknenin başlangıç noktası (0, 0, 0) ve başlangıç rotası +X kabul edilerek verildi. Motor TOMRİS kökünü döndürüyorsa aynı dönüşü bu prop'lara da uygulayın.
- Işık noktaları gerçek mesh. Görünür olsunlar diye 1,1–4,4 m çapında düşük poligonlu ikosahedron olarak modellendiler. Gerçek bir lambadan büyükler; amaç uzaktan 2–4 piksel kaplamaları. Her biri `lamps_*` adlı nesnede toplandı ve tek malzeme kullanıyor. İstenirse motor bu nesnelerin köşe noktalarını sprite ya da `THREE.Points` noktalarına çevirebilir.
- Emisyon şiddeti GLB'ye `KHR_materials_emissive_strength` olarak yazıldı. three.js `GLTFLoader` bunu `emissiveIntensity` olarak okur. Değerler önizlemedeki AgX için ayarlandı; bloom ve ton eşlemesine göre yeniden ayarlanmaları gerekebilir.
- Malzemeler basit PBR: Principled'dan yalnız temel renk, roughness, metallic ve emisyon aktarıldı. Doku yok. `doubleSided` açık.
- Pus/sis motorun işi. Önizlemelerdeki pus yalnız önizlemeye özgü bir taklit (`fake_haze`, mesafeye göre emisyon karışımı) ve GLB'ye girmedi.
- Kamera `far` değeri en az 16 km olmalı (`coast` uzak sırtı 11–12,6 km, ada 14–15,5 km).

## Özet

| Dosya | Boyut | Üçgen | Sınır kutusu, GLB yerel (min → max, m) | Emisyon malzemeleri |
|---|---|---|---|---|
| `harbour.glb` | 1 464 836 B (1,40 MB) | 24 370 (bütçe < 60k) | (−720, −11, −460) → (720, 115, 64.8) | `light_sodium`, `light_white`, `light_red` |
| `coast.glb` | 467 484 B (0,45 MB) | 11 884 (bütçe < 20k) | (−11 867, −4, −12 079) → (15 556, 603, 11 729) | `light_village`, `light_white` |
| `target.glb` | 47 028 B (46 KB) | 795 (bütçe < 15k) | (0, −1.7, −3.4) → (30, 13, 3.4) | yok (kasıtlı: ışıksız seyir) |
| `buoy.glb` | 73 028 B (71 KB) | 1 464 (2 şamandıra; bütçe < 3k) | (−1.3, −3.8, −1.3) → (1.3, 4.8, 1.3) | `light_buoy_red`, `light_buoy_green` |

## 1. harbour.glb: liman silüeti

**Yerleşim:** Prop'un deniz tarafı GLB'de +Z'ye bakıyor ve rıhtım X ekseni boyunca uzanıyor. Önerilen konum `position (-2000, 0, 0)` ve `rotation.y = +π/2`. Böylece deniz cephesi tekneye (+X) döner ve rıhtım Z ekseni boyunca uzanır. Mesafe 1,5–2,4 km arasında değiştirilebilir. Daha uzağa konursa liman arazisi (460 m derinlik), `coast` içindeki yakın sırtın eteğine (2,9 km) girer. Güneş (B kurulumu) bu yönde, yani tam kıçta ve alçakta olmalı; vinçler böylece ters ışıkta silüet olur.

**İçerik** (rıhtım 1,44 km × 460 m, üst kotu +3 m):
- `crane_01`…`crane_07`: STS rıhtım vinçleri. Gerçek ölçüler: ray açıklığı 30 m, portal 48 m, bom 62 m dışarı, 56 m geri, A-çerçeve tepesi yaklaşık 88 m, kalkık bom ucu yaklaşık 115 m. Pozlar:
  - 01–03: bom yatay, gemide çalışıyor; troley ve spreader farklı konum ve yükseklikte.
  - 04, 05, 07: bom 78–84° kalkık.
  - 06: bom 42°, kalkmakta.
  - Her vinçte A-çerçeve tepesinde ve bom ucunda kırmızı mânia lambası, portalda sodyum lamba, bom altında beyaz projektör var.
- `container_yard`: 7 blok sırası, 40 ft bay'ler, 1–5 kat, altı renk. `yard_gantries`: 4 RTG.
- `harbour_buildings`: dört antrepo, liman ofis kulesi, VTS kulesi (yaklaşık 61 m), yedi tahıl silosu, elevatör kulesi, konveyör ve gemi yükleyici, iki mobil liman vinci.
- `light_masts`: 13 adet 38 m yüksek projektör direği (her biri 6 lamba; 3 tanesi beyaz LED, kalanı sodyum) ve rıhtım boyunca 12 m direkli lambalar.
- `moored_ships`:
  - 230 m konteyner gemisi: x −660…−430, borda +Z tarafında. Köprü üstü güverteden 34 m yüksekte, güvertede 6 kata kadar konteyner.
  - 180 m dökme yük gemisi: x 300…480. Dört güverte vinci farklı açılarda.
  - Su altı karina 10–11 m'ye kadar modellendi.
- `lamps_sodium` (187 lamba), `lamps_white` (79), `lamps_red` (19).

**Malzemeler:** `crane_steel`, `crane_house`, `quay_concrete`, `mast_steel`, `shed_wall`, `shed_roof`, `silo_concrete`, `ship_hull_dark`, `ship_hull_rust`, `ship_deck`, `ship_deck_equip`, `ship_superstructure`, `ship_funnel`, `cont_red/blue/white/grey/green/orange`, `light_sodium` (emisyon 1,0/0,42/0,10 ×14), `light_white` (0,80/0,90/1,0 ×16), `light_red` (1,0/0,04/0,02 ×14).

## 2. coast.glb: kıyı tepeleri

**Yerleşim:** `position (0, 0, 0)`, dönüş yok. Prop doğrudan tekne çerçevesinde kuruldu: yay merkezi başlangıç noktası, yayların ortası tam kıç (−X).

| Nesne | Yarıçap (sırt) | Açıklık (kıçtan ±) | Tepe yüksekliği | Malzeme |
|---|---|---|---|---|
| `coast_ridge_near` | 3,6 km (etek 2,9 km) | ±110° | ≤ 55 m; liman arkasında (kıç ±14°) %12'ye iner | `coast_hill_near` |
| `coast_ridge_mid` | 6,5 km | ±125° | ≤ 210 m | `coast_hill_mid` |
| `coast_ridge_far` | 11 km | ±140° | ≤ 480 m (GLB'de en yüksek nokta 603 m) | `coast_hill_far` |
| `coast_island` | 14 km, iskele kemerinde 25° (yaklaşık (12 690, 0, −5 920)) | yaklaşık 5 × 2,2 km | yaklaşık 170–330 m | `coast_island` |

- Pruva ±40° açık deniz bırakıldı (A kurulumundaki "açık ufuk"). Ada A'daki "solda silik ada" için konuldu. Kameranın baktığı yöne göre yerini değiştirmek için `coast_island` nesnesi tek başına taşınabilir.
- Her sırtın uçları denize iner (burun), içlerinde koy boşlukları var. Her sırtın malzemesi ayrı olduğundan motor derinlik pusunu sırt başına renk ya da sis ile verebilir. Önizlemede üç katman ayrı okunuyor.
- `lamps_village` (148) ve `lamps_white` (31): yakın ve orta sırtın eteğinde ve yamacında köy kümeleri. Liman arkasındaki açı karanlık bırakıldı.
- A ve A′ (açık deniz) çekimlerinde tekne yaklaşık 1,2 km ilerlemiş olur. O çekimlerde `coast_ridge_near` ve `coast_ridge_mid` gizlenebilir ya da tüm prop tekneyle birlikte kaydırılabilir.

## 3. target.glb: kimliği belirsiz su üstü teması

- Yaklaşık 30 m'lik genel bir karakol ya da kıyı gemisi: LOA 30 m, genişlik 6,6 m, su çekimi 1,7 m, direk tepesi su hattından 13 m yukarıda.
- Bayrak, borda numarası, yazı ya da arma yok. Herhangi bir ülkenin gerçek sınıfına benzetilmedi.
- Bileşenler: güvertede genel bir kule, eğik ön camlı köprü, direk ve radar çubuğu, küçük radom, baca, kıçta RHIB ve davit.
- Eksenler TOMRİS ile aynı: pruva +X; iskele −Z; orijin kıç aynasında, su hattında.
- **Yerleşim (E: 40, 43, 51):** Önerilen `position (6000, 0, -1500)`, yani yaklaşık 6,2 km ileride ve 14° iskelede; `rotation.y ≈ +100°`. Bu açıda hedef, pruvası iskeleye dönük, neredeyse tam bordadan görünür; long-lens'te silüet en iyi böyle okunur. 400 mm eşdeğerinde (yatay FOV 5,2°) 30 m, 1920 px'te yaklaşık 105 px eder. 3× crash zoom ile yaklaşık 300 px olur. Konum, tekneye göre 40. çekim anındaki pozisyona göre verilmeli (tekne o sırada başlangıçtan kilometrelerce uzakta).
- **EO/IR malzemeleri:** `target_hull`, `target_superstructure`, `target_deck`, `target_equipment`, `target_glass`, `target_rubber`, `target_exhaust` (bacanın tamamı ve kıçtaki egzoz ağızları). Beyaz-sıcak override'da `target_exhaust` en sıcak, gövde orta, cam en soğuk değeri almalı. `previews/target_ir.png` bunun kaba bir denemesi.
- Seyir feneri yok: temas "karanlık seyrediyor". Fener istenirse eklemek birkaç satırlık iş.

## 4. buoy.glb: yanal şamandıralar (IALA A bölgesi; Türkiye A bölgesinde)

- `buoy_port_red`: iskele işareti; kırmızı, silindir tepe işareti, kırmızı fener (`light_buoy_red`).
- `buoy_starboard_green`: sancak işareti; yeşil, ucu yukarı koni tepe işareti, yeşil fener (`light_buoy_green`).
- Ölçüler: Pillar tipi, şamandıra gövdesi Ø2,5 m. Kafes ve fener su üstünde 4 m'de, tepe işareti 4,8 m'de. Altında kuyruk borusu ve ağırlık var (−3,8 m'ye kadar).
- Bileşenler: beyaz retro-yansıtıcı bant, oktahedral radar reflektörü.
- İki nesne de orijinde. Motor ikisini klonlayıp ayrı ayrı konumlandırmalı.
- **Yerleşim (liman çıkışı):** Limandan denize çıkarken IALA A'da kırmızı işaretler sancakta kalır. Bu yüzden önerilen yerler:
  - `buoy_port_red`: `(80, 0, +30)`, sancak.
  - `buoy_starboard_green`: `(80, 0, -30)`, iskele.
  - Aradaki 60 m'lik kanaldan tekne geçer.
  - B çekimlerinde (özellikle 7 ve 10) ön planda ölçek referansı olurlar.
- Malzemeler: `buoy_red`, `buoy_green`, `buoy_dark`, `buoy_white`, `light_buoy_red` (emisyon ×6), `light_buoy_green` (×6). Gerçek fenerler çakar (Fl R / Fl G). Çakma ritmi motorda `emissiveIntensity` ile verilmeli.

## Önizlemeler

| Dosya | Ne gösteriyor |
|---|---|
| `harbour.png` | 2,1 km'den 85 mm, taklit pusla |
| `harbour_close.png` | 3/4 genel görünüm |
| `harbour_detail.png` | Konteyner gemisi ve çalışan vinçler |
| `coast.png` | Kıça bakış, 24 mm |
| `coast_port.png` | İskele kemeri ve ada |
| `coast_tele.png` | 85 mm, köy ışıkları |
| `target.png` | Yakın görünüm |
| `target_far.png` | 2,6 km'den 400 mm |
| `target_ir.png` | Kaba beyaz-sıcak deneme |
| `buoy.png` | İki şamandıra |
