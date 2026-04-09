# Tedarikci Urunlerim Analizi

## Arayuz Eksiklikleri
- Liste sadece goruntuleme odakli; revizyon gonderme, yorum ekleme veya toplu aksiyon yok.
- Durum filtresi ve kategori filtresi bulunmuyor.

## Kurgu Hatalari
- Tedarikci ekraninda urunler sadece okunuyor; urun karti duzeltme sureci eksik kalmis.
- Search yalnizca istemci hafizasindaki liste uzerinde calisiyor; buyuk veri seti icin uygun degil.

## Veritabani Hatalari
- Liste verisi supplierId'ye gore istemcide filtreleniyor; sunucuda veri parcali servis edilmiyor.
- Workflow durumu urun kaydi icinde tutuluyor ama bunun icin ayri gecmis tablosu yok.

## Guvenlik Aciklari
- Istemci supplierId manipule edilirse baska tedarikci urunleri listelenebilir.
- Export islemi veri sizdirmaya acik; rol/izin katmani bulunmuyor.
## Cozum Onerileri
- Listeye durum, kategori ve workflow filtreleri eklenmelidir.
- Tedarikci kullanicisina revizyon gonderme veya yorum ekleme aksiyonu saglanmalidir.
- Listeleme ve export islemleri sunucu tarafli supplier filtreli endpointten gelmelidir.
- Workflow gecmisi ayri log veya gecmis tablosunda saklanmalidir.
- Export islemleri yetki ve audit ile korunmalidir.
## Yapilmasi Onerilen Islemler
1. Tedarikci urun listesine durum ve kategori filtreleri ekleyin.
2. Revizyon gonderme akisini ekleyin.
3. Listeleme ve exportu supplier bazli sunucu endpointine tasiyin.
4. Workflow gecmisini veri modeline ekleyin.
