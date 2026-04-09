# Urun Listesi Analizi

## Arayuz Yapılacaklar
- Sayfalama gostergesi var ama gercek sayfalama yok gözüküyor. Bu yapıyı oluştur.
- Toplu secim, toplu durum degistirme ve import hata raporu bulunmuyor. Bunlar eklenmeli.

## Kurgu Hatalari
- `Ara` butonu gercek arama calistirmiyor, sadece bilgi mesaji veriyor. Ara Butonunu kaldır.
- Silme islemi satin alma, stok, POS ve teslimat baglantilarini kontrol etmeden yapiliyor. Ürün Silme özelliği olmasın pasife almak olsun ancak bu parametrik olsun. Parametrelerde ürün sil özelliği aktif pasif şeklinde saklansın aktif olunca ürün silinemesin pasife alınabilsin.

- Excel import sadece `code` alanina gore merge ediyor; barkod ve tedarikci tutarliligi korunmuyor.???

## Veritabani Hatalari
- Urun kodu ve barkod icin zorunlu benzersizlik veri katmaninda garanti edilmiyor. Garanti edileek düzenleme yapılsın.
- Urun gorselleri base64 olarak kaydedilebildigi icin tablo boyutu hizla siser. Şişmemesi için öneri ver.
- Urun store'u tam listeyi tekrar yazarak guncelleniyor; bagli satir tablolariyla FK uyumsuzlugu riski var. sorunu anlamadım daha detaylı anlat.

## Guvenlik Aciklari
- Export ve import islemleri rol bazli korunmuyor. Rol temelli düzenleme nasıl olabilir.

- Istemci tarafli store yazimi ve korumasiz API nedeniyle urun listesi kolayca manipule edilebilir. bu aşamadaki sorunu biraz daha net açıkla.

## Cozum Onerileri
- Gercek sayfalama icin sunucu tarafli paging, sorting ve filtreleme uygulanmalidir.

- Toplu secim ve toplu durum degisimi icin listeye batch islem cubugu eklenmelidir.

- Ara butonu bilgi mesaji yerine gercek filtreleme davranisina baglanmalidir.

- Silme oncesi satin alma, stok, POS ve teslimat bagliliklari kontrol edilmelidir.
- Urun kodu ve barkod alanlari icin veritabani seviyesinde benzersizlik kurali uygulanmalidir.
- Base64 gorseller harici dosya depolamaya alinmali, tabloda yalnizca yol saklanmalidir.
- Import/export islemleri rol bazli yetki ve audit log ile korunmalidir.

## Yapilmasi Onerilen Islemler
1. Urun listesi icin sunucu tarafli sayfalama ve filtreleme endpointi yazin.
2. Urun kodu ve barkod alanlarina unique index ekleyin.
3. Silme akisini baglilik kontrollu arsivleme modeline cevirin.
4. Import ekranina onizleme ve satir bazli hata raporu ekleyin.
5. Import/export islemlerine rol ve audit kontrolu ekleyin.
