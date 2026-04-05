# Stok

Sayfalar:

- `/stock/entry`
- `/stock/entry/:stockEntryId`
- `/stock/list`

Amaci:

- Stok girislerini kaydetmek
- Tarih bazli stok hareketlerini izlemek

Stok giris ekranı:

- Stok teslim eden
- Tarih
- Belge No
- Stok cesidi
- Giris kaynagi
- Not
- Satir bazli urun listesi

Stok hareketleri:

- Satin alma girisleri
- Stok girisleri
- POS satis cikislari icin hazir hareket mantigi

Calisma sekli:

- Stok girisi kaydedildiginde urun stoklari artar.
- Stok hareketleri ekrani tarih bazli hareket listesi uretir.
- Belge numarasina basinca ilgili kayda donulebilir.

Kullandigi veri:

- `src/erp/stockEntriesData.js`
- `src/erp/purchasesData.js`
- `src/erp/productsData.js`

