# GitHub ve Canli Yayin Gereklilikleri

## Ozet

Bu dokuman, projenin GitHub'a yuklenmesi ve gercek sunucuya tasinmasi icin gereken teknik uygunluk kontrollerini, mevcut durumu ve eksik kalan maddeleri listeler.

## Mevcut Uygunluk Kontrolleri

Asagidaki kontroller tamamlanmistir:

- `npm run lint` basarili
- `npm run build` basarili
- `SQLite` veritabani altyapisi kuruldu
- API saglik kontrolu basarili: `GET /api/health`
- Ana is verileri `SQLite` veritabanina alinmis durumda
- `.env` ve veritabani dosyalari `.gitignore` icine eklendi
- `.env.example` olusturuldu

## GitHub Yukleme Oncesi Kontrol Listesi

GitHub'a yuklemeden once su maddeler saglanmalidir:

- `node_modules` repo icine alinmamalidir
- `dist` klasoru repo icine alinmamalidir
- gercek `.env` dosyasi repo icine alinmamalidir
- `data/erp.sqlite` ve diger SQLite dosyalari repo icine alinmamalidir
- gizli anahtar, token, sifre gibi bilgiler commit edilmemelidir
- `README` ve teknik dokumanlar guncel olmalidir
- `package-lock.json` commit edilmelidir

## Ortam Dosyasi

Ornek ortam dosyasi:

```env
API_PORT=4001
```

Canli ortamda ihtiyaca gore ek degiskenler eklenebilir.

## Canli Sunucu Gereklilikleri

Bu uygulama artik iki bolumden olusur:

1. Frontend
- `Vite + React`
- build cikisi `dist/`

2. Backend
- `Node.js + Express`
- `SQLite`
- servis dosyasi: `server/index.js`

Bu nedenle canli ortamda sadece statik frontend yayinlamak yeterli degildir. `Node API` de ayaga kaldirilmalidir.

## Sunucu Gereksinimleri

Minimum onerilen ortam:

- `Node.js 20+`
- `npm 10+`
- `Nginx`
- `PM2` veya benzeri process manager
- yazma izni olan disk alani (`data/` klasoru icin)

## Kurulum Adimlari

### 1. Kodun Sunucuya Alinmasi

```bash
git clone <repo-url>
cd erpsibella
npm install
```

### 2. Ortam Dosyasi

```bash
cp .env.example .env
```

Gerekirse `API_PORT` guncellenir.

### 3. API Servisinin Calistirilmasi

```bash
npm run server
```

Kalici calisma icin PM2 onerilir:

```bash
pm2 start server/index.js --name erpsibella-api
pm2 save
```

### 4. Frontend Build

```bash
npm run build
```

### 5. Frontend Yayini

`dist/` klasoru Nginx ile servis edilmelidir.

## Nginx Gereksinimi

Mevcut `nginx.conf` dosyasi sadece SPA frontend servisi icin uygundur. Ancak sistem artik `/api` kullandigi icin canli ortamda asagidaki mantik gerekir:

- `/` -> frontend `dist`
- `/api` -> `Node API` servisine proxy

Yani mevcut Docker/Nginx yapisi tek basina yeterli degildir; `/api` proxy tanimi ile guncellenmelidir.

## Docker Durumu

Mevcut `Dockerfile` yalnizca frontend build alip `nginx` ile yayin yapar.

Bu nedenle:

- mevcut Dockerfile tam sistem icin yeterli degildir
- backend API bu container icinde calismamaktadir

Canli kullanim icin iki yol vardir:

1. Ayrik kurulum
- frontend: nginx
- backend: node + pm2

2. Docker Compose
- `frontend`
- `api`
- kalici volume ile `data/`

## Veritabani ve Kalicilik

Veritabani dosyalari:

- `data/erp.sqlite`
- `data/erp.sqlite-shm`
- `data/erp.sqlite-wal`

Sunucuda:

- `data/` klasoru kalici disk uzerinde olmali
- deploy sirasinda silinmemeli
- yedeklenmeli

## Yedekleme Gerekliligi

Zorunlu oneriler:

- gunluk `erp.sqlite` yedegi
- yayin oncesi manuel snapshot
- kritik degisikliklerden once kopya alma

## Guvenlik Kontrolleri

Tamamlanan:

- sifreler artik repo icinde gizli ortam dosyasi mantigina uygun ayrilabilir
- `.env` ignore edildi
- DB dosyalari ignore edildi

Eksik / dikkat gereken:

- su an kullanici sifreleri store icinde duz metin mantiginda tutuluyor
- canli ortama cikmadan once `password_hash` yapisina gecilmeli
- auth token/session guvenligi sertlestirilmeli
- rol kontrolleri backend seviyesinde daha katı hale getirilmeli

## Audit Sonucu

`npm audit --omit=dev` sonucunda asagidaki paketlerde risk goruldu:

- `lodash`
- `react-quill / quill`
- `xlsx`

Not:

- `xlsx` icin dogrudan fix yok
- `react-quill` su an projede aktif kullanimda degilse kaldirilmasi dusunulmeli
- yayin oncesi bagimlilik temizlik turu onerilir

## Canliya Cikmadan Once Zorunlu Tamamlanmasi Gerekenler

Asagidaki maddeler hala tamamlanmalidir:

1. `Nginx /api proxy` yapisi yazilacak
2. mevcut `Dockerfile` tam sistem icin revize edilecek veya `docker-compose.yml` eklenecek
3. sifreler hash'li yapıya alinacak
4. backend yetki kontrolu store seviyesinden API seviyesine sertlestirilecek
5. veritabani backup stratejisi belirlenecek
6. canli domain ve SSL yapisi tanimlanacak
7. loglama ve hata izleme eklenecek

## Yayin Karari

Bugunku haliyle proje:

- gelistirme ve kapali pilot icin uygun
- gercek veritabaniyla calisiyor
- GitHub'a yuklenmeye teknik olarak uygun

Ancak gercek canli uretim yayini icin:

- API reverse proxy
- sifre hashleme
- deployment otomasyonu
- backup ve izleme

adimlari tamamlanmadan final production kabul edilmemelidir.
