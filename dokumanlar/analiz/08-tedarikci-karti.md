# Tedarikci Karti Analizi

## Arayuz Eksiklikleri
- IBAN, vergi no ve telefon icin maskeleme/format kontrolu zayif.
- Tedarikci gecmisi, not versiyonlari ve bagli belge listesi tam olarak sunulmuyor.

## Kurgu Hatalari
- Pasif tedarikciye bagli aktif urun veya kullanici varsa kullanici uyarilmiyor.
- Kartta gosterilen urun ozeti bilgilendirici ama bagliliklari koruyan is kurali yok.

## Veritabani Hatalari
- Kayitlar normalize edilmeden serbest metin olarak saklaniyor; raporlama zorlasir.
- Tedarikci tablosunu silip yeniden yazan kalicilik deseni FK hatasina acik.

## Guvenlik Aciklari
- Tedarikci banka ve vergi bilgileri icin alan bazli yetki ayrimi yok.
- Sunucu tarafli rol kontrolu olmadigindan istemci degisikligiyle erisim genisletilebilir.
## Cozum Onerileri
- IBAN, vergi no ve telefon alanlarina maske ve format dogrulamalari eklenmelidir.
- Tedarikci gecmisi, bagli belge listesi ve not versiyonlari kartta gosterilmelidir.
- Pasiflestirme oncesi aktif urun ve kullanici bagliliklari kontrol edilmelidir.
- Serbest metin alanlari normalize edilerek raporlanabilir veri yapisi saglanmalidir.
- Banka ve vergi bilgileri alan bazli yetki ile korunmalidir.
## Yapilmasi Onerilen Islemler
1. Tedarikci kartina format dogrulamalari ekleyin.
2. Pasiflestirme oncesi bagli kayit kontrolu yapin.
3. Banka ve vergi alanlarini rol bazli maskeleyin.
4. Kartta bagli belge ve gecmis gorunumlerini ekleyin.
