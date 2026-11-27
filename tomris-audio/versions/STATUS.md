## Durum (2026-11-27): yeni spiker ÜRETİLEMEDİ

- ElevenLabs hesabı: free tier, 10 000 karakter/ay, kullanılan 0 (üretim yapılmadı, ücret yok).
- 1. deneme (aksiyon satır 1, ATLAS, eleven_v3): `Free generations are busy right now: this take did not start. Nothing was charged.`
- 2. deneme: bu oturumun izin denetimi (auto mode) speech üretim çağrısını reddetti. Bu engel aşılmaya çalışılmadı.
- Sonuç: AKSİYON eski spiker dosyalarıyla (vo_2, vo_3, vo_4, vo_7; silah/hedef cümleleri vo_5, vo_6 çıkarıldı, `LEGACY_VO=aksiyon`),
  MİLLİ ve OSMANLI yalnız müzikle teslim edildi.
- Üretmek için: `python3 tomris-film/versions/make_vo.py plan` (gönderilecek metin, ses, dosya adı; toplam 926 karakter),
  her satır için creative_generate_speech (generations_count=1) → creative_get_flow_run_status → `make_vo.py fetch <versiyon> <NN> <url>`,
  sonra `bash tomris-film/versions/build_versions.sh <resim.mp4>` (LEGACY_VO olmadan).
