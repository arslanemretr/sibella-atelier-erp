import crypto from "node:crypto";
import process from "node:process";
import { ensureDatabaseReady, sqlExec, sqlOne } from "../server/db.js";

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

const PRODUCTS = [
  { code: "HPRP0001", name: "Kedi Tasması (KTD-01)",         salePrice: 250,  cost: 125, stock: 1 },
  { code: "HPRP0002", name: "Kedi Tasması (KTD-02)",         salePrice: 250,  cost: 125, stock: 1 },
  { code: "HPRP0003", name: "Gözlük Askısı (GA-PL-01)",     salePrice: 350,  cost: 175, stock: 1 },
  { code: "HPRP0004", name: "Gözlük Askısı (GA-F-01)",      salePrice: 350,  cost: 175, stock: 1 },
  { code: "HPRP0005", name: "Telefon Askısı (CA-GO-01)",    salePrice: 250,  cost: 125, stock: 1 },
  { code: "HPRP0006", name: "Telefon Askısı (CA-TW-01)",    salePrice: 250,  cost: 125, stock: 1 },
  { code: "HPRP0007", name: "Telefon Askısı (TAD-SF-01)",   salePrice: 850,  cost: 425, stock: 1 },
  { code: "HPRP0008", name: "Telefon Askısı (TAR-TW-02)",   salePrice: 750,  cost: 375, stock: 1 },
  { code: "HPRP0009", name: "Telefon Askısı (TAR-OK-03)",   salePrice: 750,  cost: 375, stock: 1 },
  { code: "HPRP0010", name: "Telefon Askısı (TAD-TR-04)",   salePrice: 850,  cost: 425, stock: 1 },
  { code: "HPRP0011", name: "Telefon Askısı (TAŞ-SŞ-01)",   salePrice: 850,  cost: 425, stock: 1 },
];

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL zorunludur. Örnek: DATABASE_URL=postgresql://... node scripts/import-hprp-products.mjs");
  }

  await ensureDatabaseReady();

  let inserted = 0;
  let skipped = 0;

  for (const p of PRODUCTS) {
    const existing = await sqlOne("SELECT id FROM products WHERE code = $1", [p.code]);
    if (existing) {
      console.log(`ATLANDI  ${p.code} — zaten mevcut`);
      skipped++;
      continue;
    }

    const id = createId("prd");
    const now = nowIso();

    await sqlExec(`
      INSERT INTO products (
        id, code, name,
        sale_price, sale_currency,
        cost, cost_currency,
        stock, min_stock,
        barcode, supplier_code,
        product_type, sales_tax,
        image,
        is_for_sale, is_for_purchase, use_in_pos, track_inventory,
        status, workflow_status,
        notes, created_at, updated_at
      ) VALUES (
        $1, $2, $3,
        $4, 'TRY',
        $5, 'TRY',
        $6, 0,
        '', '',
        'kendi', '%20',
        '/products/baroque-necklace.svg',
        true, false, true, true,
        'Aktif', 'Taslak',
        '', $7, $8
      )
    `, [id, p.code, p.name, p.salePrice, p.cost, p.stock, now, now]);

    console.log(`EKLENDI  ${p.code} — ${p.name}`);
    inserted++;
  }

  console.log(`\nTamamlandi: ${inserted} eklendi, ${skipped} atlandi.`);
}

run().catch((err) => {
  console.error("Hata:", err.message);
  process.exit(1);
});
