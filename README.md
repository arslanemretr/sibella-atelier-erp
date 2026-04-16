# ERP Sibella

Uygulama React/Vite arayuzu, Express API'si ve PostgreSQL veritabani ile calisir.

## Docker ile tek komutta calistirma

Docker stack'i burada ve canlida ayni `docker-compose.yml` ile calisir. Ortama gore degisen tek sey environment degerleridir.

Ilk kurulumda `.env.docker.example` dosyasini ortamina uygun degerlerle `.env.docker` olarak hazirla. Ardindan:

```bash
docker compose --env-file .env.docker up --build -d
```

Erisim adresleri:

- Web: http://localhost:8080
- API: http://localhost:4001/api/health
- PostgreSQL: localhost:5432

Varsayilan olarak API portu sadece host makineden erisilebilir sekilde `127.0.0.1` uzerine baglanir. Dis dunyaya yalnizca web portunu acmak daha guvenlidir; `nginx` zaten `/api` isteklerini iceride API servisine yonlendirir.

Varsayilan olarak PostgreSQL portu sadece host makineden erisilebilir sekilde `127.0.0.1` uzerine baglanir. Dis agdan erisim gerekmiyorsa bu ayari boyle birak.

Konteyner durumunu kontrol etmek icin:

```bash
docker compose --env-file .env.docker ps
```

Log izlemek icin:

```bash
docker compose --env-file .env.docker logs -f db api web
```

Durdurmak icin:

```bash
docker compose --env-file .env.docker down
```

Veritabani verisini silmeden yeniden baslatmak icin `down` yeterlidir. Veritabani verisini de sifirlamak istersen:

```bash
docker compose --env-file .env.docker down -v
```

Canli ortamda da ayni compose dosyasini kullan. Sadece `.env.docker` icindeki port, sifre ve `DOCKER_DATABASE_URL` degerleri ortama gore degissin. Boylece burada test ettigin container yapisi ile canlidaki yapi ayni kalir.

Canliya gonderirken gercek `.env.docker` dosyasini repoya koyma; sadece `.env.docker.example` repoda kalmali.

## Yerelde calistirma

Yerelde calistiracaksan once PostgreSQL'in ayakta oldugundan emin ol ve `.env` icindeki `DATABASE_URL` degerini host makine icin kullan:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/erpsibella
```

Ardindan ayri terminallerde:

```bash
npm run server
```

```bash
npm run dev
```

Not: Docker icindeki API `localhost` yerine `db` servis adini kullanir. Bu yuzden Docker ve yerel calisma modlarinin veritabani baglanti ayari farklidir; `docker-compose.yml` bunu otomatik olarak dogru degerle ayarlar.
