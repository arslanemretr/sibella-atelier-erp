# GitHub ve Docker Farki

## GitHub Nedir

`GitHub`, kaynak kodunu saklamak, versiyonlamak ve ekip ile birlikte yonetmek icin kullanilir.

Avantajlari:

- kod gecmisi tutulur
- degisiklikler geri alinabilir
- ekip calismasi kolaylasir
- sunucuya deploy etmeden once merkezi kaynak olur

Kisaca:

- `GitHub = kodun evi`

## Docker Nedir

`Docker`, uygulamayi calisacak tum bagimliliklari ile paketlemek ve farkli sunucularda ayni sekilde ayaga kaldirmak icin kullanilir.

Avantajlari:

- ayni ortam her yerde tekrar kurulabilir
- sunucu tasima kolaylasir
- frontend ve backend servisleri birlikte yonetilebilir
- kurulum farkliliklari azalir

Kisaca:

- `Docker = uygulamanin tasinabilir calisma kutusu`

## Hangisi Daha Avantajli

Bu iki teknoloji birbirinin alternatifi degildir.

En dogru kurgu:

- `GitHub` ile kodu yonetmek
- `Docker Compose` ile sunucuda calistirmak

Yani:

- GitHub olmadan kod yonetimi zayif kalir
- Docker olmadan kurulum ve tasima zorlasir

## Bu Projede Kurulan Yapi

Bu projede:

- kaynak kod GitHub'a uygun hale getirildi
- deploy icin `Docker Compose` kuruldu

Dosyalar:

- `docker-compose.yml`
- `Dockerfile.web`
- `Dockerfile.api`
- `nginx.conf`

## Onerilen Kullanim

1. Kodu GitHub'a yukle
2. Sunucuda repoyu cek
3. Docker Compose ile servisi ayaga kaldir

Ornek:

```bash
git clone <repo-url>
cd erpsibella
docker compose up -d --build
```

## Sonuc

Bu proje icin en avantajli model:

- `GitHub + Docker Compose`

tek basina sadece GitHub ya da sadece Docker degil.
