# Urun Karti Analizi

## Arayuz Eksiklikleri
- Kod icinde `Satinalma` ve `Fiyat` sekmeleri var ama filtrelenerek gizlenmis; tasarim yarim kalmis gorunuyor. Tasarım değşikliği yapılmıştı. kodu uygun şekilde temizlemen gerekir.

- Barkod, tedarik kodu ve notlar icin kalite kontrolu veya format dogrulamasi zayif. Barkod için Barkod Tasarımı için ayarlar sayfasından kurgu çalışılacak.
Tedarikçi Kodu için de öneri yazılabilir.

## Kurgu Hatalari
- Urun kodu benzersizlik kontrolu yalnizca parametre acikken yapiliyor; parametre kapaninca cakisma olusabilir. Sorun değil kalsın. test için bırakıldı.

- Tedarikci degisikligi urun kodunu otomatik degistiriyor ama mevcut hareketlerle etkisi kullaniciya gosterilmiyor. Ürün Kodu bir kez açıldı mı kod üzrinden değişiklik yapılmayacak şekilde kapatılmalı. Tedarilçi deeğişimide yapılamaz.

- Mevcut stok sadece okunuyor; stok farkinin hangi kayittan geldigi ekranda izlenemiyor. Stok hareket geçmişinden hesapla stok miktarı bilgisi buraya gelmeli.

## Veritabani Hatalari
- `createdBy`, `workflowStatus`, `status` gibi alanlar istemciden aynen kabul ediliyor. - sorun nedir ne yapılmalı.

- Ozellik satirlari ve urun kaydi her guncellemede komple yeniden yaziliyor; versiyonlama yok. - sorun nedir ne yapılmalı.

- Bagli hareketler varken urun tablosunu yeniden yazma modeli kalici kayitta FK hatasi uretebilir. - anlamadım sorun nedir, çözüm önerin nedir.


## Guvenlik Aciklari
- Yetki kontrolu sunucuda yok; istemci istegiyle urun onay durumu ve sahiplik bilgisi degistirilebilir.
- Gorsel yukleme boyut/icerik siniri olmadan data URL olarak kabul ediliyor.


## Cozum Onerileri
- Gizli kalan Satinalma ve Fiyat sekmeleri ya tamamlanmali ya da koddan temizlenmelidir.
- Barkod, tedarik kodu ve not alanlarina format, uzunluk ve is kural dogrulamasi eklenmelidir.
- Urun kodu degisikliginin mevcut hareketlere etkisi onizleme ile kullaniciya gosterilmelidir.
- createdBy, workflowStatus ve status gibi kritik alanlar yalnizca sunucuda set edilmelidir.
- Gorsel yukleme boyut, tip ve guvenlik kontrolleri ile sinirlandirilmalidir.
- Urun karti guncelleme islemleri rol bazli yetki ile korunmalidir.

## Yapilmasi Onerilen Islemler
1. Urun karti alanlari icin sunucu tarafli dogrulama katmani ekleyin.
2. Kritik alanlarin istemciden degistirilmesini sinirlandirin.
3. Gorsel yuklemeyi kontrollu dosya depolama yapisina tasiyin.
4. Urun kodu degisimi icin etki analizi ve onay akisi ekleyin.
