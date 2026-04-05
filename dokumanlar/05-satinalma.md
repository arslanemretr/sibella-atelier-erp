# Satinalma

Sayfalar:

- `/purchasing/list`
- `/purchasing/entry`
- `/purchasing/entry/:purchaseId`

Amaci:

- Gecmis satin alma kayitlarini listelemek
- Yeni satin alma fisleri olusturmak
- Mevcut satin alma kaydini duzenlemek

Genel bilgiler:

- Tedarikci
- Tarih
- Belge No
- Tedarik Tipi
- Odeme Kosulu
- Aciklama

Satir kalemleri:

- Urun
- Miktar
- Birim fiyat
- Not

Calisma sekli:

- Kaydet ile satin alma belgesi olusur.
- Satin alma satirlari urun stoklarini artirir.
- Liste ekrani filtreli ve detay drawer li calisir.

Kullandigi veri:

- `src/erp/purchasesData.js`
- `src/erp/productsData.js`
- `src/erp/suppliersData.js`

Not:

- Hareket verileri temiz baslangica alinmistir; yeni satin alma kayitlari sifirdan baslar.

