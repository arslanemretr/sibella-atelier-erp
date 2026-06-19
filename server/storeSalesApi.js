/* global process */
import crypto from "node:crypto";
import { sqlExec, sqlMany, sqlOne } from "./db.js";
import {
  withInventoryTransaction,
  replaceStockMovementsForSource,
  rebuildStockBalancesForLocationProducts,
  assertStockLocationStockAvailable,
} from "./inventory.js";

function nowIso() { return new Date().toISOString(); }
function createId(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function httpError(res, status, message) {
  return res.status(status).json({ ok: false, message });
}

// ── Tablo oluşturma ────────────────────────────────────────────────────────
export async function ensureStoreSalesReady() {
  await sqlExec(`
    CREATE TABLE IF NOT EXISTS store_sales (
      id                TEXT PRIMARY KEY,
      sale_no           TEXT NOT NULL UNIQUE,
      store_id          TEXT NOT NULL,
      stock_location_id TEXT NOT NULL,
      period_key        TEXT NOT NULL,
      sale_date         DATE NOT NULL,
      invoice_name      TEXT,
      total_quantity    NUMERIC(12,4) NOT NULL DEFAULT 0,
      total_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
      status            TEXT NOT NULL DEFAULT 'Tamamlandi',
      note              TEXT,
      created_by        TEXT,
      created_at        TIMESTAMPTZ,
      updated_at        TIMESTAMPTZ
    )
  `);
  await sqlExec(`
    CREATE TABLE IF NOT EXISTS store_sale_lines (
      id           TEXT PRIMARY KEY,
      sale_id      TEXT NOT NULL REFERENCES store_sales(id) ON DELETE CASCADE,
      product_id   TEXT,
      product_code TEXT,
      product_name TEXT,
      quantity     NUMERIC(12,4) NOT NULL,
      unit_price   NUMERIC(14,2) NOT NULL,
      line_total   NUMERIC(14,2) NOT NULL,
      sort_order   INT NOT NULL DEFAULT 0
    )
  `);
  await sqlExec(`CREATE INDEX IF NOT EXISTS idx_store_sales_store_id ON store_sales (store_id)`);
  await sqlExec(`CREATE INDEX IF NOT EXISTS idx_store_sales_period ON store_sales (period_key)`);
  await sqlExec(`CREATE INDEX IF NOT EXISTS idx_store_sale_lines_sale ON store_sale_lines (sale_id)`);
}

// ── Yardımcılar ─────────────────────────────────────────────────────────────
function mapSaleRow(row, lines = []) {
  return {
    id: row.id,
    saleNo: row.sale_no || "",
    storeId: row.store_id || null,
    storeName: row.store_name || "",
    stockLocationId: row.stock_location_id || null,
    periodKey: row.period_key || "",
    saleDate: row.sale_date ? String(row.sale_date).slice(0, 10) : "",
    invoiceName: row.invoice_name || "",
    totalQuantity: Number(row.total_quantity || 0),
    totalAmount: Number(row.total_amount || 0),
    status: row.status || "Tamamlandi",
    note: row.note || "",
    lineCount: lines.length || Number(row.line_count || 0),
    lines: lines.map((l) => ({
      id: l.id,
      productId: l.product_id || null,
      productCode: l.product_code || "",
      productName: l.product_name || "",
      quantity: Number(l.quantity || 0),
      unitPrice: Number(l.unit_price || 0),
      lineTotal: Number(l.line_total || 0),
    })),
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function nextSaleNo(storeId) {
  const store = await sqlOne("SELECT code FROM stores WHERE id = $1", [storeId]);
  const storeCode = String(store?.code || "GEN").toUpperCase();
  const row = await sqlOne("SELECT COUNT(*)::int AS n FROM store_sales WHERE store_id = $1", [storeId]);
  const next = Number(row?.n || 0) + 1;
  return `MS-${storeCode}-${String(next).padStart(4, "0")}`;
}

// ── Liste ───────────────────────────────────────────────────────────────────
export async function handleStoreSalesList(req, res) {
  try {
    const { storeId, periodKey, periodFrom, periodTo } = req.query || {};
    const where = [];
    const params = [];
    if (storeId) { params.push(storeId); where.push(`ss.store_id = $${params.length}`); }
    if (periodKey) { params.push(periodKey); where.push(`ss.period_key = $${params.length}`); }
    if (periodFrom) { params.push(periodFrom); where.push(`ss.period_key >= $${params.length}`); }
    if (periodTo) { params.push(periodTo); where.push(`ss.period_key <= $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = await sqlMany(`
      SELECT ss.*, s.name AS store_name,
             (SELECT COUNT(*)::int FROM store_sale_lines sl WHERE sl.sale_id = ss.id) AS line_count
      FROM store_sales ss
      LEFT JOIN stores s ON s.id = ss.store_id
      ${whereSql}
      ORDER BY ss.created_at DESC, ss.sale_no DESC
    `, params);
    return res.json({ ok: true, items: rows.map((r) => mapSaleRow(r)) });
  } catch (error) {
    return httpError(res, 500, error?.message || "Magaza satislari listelenemedi.");
  }
}

// ── Tekil ─────────────────────────────────────────────────────────────────
export async function handleStoreSalesGet(req, res) {
  try {
    const row = await sqlOne(`
      SELECT ss.*, s.name AS store_name
      FROM store_sales ss LEFT JOIN stores s ON s.id = ss.store_id
      WHERE ss.id = $1
    `, [req.params.id]);
    if (!row) return httpError(res, 404, "Satis bulunamadi.");
    const lines = await sqlMany(
      "SELECT * FROM store_sale_lines WHERE sale_id = $1 ORDER BY sort_order ASC, id ASC",
      [req.params.id],
    );
    return res.json({ ok: true, item: mapSaleRow(row, lines) });
  } catch (error) {
    return httpError(res, 500, error?.message || "Satis getirilemedi.");
  }
}

// ── Sonraki satis no ─────────────────────────────────────────────────────────
export async function handleStoreSalesNextNo(req, res) {
  try {
    const { storeId } = req.query || {};
    if (!storeId) return httpError(res, 400, "storeId zorunludur.");
    return res.json({ ok: true, saleNo: await nextSaleNo(storeId) });
  } catch (error) {
    return httpError(res, 500, error?.message || "Satis no hesaplanamadi.");
  }
}

// ── Oluştur (anında kesinleşir; stok düşer) ──────────────────────────────────
export async function handleStoreSalesCreate(req, res) {
  const body = req.body || {};
  const storeId = body.storeId;
  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  if (!storeId) return httpError(res, 400, "Magaza (storeId) zorunludur.");
  if (!rawLines.length) return httpError(res, 400, "En az bir satir eklenmelidir.");

  try {
    const store = await sqlOne("SELECT id, code, name, stock_location_id FROM stores WHERE id = $1", [storeId]);
    if (!store?.stock_location_id) return httpError(res, 400, "Magaza stok yeri bulunamadi.");

    // Satir ürün bilgilerini tamamla (kod/ad), miktar/fiyat doğrula
    const lines = [];
    for (const raw of rawLines) {
      const quantity = Number(raw.quantity || 0);
      const unitPrice = Number(raw.unitPrice || 0);
      if (!raw.productId) return httpError(res, 400, "Satir urunu secilmelidir.");
      if (quantity <= 0) return httpError(res, 400, "Adet 0'dan buyuk olmalidir.");
      const prod = await sqlOne("SELECT code, name FROM products WHERE id = $1", [raw.productId]);
      lines.push({
        id: createId("ssline"),
        productId: raw.productId,
        productCode: prod?.code || raw.productCode || "",
        productName: prod?.name || raw.productName || "",
        quantity,
        unitPrice,
        lineTotal: quantity * unitPrice,
      });
    }

    const totalQuantity = lines.reduce((s, l) => s + l.quantity, 0);
    const totalAmount = lines.reduce((s, l) => s + l.lineTotal, 0);
    const now = nowIso();
    const saleId = createId("ssale");
    const saleNo = await nextSaleNo(storeId);
    const periodKey = body.periodKey || now.slice(0, 7);
    const saleDate = body.saleDate || now.slice(0, 10);

    await withInventoryTransaction(async (tx) => {
      // Mağaza lokasyonunda yeterli stok var mı?
      await assertStockLocationStockAvailable(store.stock_location_id, lines, tx);

      await tx.exec(`
        INSERT INTO store_sales (
          id, sale_no, store_id, stock_location_id, period_key, sale_date, invoice_name,
          total_quantity, total_amount, status, note, created_by, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::timestamptz,$14::timestamptz)
      `, [
        saleId, saleNo, storeId, store.stock_location_id, periodKey, saleDate,
        body.invoiceName || null, totalQuantity, totalAmount, "Tamamlandi",
        body.note || null, req.authUser?.id || null, now, now,
      ]);

      for (let i = 0; i < lines.length; i += 1) {
        const l = lines[i];
        await tx.exec(`
          INSERT INTO store_sale_lines (
            id, sale_id, product_id, product_code, product_name, quantity, unit_price, line_total, sort_order
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, [l.id, saleId, l.productId, l.productCode, l.productName, l.quantity, l.unitPrice, l.lineTotal, i]);
      }

      // Stok çıkışı (SATIS_CIKISI / OUT) — mağaza lokasyonundan düşer
      await replaceStockMovementsForSource(
        "store-sale",
        saleId,
        lines.map((l) => ({
          movementType: "SATIS_CIKISI",
          direction: "OUT",
          affectsStock: true,
          quantity: l.quantity,
          productId: l.productId,
          stockLocationId: store.stock_location_id,
          documentNo: saleNo,
          documentDate: saleDate,
          sourceLineId: l.id,
          partyId: storeId,
          partyName: store.name || "",
          unitAmount: l.unitPrice,
          totalAmount: l.lineTotal,
          createdBy: req.authUser?.id || null,
          createdAt: now,
        })),
        tx,
      );
      await rebuildStockBalancesForLocationProducts(
        store.stock_location_id,
        lines.map((l) => l.productId),
        tx,
      );
    });

    const row = await sqlOne(`
      SELECT ss.*, s.name AS store_name FROM store_sales ss
      LEFT JOIN stores s ON s.id = ss.store_id WHERE ss.id = $1
    `, [saleId]);
    const savedLines = await sqlMany("SELECT * FROM store_sale_lines WHERE sale_id = $1 ORDER BY sort_order ASC", [saleId]);
    return res.status(201).json({ ok: true, item: mapSaleRow(row, savedLines) });
  } catch (error) {
    return httpError(res, 400, error?.message || "Satis kaydedilemedi.");
  }
}

// ── Güncelle (fatura ismi / not) ─────────────────────────────────────────────
export async function handleStoreSalesUpdate(req, res) {
  try {
    const existing = await sqlOne("SELECT id FROM store_sales WHERE id = $1", [req.params.id]);
    if (!existing) return httpError(res, 404, "Satis bulunamadi.");
    const body = req.body || {};
    await sqlExec(
      `UPDATE store_sales SET invoice_name = $2, note = $3, updated_at = $4::timestamptz WHERE id = $1`,
      [req.params.id, body.invoiceName ?? null, body.note ?? null, nowIso()],
    );
    const row = await sqlOne(`
      SELECT ss.*, s.name AS store_name FROM store_sales ss
      LEFT JOIN stores s ON s.id = ss.store_id WHERE ss.id = $1
    `, [req.params.id]);
    const lines = await sqlMany("SELECT * FROM store_sale_lines WHERE sale_id = $1 ORDER BY sort_order ASC", [req.params.id]);
    return res.json({ ok: true, item: mapSaleRow(row, lines) });
  } catch (error) {
    return httpError(res, 400, error?.message || "Satis guncellenemedi.");
  }
}

// ── Sil (stok geri yüklenir) ─────────────────────────────────────────────────
export async function handleStoreSalesDelete(req, res) {
  try {
    const row = await sqlOne("SELECT id, stock_location_id FROM store_sales WHERE id = $1", [req.params.id]);
    if (!row) return httpError(res, 404, "Satis bulunamadi.");
    const lines = await sqlMany("SELECT product_id FROM store_sale_lines WHERE sale_id = $1", [req.params.id]);
    const productIds = lines.map((l) => l.product_id).filter(Boolean);

    await withInventoryTransaction(async (tx) => {
      // Hareketleri kaldır → stok geri gelir
      await replaceStockMovementsForSource("store-sale", req.params.id, [], tx);
      if (row.stock_location_id && productIds.length) {
        await rebuildStockBalancesForLocationProducts(row.stock_location_id, productIds, tx);
      }
      await tx.exec("DELETE FROM store_sales WHERE id = $1", [req.params.id]);
    });
    return res.json({ ok: true });
  } catch (error) {
    return httpError(res, 400, error?.message || "Satis silinemedi.");
  }
}
