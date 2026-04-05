# Ayarlar ve Kullanicilar

Sayfalar:

- `/settings/users`
- `/settings/categories`
- `/settings/collections`
- `/settings/pos-categories`
- `/settings/barcode-standards`
- `/settings/procurement-types`
- `/settings/payment-terms`

Amaci:

- Sistemin referans verilerini ve kullanicilarini yonetmek

Kullanici:

- Yeni kullanici ekleme
- Kullanici guncelleme
- Kullanici silme
- Login icin kullanilan kayitlarin yonetimi

Tanim ekranlari:

- Kategori
- Koleksiyon
- POS kategorisi
- Barkod standardi
- Tedarik tipi
- Odeme kosulu

Calisma sekli:

- Tanim ekranlarinda ekleme ve duzenleme ayni sayfada yapilir.
- `Duzenle` ile sag drawer acilir ve kayit guncellenir.
- Bu tanimlar urun, tedarikci, satin alma ve POS ekranlarinda dropdown olarak kullanilir.

Kullandigi veri:

- `src/erp/masterData.js`
- `src/erp/usersData.js`
