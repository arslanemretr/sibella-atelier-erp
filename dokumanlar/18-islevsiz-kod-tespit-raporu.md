# Islevsiz Kod Tespit Raporu

Bu rapor local PostgreSQL gecisi sonrasinda kod tabaninda kalan islevsiz, artik kullanilmayan veya mimari olarak gereksiz hale gelmis parcalari listeler.

## Ozet

Tespit edilen kod tipleri:

1. Tamamen artik cagrilmayan kod
2. Legacy uyumluluk icin duran ama runtime'da gereksiz hale gelen kod
3. Ekran bazinda calisan ama artik daha dogru yere tasinmasi gereken kod
4. Dokumantasyonda eski kalan anlatimlar

## Ekran Bazli Bulgular

### Urunler

Dosya: [productsData.js](/d:/erpsibella/src/erp/productsData.js)

- Temizlendi:
  - `applyProductStockAdjustments()` no-op fonksiyonu kaldirildi
- Not:
  - stok hesabi dogru calisiyor ama halen frontend tarafinda hesaplanıyor
  - bu kod islevsiz degil, ancak gelecekte server-side stock summary endpointine alinabilir

### Satin Alma

Dosya: [purchasesData.js](/d:/erpsibella/src/erp/purchasesData.js)

- Temizlendi:
  - kullanilmayan `createId`
  - kullanilmayan `nowIso`
  - kullanilmayan `normalizeLines`
  - kullanilmayan `normalizePurchase`
  - kullanilmayan `buildAdjustments`
  - kullanilmayan `applyProductStockAdjustments` importu

Durum:
- Bu dosya artik API istemcisi gibi calisiyor
- kalan kod aktif ve kullaniliyor

### Stok Girisi

Dosya: [stockEntriesData.js](/d:/erpsibella/src/erp/stockEntriesData.js)

- Temizlendi:
  - kullanilmayan `createId`
  - kullanilmayan `nowIso`
  - kullanilmayan `normalizeLines`
  - kullanilmayan `normalizeStockEntry`
  - kullanilmayan `buildAdjustments`
  - kullanilmayan `applyProductStockAdjustments` importu

Durum:
- Dosya artik API istemcisi gibi calisiyor

### POS

Dosya: [posData.js](/d:/erpsibella/src/erp/posData.js)

- Tespit:
  - `getProductSnapshot()` exportu su an kod tabaninda kullanilmiyor
- Oneri:
  - bir sonraki temizlik turunda kaldirilabilir

### Teslimat Listeleri

Dosya: [deliveryListsData.js](/d:/erpsibella/src/erp/deliveryListsData.js)

- Tespit:
  - `getNextDeliveryNoPreview()` halen kullaniliyor ancak API tarafindaki gercek yaratma mantigi ile birebir garanti vermiyor
- Not:
  - bu islevsiz degil ama “preview only” davranisina sahip
  - benzersizlik garanti edilecekse backend tarafina alinmali

### Uygulama Kabugu

Dosya: [App.jsx](/d:/erpsibella/src/App.jsx)

- Tespit:
  - `resetOperationalDataIfNeeded()` halen calisiyor
  - bu fonksiyon ilk yuklemede eski localStorage anahtarlarini temizliyor
- Degerlendirme:
  - bugun aktif akisin parcasi degil
  - tamamen islevsiz de degil
  - legacy temizlik fonksiyonu olarak duruyor
- Oneri:
  - smoke test turu bittikten sonra kaldirilabilir

## Altyapi Bazli Bulgular

### Legacy Store Uyumluluk Katmani

Dosya: [db.js](/d:/erpsibella/server/db.js)

Durum:
- legacy store uyumluluk katmani kaldirildi
- veri akisi artik yalnizca PostgreSQL tablolari uzerinden calisiyor
- bu alan artik aktif teknik borc degil

### SMTP Mailer Legacy Okuma Mantigi

Dosya: [mailer.js](/d:/erpsibella/server/mailer.js)

- Durum:
  - store okuma mantigi kaldirildi
  - artik dogrudan `smtp_settings` tablosundan okuyor
- Sonuc:
  - bu alan temiz

## Dokumantasyon Bazli Bulgular

### Eski Mimari Anlatimi

Dosyalar:
- [09-veritabani-mimarisi.md](/d:/erpsibella/dokumanlar/09-veritabani-mimarisi.md)
- [12-veritabani-semasi-guncel.md](/d:/erpsibella/dokumanlar/12-veritabani-semasi-guncel.md)
- [13-postgresql-gecis-rehberi.md](/d:/erpsibella/dokumanlar/13-postgresql-gecis-rehberi.md)

Tespit:
- bu dosyalarda eski store/mirror mantigini anlatan kisimlar vardi
- guncel hedef mimari ile kismen uyusmuyorlar

Oneri:
- genel kapanis dokumantasyon turunda bu dosyalar yeniden yazilmali

## Su Ana Kadar Temizlenen Islevsiz Kodlar

- `src/erp/serverStore.js` kaldirildi
- `/api/store` route’lari kaldirildi
- `productsData.applyProductStockAdjustments()` kaldirildi
- `purchasesData` icindeki kullanilmayan helper’lar kaldirildi
- `stockEntriesData` icindeki kullanilmayan helper’lar kaldirildi

## Bir Sonraki Temizlik Sirasi

1. `App.jsx` icindeki `resetOperationalDataIfNeeded()`
2. `posData.js` icindeki `getProductSnapshot()`
3. eski mimari dokumanlarinin revizyonu
