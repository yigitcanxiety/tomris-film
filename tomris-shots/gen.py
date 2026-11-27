import json, math
FR=[150,75,36,30,24,39,36,36,48,39,105,36,27,30,30,24,33,27,24,36,24,27,36,60,45,36,27,24,27,45,30,30,30,27,24,24,43,4,24,21,18,18,18,21,18,15,18,15,15,18,15,15,18,6,30,4,75,60,210]
SETUPS={
 "B":dict(sunElevationDeg=1,sunAzimuthDeg=270,look="sunset",sea=dict(windSpeed=4,waveHeightM=0.2,choppiness=0.6)),
 "A":dict(sunElevationDeg=3,sunAzimuthDeg=225,look="sunset",sea=dict(windSpeed=10,waveHeightM=0.8,choppiness=1.0)),
 "Ap":dict(sunElevationDeg=-4,sunAzimuthDeg=235,look="bluehour",sea=dict(windSpeed=8,waveHeightM=0.6,choppiness=0.9)),
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
# fix1: A shots shot with the sun behind the camera keep the warm key (less grey-hold, neutral WB, less cool sky fill)
WARM_A=dict(hold=0.3,wb=[1.0,1.0,1.0],envGain=1.0)
LP={"x":-4.4,"y":1.0,"z":-1.8}; TXT_P=P(-4.4,1.0,-1.8)
O(1,"overlay",vo=None,sfx=["alçak swell (sfx_swell.mp3)"],note="HyperFrames açılış (tomris-overlays/opening → renders/opening.mp4, 150 kare, kare 0–149), yazısız: karanlıkta ılık ince ufuk çizgisi büyür; modelden üretilmiş gerçek iskele profili çizgi olarak pruvadan kıça çizilir; çizgiler boyunca yumuşak ışık süpürmesi; ufuk ılık bir flaşa açılıp #2'ye (gün batımı limanı) devreder. vo_1 kare 15'te sessiz, adlandırılmış boş yuva.")
S(2,"B",85,"drone",P(268,7.5,-14),P(252,8.7,-8),"boat","linear",0.1,8,90,0,note="İlk 3B kare 150; güneş iki vinç arasında; tekne sağ 1/3'te (screenOffset); VO1 sürer",sfx=["radyo paraziti"],screenOffset=P(0.33,0,0))
S(3,"B",100,"detail",P(9,4.6,-3),P(8.8,4.6,-3),"eoir","linear",0,8,90,0,[A("eoir_az",0,35)],sfx=["servo vızıltısı"],note="Lense güneş parlaması; küre uyanır")
S(4,"B",135,"static",P(2.5,3,85),P(-1.5,3,85),"boat","linear",0,8,90,0,note="Dünyada sabit kamera, tekne soldan sağa geçer; f/1,8 DOF, ön planda vinç ışığı bokeh",fStop=1.8)
S(5,"B",85,"detail",P(5,6.2,-4),P(5,6.2,-4),"mast","linear",0,8,90,0,sfx=["röle tıkı"],note="Fenerler yanar: kırmızı/yeşil/beyaz; bayrak kenarda")
S(6,"B",50,"detail",P(1.4,1.8,-3.2),P(0.6,1.8,-3.2),"wheelhouse_glass","linear",0,8,90,0,vo="Liman komutanlığından tek bir emir çıktı.",note="Köşk yan camı, içi boş; camda vinç ışıkları")
S(7,"B",28,"drone",P(22,10,7),P(18.5,10.5,4.5),"boat","linear",0,8,90,0,note="fix1: yüksek açı, tekneye önden-sancaktan güneşe doğru bakış (tepeden 90° değil): parıltı yolu, şamandıra kapısı, gövdede ılık kenar ışığı; hız 8→12 kn",speedToKn=12,ev=0.7)
S(8,"B",135,"detail",P(9,6.5,-5),P(9,6.5,-5),"flag","linear",0.15,12,90,0,vo="Gemide tek bir asker yok.",note="HERO bayrak, yavaş bake, güneş arkadan",flagBake="slow")
S(9,"B",35,"waterline",P(-8.5,0.35,-1.2),P(-21.5,0.35,-1.2),"stern","easeIn",0.1,12,90,2,note="Dünyada sabit alçak kamera, tekne uzaklaşır; jetler devreye girer, kıç 2° çömelir. fix1: önden aydınlık kıç ılık (gri tutma düşük, ılık WB), sis spreyi yarıya",speedToKn=20,trimToDeg=2,sfx=["jet türbini yükselir"],lookSet=dict(sprayGain=0.5,hold=0.15,wb=[1.0,0.98,0.9]))
S(10,"B",50,"static",P(29,1.2,17),P(12.3,1.2,17),"boat","linear",0,25,90,3,note="Dünyada sabit alçak kamera, tekne önden-yandan geçer; güneş arkada, silüet; pan. fix1: 17 m geri, 39 kare (tekne kadraja yaklaşıp kesilmeden biter)",sfx=[])
S(11,"A",35,"drone",P(-69,40,-6),P(-40,40,-6),"boat","easeInOut",0.05,35,225,4,vo="On üç metre.",sfx=["müzik ritmi girer"],note="Güneş parıltı yolu, silüet; tilt 30°→45° mesafe değişimiyle; sis ufku gizler")
S(12,"A",50,"chase",P(-1.2,2.8,-23),P(0.2,2.8,-23),"boat","linear",0.05,35,0,4,vo="On ton.",note="MASTER referans açısı (master_varA): iskele yan, pruva solda, tekne tam kadrajda; bob 0,3°. fix1: 23 m (direk üstü kadraj içinde), ılık A önden-ışık",lookSet=WARM_A)
S(13,"A",85,"detail",P(-5.1,1.0,-6.6),P(-5.1,1.0,-6.4),"hull_text","linear",0.05,35,0,4,note="TOMRİS / TCB-1601 yazısı okunur; spray; odak yazıda. fix1: yazıya dik, 85 mm, iki satır 2.39 içinde, tekneyle hizalı (eğik görünmez)",focusOn="hull_text",alignBoat=True)
S(14,"A",24,"waterline",P(14,0.4,0),P(12,0.4,0),"bow","linear",0.1,35,0,4,vo="Saatte otuz beş knot.",note="Pruva kameraya gelir; lens damlası compositor'da")
S(15,"A",24,"static",P(9,0.5,25),P(-9,0.5,25),"boat","linear",0,35,0,4,sfx=["Doppler motor geçişi"],note="Dünyada sabit; ~40° pan; motion blur şart")
S(16,"A",85,"detail",P(6.5,6,-3.5),P(6.5,6,-3.5),"radar","linear",0,35,45,4,[A("radar_spin",0,720)],note="Radar çubuğu döner, güneş arkada; kenarda bayrak")
S(17,"A",35,"drone",P(7,30,-5),P(-7,30,5),"boat","linear",0.05,35,0,4,note="Tepeden 90°, 2°/sn roll, V iz ≥60 m. fix1: pruva sağda (2.39 genişliği, tekne tam sığar), +0,6 EV",rollDegPerSec=2,bowRollDeg=90,ev=0.6)
S(18,"A",50,"chase",P(-15,0.65,2.2),P(-14.6,0.7,1.5),"stern","linear",0.05,35,0,4,vo="İki su jetiyle,",note="İki jet wash")
S(19,"A",200,"detail",P(40,1.5,-38),P(40,1.5,-38),"flag","linear",0.05,35,45,1.5,note="HERO hızlı bake; bayrak güneş diskinin önünde. fix1: 45° iskele-ön (bayrak yüzü görünür, kenardan değil)",flagBake="fast")
S(20,"A",40,"chase",P(12,2.5,14),P(12,2.5,13.5),"boat","linear",0.05,35,0,6,vo="uzaktan ya da tamamen otonom.",sfx=["slam darbesi"],note="Dalgaya biner; pitch +6°→−1° / 0,5 sn; sancak 3/4 ön. fix1: daha önden/geniş (tam ters ışık değil), +0,4 EV",trimToDeg=-1,ev=0.4)
S(21,"A",24,"waterline",P(8.5,0.7,-3.6),P(7.9,0.7,-3.4),P(1.5,0.6,-1.6),"linear",0.05,35,0,4,note="Alçak, pruva önünden-iskeleden: pruva ve iskele bordası boyunca açılan pruva dalgası, chine ve usturmaça")
S(22,"A",24,"detail",P(-6,3.9,0.5),P(-6,3.9,0.5),"eoir","linear",0.25,35,0,4,[A("radar_spin",0,360)],note="Güverte arkasından köşk üstü, EO/IR + direk silüeti, ufuk")
a,b=orb(22,25,-120,15,36)
S(23,"A",28,"orbit",a,b,"boat","linear",0,35,0,4,sfx=["motor gürlemesi","müzik nefes alır"],note="Orbit 15°/sn (6°/sn önizlemede ölü görünüyordu)",orbitDegPerSec=15)
S(24,"W",50,"static",P(1,2,-22),P(1,2,-21.4),"boat","linear",0,0,0,0,vo="Yirmi insansız deniz aracı incelendi,",sfx=["elektronik tik"],note="Camgöbeği tel kafes pruvadan kıça çizilir (maske anim.); dolly 0,3 m/s")
a,b=orb(20,5,-150,20,45)
S(25,"W",35,"orbit",a,b,"boat","linear",0,0,0,0,vo="her ölçü hesapla doğrulandı.",note="Tel kafesten mat griye geçiş, turntable 20°/sn",orbitDegPerSec=20,flagBake="slow")
S(26,"C",85,"detail",P(7.6,4.4,-2.6),P(7.3,4.45,-2.5),"gun","linear",0,0,0,0,[A("gun_az",0,40),A("gun_el",0,10)],vo="Burnunda ASELSAN STAMP,",sfx=["servo"],note="STAMP iskele-pruvadan, anahtar ışık tarafından (ışık iskele pruvadan yüksek); 40° traverse + 10° yükselme. fix1: yüksekten, silahın arkasında güverte (boşluk değil)")
S(27,"A",28,"detail",P(-1.0,3.55,0.5),P(-0.7,3.55,0.4),P(10.5,2.3,-0.2),"linear",0.05,35,225,4,note="Silahın arkasından ileri, namlu ön planda, güneşe doğru")
S(28,"C",135,"detail",P(10,2.3,-3.6),P(10,2.3,-3.5),P(6.4,2.2,0),"linear",0,0,0,0,vo="on iki koma yedi milimetre",note="Namlu ucu makro, rim ışığı")
S(29,"A",85,"chase",P(4.5,3.6,-8),P(4.1,3.65,-8),"gun","linear",0.05,35,0,4,[A("gun_az",0,-75)],vo="uzaktan komutalı silah.",note="Silah yana döner. fix1: ılık A önden-ışık",lookSet=WARM_A)
a,b=orb(16,4,-150,15,45)
S(30,"C",50,"orbit",a,b,"launcher","linear",0,0,0,0,[A("launcher_el",0,25)],vo="Kıçında dört L-UMTAS füzesi.",sfx=["hidrolik"],note="Lançer 0→25°; 3/4 kıç; DÖRT füze (karar). fix1: yazı alt kenarda kesilmesin",orbitDegPerSec=15,screenOffset=P(0,0.3,0))
S(31,"C",100,"detail",P(3.5,3.9,-1.5),P(3.5,3.9,-1.5),P(-3.6,3.2,0),"linear",0,0,0,0,[A("launcher_el",25,25)],note="Dört füze burnu; rack focus ön sıra→arka sıra",rackFocus=["front_row","rear_row"])
S(32,"A",70,"chase",P(1,2.2,-33),P(1,2.2,-33),"boat","linear",0.05,35,0,4,[],note="Uzun lens yan profil, gün batımı; lançer yatık (denizde hep yatık). fix1: 70 mm / 33 m, pruva ve yazı kadraj içinde, ılık A",lookSet=WARM_A)
S(33,"C",50,"static",P(-9.8,1.5,2.2),P(-9.6,1.55,1.6),P(-5.6,1.9,0),"linear",0,0,0,0,[A("launcher_el",25,25)],note="fix1: lançer kıç-sancaktan alçak 3/4: dört tüp (2×2) ve kıç uçları köşke karşı okunur (tepeden açı, bayrak şeridi ve roll kaldırıldı)")
S(34,"A",35,"chase",P(-12,3,-1.5),P(-12,3,-1.5),"launcher","linear",0.05,35,225,4,[],note="Tekneye bağlı kıç kamerası, arkada güneş. ÖNERİ cümlesi 'Menzil [MENZİL].' varsayılan düşük (vo null); değer gelirse eklenir")
S(35,"C",100,"detail",P(7.5,4.8,3.4),P(7.5,4.8,3.4),"eoir","linear",0,0,0,0,[A("eoir_az",-60,28)],note="EO/IR küresi kameraya döner")
S(36,"A",135,"chase",P(9.4,4.6,-9.5),P(9.4,4.6,-9.5),"eoir","linear",0.05,35,0,4,note="EO/IR camında güneş yansıması. fix1: #35 ile aynı kadraj olmasın diye 20° iskeleye, ılık A",lookSet=WARM_A)
a,b=orb(22,3.2,60,30,43)   # fix1: starboard side (was -120: ended on #39's port 3/4)
S(37,"C",35,"orbit",a,b,"boat","linear",0,0,0,0,[A("launcher_el",0,0)],sfx=["drop öncesi gerilim"],note="Tam turntable 30°/sn, parlak siyah zemin yansıması; lançer inik",orbitDegPerSec=30,flagBake="slow")
O(38,"black",sfx=["ses kesilir"],note="Siyah flaş")
S(39,"Ap",35,"static",P(7,2.5,-22),P(-7,2.5,-22),"boat","easeOut",0,35,0,4,vo="Hedef tespit edildi.",sfx=["müzik drop"],note="Mavi saat girişi; whip pan 60°/sn→0; fenerler yanık")
S(40,"Ap",24,"detail",P(-4.3,6.1,0.6),P(-4.6,6.2,0.9),P(-46.5,0,-2),"easeOut",0.05,35,0,4,note="Güzellik: direk tepesinden kıça, uzayan mavi-beyaz iz; bayrak ve direk ön planda")
S(41,"Ap",24,"detail",P(5.0,3.6,2.6),P(4.8,3.65,2.4),P(1.5,2.8,0),"linear",0,35,0,4,[],note="fix1: ön güverte (sancak-pruva üstünden kıça): silah, köşk ön camları, direk fenerleri (EO/IR yakın planı yerine)")
S(42,"Ap",50,"detail",P(9.5,0.7,2.8),P(9.5,0.7,2.8),"gun","linear",0,35,0,4,[A("gun_az",0,-20)],sfx=["servo"],note="Silah küçük yay çizer, alttan (mekanik detay)")
S(43,"Ap",200,"drone",P(168.5,3.2,-16),P(168.5,3.4,-19),P(-0.2,2.2,0),"linear",0.06,35,0,4,note="Güzellik: 200 mm sıkıştırma; tekne arkasında liman vinçleri ve rıhtım ışıkları, alacakaranlık",fStop=4)
S(44,"Ap",35,"chase",P(-12,3.2,-1.5),P(-12,3.2,-1.5),"launcher","linear",0.05,35,0,4,[],vo="Görüntü, şifreli bağlantıyla",note="Kıç takip; lançer yatık (yalnız stüdyoda kalkar)")
S(45,"Ap",24,"drone",P(-3,26,3),P(3,26,-1),"boat","linear",0,35,0,4,[],note="Tepeden, mavi-beyaz iz, fenerler. fix1: çapraz (pruva sol-üste 35°) ve çapraz sürüklenme, +1,4 EV, fenerler kısık",bowRollDeg=-35,ev=1.4,lookSet=dict(navEmissive=18,navGlow=0.45))
S(46,"Ap",135,"detail",P(9,6,-3),P(9,6,-3),"flag","linear",0.05,35,0,4,note="HERO hızlı bake; bayrak kırmızı fener ışığında",flagBake="fast")
S(47,"Ap",24,"waterline",P(13,0.5,0),P(11,0.5,0),"bow","linear",0.1,35,0,4,vo="anında komuta merkezinde.",note="Alçak-ön pruva spray; geri 16 m/s")
S(48,"Ap",35,"detail",P(-3.5,1.6,-3.6),P(-3.0,1.65,-3.5),"wheelhouse_glass","linear",0,35,0,4,note="Köşk camı, boş, ekran ışığı. fix1: kıç-iskeleden alçak, köşk yanı boyunca (camda gök yansır), +0,6 EV",ev=0.6)
S(49,"Ap",50,"chase",P(-15,1.0,-5),P(-14.4,1.0,-4.6),"stern","linear",0.05,35,0,4,note="Jet wash, kıç 3/4 iskele")
S(50,"Ap",85,"chase",P(2,1.6,-33),P(3,1.6,-33),"boat","linear",0.05,35,0,4,note="Yan takip, hız. fix1: 33 m, bayrak kadraj içinde",screenOffset=P(0,-0.1,0))
S(51,"Ap",35,"detail",P(-0.5,3.6,-2.6),P(-1.2,3.65,-2.4),"radar","linear",0,35,0,4,[A("radar_spin",0,720)],note="Güzellik: dönen radar çubuğu, arkasında akşam göğü; alttan. fix1: fener ışığının direğe düşen payı %30",lookSet=dict(navLight=0.18))
S(52,"Ap",85,"detail",P(-5.1,1.0,6.6),P(-5.1,1.0,6.4),"hull_text","linear",0.05,35,0,4,note="TOMRİS yazısı fener ışığında (sancak borda). fix1: yazıya dik, iki satır kadrajda, +1 EV, kontrast",focusOn="hull_text",alignBoat=True,ev=1.0,lookSet=dict(contrast=1.25,bloom=0.04))
S(53,"Ap",100,"detail",P(-3,3.9,-6),P(-3,3.9,-6),P(-4.5,2.15,0),"linear",0,35,0,4,[],note="Yatık lançerde füze burunları yandan")
O(54,"black",sfx=["sessizlik"],note="Siyah flaş")
S(55,"Ap",50,"detail",P(-1.6,3.6,5.2),P(1.0,3.7,4.4),"flag","easeInOut",0.1,35,0,4,[],sfx=["müzik zirvesi"],note="Güzellik: ters ışıkta bayrak; kamera pruva-sancaktan kıç-iskeleye (akşam ışığına) bakarak direğin önünde kayar; ateşleme/kilit yok. fix1: yeşil fenerin direğe düşen ışığı kısık (ampul parlak kalır)",lookSet=dict(navLight=0.06))
O(56,"black",note="Siyah flaş")
S(57,"Ap",35,"drone",P(-30,10,8),P(-80,30,6),"boat","easeOut",0,35,0,4,[],vo="TOMRİS, İstanbul Teknik Üniversitesi'nde tasarlandı.",note="Geri çekilip yükselir, yavaşlayarak; tekne ufka. fix1: +0,5 EV",ev=0.5)
S(58,"Ap",85,"detail",P(5,2.2,-3.4),P(4.5,2.5,-3.1),"flag","linear",0,35,0,4,[A("radar_spin",0,720)],vo="TOMRİS. Denizde, nöbette.",note="Direk, bayrak, fenerler, mavi gök; HERO hızlı bake",flagBake="fast")
O(59,"overlay",sfx=["müzik kuyruğu"],note="HyperFrames son kart (tomris-overlays/renders/endcard.mp4, 210 kare, kare 1890–2099): TOMRİS · TCB-1601 logosu, ekip adları, İTÜ Gemi İnşaatı ve Deniz Bilimleri Fakültesi; filmdeki tek yazı")
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
        d.update(camera=cam,boat=boat,anim=s["anim"],flagVisible=s["n"]!=24)
    else:
        d.update(camera=None,boat=None,anim=[],flagVisible=False)
    d.update(vo=s["vo"],sfx=s["sfx"],note=s["note"])
    out.append(d)
# ---- structure: beats with frame ranges (inclusive) ----
def rng(a,b): return dict(start=next(d["startFrame"] for d in out if d["n"]==a), end=next(d["startFrame"]+d["frames"]-1 for d in out if d["n"]==b))
BEATS=[("Açılış, yazısız çizgi profil (HyperFrames opening.mp4)",1,1),("Liman, gün batımı (B)",2,10),("Açık deniz, gün batımı (A)",11,23),("Tel kafes ara (W)",24,25),
       ("Karanlık stüdyo / deniz kesmeleri (C+A)",26,37),("Siyah flaş",38,38),("Mavi saat (A′)",39,53),("Siyah flaş",54,54),("Doruk süpürme (A′)",55,55),
       ("Siyah flaş",56,56),("Kapanış (A′)",57,58),("Son kart (HyperFrames endcard.mp4)",59,59)]
beats=[dict(name=n,shots=[a,b],**{"from":rng(a,b)["start"],"to":rng(a,b)["end"]}) for n,a,b in BEATS]
# ---- audio cues (film frames). VO clips may be cut into segments (in/out seconds inside the clip, on silences) so
#      each line lands on the shot shots[].vo names; mix.sh places them and refuses overlaps. ----
V=lambda clip,frame,shot,i=0,o=None,text="":dict(clip=clip,frame=frame,shot=shot,**{"in":i,"out":o},text=text)
AUDIO=dict(
 vo=[V("vo_1.mp3",15,1,text="(boş yuva: dosya yok, sessiz)"),
     V("vo_2_liman_gemide.mp3",315,6,0,2.40,"Liman komutanlığından tek bir emir çıktı."),
     V("vo_2_liman_gemide.mp3",390,8,2.60,None,"Gemide tek bir asker yok."),
     V("vo_3_olcu.mp3",513,11,0,0.95,"On üç metre."),
     V("vo_3_olcu.mp3",618,12,1.05,1.78,"On ton."),
     V("vo_3_olcu.mp3",681,14,1.80,3.80,"Saatte otuz beş knot."),
     V("vo_3_olcu.mp3",798,18,3.95,5.25,"İki su jetiyle,"),
     V("vo_3_olcu.mp3",849,20,5.30,None,"uzaktan ya da tamamen otonom."),
     V("vo_4_yirmi_arac.mp3",938,23,0,None,"Yirmi insansız deniz aracı incelendi, her ölçü hesapla doğrulandı. (J-cut: #23'ün 3. karesinde başlar; 4,5 sn'lik cümle #24–25'e (3,5 sn) sığmaz)"),
     V("vo_5_stamp_umtas.mp3",1082,26,0,None,"Burnunda ASELSAN STAMP on iki koma yedi milimetre uzaktan komutalı silah. Kıçında dört L-UMTAS füzesi. ('Kıçında' #31'de)"),
     V("vo_6_hedef.mp3",1448,39,0,None,"Hedef tespit edildi. Görüntü, şifreli bağlantıyla anında komuta merkezinde. (AÇIK SORU: resimle artık örtüşmüyor)"),
     V("vo_7_tomris.mp3",1755,57,0,None,"TOMRİS, İstanbul Teknik Üniversitesi'nde tasarlandı. TOMRİS. Denizde, nöbette. (ikinci cümle #58'de, son kartın ilk 1,4 sn'sine taşar)")],
 beds=[dict(bus="mus",clip="music.mp3",frame=0,gainDb=-6,lengthS=70.0,note="müzik, VO altında ~9 dB ducking"),
       dict(bus="sfx",clip="sfx_swell.mp3",frame=0,gainDb=-18,lengthS=5.0,note="açılış altında alçak swell (#1)"),
       dict(bus="sfx",clip="sfx_waves.mp3",frame=150,gainDb=-15,lengthS=round((513-150)/30,3),note="liman bölümü (#2–#10) altında dalga"),
       dict(bus="sfx",clip="sfx_waterjet.mp3",frame=426,gainDb=-10,lengthS=0,note="#9 jetler devreye girer"),
       dict(bus="sfx",clip="sfx_wind.mp3",frame=513,gainDb=-18,lengthS=round((972-513)/30,3),note="açık deniz A (#11–#23)"),
       dict(bus="sfx",clip="sfx_wind.mp3",frame=1448,gainDb=-18,lengthS=round((1890-1448)/30,3),note="mavi saat A′ (#39–#58)"),
       dict(bus="sfx",clip="sfx_radar.mp3",frame=741,gainDb=-16,lengthS=0,note="#16 radar"),
       dict(bus="sfx",clip="sfx_radar.mp3",frame=1667,gainDb=-16,lengthS=0,note="#51 radar"),
       dict(bus="sfx",clip="sfx_impact.mp3",frame=849,gainDb=-10,lengthS=0,note="#20 slam"),
       dict(bus="sfx",clip="sfx_impact.mp3",frame=1444,gainDb=-6,lengthS=0,note="#38 siyah flaş / drop"),
       dict(bus="sfx",clip="sfx_impact.mp3",frame=1715,gainDb=-6,lengthS=0,note="#54 siyah flaş"),
       dict(bus="sfx",clip="sfx_impact.mp3",frame=1751,gainDb=-6,lengthS=0,note="#56 siyah flaş"),
       dict(bus="sfx",clip="sfx_impact.mp3",frame=1890,gainDb=-8,lengthS=0,note="son kart")])
STRUCT=dict(opening=dict(file="tomris-overlays/renders/opening.mp4",start=0,frames=150),
            picture3d=dict(start=150,end=1889,note="3B render tam zaman çizgisi; siyah flaşlar 1444–1447, 1715–1720, 1751–1754 kurguda siyah"),
            endcard=dict(file="tomris-overlays/renders/endcard.mp4",start=1890,frames=210),
            picture="2.39:1, 1920x804 @ y=138 içinde 1920x1080")
doc=dict(fps=30,totalFrames=2100,structure=STRUCT,beats=beats,audio=AUDIO,setups=SETUPS,shots=out)
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
L[2]="30 fps · 2100 kare · kamera koordinatları teknenin yerel çerçevesinde (m; +x pruva, +y yukarı, +z sancak; orijin gövde ortası, GLB kıç aynası orijininden 6,5 m önde). Bu dosya ve shots.json `gen.py` ile üretilir; elle düzenlemeyin."
L+=["","## Yapı (kare aralıkları, dahil)","","| Bölüm | Kareler | Süre | Çekimler |","|---|---|---|---|"]
for bt in beats: L.append(f"| {bt['name']} | {bt['from']}–{bt['to']} | {(bt['to']-bt['from']+1)/30:.2f} sn | #{bt['shots'][0]}–#{bt['shots'][1]} |")
L+=["","Teslim: 1920×1080, resim 2.39:1 (1920×804, y=138). Açılış `tomris-overlays/renders/opening.mp4` (150 kare), son kart `endcard.mp4` (210 kare); arası 3B (tomris-three, kare 150–1889). Siyah flaşlar kurguda siyaha zorlanır. Filmde son kart dışında yazı, retikül ya da HUD yok.",
"","## Ses yuvaları (`audio`, mix.sh okur)","","| Klip | Kare | Çekim | Klip içi (sn) | Metin |","|---|---|---|---|---|"]
for c in AUDIO["vo"]: L.append(f"| {c['clip']} | {c['frame']} | #{c['shot']} | {c['in']}–{c['out'] if c['out'] is not None else 'son'} | {c['text']} |")
for c in AUDIO["beds"]: L.append(f"| {c['clip']} ({c['bus']}, {c['gainDb']} dB{', '+str(c['lengthS'])+' sn' if c['lengthS'] else ''}) | {c['frame']} | — | — | {c['note']} |")
L+=["","## Yorumlanan satırlar","",
"- **Açılış (#1):** eski radar/HUD açılışı (yazı ve hedef çerçevesiyle) çıktı, `tomris-overlays/opening_old/` ve `renders/opening_old.mp4` olarak saklandı. Yeni açılış yazısız; tekne profili `tomris-overlays/opening/profile_lines.py` ile tomris.blend'den (ortografik iskele görünüşü, siluet + kenar çizgileri, ışın izlemeyle gizli çizgi temizliği) üretilir. Açılışta radar sesi yok; altında yalnız `sfx_swell.mp3` yuvası.",
"- **Yönetmen kararı (tasarım vitrini):** sensör/hedef bölümü tamamen çıktı. Kurulum E ve görünümü yok; #40, #43, #51 ve #55'in kilit kısmı güzellik çekimi: #40 direk tepesinden iz, #43 200 mm'de tekne + liman vinçleri sıkıştırması, #51 göğe karşı dönen radar, #55 ters ışıkta bayrağın kadrajı süpürdüğü drone geçişi. #41/#42 EO/IR ve silah yalnız mekanik detay olarak küçük yay çizer.",
"- **Lançer:** denizde her zaman yatık (#32, #34, #44, #45, #53, #55, #57 animasyonsuz); yalnız stüdyoda (#30 0→25°, #31, #33) kalkar; #37 turntable'da yatık.",
"- **Zamanlama:** açılış 150 kare (opening.mp4) → #2 kare 150'de 75 kare; son kart 210 kare (endcard.mp4) → #57 75, #58 60 kare. Toplam 2100 değişmedi.",
"- **Bakış noktaları:** `mast`, `radar`, `wheelhouse_glass`, `hull_text`, `noses` adları film.js ANCHOR'daki GLB geometrisine bağlanır. film.js EDIT yalnız GLB hassasiyetinde yeniden nişan tutar (#8, #46 mesafe; #28 namlu, #31 burunlar + rack focus); zamanlama/kurulum/hız/animasyon her zaman burada.",
"- **#2:** 85 mm'de tekne küçük, sağ 1/3 (`screenOffset`); kamera 7,5 m'ye indirildi ki vinçler ve güneş kadrajda olsun.",
"- **#10:** #4 ile aynı yan profil olmaması için dünyada sabit alçak kamera, tekne önden-yandan geçer, güneş arkada.",
"- **#12:** master_varA referans açısı: iskele yan, pruva solda, tekne kadraja tam sığar (21 m, 2,8 m yükseklik).",
"- **#26/#27/#28/#49:** silah alttan yakın; silah ön planda güneşe doğru (28 mm); namlu + ağız freni (gerçek namlu y = 2,41 m); jet wash kıç 3/4 iskeleden (#18 ile aynı açı olmasın).",
"- **#4, #9, #10, #14, #15, #39, #47:** dünyada sabit/hız farklı kameralar tekne çerçevesinde, tekne hızıyla geriye kayan konum olarak hesaplandı.",
"- **#11:** tilt 30°→45° kamera yüksekliği 40 m sabit, yatay mesafe 69→40 m.",
"- **#17:** 'tekneyle aynı hız' ile 'kadrajı çaprazlar' çeliştiği için ±7 m çapraz sürüklenme eklendi.",
"- **#19:** güneş 3°'de ve bayrak 5,8 m'de; 200 mm alt açı, kamera 55 m önde; tekne başı 45°.",
"- **#57:** kıç-sancak üstünden geri çekilip yükselir (75 kare), #55'in başlangıç açısını tekrarlamaz.",
"- **VO:** vo_2 ve vo_3 sessizliklerden bölünüp atanan çekimlere oturtuldu; vo_4 (4,5 sn) #24–25'e (3,5 sn) sığmadığı ve vo_5'e taşmaması için #23'ün 3. karesinde başlar (J-cut); vo_5 kare 1082 ('Kıçında' #31'de). vo_6 'Hedef tespit edildi…' yuvası korundu ama resimle örtüşmüyor (yönetmene açık soru). vo_1 dosyası yok, yuva sessiz.",
"- **bayrak:** flagVisible tekne çekimlerinde true; yalnız #24 (tel kafes) false. `flagBake`: B/A/A′ hızına göre slow/fast.",
"- **Yön/güneş:** güneş azimutu atan2(z, x) (0 = +x, 90 = +z). B'de tekne +z'ye (yön 90°), güneş −z'de liman vinçlerinin arkasında (ters ışık); A'da güneş kıç-iskele omzunda (225°); ters ışık isteyen çekimlerde yön değişti (#11, #16, #19, #27, #34).",
"- **Stüdyo kurulumları:** güneş alanı 'ana ışık 45°' (film.js'te tek sert anahtar ışık: iskele pruvadan, yüksek)."]
open("shots.md","w").write("\n".join(L)+"\n")
