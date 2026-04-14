# Veritabani Mimarisi

## Genel Yapi

Uygulama artik sadece `localStorage` ile calismamaktadir. Ana is verileri icin yerel bir API ve `SQLite` veritabani kullanilmaktadir.

- Veritabani motoru: `SQLite`
- DB dosyasi: `data/erp.sqlite`
- API sunucusu: `server/index.js`
- DB erisim katmani: `server/db.js`
- Frontend store koprusu: `src/erp/serverStore.js`

## Veritabani Mantigi

Mevcut frontend modulleri bozulmadan korunmustur. Bunun icin her module ozel store verisi `SQLite` icinde saklanir.

Kullanilan ana kayit anahtarlari:

- `sibella.erp.masterData.v1`
- Kullanici verisi artik dogrudan `users` tablosunda tutulur
- `sibella.erp.suppliers.v1`
- `sibella.erp.products.v1`
- `sibella.erp.purchases.v2`
- `sibella.erp.contracts.v1`
- `sibella.erp.stockEntries.v2`
- `sibella.erp.posSessions.v2`
- `sibella.erp.posSales.v2`
- `sibella.erp.deliveryLists.v1`
- `sibella.erp.systemParameters.v1`
- `sibella.erp.smtpSettings.v1`

Bu veriler `kv_store` tablosunda tutulur:

- `key`
- `value`
- `updated_at`

## API Uclari

- `GET /api/health`
- `GET /api/store`
- `GET /api/store/:key`
- `PUT /api/store/:key`

## Frontend Tarafinda DB'ye Gecen Moduller

Asagidaki moduller artik SQLite destekli API uzerinden calisir:

- kullanicilar
- tedarikciler
- urunler
- satin alma kayitlari
- konsinye sozlesmeler
- stok giris kayitlari
- POS oturumlari
- POS satislari
- teslimat listeleri
- master tanimlar
- sistem parametreleri

## Hala Tarayici Tarafinda Kalan Yardimci Veriler

Asagidaki veriler uygulama davranisi icin tarayici tarafinda kalmaya devam eder:

- aktif login oturumu
- liste filtre presetleri
- POS ekranindaki gecici siparis taslaklari

Bu veriler is verisi degil, kullanici deneyimi amaclidir.

## Calistirma

1. API sunucusunu baslatin:

```bash
npm run server
```

2. Frontend gelistirme sunucusunu baslatin:

```bash
npm run dev
```

Vite gelistirme ortami `/api` isteklerini otomatik olarak `http://localhost:4001` adresine proxy eder.

## Not

Bu yapi, mevcut uygulamayi hizla gercek veritabani ile calisir hale getirmek icin kurulmustur. Bir sonraki asamada bu `kv_store` yapisi istenirse daha iliskisel tablolara ayrilabilir.
