// Tek seferlik toplu görsel küçültme (backfill).
// DB'de data URL olarak saklanan büyük ham fotoğrafları (ör. 3024x4032, 2-3 MB)
// makul bir boyuta (en fazla 1280px, JPEG kalite 78) indirir. Böylece PDF'e
// güvenle gömülür, ürün listesi/görsel ucu hızlanır, DB şişkinliği azalır.
//
// Kullanim (api konteyneri icinde):
//   docker compose exec api node scripts/downscale-images.mjs            # DRY-RUN (yazmaz, sadece rapor)
//   docker compose exec api node scripts/downscale-images.mjs --apply    # gercekten yazar
//
// NOT: --apply oncesi DB yedegi onerilir:
//   docker compose exec db pg_dump -U postgres erpsibella > yedek.sql

import pg from "pg";
import Jimp from "jimp";

const { Pool } = pg;

const APPLY = process.argv.includes("--apply");
const MAX_DIM = 1280;       // en uzun kenar bu pikseli gecmez
const QUALITY = 78;         // JPEG kalitesi
const THRESHOLD = 200 * 1024; // sadece data URL uzunlugu bunu asanlara dokun (~200 KB)

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
if (!DATABASE_URL) {
  console.error("HATA: DATABASE_URL tanimli degil. Scripti api konteyneri icinde calistirin.");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// (tablo, id kolonu, gorsel kolonu, updated_at'e dokunulsun mu)
const TARGETS = [
  { table: "products", idCol: "id", imgCol: "image", touchUpdatedAt: true },
  { table: "store_shipment_lines", idCol: "id", imgCol: "image", touchUpdatedAt: false },
];

function parseDataUrl(s) {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s.exec(s || "");
  if (!m) return null;
  return { mime: m[1].toLowerCase(), base64: m[2] };
}

function fmtKB(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}

async function processTable(t) {
  const stat = { taranan: 0, kucultuldu: 0, atlandi_webp: 0, atlandi_kucuk: 0, hata: 0, oncekiB: 0, sonrakiB: 0 };

  const { rows } = await pool.query(
    `SELECT ${t.idCol} AS id, ${t.imgCol} AS img
       FROM ${t.table}
      WHERE ${t.imgCol} LIKE 'data:image/%'
        AND length(${t.imgCol}) > $1`,
    [THRESHOLD],
  );

  console.log(`\n=== ${t.table}: ${rows.length} aday satir (>${fmtKB(THRESHOLD)}) ===`);

  for (const row of rows) {
    stat.taranan += 1;
    const parsed = parseDataUrl(row.img);
    if (!parsed) { stat.hata += 1; continue; }
    if (parsed.mime.includes("webp") || parsed.mime.includes("svg")) {
      // jimp webp okuyamaz; webp'ler zaten kucuk — atla
      stat.atlandi_webp += 1;
      continue;
    }

    const beforeLen = row.img.length;
    let newUrl;
    try {
      const inBuf = Buffer.from(parsed.base64, "base64");
      const img = await Jimp.read(inBuf);
      if (img.bitmap.width > MAX_DIM || img.bitmap.height > MAX_DIM) {
        img.scaleToFit(MAX_DIM, MAX_DIM);
      }
      // Saydamligi beyaz zemine yedir (JPEG'de siyah olmasin)
      const flat = await Jimp.create(img.bitmap.width, img.bitmap.height, 0xffffffff);
      flat.composite(img, 0, 0);
      flat.quality(QUALITY);
      const outBuf = await flat.getBufferAsync(Jimp.MIME_JPEG);
      newUrl = `data:image/jpeg;base64,${outBuf.toString("base64")}`;
    } catch (error) {
      stat.hata += 1;
      console.log(`  ! ${row.id}: okunamadi/cevrilemedi (${error?.message || "hata"})`);
      continue;
    }

    const afterLen = newUrl.length;
    if (afterLen >= beforeLen) {
      // Kucultme kazanc saglamadi (zaten optimize) — dokunma
      stat.atlandi_kucuk += 1;
      continue;
    }

    stat.kucultuldu += 1;
    stat.oncekiB += beforeLen;
    stat.sonrakiB += afterLen;
    console.log(`  - ${row.id}: ${fmtKB(beforeLen)} -> ${fmtKB(afterLen)} ${APPLY ? "(yazildi)" : "(dry-run)"}`);

    if (APPLY) {
      const setUpdated = t.touchUpdatedAt ? ", updated_at = now()" : "";
      await pool.query(
        `UPDATE ${t.table} SET ${t.imgCol} = $1${setUpdated} WHERE ${t.idCol} = $2`,
        [newUrl, row.id],
      );
    }
  }

  console.log(
    `  --> kucultuldu: ${stat.kucultuldu}, atlandi(zaten kucuk): ${stat.atlandi_kucuk}, ` +
    `atlandi(webp/svg): ${stat.atlandi_webp}, hata: ${stat.hata}` +
    (stat.kucultuldu ? `, kazanc: ${fmtKB(stat.oncekiB)} -> ${fmtKB(stat.sonrakiB)}` : ""),
  );
  return stat;
}

async function main() {
  console.log(`MOD: ${APPLY ? "APPLY (yaziyor)" : "DRY-RUN (yazmaz)"}  |  max ${MAX_DIM}px, kalite ${QUALITY}`);
  let totBefore = 0, totAfter = 0, totCount = 0;
  for (const t of TARGETS) {
    const s = await processTable(t);
    totBefore += s.oncekiB; totAfter += s.sonrakiB; totCount += s.kucultuldu;
  }
  console.log(`\n==== TOPLAM: ${totCount} gorsel kucultuldu, ${fmtKB(totBefore)} -> ${fmtKB(totAfter)} ====`);
  if (!APPLY) {
    console.log("Bu bir DRY-RUN idi; hicbir sey yazilmadi. Uygulamak icin: --apply ekleyin.");
  }
  await pool.end();
}

main().catch((error) => {
  console.error("BEKLENMEYEN HATA:", error);
  process.exit(1);
});
