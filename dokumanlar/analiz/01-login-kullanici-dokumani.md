# 01 Nolu Ekran Kullanici Dokumani

## Ekran Adi
Login

## Ekranin Amaci
Bu ekran, kullanicinin ERP uygulamasina veya tedarikci portalina guvenli sekilde giris yapmasini saglar.

## Ekrana Erisim
- Yetkili oturum yoksa uygulama otomatik olarak login ekranini acar.
- Dogrudan adres: `/login`

## Ekrandaki Alanlar
- `E-posta`: Sistemde tanimli kurumsal e-posta adresiniz.
- `Sifre`: Kullanici sifreniz.
- `Giris Yap`: Sisteme giris butonu.
- `Sifremi Unuttum`: Sifre yenileme kodu olusturur ve yeni sifre belirleme ekranini acar.
- `Destek` bilgi alani: Sifre unutma veya pasif hesap durumunda izlenecek yonlendirme.

## Giris Yapma Adimlari
1. `E-posta` alanina kurumsal e-posta adresinizi girin.
2. `Sifre` alanina sifrenizi girin.
3. `Giris Yap` butonuna basin.
4. Bilgiler dogruysa sistem oturumunuzu acar ve sizi ilgili ana ekrana yonlendirir.

## Rol Bazli Yonlendirme
- `Yonetici`, `Magaza`, `Muhasebe` gibi ic roller: `/dashboard`
- `Tedarikci`: `/supplier/dashboard`

## Hata Durumlari
- `E-posta veya sifre hatali.`:
  Girilen bilgilerden biri yanlistir.
- `Bu hesap pasif durumda...`:
  Hesabiniz pasiflestirilmistir; yoneticiniz ile iletisime gecin.
- `Hesap gecici olarak kilitlendi...`:
  Kisa surede cok sayida hatali deneme yapilmistir. Bir sure bekleyip tekrar deneyin.
- Alan bos veya e-posta formati gecersizse:
  Form ilgili alanda uyari verir.

## Sifremi Unuttum Akisi
1. `Sifremi Unuttum` baglantisina basin.
2. E-posta adresinizi girip `Kod Olustur` butonuna basin.
3. Sistem size tek kullanimlik bir sifre yenileme kodu uretir.
4. Uretilen kodu, yeni sifrenizi ve yeni sifre tekrar alanini doldurun.
5. `Sifreyi Yenile` butonuna basin.
6. Islem tamamlandiktan sonra yeni sifreniz ile login ekranindan giris yapin.

## Kullanici Icin Notlar
- Sifre alaninda buyuk-kucuk harf farki onemlidir.
- Oturum acildiginda erisim yetkileriniz rolunuze gore otomatik uygulanir.
- Ortak bilgisayarlarda isiniz bittiginde `Cikis Yap` ile oturumu kapatin.
- Sifrenizi unuttuysaniz sistem yoneticiniz ile iletisime gecin.

## Basarili Giris Sonrasi
- Ic kullanicilar dashboard ekranina gider.
- Tedarikci kullanicilar tedarikci dashboard ekranina gider.
- Korumali bir sayfaya gitmeye calisirken login olduysaniz, sistem sizi uygun durumda geldiginiz sayfaya geri yonlendirebilir.

## Mevcut Sinirlar
- Bu ekranda dogrudan sifre sifirlama formu yoktur.
- Bu ekranda yeni kullanici kaydi acilmaz.
- Cok asamali dogrulama su an kullanilmamaktadir.
