# Veritabani Mimarisi

## Genel Yapi

Uygulama artik sadece `localStorage` ile calismamaktadir. Ana is verileri icin yerel API ve `PostgreSQL` veritabani kullanilmaktadir.

- Veritabani motoru: `PostgreSQL`
- API sunucusu: `server/index.js`
- DB erisim katmani: `server/db.js`
- Frontend API istemcisi: `src/erp/apiClient.js`

## Veritabani Mantigi

Mevcut frontend modulleri tablo bazli API endpointleri uzerinden calisir. Uygulamadaki her ana modul dogrudan kendi PostgreSQL tablolarina yazilir ve oralardan okunur.

## API Uclari

- `GET /api/health`

## Frontend Tarafinda DB'ye Gecen Moduller

Asagidaki moduller artik PostgreSQL destekli API uzerinden calisir:

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

Sistemde tek kalici veri kaynagi PostgreSQL tablolaridir. Legacy store/mirror yapisi tamamen kaldirilmistir.
