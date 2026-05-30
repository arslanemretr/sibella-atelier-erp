# Tedarikci Portali Kullanim Talimati

Bu talimat, Sibella Atelier tedarikci portalini kullanacak tedarikciler icin hazirlanmistir. Ekran goruntuleri `Neslihan Karadogan / Mina Aksesuar` tedarikci kullanicisi ile alinmistir; kullanicinin kendi hesabinda sadece kendisine bagli firma, urun, teslimat ve hakedis bilgileri gorunur.

## 1. Portala Giris

![Giris ekrani](gorseller/tedarikci-portali/01-giris.png)

1. Portal adresini tarayicida acin.
2. Size tanimlanan `E-posta` ve `Sifre` bilgilerini girin.
3. `Giris Yap` butonuna basin.
4. Kullanici rolu `Tedarikci` ise sistem sizi otomatik olarak tedarikci dashboard ekranina yonlendirir.
5. Sifrenizi unuttuysaniz `Sifremi Unuttum` baglantisi ile sifre yenileme akisini baslatabilirsiniz.

## 2. Dashboard

![Dashboard ekrani](gorseller/tedarikci-portali/02-dashboard.png)

Dashboard, tedarikci hesabinin ozet ekranidir.

Bu ekranda:

- firma, yetkili kisi, e-posta, telefon ve sehir bilgileri gorulur
- toplam urun cesidi, toplam stok adedi, stogu biten urunler ve onay bekleyen teslimatlar takip edilir
- son teslimatlar listelenir
- hakedis ozeti kisa olarak goruntulenir

Dashboard uzerinden detayli islem yapilmaz; ilgili detay icin ust menuden `Urunlerim`, `Hakedis Ozeti` veya `Teslimat Listesi` ekranina gecilir.

## 3. Urunlerim

![Urunlerim ekrani](gorseller/tedarikci-portali/03-urunlerim.png)

`Urunlerim` ekrani, tedarikciye bagli urunlerin takip edildigi listedir.

Kullanim adimlari:

1. Ust menuden `Urunlerim` sekmesine girin.
2. Arama alanindan urun kodu veya urun adi ile kayit arayin.
3. Liste/Kanban secimi ile gorunum tipini degistirin.
4. `Excel'e Aktar` butonu ile urun listesini disari aktarabilirsiniz.
5. Satirdaki duzenleme simgesine basarak urun kartini acin.

Listede gorulebilen temel bilgiler:

- urun kodu
- urun adi
- satis fiyati
- kalan stok adedi
- satis adedi
- iade adedi
- toplam tutar

## 4. Urun Karti

![Urun karti ekrani](gorseller/tedarikci-portali/04-urun-karti.png)

Urun karti, tedarikci tarafinda bilgi goruntuleme amaciyla kullanilir.

Bu ekranda:

- urun gorseli
- tedarikci bilgisi
- urun kodu
- urun adi
- satis fiyati
- kategori
- koleksiyon
- urun aciklamasi
- kayit durumu
- kart durumu

goruntulenir.

Tedarikci kullanicisi bu ekranda urun bilgisini kontrol eder. Degisiklik gerekiyorsa yoneticiye bilgi verilmelidir.

## 5. Hakedis Ozeti

![Hakedis ozeti ekrani](gorseller/tedarikci-portali/05-hakedis-ozeti.png)

`Hakedis Ozeti`, konsinye urunlerin satislarina gore donem bazli hakedis bilgisini takip etmek icin kullanilir.

Kullanim adimlari:

1. Ust menuden `Hakedis Ozeti` sekmesine girin.
2. `Onceki Ay` ve `Sonraki Ay` butonlari ile donem degistirin.
3. Ust kartlardan toplam net satis, komisyon orani, hakedis tutari ve odeme durumunu kontrol edin.
4. `Satis Detayi` tablosundan urun bazli satis, iade, net satis ve hakedis bilgilerini inceleyin.
5. Gerekiyorsa `Excel'e Aktar` butonlari ile satis detayi veya donem gecmisi disari aktarilir.

Odeme durumu ornekleri:

- `Donem Tamamlanmadi`: ilgili ay henuz kapanmamistir
- `Satis Yok`: hakedise konu satis yoktur
- `Fatura Bekleniyor`: hakedis olusmus, fatura bekleniyordur
- `Odeme Bekleniyor`: fatura alinmis, odeme bekleniyordur
- `Tamamlandi`: odeme sureci tamamlanmistir

## 6. Teslimat Listesi

![Teslimat listesi ekrani](gorseller/tedarikci-portali/06-teslimat-listesi.png)

`Teslimat Listesi`, tedarikcinin olusturdugu teslimatlari izledigi ekrandir.

Kullanim adimlari:

1. Ust menuden `Teslimat Listesi` sekmesine girin.
2. Arama alanindan teslimat no, kargo takip kodu veya not ile arama yapin.
3. `Yeni Teslimat` butonu ile yeni teslimat surecini baslatin.
4. Satirdaki goz simgesi ile teslimat detayini acin.
5. PDF/indirme simgesi ile teslimat dokumanini indirin.
6. Silme simgesi gorunuyorsa taslak kaydi silebilirsiniz.

Listede gorulebilen temel bilgiler:

- teslimat no
- durum
- tarih
- yetkili
- urun cesidi
- toplam teslim adet
- toplam tutar

## 7. Yeni Teslimat Baslatma

![Yeni teslimat modal ekrani](gorseller/tedarikci-portali/08-yeni-teslimat-modal.png)

Yeni teslimat, teslimat listesi ekranindaki `Yeni Teslimat` butonundan baslatilir.

1. `Yeni Teslimat` butonuna basin.
2. Acilan pencerede teslimat kodu, firma, yetkili kisi ve e-posta bilgisini kontrol edin.
3. `Tarih` alanini kontrol edin.
4. `Gonderim Sekli` alaninda `Kargo` veya ilgili secenegi secin.
5. Varsa `Kargo Takip Kodu` girin.
6. Gerekli aciklamayi `Not` alanina yazin.
7. `Kaydet ve Devam Et` butonuna basin.

Bu islem bos bir taslak teslimat kaydi olusturur ve sizi teslimat detay ekranina goturur.

## 8. Teslimat Detayi ve Urun Satirlari

![Teslimat detay ekrani](gorseller/tedarikci-portali/07-teslimat-detay.png)

Teslimat detay ekraninda teslimat baslik bilgileri, urun satirlari ve kaydetme aksiyonlari bulunur.

Urun satiri ekleme adimlari:

1. `Urun Adi` alaninda mevcut listeden urun secin veya manuel urun adi yazin.
2. Mevcut urun secildiginde urun kodu ve satis fiyati otomatik gelebilir.
3. Manuel urun giriyorsaniz `Urun Kodu` ve `Satis Fiyati` alanlarini doldurun.
4. `Teslim Adedi` alanina teslim miktarini yazin.
5. `Kamera` veya `Galeri` butonu ile urun gorseli ekleyin.
6. `Ekle` butonu ile satiri teslimat listesine ekleyin.
7. Eklenen satirlari alttaki tablodan kontrol edin.

Satir islemleri:

- duzenleme simgesi ile satir bilgilerini guncelleyin
- silme simgesi ile hatali satiri kaldirin
- alt toplamdan teslimat tutarini kontrol edin

Teslimat kaydetme:

- `Taslak Kaydet`: teslimati daha sonra tamamlamak uzere taslak olarak saklar
- `Onaya Gonder`: teslimati satin alma/yonetici onayina gonderir
- `PDF Olarak Indir`: teslimat dokumanini PDF olarak indirir

## 9. Teslimat Durumlari

Teslimat kayitlari asagidaki durumlarda olabilir:

- `Taslak`: tedarikci tarafindan duzenlenebilir
- `Onay Bekleniyor`: tedarikci tarafindan gonderilmis, yonetici onayi bekler
- `Onaylandi`: yonetici tarafindan onaylanmistir
- `Revizyon Istendi`: yonetici duzeltme istemistir, tedarikci tekrar duzenleyebilir
- `Tamamlandi`: teslimat sureci tamamlanmistir

Not: Tedarikci tarafinda genellikle yalnizca `Taslak` ve `Revizyon Istendi` durumundaki teslimatlar duzenlenebilir. Onaya gonderilen veya tamamlanan kayitlar izleme modunda kalir.

## 10. Dikkat Edilecek Noktalar

- Teslimati onaya gondermeden once tarih, gonderim sekli ve kargo takip kodunu kontrol edin.
- Urun satiri eklerken urun adi, kod, satis fiyati, teslim adedi ve gorsel bilgisini eksiksiz girin.
- Ayni teslimati iki kez olusturmamaya dikkat edin.
- Hatalari fark ederseniz taslak durumundayken duzeltin.
- Onaya gonderilen teslimatlar icin degisiklik gerekiyorsa yonetici ile iletisime gecin.
- Isiniz bittiginde kullanici menusunden cikis yapin.

## 11. Sik Karsilasilan Sorunlar

### Giris yapamiyorum

- E-posta ve sifreyi kontrol edin.
- Sifre buyuk/kucuk harfe duyarlidir.
- Hesap pasifse yonetici ile iletisime gecin.

### Urun listemde bekledigim urun yok

- Urun farkli bir tedarikciye bagli olabilir.
- Urun henuz sisteme eklenmemis olabilir.
- Yoneticiye urun/tedarikci eslestirmesini kontrol ettirin.

### Yeni teslimat satiri eklenmiyor

- Urun adi bos olmamalidir.
- Teslim adedi en az 1 olmalidir.
- Manuel urun giriliyorsa urun kodu ve satis fiyati kontrol edilmelidir.
- Gorsel eklenmesi bekleniyorsa kamera veya galeri ile gorsel secilmelidir.

### Teslimat duzenlenemiyor

- Teslimat `Onay Bekleniyor`, `Onaylandi` veya `Tamamlandi` durumunda olabilir.
- Bu durumda degisiklik icin yoneticiye revizyon talebi iletilmelidir.

## 12. Destek

Giris, urun eslestirme, hakedis veya teslimat akisi ile ilgili sorunlarda yonetici kullaniciya bilgi verin.
