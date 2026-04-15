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

## Mevcut Runtime Durumu

- Uygulama calisma aninda yalnizca PostgreSQL tabanli calisir.
- Veri yazma ve okuma islemleri dogrudan uygulama tablolari uzerinden yapilir.
- Legacy store/mirror katmani kaldirilmistir.
