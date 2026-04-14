# Ekran Bazli Test Plani

Bu dokuman local PostgreSQL gecisi sonrasinda ekran ekran uygulanacak smoke ve regresyon test planidir.

## 1. Login

Amaç:
- kullanici girisi yalnizca `users` tablosundan calissin
- oturum ve sifre sifirlama akislari hata vermesin

Testler:
1. Aktif kullanici ile login
2. Pasif kullanici ile login reddi
3. Hatali sifre ile login reddi
4. Session yenileme
5. Forgot password request
6. Forgot password confirm

## 2. Dashboard

Amaç:
- kartlar ve ozetler PostgreSQL tablolari ile uyumlu gelsin

Testler:
1. Toplam urun sayisi
2. Toplam tedarikci sayisi
3. Son hareketler listesi
4. Dusuk stok listesi

## 3. Master Data

Kapsam:
- kategoriler
- koleksiyonlar
- POS kategorileri
- barkod standartlari
- tedarik tipleri
- odeme kosullari

Testler:
1. Listeleme
2. Yeni kayit ekleme
3. Kayit guncelleme
4. Ilgili ekranlarda secim listesine yansima

## 4. Tedarikciler

Testler:
1. Listeleme
2. Yeni tedarikci ekleme
3. Guncelleme
4. Silme
5. Satin alma / teslimat ekranlarinda secim listesine yansima

## 5. Urunler

Testler:
1. Listeleme
2. Yeni urun ekleme
3. Ozellik satiri ekleme
4. Guncelleme
5. Silme
6. Urun kodu otomatik uretimi
7. Urun karti mevcut stok alaninin hareketlerden hesaplanmasi

## 6. Satin Alma

Testler:
1. Satin alma listesi
2. Yeni satin alma kaydi
3. Satir ekleme / guncelleme
4. Stok hareketleri ekranina yansima

## 7. Stok Girisi

Testler:
1. Stok giris listesi
2. Yeni stok girisi
3. Taslak > Tamamlandi akisi
4. Urun listesi stok kolonuna yansima

## 8. Stok Hareketleri

Testler:
1. Satin alma kaynakli hareket
2. Stok girisi kaynakli hareket
3. POS satis cikisi
4. Teslimat stoğa alim hareketi

## 9. POS

Testler:
1. Yeni POS oturumu
2. Acik oturum secimi
3. Barkodla urun bulma
4. Sepete ekleme
5. Satis tamamlama
6. Stok dusumu
7. Oturum kapatma

## 10. Sozlesmeler

Testler:
1. Listeleme
2. Yeni sozlesme
3. Guncelleme
4. PDF bilgisinin korunmasi

## 11. Teslimat Listeleri

Testler:
1. Admin teslimat listesi
2. Tedarikci portal teslimat listesi
3. Yeni teslimat formu
4. Guncelleme
5. Teslim alindi > stok girisi olusumu
6. Urun listesi stok alanina yansima

## 12. Sistem Parametreleri

Testler:
1. Parametrelerin yuklenmesi
2. Urun kodu kontrol parametresi degisimi
3. Urun karti davranisina etkisi

## 13. SMTP Ayarlari

Testler:
1. Ayar kaydetme
2. Tekrar yukleme
3. Test maili gonderme

## Genel Kapanis Testleri

1. `npm run build`
2. Login > Dashboard > Logout
3. Bir urun icin:
   - stok girisi
   - POS satis
   - teslimat stoğa alim
   - stok sayisinin dogrulanmasi
4. Network tabinda `/api/store` cagrisinin kalmadiginin dogrulanmasi
