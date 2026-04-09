# Guncel Veritabani Semasi (SQLite)

Bu dokuman `data/erp.sqlite` dosyasindaki tum tablo semasini ozetler.

## Motor ve Dosya

- Motor: SQLite
- Dosya: `data/erp.sqlite`
- Erisim katmani: `server/db.js`

## Tablolar

### Kimlik / Guvenlik

- `users`
- `auth_sessions`
- `password_reset_tokens`
- `login_attempts`

### Master Veriler

- `categories`
- `collections`
- `pos_categories`
- `barcode_standards`
- `procurement_types`
- `payment_terms`
- `suppliers`

### Urun ve Tedarik

- `products`
- `product_features`
- `purchases`
- `purchase_lines`
- `consignment_contracts` (yeni, kod tarafinda aktif)

### Stok / POS / Teslimat

- `stock_entries`
- `stock_lines`
- `pos_sessions`
- `pos_sales`
- `pos_sale_lines`
- `delivery_lists`
- `delivery_lines`

### Sistem

- `system_parameters`
- `smtp_settings`
- `kv_store`
- `store_meta`

## Iliski Ozeti

- `users.supplier_id -> suppliers.id`
- `products.supplier_id -> suppliers.id`
- `products.created_by -> users.id`
- `product_features.product_id -> products.id (CASCADE)`
- `purchases.supplier_id -> suppliers.id`
- `purchase_lines.purchase_id -> purchases.id (CASCADE)`
- `purchase_lines.product_id -> products.id`
- `consignment_contracts.supplier_id -> suppliers.id`
- `stock_entries.source_party_id -> suppliers.id`
- `stock_lines.stock_entry_id -> stock_entries.id (CASCADE)`
- `stock_lines.product_id -> products.id`
- `pos_sales.session_id -> pos_sessions.id`
- `pos_sale_lines.sale_id -> pos_sales.id (CASCADE)`
- `pos_sale_lines.product_id -> products.id`
- `delivery_lists.supplier_id -> suppliers.id`
- `delivery_lists.created_by -> users.id`
- `delivery_lines.delivery_list_id -> delivery_lists.id (CASCADE)`
- `delivery_lines.product_id -> products.id`

## Not

`consignment_contracts` tablosu yeni eklendi. Uygulama server'i yeni kod ile yeniden baslatildiginda tablo otomatik olusur.
