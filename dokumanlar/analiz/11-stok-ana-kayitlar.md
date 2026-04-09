# Stok Ana Kayitlar Analizi

## Arayuz Eksiklikleri
- Export, iptal, silme, durum gecmisi ve satir ozeti eksik.
- Detay drawer'inda satirlar gorunmuyor; yalnizca ust bilgi var.

## Kurgu Hatalari
- Bos satirli ana kayit olusturulabiliyor.
- Durumlarin is anlami net degil; `Alim Planlandi`, `Taslak`, `Tamamlandi` akisi kilitlenmemis.

## Veritabani Hatalari
- Belge numarasi timestamp parcasi ile uretiliyor; cakisma riski var.
- Stok ana kaydi ve satirlar arasinda surum/lock mantigi yok.

## Guvenlik Aciklari
- Stok ana kaydi acma yetkisi rol bazli ayrilmamis.
- Korumasiz API ile tamamlanmamis veya tamamlanmis kayitlar disaridan degistirilebilir.
## Cozum Onerileri
- Export, iptal, silme, durum gecmisi ve satir ozeti gibi eksik liste aksiyonlari eklenmelidir.
- Bos satirli ana kayit olusmasi engellenmeli veya gecici taslak mantigi netlestirilmelidir.
- Durumlar icin net bir state machine tanimlanmali ve yetkisiz gecisler engellenmelidir.
- Belge numarasi kontrollu ve sirali bir sayac ile uretilmelidir.
- Stok ana kayitlari rol bazli erisim ve duzenleme kurallari ile korunmalidir.
## Yapilmasi Onerilen Islemler
1. Stok ana kayitlar icin state machine tasarlayin.
2. Bos ana kayit olusturmayi engelleyin.
3. Belge numarasi uretimini sirali hale getirin.
4. Listeye export, iptal ve detay satir ozeti ekleyin.
