# PostgreSQL Gecis Rehberi

Bu projede PostgreSQL gecisi icin gerekli hazirliklar eklendi.

## Eklenen Dosyalar

- PostgreSQL semasi: `database/postgresql/schema.sql`
- SQLite -> PostgreSQL migration scripti: `scripts/migrate-sqlite-to-postgres.mjs`
- NPM scriptleri:
  - `npm run db:migrate:pg`
  - `npm run db:migrate:pg:data`

## Ortam Degiskenleri

`.env` icine:

```env
SQLITE_PATH=data/erp.sqlite
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/erpsibella
```

## Gecis Adimlari

1. PostgreSQL veritabani olusturun (`erpsibella`).
2. `DATABASE_URL` degerini kendi sunucunuza gore ayarlayin.
3. Asagidaki komutu calistirin:

```bash
npm run db:migrate:pg
```

Bu komut:
- PostgreSQL semasini uygular.
- Hedef tablolari `TRUNCATE` eder.
- SQLite verilerini PostgreSQL'e tasir.

## Sadece Veri Tasima

Sema zaten kuruluysa:

```bash
npm run db:migrate:pg:data
```

## Gecis Sonrasi Onerilen Kontrol

- Toplam kayit sayilarini tablo bazinda SQLite ve PostgreSQL tarafinda karsilastirin.
- Ozellikle kritik tablolar:
  - `users`
  - `suppliers`
  - `products`
  - `delivery_lists`
  - `consignment_contracts`

## Mevcut Runtime Durumu (Faz-1)

- Uygulama calisma aninda halen SQLite tabanli calisir.
- `DATABASE_URL` tanimliysa store yazmalari PostgreSQL `kv_store/store_meta` tablolarina da mirror edilir.
- Bu faz amaci kesintisiz gecis ve veri dogrulamadir.
