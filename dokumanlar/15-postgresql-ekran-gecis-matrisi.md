# PostgreSQL Ekran Gecis Matrisi

Bu dokuman local ortamda ekran ekran PostgreSQL gecisini izlemek icin hazirlanmistir.
Amac:

- her ekranin veri kaynagini netlestirmek
- gerekli tablo semasini belirtmek
- hibrit kalan alanlari tespit etmek
- test ve dokumantasyon sirasini korumak

## Tamamlanan Ekranlar

### 1. Login

- Durum: Tamamlandi
- Yeni ana kaynak: `users`
- Destek tablolari:
  - `auth_sessions`
  - `login_attempts`
  - `password_reset_tokens`
- Kaldirilan legacy bagimliligi:
  - `kv_store > sibella.erp.users.v1`
- Test:
  - kullanici listesi PostgreSQL `users` tablosundan okunuyor
  - login handler testi gecti
  - user management artik `/api/users` uzerinden calisiyor

### 2. Dashboard

- Durum: Tamamlandi
- Veri kaynagi:
  - `products`
  - `suppliers`
  - `purchases`
  - `purchase_lines`
  - `stock_entries`
  - `stock_lines`
  - `pos_sessions`
  - `pos_sales`
  - `pos_sale_lines`
- Not:
  - dashboard summary store yerine SQL tabanli calisiyor
- Test:
  - summary handler 200 dondu
  - istatistik, son hareketler ve low stock hesaplari dogrulandi

### 3. Kategori / Koleksiyon / POS Kategori / Barkod / Tedarik Tipi / Odeme Kosulu

- Durum: Tamamlandi
- Ekran grubu: Master Data
- Veri kaynagi:
  - `categories`
  - `collections`
  - `pos_categories`
  - `barcode_standards`
  - `procurement_types`
  - `payment_terms`
- API:
  - `GET /api/master-data/:entityKey`
  - `POST /api/master-data/:entityKey`
  - `PUT /api/master-data/:entityKey/:id`
- Test:
  - create/list/update handler testi gecti

### 4. Tedarikci Listesi / Tedarikci Karti

- Durum: Tamamlandi
- Veri kaynagi:
  - `suppliers`
- API:
  - `GET /api/suppliers`
  - `POST /api/suppliers`
  - `PUT /api/suppliers/:id`
  - `DELETE /api/suppliers/:id`
- Test:
  - create/list/update handler testi gecti

### 5. Urun Listesi / Urun Karti

- Durum: Tamamlandi
- Veri kaynagi:
  - `products`
  - `product_features`
- Destek okumalari:
  - `categories`
  - `collections`
  - `pos_categories`
  - `suppliers`
- API:
  - `GET /api/products`
  - `POST /api/products`
  - `PUT /api/products/:id`
  - `DELETE /api/products/:id`
- Not:
  - urun stok goruntusu hareket tabanli hesaplanir
  - stok girisleri artik `stock_entries` API uzerinden okunur
  - POS satislari da artik PostgreSQL API uzerinden okunur
- Test:
  - create/list/update handler testi gecti

### 6. Satin Alma Listesi / Satin Alma Giris

- Durum: Tamamlandi
- Veri kaynagi:
  - `purchases`
  - `purchase_lines`
- API:
  - `GET /api/purchases`
  - `POST /api/purchases`
  - `PUT /api/purchases/:id`
- Test:
  - create/list/update handler testi gecti

### 7. Stok Giris Listesi / Stok Giris Formu

- Durum: Tamamlandi
- Veri kaynagi:
  - `stock_entries`
  - `stock_lines`
- API:
  - `GET /api/stock-entries`
  - `POST /api/stock-entries`
  - `PUT /api/stock-entries/:id`
- Test:
  - create/list/update handler testi gecti

## Siradaki Ekranlar

### 8. Stok Hareketleri

- Durum: Kismen Tamamlandi
- Mevcut durum:
  - hareket listesi frontend tarafinda `listPurchases()` ve `listStockEntries()` uzerinden uretiliyor
  - bu iki kaynak artik PostgreSQL API uzerinden besleniyor
- Hedef:
  - hesaplamayi PostgreSQL tabanli tutmak
  - gerekirse server tarafinda SQL birlestirme endpointi eklemek
- Tablolar:
  - `purchases`
  - `purchase_lines`
  - `stock_entries`
  - `stock_lines`
  - `pos_sales`
  - `pos_sale_lines`

### 9. POS Oturumlari / POS Ekrani

- Durum: Tamamlandi
- Hedef tablolar:
  - `pos_sessions`
  - `pos_sales`
  - `pos_sale_lines`
- API:
  - `GET /api/pos-sessions`
  - `POST /api/pos-sessions`
  - `POST /api/pos-sessions/:id/close`
  - `GET /api/pos-sales`
  - `POST /api/pos-sales`
- Test:
  - session create/list/close handler testi gecti
  - sale create/list handler testi gecti

### 10. Tedarikci Sozlesmeleri

- Durum: Tamamlandi
- Veri kaynagi:
  - `consignment_contracts`
- API:
  - `GET /api/contracts`
  - `POST /api/contracts`
  - `PUT /api/contracts/:id`
  - `DELETE /api/contracts/:id`
- Test:
  - create/list/update/delete handler testi gecti

### 11. Teslimat Listeleri / Tedarikci Portal Teslimat Akisi

- Durum: Tamamlandi
- Hedef tablolar:
  - `delivery_lists`
  - `delivery_lines`
- Iliskili tablolar:
  - `products`
  - `stock_entries`
  - `stock_lines`
- API:
  - `GET /api/delivery-lists`
  - `POST /api/delivery-lists`
  - `PUT /api/delivery-lists/:id`
  - `POST /api/delivery-lists/:id/complete`
- Test:
  - create/list/update handler testi gecti
  - complete teslimat > stock entry yazimi testi gecti

### 12. Sistem Parametreleri

- Durum: Tamamlandi
- Veri kaynagi:
  - `system_parameters`
- API:
  - `GET /api/settings/system-parameters`
  - `PUT /api/settings/system-parameters`
- Test:
  - get/put handler testi gecti

### 13. SMTP Ayarlari

- Durum: Tamamlandi
- Veri kaynagi:
  - `smtp_settings`
- API:
  - `GET /api/settings/smtp`
  - `PUT /api/settings/smtp`
  - `POST /api/settings/smtp/test`
- Test:
  - get/put handler testi gecti

## Hibrit Kalan Parcalar

Su an localde tamamen kaldirilmamis bagimliliklar:

- `kv_store` uzerinden calisan / tam sokulmemis moduller:
  - `server/db.js` icindeki store > table sync uyumluluk katmani
- sayfa seviyesinde kalan son teknik isler:
  - stok hareketleri ekranini server-side SQL raporlamaya tasimak
  - sayfa bazli smoke testleri tarayici senaryolariyla tamamlamak
  - legacy `kv_store` anahtarlarinin fiziksel temizligini yapmak

## Bir Sonraki Teknik Hedef

Siradaki blok:

1. legacy sync katmanini kapatmak
2. fiziksel `kv_store` temizligi yapmak
3. ekran bazli smoke test ve duzeltme turu
4. genel dokumantasyon ve tedarikci portal kullanim kilavuzu

## Test Prensibi

Her ekran gecisinde asagidaki minimum testler uygulanir:

1. Listeleme testi
2. Yeni kayit olusturma testi
3. Kayit guncelleme testi
4. Iliskili veri goruntuleme testi
5. Rol / yetki testi
6. `npm run build` dogrulamasi

Bu matris her migration bloğundan sonra guncellenecektir.
