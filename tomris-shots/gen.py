import json, math
FR=[105,120,36,30,24,39,36,36,42,45,105,36,27,30,30,24,33,27,24,36,24,27,36,60,45,36,27,24,27,45,30,30,30,27,24,24,43,4,24,21,18,18,18,21,18,15,18,15,15,18,15,15,18,6,30,4,120,105,120]
SETUPS={
 "B":dict(sunElevationDeg=1,sunAzimuthDeg=270,look="sunset",sea=dict(windSpeed=4,waveHeightM=0.2,choppiness=0.6)),
 "A":dict(sunElevationDeg=3,sunAzimuthDeg=225,look="sunset",sea=dict(windSpeed=10,waveHeightM=0.8,choppiness=1.0)),
 "Ap":dict(sunElevationDeg=-4,sunAzimuthDeg=235,look="bluehour",sea=dict(windSpeed=8,waveHeightM=0.6,choppiness=0.9)),
 "E":dict(sunElevationDeg=-4,sunAzimuthDeg=235,look="eoir",sea=dict(windSpeed=8,waveHeightM=0.6,choppiness=0.9)),
 "C":dict(sunElevationDeg=45,sunAzimuthDeg=0,look="studio",sea=dict(windSpeed=0,waveHeightM=0,choppiness=0)),
 "W":dict(sunElevationDeg=45,sunAzimuthDeg=0,look="wireframe",sea=dict(windSpeed=0,waveHeightM=0,choppiness=0)),
}
P=lambda x,y,z:dict(x=x,y=y,z=z)
def orb(r,y,a0,dps,fr):
    a1=a0+dps*fr/30
    f=lambda a:P(round(r*math.cos(math.radians(a)),2),y,round(r*math.sin(math.radians(a)),2))
    return f(a0),f(a1)
shots=[]
def S(n,setup,lens,ctype,frm,to,look,ease="linear",hh=0,kn=0,hdg=0,trim=0,anim=(),vo=None,sfx=(),note="",kind="3d",**cx):
    shots.append(dict(n=n,kind=kind,setup=setup,lensMm=lens,ctype=ctype,frm=frm,to=to,look=look,ease=ease,hh=hh,kn=kn,hdg=hdg,trim=trim,anim=list(anim),vo=vo,sfx=list(sfx),note=note,cx=cx))
def O(n,kind,vo=None,sfx=(),note=""):
    shots.append(dict(n=n,kind=kind,setup=None,lensMm=None,ctype=None,frm=None,to=None,look=None,ease=None,hh=0,kn=0,hdg=0,trim=0,anim=[],vo=vo,sfx=list(sfx),note=note,cx={}))
A=lambda t,f,to:dict(target=t,fromDeg=f,toDeg=to)
LP={"x":-4.4,"y":1.0,"z":-1.8}; TXT_P=P(-4.4,1.0,-1.8)
O(1,"overlay",vo="Son dakika. Ege'de kimliği belirsiz bir su üstü teması tespit edildi.",sfx=["radyo paraziti","radar bip","alçak drone müzik"],note="HyperFrames: radar açılışı, isimsiz Ege kıyı çizgisi, kırmızı temas; küçük 'SON DAKİKA' künyesi; VO 0,5 sn'de (kare 15) başlar")
S(2,"B",85,"drone",P(268,25,-14),P(252,26.2,-8),"boat","linear",0.1,8,90,0,note="Güneş iki vinç arasında; tekne sağ 1/3'te (screenOffset); VO1 sürer",sfx=["radyo paraziti"],screenOffset=P(0.33,0,0))
S(3,"B",100,"detail",P(9,4.6,-3),P(8.8,4.6,-3),"eoir","linear",0,8,90,0,[A("eoir_az",0,35)],sfx=["servo vızıltısı"],note="Lense güneş parlaması; küre uyanır")
S(4,"B",135,"static",P(2.5,3,85),P(-1.5,3,85),"boat","linear",0,8,90,0,note="Dünyada sabit kamera, tekne soldan sağa geçer; f/1,8 DOF, ön planda vinç ışığı bokeh",fStop=1.8)
S(5,"B",85,"detail",P(5,6.2,-4),P(5,6.2,-4),"flag" if False else P(-0.5,5.2,0),"linear",0,8,90,0,sfx=["röle tıkı"],note="Fenerler yanar: kırmızı/yeşil/beyaz; bayrak kenarda")
S(6,"B",50,"detail",P(1.4,1.8,-3.2),P(0.6,1.8,-3.2),P(-0.6,1.9,-1.4),"linear",0,8,90,0,vo="Liman komutanlığından tek bir emir çıktı.",note="Köşk yan camı, içi boş; camda vinç ışıkları")
S(7,"B",35,"drone",P(2,20,0),P(2,20,0),"boat","linear",0,8,90,0,note="Tepeden 90°, mendirek ağzı; hız 8→12 kn",speedToKn=12)
S(8,"B",135,"detail",P(9,6.5,-5),P(9,6.5,-5),"flag","linear",0.15,12,90,0,vo="Gemide tek bir asker yok.",note="HERO bayrak, yavaş bake, güneş arkadan",flagBake="slow")
S(9,"B",35,"waterline",P(-8.5,0.35,-1.2),P(-19.5,0.35,-1.2),"stern","easeIn",0.1,12,90,2,note="Dünyada sabit alçak kamera, tekne uzaklaşır; jetler devreye girer, kıç 2° çömelir",speedToKn=20,trimToDeg=2,sfx=["jet türbini yükselir"])
S(10,"B",50,"static",P(9.5,2.5,30),P(-9.5,2.5,30),"boat","linear",0,25,90,3,note="Mendirek feneri ön planda, silüet; pan ~20°/sn",sfx=[])
S(11,"A",35,"drone",P(-69,40,-6),P(-40,40,-6),"boat","easeInOut",0.05,35,225,4,vo="On üç metre.",sfx=["müzik ritmi girer"],note="Güneş parıltı yolu, silüet; tilt 30°→45° mesafe değişimiyle; sis ufku gizler")
S(12,"A",50,"chase",P(-1,1.2,-15),P(-0.4,1.2,-15),"boat","linear",0.05,35,0,4,vo="On ton.",note="MASTER referans açısı; bob 0,3°")
S(13,"A",100,"detail",P(-4.0,1.2,-6.2),P(-4.0,1.2,-6.2),TXT_P,"linear",0.05,35,0,4,note="TOMRİS / TCB-1601 yazısı okunur; spray; odak yazıda",focusOn="hull_text")
S(14,"A",24,"waterline",P(14,0.4,0),P(12,0.4,0),"bow","linear",0.1,35,0,4,vo="Saatte otuz beş knot.",note="Pruva kameraya gelir; lens damlası compositor'da")
S(15,"A",24,"static",P(9,0.5,25),P(-9,0.5,25),"boat","linear",0,35,0,4,sfx=["Doppler motor geçişi"],note="Dünyada sabit; ~40° pan; motion blur şart")
S(16,"A",85,"detail",P(6.5,6,-3.5),P(6.5,6,-3.5),P(-0.8,5.4,0),"linear",0,35,45,4,[A("radar_spin",0,720)],note="Radar çubuğu döner, güneş arkada; kenarda bayrak")
S(17,"A",35,"drone",P(7,30,-5),P(-7,30,5),"boat","linear",0.05,35,0,4,note="Tepeden 90°, 2°/sn roll, V iz ≥60 m",rollDegPerSec=2)
S(18,"A",50,"chase",P(-14.5,0.8,0),P(-14.5,0.8,0),"stern","linear",0.05,35,0,4,vo="İki su jetiyle,",note="İki jet wash")
S(19,"A",200,"detail",P(55,0.8,-6),P(55,0.8,-6),"flag","linear",0.05,35,45,1.5,note="HERO hızlı bake; bayrak güneş diskinin önünde",flagBake="fast")
S(20,"A",50,"chase",P(8,2,12),P(8,2,12),"boat","linear",0.05,35,0,6,vo="uzaktan ya da tamamen otonom.",sfx=["slam darbesi"],note="Dalgaya biner; pitch +6°→−1° / 0,5 sn; sancak 3/4 ön",trimToDeg=-1)
S(21,"A",35,"waterline",P(2.5,0.5,-3.0),P(2.5,0.5,-3.0),P(2.5,0.2,-1.7),"linear",0.05,35,0,4,note="Chine ve usturmaça; su gövdeye girmemeli (maske)")
S(22,"A",24,"detail",P(-6,3.9,0.5),P(-6,3.9,0.5),"eoir","linear",0.25,35,0,4,[A("radar_spin",0,360)],note="Güverte arkasından köşk üstü, EO/IR + direk silüeti, ufuk")
a,b=orb(22,25,-120,6,36)
S(23,"A",28,"orbit",a,b,"boat","linear",0,35,0,4,sfx=["motor gürlemesi","müzik nefes alır"],note="Orbit 6°/sn",orbitDegPerSec=6)
S(24,"W",50,"static",P(1,2,-22),P(1,2,-21.4),"boat","linear",0,0,0,0,vo="Yirmi insansız deniz aracı incelendi,",sfx=["elektronik tik"],note="Camgöbeği tel kafes pruvadan kıça çizilir (maske anim.); dolly 0,3 m/s")
a,b=orb(20,5,-150,20,45)
S(25,"W",35,"orbit",a,b,"boat","linear",0,0,0,0,vo="her ölçü hesapla doğrulandı.",note="Tel kafesten mat griye geçiş, turntable 20°/sn",orbitDegPerSec=20,flagBake="slow")
S(26,"C",85,"detail",P(11.5,0.4,-3.5),P(11.3,0.4,-3.5),"gun","linear",0,0,0,0,[A("gun_az",0,40),A("gun_el",0,10)],vo="Burnunda ASELSAN STAMP,",sfx=["servo"],note="STAMP alttan; 40° traverse + 10° yükselme")
S(27,"A",50,"detail",P(2.6,3.8,0.4),P(2.6,3.8,0.4),P(20,2.2,0),"linear",0.05,35,225,4,note="Silahın arkasından ileri, namlu ön planda, güneşe doğru")
S(28,"C",135,"detail",P(10,2.3,-3.6),P(10,2.3,-3.5),P(6.4,2.2,0),"linear",0,0,0,0,vo="on iki koma yedi milimetre",note="Namlu ucu makro, rim ışığı")
S(29,"A",85,"chase",P(5.5,2,-10),P(5.5,2,-10),"gun","linear",0.05,35,0,4,[A("gun_az",0,-75)],vo="uzaktan komutalı silah.",note="Silah yana döner")
a,b=orb(16,4,-150,15,45)
S(30,"C",50,"orbit",a,b,"launcher","linear",0,0,0,0,[A("launcher_el",0,25)],vo="Kıçında dört L-UMTAS füzesi.",sfx=["hidrolik"],note="Lançer 0→25°; 3/4 kıç; DÖRT füze (karar)",orbitDegPerSec=15)
S(31,"C",100,"detail",P(3.5,3.9,-1.5),P(3.5,3.9,-1.5),P(-3.6,3.2,0),"linear",0,0,0,0,[A("launcher_el",25,25)],note="Dört füze burnu; rack focus ön sıra→arka sıra",rackFocus=["front_row","rear_row"])
S(32,"A",85,"chase",P(1,2.2,-28),P(1,2.2,-28),"boat","linear",0.05,35,0,4,[A("launcher_el",25,25)],note="Silah + lançer yan profil, gün batımı")
S(33,"C",50,"static",P(-5,12,0),P(-5,12,0),"launcher","linear",0,0,0,0,[A("launcher_el",25,25)],note="Lançer tepeden, burunlar hizalı; 5°/sn dönüş",rollDegPerSec=5)
S(34,"A",35,"chase",P(-12,3,-1.5),P(-12,3,-1.5),"launcher","linear",0.05,35,225,4,[A("launcher_el",25,25)],note="Tekneye bağlı kıç kamerası, arkada güneş. ÖNERİ cümlesi 'Menzil [MENZİL].' varsayılan düşük (vo null); değer gelirse eklenir")
S(35,"C",100,"detail",P(7.5,4.8,3.4),P(7.5,4.8,3.4),"eoir","linear",0,0,0,0,[A("eoir_az",-60,28)],note="EO/IR küresi kameraya döner")
S(36,"A",135,"chase",P(12,4.6,-5),P(12,4.6,-5),"eoir","linear",0.05,35,0,4,note="EO/IR camında güneş yansıması")
a,b=orb(22,3.2,-120,30,43)
S(37,"C",35,"orbit",a,b,"boat","linear",0,0,0,0,[A("launcher_el",0,0)],sfx=["drop öncesi gerilim"],note="Tam turntable 30°/sn, parlak siyah zemin yansıması; lançer inik",orbitDegPerSec=30,flagBake="slow")
O(38,"black",sfx=["ses kesilir"],note="Siyah flaş")
S(39,"Ap",35,"static",P(7,2.5,-22),P(-7,2.5,-22),"boat","easeOut",0,35,0,4,vo="Hedef tespit edildi.",sfx=["müzik drop"],note="Whip pan 60°/sn→0; fenerler yanık")
S(40,"E",200,"detail",P(0,4.6,0),P(0,4.6,0),P(900,6,-120),"easeIn",0,0,0,0,note="EO/IR beyaz-sıcak; ufukta bayraksız, adsız genel hedef; crash zoom 1→3×",digitalZoom=dict(fromX=2,toX=6),overlay="eoir_reticle")
S(41,"Ap",85,"detail",P(8,4.8,-3.6),P(8,4.8,-3.6),"eoir","linear",0,35,0,4,[A("eoir_az",0,-35)],note="EO/IR küresi hedefe döner")
S(42,"Ap",50,"detail",P(9.5,0.7,2.8),P(9.5,0.7,2.8),"gun","linear",0,35,0,4,[A("gun_az",0,-35)],sfx=["servo"],note="Silah döner, alttan")
S(43,"E",200,"detail",P(0,4.6,0),P(0,4.6,0),P(900,6,-120),"linear",0,0,0,0,sfx=["kilit tonu"],note="Kilit: retikül daralır (HF, yazısız)",digitalZoom=dict(fromX=2,toX=2),overlay="eoir_reticle_lock")
S(44,"Ap",35,"chase",P(-12,3.2,-1.5),P(-12,3.2,-1.5),"launcher","linear",0.05,35,0,4,[A("launcher_el",0,25)],vo="Görüntü, şifreli bağlantıyla",note="Lançer kalkar, denizde")
S(45,"Ap",24,"drone",P(-4,24,2),P(2,24,2),"boat","linear",0,35,0,4,[A("launcher_el",25,25)],note="Tepeden, mavi-beyaz iz, fenerler")
S(46,"Ap",135,"detail",P(9,6,-3),P(9,6,-3),"flag","linear",0.05,35,0,4,note="HERO hızlı bake; bayrak kırmızı fener ışığında",flagBake="fast")
S(47,"Ap",24,"waterline",P(13,0.5,0),P(11,0.5,0),"bow","linear",0.1,35,0,4,vo="anında komuta merkezinde.",note="Alçak-ön pruva spray; geri 16 m/s")
S(48,"Ap",50,"detail",P(1.2,1.8,-3.2),P(0.8,1.8,-3.2),P(-0.6,1.9,-1.4),"linear",0,35,0,4,note="Köşk camı, boş, ekran ışığı")
S(49,"Ap",50,"chase",P(-11,0.9,0),P(-11,0.9,0),"stern","linear",0.05,35,0,4,note="Jet wash")
S(50,"Ap",85,"chase",P(2,1.6,-30),P(3,1.6,-30),"boat","linear",0.05,35,0,4,note="Yan takip, hız")
S(51,"E",200,"detail",P(0,4.6,0),P(0,4.6,0),P(900,6,-120),"linear",0,0,0,0,sfx=["kilit tonu sürekli"],note="Hedef ortada, kilitli",digitalZoom=dict(fromX=2,toX=2),overlay="eoir_reticle_lock")
S(52,"Ap",100,"detail",P(-4,1.2,6.2),P(-4,1.2,6.2),P(-4.4,1.0,1.8),"linear",0.05,35,0,4,note="TOMRİS yazısı fener ışığında (sancak borda)",focusOn="hull_text")
S(53,"Ap",100,"detail",P(-3,3.9,-6),P(-3,3.9,-6),P(-3.8,3.2,0),"linear",0,35,0,4,[A("launcher_el",25,25)],note="Füze burunları yandan")
O(54,"black",sfx=["sessizlik"],note="Siyah flaş")
S(55,"Ap",24,"drone",P(-10,5.2,-2.6),P(12,4.5,-3),"boat","easeInOut",0.1,35,0,4,[A("launcher_el",25,25),A("gun_az",-35,-35)],sfx=["müzik zirvesi"],note="Kıçtan direk yanından pruva önüne; bayrak kadrajı süpürür; ateşleme YOK, yalnız kilit/lançer")
O(56,"black",note="Siyah flaş")
S(57,"Ap",35,"drone",P(-12,5,-5),P(-100,40,-5),"boat","easeOut",0,35,0,4,[A("launcher_el",25,25)],vo="TOMRİS, İstanbul Teknik Üniversitesi'nde tasarlandı.",note="Geri çekilip yükselir, yavaşlayarak; tekne ufka")
S(58,"Ap",85,"detail",P(5,2.2,-3.4),P(4.5,2.5,-3.1),"flag","linear",0,35,0,4,[A("radar_spin",0,720)],vo="TOMRİS. Denizde, nöbette.",note="Direk, bayrak, fenerler, mavi gök; HERO hızlı bake",flagBake="fast")
O(59,"overlay",sfx=["müzik kuyruğu"],note="HyperFrames: TOMRİS · TCB-1601 logosu, ekip adları, İTÜ Gemi İnşaatı ve Deniz Bilimleri Fakültesi")
assert len(shots)==59 and len(FR)==59
out=[];f=0
for s,fr in zip(shots,FR):
    d=dict(n=s["n"],startFrame=f,frames=fr,kind=s["kind"],setup=s["setup"],lensMm=s["lensMm"])
    f+=fr
    if s["kind"]=="3d":
        look=s["look"]
        cam=dict(type=s["ctype"],**{"from":s["frm"],"to":s["to"]},lookAt=look,ease=s["ease"],handheld=s["hh"]);cam.update(s["cx"])
        boat=dict(speedKn=s["kn"],headingDeg=s["hdg"],trimDeg=s["trim"])
        for k in("speedToKn","trimToDeg"):
            if k in cam: boat[k]=cam.pop(k)
        for k in("flagBake","overlay"):
            if k in cam: d[k]=cam.pop(k)
        d.update(camera=cam,boat=boat,anim=s["anim"],flagVisible=s["setup"]!="E" and s["n"]!=24)
        if s["setup"]=="E": d["boat"]=None
    else:
        d.update(camera=None,boat=None,anim=[],flagVisible=False)
    d.update(vo=s["vo"],sfx=s["sfx"],note=s["note"])
    out.append(d)
doc=dict(fps=30,totalFrames=2100,setups=SETUPS,shots=out)
json.dump(doc,open("shots.json","w"),ensure_ascii=False,indent=1)
# markdown
SN={"Ap":"A′"}
L=["# TOMRİS · Çekim koreografisi (shots.json özeti)","","30 fps · 2100 kare · kamera koordinatları teknenin yerel çerçevesinde (m; +x pruva, +y yukarı, +z sancak)","",
"| # | Başl. | Kare | Tür | Kur. | Lens | Kamera | Başlangıç → Bitiş | Bakış | kn / yön / trim | Anim | VO |","|---|---|---|---|---|---|---|---|---|---|---|---|"]
fx=lambda p:f"({p['x']:g},{p['y']:g},{p['z']:g})"
for d in out:
    if d["kind"]!="3d":
        L.append(f"| {d['n']} | {d['startFrame']} | {d['frames']} | {d['kind']} | — | — | — | — | — | — | — | {d['vo'] or ''} |");continue
    c=d["camera"];lk=c["lookAt"];lk=fx(lk) if isinstance(lk,dict) else lk
    b=d["boat"];bt="—" if not b else f"{b['speedKn']}{('→'+str(b['speedToKn'])) if 'speedToKn' in b else ''} / {b['headingDeg']} / {b['trimDeg']}{('→'+str(b['trimToDeg'])) if 'trimToDeg' in b else ''}"
    an=", ".join(f"{a['target']} {a['fromDeg']}→{a['toDeg']}" for a in d["anim"])
    L.append(f"| {d['n']} | {d['startFrame']} | {d['frames']} | 3d | {SN.get(d['setup'],d['setup'])} | {d['lensMm']} | {c['type']} | {fx(c['from'])} → {fx(c['to'])} | {lk} | {bt} | {an} | {d['vo'] or ''} |")
L+=["","## Yorumlanan satırlar","",
"- **Genel (füze):** karar gereği lançerde DÖRT füze, #30 VO'su 'dört'; ateşleme yok, #55 yalnız lançer + kilit; gövde yazısı #13, #52'de görünür, bayrak kalır.",
"- **#1–2 VO:** 'ÖNERİ' kısaltılmış cümle kabul edildi; #1'de 0,5 sn'de başlar, #2'ye taşar (vo yalnız #1'de).",
"- **#2:** 85 mm'de 'tekne küçük, sağ 1/3' için kamera ~250 m uzağa konuldu (boy ~%10); sağ 1/3 `screenOffset` ile.",
"- **#4, #9, #10, #14, #15, #39, #47:** dünyada sabit/hız farklı kameralar tekne çerçevesinde, tekne hızıyla geriye kayan konum olarak hesaplandı.",
"- **#11:** tilt 30°→45° kamera yüksekliği 40 m sabit tutulup yatay mesafe 69→40 m yapılarak sağlandı; 'drone 18 m/s' tekneyle aynı hız sayıldı.",
"- **#12:** 50 mm'de 15 m'de tekne tam sığmaz (kırpık orta plan); plandaki mesafe korundu.",
"- **#17:** 'tekneyle aynı hız' ile 'kadrajı çaprazlar' çeliştiği için ±7 m çapraz sürüklenme eklendi.",
"- **#19:** güneş 3°'de ve bayrak 5,8 m'de; 200 mm alt açıyla örtüşmesi için kamera 55 m önde, y 0,8 (bayrak ~5° yükseklikte); tekne başı güneşten uzağa (45°).",
"- **#29:** 'uzaktan komutalı silah.' VO parçası plan satırında olmadığı için #29'a yerleştirildi (27 kare, sıkı).",
"- **#34:** 'Menzil [MENZİL].' değer gelmeyeceği varsayılarak vo=null (düşme varsayılanı).",
"- **#37:** turntable'da lançer inik (temiz siluet); plan belirtmiyor.",
"- **#40, #43, #51:** '400 mm eşdeğeri' lens sınırı 200 mm'yi aştığından lensMm=200 + `digitalZoom` (2× = 400 mm eş.; #40'ta 2→6×, planın 1→3× zumu) yazıldı; retikül HF `overlay` alanı.",
"- **#55:** 'drone 25 m/s' (tekneye göre 7 m/s) kıçtan pruva önüne ulaşmaya yetmez; tekneye göre ~22 m'lik yol alındı.",
"- **#57:** 'geri 3 m/s' + tekne uzaklaşması: tekne çerçevesinde 5→40 m yükseklikle ~90 m geri, easeOut.",
"- **bayrak:** flagVisible, tekne 3B çekimlerinde true (bayrak kalır); yalnız E (tekne yok) ve #24 (tel kafes) false. `flagBake`: B/A/A′ hızına göre slow/fast, plandaki HERO notları korundu.",
"- **Yön/güneş:** planda yön yok; B'de tekne güneşe karşı arkadan aydınlatma (yön 90°, güneş 270°), A'da güneş kıç-iskele omzunda (225°), ters ışık isteyen çekimlerde yön değişti (#11, #16, #19, #27, #34).",
"- **Stüdyo kurulumları:** güneş alanı 'ana ışık 45°' olarak yazıldı (elevation 45, az 0)."]
open("shots.md","w").write("\n".join(L)+"\n")
