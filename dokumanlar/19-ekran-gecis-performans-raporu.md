# Ekran Gecis Performans Raporu

Bu rapor local uygulamada ekranlar arasi gecislerde gozlenen yavasligin kod ve runtime log analizi ile tespit edilen nedenlerini listeler.

## Ozet

- Ana darboğaz: bircok ekran ilk render asamasinda `requestJsonSync` / `requestCollectionSync` ile senkron HTTP cagrisi yapiyor.
- Bu cagrilar `XMLHttpRequest(..., false)` kullandigi icin UI thread'i blokluyor.
- Backend gecici olarak ayakta degilse Vite proxy tarafinda toplu `ECONNREFUSED` hatalari olusuyor ve ekran tamamen donuyor.
- `ProductListPage` asenkron modele gecirildi; diger ekranlarin buyuk kismi hala senkron veri akisinda.

## Runtime Log Bulgulari

### Kritik

- Vite proxy loglarinda ard arda `AggregateError [ECONNREFUSED]` goruldu.
- Etkilenen endpointler:
  - `/api/auth/session`
  - `/api/master-data/procurement-types`
  - `/api/master-data/payment-terms`
  - `/api/master-data/categories`
  - `/api/master-data/collections`
  - `/api/master-data/pos-categories`
  - `/api/master-data/barcode-standards`
- Sonuc:
  - Ekran ilk acilista cevap vermiyor gibi gorunuyor
  - Kullanici manuel yenileyince ekran bazen duzeliyor
  - Sorun sadece veri yoklugu degil, bloklayan senkron isteklerin tekrarli denemesi

## Teknik Kök Neden

### 1. Senkron API katmani

Dosya: [src/erp/apiClient.js](/d:/erpsibella/src/erp/apiClient.js)

- `requestJsonSync`
- `requestCollectionSync`
- `mutateResourceSync`

Bu fonksiyonlar tarayicida senkron XHR kullaniyor. Render icinde veya `useState(() => ...)` icinde cagrildiklarinda ekran gecisini durduruyorlar.

### 2. Render sirasinda veri toplama

Bir cok sayfa veriyi effect icinde degil, component govdesinde veya `useState` initializer icinde topluyor.

## Ekran Bazli Bulgular

### 1. ProductListPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Eski durum:
- `listProducts()`
- `listMasterData("categories")`
- `listMasterData("collections")`

Sorun:
- Ilk acilista birden fazla senkron HTTP cagrisiyla UI bloklaniyordu.

Durum:
- Bu sayfa asenkron modele alindi.
- `listProductsFresh()` ve `listMasterDataFresh()` ile arka planda yukleniyor.

### 2. ProductEditorPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimliliklar:
- `listProducts()`
- `listMasterData(...)`
- `listSuppliers()`
- `getProductById()`

Risk:
- Urun duzenleme ekranina ilk giriste birden fazla lookup senkron geliyor.
- Kod/urun cakis kontrolu icin tekrar `listProducts()` cagriliyor.

Oncelik:
- Yuksek

### 3. UserManagementPage

Dosya: [src/pages/UserManagementPage.jsx](/d:/erpsibella/src/pages/UserManagementPage.jsx)

Senkron bagimlilik:
- `listSuppliers()` `useMemo` icinde cagriliyor.

Not:
- Kullanici listesi artik async (`listUsersFresh`) ama tedarikci dropdown'u hala sync.

Oncelik:
- Orta

### 4. SupplierListPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimliliklar:
- `listSuppliers()`
- `listMasterData("procurement-types")`
- `listMasterData("payment-terms")`

Risk:
- Liste acilisi bloklanir
- Filtre secenekleri her render'da sync olusur

Oncelik:
- Yuksek

### 5. SupplierEditorPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimliliklar:
- `listProducts()`
- `listMasterData(...)`
- `listSuppliers()`
- `getSupplierById()`

Risk:
- Editor ekranina gecis yavas
- Duzenleme halinde tum lookup'lar render icinde toplaniyor

Oncelik:
- Yuksek

### 6. ContractsPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimliliklar:
- `listContracts()`
- `listSuppliers()`

Risk:
- Sozlesme listesi her geciste bloklanabilir

Oncelik:
- Orta

### 7. PurchaseListPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimliliklar:
- `listPurchases()`
- `listSuppliers()`
- `listMasterData("procurement-types")`
- `listMasterData("payment-terms")`

Risk:
- Satin alma listesi ve filtreleri ayni anda sync yukleniyor

Oncelik:
- Yuksek

### 8. PurchaseEditorPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimliliklar:
- `listProducts()`
- `listMasterData(...)`
- `listSuppliers()`
- `listPurchases()`

Risk:
- Ilk acilista hem lookup hem de varsayilan belge numarasi icin sync cagrilar var

Oncelik:
- Yuksek

### 9. StockListPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimliliklar:
- `listPurchases()`
- `listStockEntries()`
- `listProducts()`

Risk:
- Hareket listesi build edilirken purchase + stock entry + products hepsi sync okunuyor
- Bu sayfa buyuk veriyle en yavas sayfalardan biri olmaya aday

Oncelik:
- Cok yuksek

### 10. PosSessionsPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimliliklar:
- `listPosSessions()`
- detay table icinde `listPosSales()`

Risk:
- Session listesi acilirken sync
- Secili oturum detayinda tekrar sync satis toplaniyor

Oncelik:
- Orta

### 11. PosScreenPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimliliklar:
- `listPosSales()`
- `listMasterData("pos-categories")`
- dolayli olarak `buildPosProductCatalog()` -> `listProducts()`

Risk:
- POS en kritik ekranlardan biri; acilista katalog ve session verisi sync toplaniyor

Oncelik:
- Cok yuksek

### 12. StockEntryEditorPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimliliklar:
- `listSuppliers()`
- `listProducts()`

Risk:
- Stok girisi editoru acilisinda lookup maliyeti yuksek

Oncelik:
- Orta

### 13. SettingsDefinitionPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimlilik:
- `listMasterData(activeConfig.entityKey)`

Risk:
- Ayarlar altindaki tum tanim ekranlari senkron yukleniyor

Oncelik:
- Orta

### 14. StockEntryListPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimliliklar:
- `listStockEntries()`
- `listSuppliers()`

Risk:
- Liste + filtre secenekleri sync

Oncelik:
- Orta

### 15. SupplierPortalProductListPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Dolayli bagimlilik:
- `listProductsBySupplier()` -> `listProducts()`

Risk:
- Tedarikci urun listesi acilisinda ayni sync urun akisi tekrar ediyor

Oncelik:
- Yuksek

### 16. SupplierPortalProductEditorPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimliliklar:
- `listMasterData("categories")`
- `listMasterData("collections")`
- `listSuppliers()`
- `getProductById()`

Oncelik:
- Yuksek

### 17. SupplierDeliveryListsPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimliliklar:
- `listDeliveryLists()`
- `listSuppliers()`

Oncelik:
- Orta

### 18. SupplierPortalDeliveryEditorPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimliliklar:
- `listMasterData("categories")`
- `listMasterData("collections")`
- `getProductById()`
- `getSupplierById()`

Risk:
- Satir bazli urun eslestirme ve duzenleme ekraninda tekrarli sync lookup var

Oncelik:
- Yuksek

### 19. ParametersPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimlilik:
- `getSystemParameters()` iki kez cagriliyor

Kaynak:
- [src/erp/systemParameters.js](/d:/erpsibella/src/erp/systemParameters.js)

Risk:
- Parametre ekrani kucuk ama hala sync XHR kullaniyor

Oncelik:
- Dusuk

### 20. SmtpSettingsPage

Dosya: [src/erp/pages.jsx](/d:/erpsibella/src/erp/pages.jsx)

Senkron bagimlilik:
- `getSmtpSettings()` iki kez cagriliyor

Kaynak:
- [src/erp/smtpSettings.js](/d:/erpsibella/src/erp/smtpSettings.js)

Oncelik:
- Dusuk

## Oncelikli Duzeltme Sirasi

1. `PurchaseListPage`
2. `PurchaseEditorPage`
3. `StockListPage`
4. `PosScreenPage`
5. `SupplierListPage`
6. `SupplierEditorPage`
7. `SupplierPortalProductListPage`
8. `SupplierPortalProductEditorPage`
9. `SupplierPortalDeliveryEditorPage`
10. `UserManagementPage`
11. `SettingsDefinitionPage`
12. `ParametersPage` ve `SmtpSettingsPage`

## Onerilen Cozum Modeli

Tum sayfalar icin ortak model:

- render icinde `listX()` cagrisi yapma
- `useState([])` ile bos basla
- `useEffect` + async `refreshX()` ile veri yukle
- lookup tablolarini `Promise.all` ile paralel cek
- tablo ve form icin `loading` goster
- senkron `requestJsonSync` / `requestCollectionSync` kullanimini yeni sayfalarda tamamen bitir

## Simdiden Tamamlanan

- `ProductListPage` asenkron yukleme modeline tasindi.

## Sonuc

Sorun tek bir ekranda degil; uygulamanin kalan buyuk kismina yayilmis senkron veri erisimi var. Performans iyilestirmesinin ana isi, ekranlari tek tek async veri modeliyle yeniden yazmak olacak.
