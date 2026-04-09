# Tedarikci Listesi Analizi

## Arayuz Eksiklikleri
- Gercek sayfalama, toplu guncelleme ve iliskili kayit uyarilari yok.
- CSV import sonrasi satir bazli hata dokumu uretilmiyor.

## Kurgu Hatalari
- Silme islemi tedarikciye bagli urun, kullanici ve teslimatlari kontrol etmiyor.
- Import anahtari `email || company`; ayni firma veya bos e-posta durumunda yanlis kayit ustune yazilabilir.

## Veritabani Hatalari
- Kisa kod, e-posta, vergi numarasi ve IBAN icin benzersizlik garantisi yok. - olmalı
- Tedarikci store'unun toplu yeniden yazimi, bagli kullanici ve urun FK'larini bozabilir.

## Guvenlik Aciklari
- Ticari ve finansal bilgiler tum yetkili olmayan ic roller tarafindan da gorulebilir.
- Korumasiz store API nedeniyle tedarikci verisi manipule edilebilir.
## Cozum Onerileri
- Listeye sunucu tarafli sayfalama, filtreleme ve toplu guncelleme aksiyonlari eklenmelidir.
- CSV import sonrasinda satir bazli hata ve duplicate raporu gosterilmelidir.
- Silme oncesi bagli urun, kullanici ve teslimat kontrolu yapilmali; gerekirse kayit pasife alinmalidir.
- Kisa kod, e-posta, vergi no ve IBAN alanlari icin benzersizlik kurali uygulanmalidir.
- Finansal ve ticari bilgiler alan bazli rol yetkisi ile maskelenmelidir.
## Yapilmasi Onerilen Islemler
1. Tedarikci listesi icin sunucu tarafli paging ekleyin.
2. Silme yerine pasiflestirme ve baglilik kontrolu uygulayin.
3. Import ekranina hata ve duplicate raporu ekleyin.
4. Finansal alanlari rol bazli goruntuleme ile koruyun.
