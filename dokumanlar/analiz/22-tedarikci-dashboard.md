# Tedarikci Dashboard Analizi

## Arayuz Eksiklikleri
- KPI kartlarindan detay ekrana gecis yok.
- Urun bazli dusuk stok, revizyon bekleyen urun ve son mesajlar alanlari eksik.

## Kurgu Hatalari
- Gosterilen stok degeri maliyet x stok uzerinden gidiyor; tedarikci icin hangi degerleme yontemi kullanildigi net degil.
- Dashboard yalnizca supplierId filtresiyle calisiyor; gercek sunucu yetkilendirmesi yok.

## Veritabani Hatalari
- Tedarikci ozetleri icin ayri rapor veya materialized veri yok; tum veriler istemcide hesaplanıyor.
- Firma ile kullanici profili arasinda tutarsizlik cikarsa ekranda hangisinin dogru oldugu belli degil.

## Guvenlik Aciklari
- `localStorage` icindeki `supplierId` degistirilirse baska tedarikci verisi okunabilir.
- Sunucu API'sinde buna karsi bagimsiz bir filtreleme/kimlik kontrolu yok.
## Cozum Onerileri
- KPI kartlarina detay ekrana gecis ve drill-down aksiyonlari eklenmelidir.
- Dusuk stok, revizyon bekleyen urun ve mesaj alanlari dashboarda eklenmelidir.
- Stok degerleme yontemi acikca belirtilmeli veya secilebilir hale getirilmelidir.
- Dashboard verileri sunucu tarafinda session kullanicisina gore filtrelenmelidir.
- Tedarikci ozetleri icin ayri rapor endpointleri kullanilmalidir.
## Yapilmasi Onerilen Islemler
1. KPI kartlarina detay gecis ekleyin.
2. Dusuk stok ve revizyon uyari alanlari olusturun.
3. Dashboard verisini supplier bazli sunucu sorgusuna tasiyin.
4. Stok degerleme yontemini ekranda aciklayin.
