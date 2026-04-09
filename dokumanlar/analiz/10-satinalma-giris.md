# Satinalma Giris Analizi

## Arayuz Eksiklikleri
- Fatura, vergi, irsaliye eki ve dosya yukleme alanlari yok.
- Urun secimi tum urunleri gosteriyor; tedarikci bazli filtreleme yok.

## Kurgu Hatalari
- Satin alma kaydi kaydedildigi anda stok artiyor; taslak ve onay ayrimi olmadigi icin stok siser.
- Belge numarasi benzersizligi kontrol edilmiyor.
- Farkli tedarikciye ait urunler ayni satin alma belgesine eklenebilir.

## Veritabani Hatalari
- Satin alma kaydi ile stok etkisi ayri transaction yerine istemci tarafinda baglaniyor.
- Belge durumunu ve muhasebe etkisini ayiracak veri modeli yok.

## Guvenlik Aciklari
- Satin alma olusturma/guncelleme icin rol ve onay mekanizmasi bulunmuyor.
- Istemci uzerinden miktar ve fiyat manipule edilerek kayit olusturulabilir.
## Cozum Onerileri
- Fatura, irsaliye, vergi ve dosya ek alanlari satin alma formuna eklenmelidir.
- Urun secimi secili tedarikciye filtrelenmeli ve farkli tedarikci urunleri ayni belgeye eklenememelidir.
- Satin alma kaydi taslak, onay ve tamamlandi gibi durumlarla yonetilmeli; stok etkisi sadece tamamlandiginda olusmalidir.
- Belge numarasi benzersizligi sunucu ve veritabani seviyesinde garanti edilmelidir.
- Satin alma olusturma ve guncelleme islemleri rol bazli yetki ve onay mekanizmasi ile korunmalidir.
## Yapilmasi Onerilen Islemler
1. Satin alma formuna durum bazli is akisi ekleyin.
2. Belge numarasina unique kontrol ve index ekleyin.
3. Urun secimini tedarikciye gore filtreleyin.
4. Stok etkisini sadece tamamlanmis belgelerde uygulayin.
