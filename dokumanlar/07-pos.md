# POS

Sayfalar:

- `/pos/sessions`
- `/pos/store`

Amaci:

- Magaza oturumu acmak ve kapatmak
- Tek oturum icinde birden fazla fis yonetmek
- Hizli satis yapmak

Oturumlar:

- Acilis tarih ve saati kaydedilir
- Kapanis tarih ve saati kaydedilir
- Oturuma bagli satis adedi ve toplam gorulur

POS ekranı:

- Oturum yoksa once `Kasayi Acin` ekrani gelir
- `Yeni` ile ayni oturum icinde yeni fis acilir
- Acik fisler ustte sekme olarak gorunur
- Urun secince aktif fisin sepetine eklenir
- Musteri ve not fis bazinda tutulur
- Indirim fis bazinda uygulanir
- Odeme ile satis kaydi olusur ve stok duser

Sol alt tus takimi:

- Secili satira gore miktar veya fiyat girer
- `%` indirim ekranini acar
- `⌫` son karakteri siler

Kullandigi veri:

- `src/erp/posData.js`
- `src/erp/productsData.js`
- `src/erp/masterData.js`

Not:

- POS oturum ve satis hareketleri temiz baslangica alinmistir.

