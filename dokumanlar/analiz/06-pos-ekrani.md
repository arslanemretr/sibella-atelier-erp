# POS Ekrani Analizi

## Arayuz Eksiklikleri
- Urun kartlarinda stok adedi gorunmuyor; kasiyer eldeki miktari gormeden satis yapiyor.
- Tus takiminda `?` ve anlamsiz `Kaydolun` metni gibi yarim kalmis arayuz izleri var.
- Fis onizleme, iade, musteri arama ve odeme parcala akislari yok.

## Kurgu Hatalari
- Urun sepete eklenirken sadece ilk eklemede stok kontrolu var; miktar sonradan limitsiz arttirilabiliyor.
- Kasiyer ekranindan birim fiyat ve indirim manuel degistirilebiliyor; onay mekanizmasi yok.
- Taslak siparisler `localStorage` uzerinde tutuluyor; ayni kullanicinin baska cihazdaki islemleri gorulmez.

## Veritabani Hatalari
- Satis kaydi olusurken stok yeterliligi sunucuda dogrulanmiyor.
- Stok eksiye dusunce `0`'a kirpiliyor; fiili satis miktari ile stok kaydi tutarsizlasabilir.
- Satis, stok dusumu ve draft temizligi tek transaction icinde degil.

## Guvenlik Aciklari
- Fiyat ve indirim manipule edilerek yetkisiz satis yapilabilir.
- Barkod ve siparis verileri korumasiz API/store yapisiyla mudahaleye aciktir.
## Cozum Onerileri
- Urun kartlarinda anlik stok ve kritik stok uyari bilgisi gosterilmelidir.
- Yarim kalmis UI oge ve anlamsiz metinler temizlenmelidir.
- Sepette miktar artarken de stok kontrolu yapilmali ve sunucuda yeniden dogrulanmalidir.
- Manuel fiyat ve indirim degisikligi sadece yetkili roller veya yonetici onayi ile yapilmalidir.
- Taslak siparisler localStorage yerine sunucu tarafinda tutulmalidir.
- Barkod ve satis verisi kimlik ve rol kontrolleri ile korunmalidir.
## Yapilmasi Onerilen Islemler
1. Sepet miktar guncellemesinde stok yeterlilik kontrolu ekleyin.
2. Indirim ve fiyat degisimini rol bazli izne baglayin.
3. Taslak siparisleri sunucu tarafina tasiyin.
4. POS arayuzundeki yarim kalmis aksiyonlari temizleyin.
