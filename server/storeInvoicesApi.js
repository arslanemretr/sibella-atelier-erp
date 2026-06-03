/* global process */
import crypto from "node:crypto";
import { sqlExec, sqlMany, sqlOne } from "./db.js";

function nowIso() { return new Date().toISOString(); }
function createId(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function httpError(res, status, message) {
  return res.status(status).json({ ok: false, message });
}

// ── Tablo oluşturma ────────────────────────────────────────────────────────
export async function ensureStoreInvoicesReady() {
  await sqlExec(`
    CREATE TABLE IF NOT EXISTS store_invoices (
      id           TEXT PRIMARY KEY,
      invoice_no   TEXT NOT NULL UNIQUE,
      store_id     TEXT NOT NULL,
      invoice_date DATE NOT NULL,
      total_amount NUMERIC(14,2) NOT NULL,
      kdv_rate     INT NOT NULL,
      quantity     NUMERIC(12,4) NOT NULL DEFAULT 1,
      kdv_amount   NUMERIC(14,2) NOT NULL,
      unit_amount  NUMERIC(14,2) NOT NULL,
      service_amount NUMERIC(14,2) NOT NULL,
      period_key   TEXT NOT NULL,
      due_date     DATE NOT NULL,
      description  TEXT,
      ext_invoice_no TEXT,
      created_by   TEXT,
      created_at   TIMESTAMPTZ,
      updated_at   TIMESTAMPTZ
    )
  `);
  await sqlExec(`ALTER TABLE store_invoices ADD COLUMN IF NOT EXISTS ext_invoice_no TEXT`);
  await sqlExec(`CREATE INDEX IF NOT EXISTS idx_store_invoices_store_id ON store_invoices (store_id)`);
  await sqlExec(`CREATE INDEX IF NOT EXISTS idx_store_invoices_period ON store_invoices (period_key)`);
}

// ── Yardımcı: Vade tarihi hesapla ─────────────────────────────────────────
// Dönem son günü + firma vade günü → hafta sonu ise Pazartesiye kaydır
function calcDueDate(periodKey, paymentDueDays) {
  const [year, month] = periodKey.split("-").map(Number);
  // Dönem son günü
  const lastDay = new Date(year, month, 0); // month 1-12 → Date(y, m, 0) = last day of month
  lastDay.setDate(lastDay.getDate() + Number(paymentDueDays || 0));
  // Hafta sonu kontrolü
  const dow = lastDay.getDay(); // 0=Pazar, 6=Cumartesi
  if (dow === 6) lastDay.setDate(lastDay.getDate() + 2); // Cumartesi → Pazartesi
  if (dow === 0) lastDay.setDate(lastDay.getDate() + 1); // Pazar → Pazartesi
  return lastDay.toISOString().slice(0, 10);
}

// ── Hesaplamalar ───────────────────────────────────────────────────────────
function calcAmounts(totalAmount, kdvRate, quantity) {
  const total = Number(totalAmount || 0);
  const rate  = Number(kdvRate || 0);
  const qty   = Number(quantity || 1);
  const serviceAmount = rate > 0 ? total / (1 + rate / 100) : total;
  const kdvAmount     = total - serviceAmount;
  const unitAmount    = qty > 0 ? serviceAmount / qty : serviceAmount;
  return {
    serviceAmount: Math.round(serviceAmount * 100) / 100,
    kdvAmount:     Math.round(kdvAmount * 100) / 100,
    unitAmount:    Math.round(unitAmount * 100) / 100,
  };
}

// ── Sonraki fatura numarası ────────────────────────────────────────────────
async function getNextInvoiceNo() {
  const year = new Date().getFullYear();
  const row = await sqlOne(
    `SELECT COUNT(*)::int AS cnt FROM store_invoices WHERE invoice_no LIKE $1`,
    [`FAT-${year}-%`],
  );
  const seq = (Number(row?.cnt || 0) + 1).toString().padStart(4, "0");
  return `FAT-${year}-${seq}`;
}

// ── Row mapper ─────────────────────────────────────────────────────────────
function mapRow(row) {
  if (!row) return null;
  return {
    id:            row.id,
    invoiceNo:     row.invoice_no,
    storeId:       row.store_id,
    storeName:     row.store_name || "",
    invoiceDate:   row.invoice_date ? String(row.invoice_date).slice(0, 10) : null,
    totalAmount:   Number(row.total_amount || 0),
    kdvRate:       Number(row.kdv_rate || 0),
    quantity:      Number(row.quantity || 1),
    kdvAmount:     Number(row.kdv_amount || 0),
    unitAmount:    Number(row.unit_amount || 0),
    serviceAmount: Number(row.service_amount || 0),
    periodKey:     row.period_key || "",
    dueDate:       row.due_date ? String(row.due_date).slice(0, 10) : null,
    description:   row.description || "",
    extInvoiceNo:  row.ext_invoice_no || "",
    createdBy:     row.created_by || null,
    createdAt:     row.created_at || null,
    updatedAt:     row.updated_at || null,
  };
}

// ── GET /api/store-invoices ────────────────────────────────────────────────
export async function handleStoreInvoicesList(req, res) {
  const { storeId, periodKey } = req.query;
  const conds  = [];
  const params = [];
  let   idx    = 1;
  if (storeId)   { conds.push(`si.store_id = $${idx++}`);    params.push(storeId); }
  if (periodKey) { conds.push(`si.period_key = $${idx++}`);  params.push(periodKey); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = await sqlMany(
    `SELECT si.*, s.name AS store_name
     FROM store_invoices si
     LEFT JOIN stores s ON s.id = si.store_id
     ${where}
     ORDER BY si.invoice_date DESC, si.invoice_no DESC`,
    params,
  );
  return res.json({ ok: true, items: rows.map(mapRow) });
}

// ── GET /api/store-invoices/:id ────────────────────────────────────────────
export async function handleStoreInvoicesGet(req, res) {
  const row = await sqlOne(
    `SELECT si.*, s.name AS store_name FROM store_invoices si
     LEFT JOIN stores s ON s.id = si.store_id
     WHERE si.id = $1`,
    [req.params.id],
  );
  if (!row) return httpError(res, 404, "Fatura bulunamadi.");
  return res.json({ ok: true, item: mapRow(row) });
}

// ── GET /api/store-invoices/next-no ───────────────────────────────────────
export async function handleStoreInvoicesNextNo(req, res) {
  const invoiceNo = await getNextInvoiceNo();
  return res.json({ ok: true, invoiceNo });
}

// ── POST /api/store-invoices ───────────────────────────────────────────────
export async function handleStoreInvoicesCreate(req, res) {
  const body = req.body || {};
  const { storeId, invoiceDate, totalAmount, kdvRate, quantity, periodKey, description, extInvoiceNo } = body;
  if (!storeId || !invoiceDate || !totalAmount || !periodKey) {
    return httpError(res, 400, "storeId, invoiceDate, totalAmount ve periodKey zorunludur.");
  }
  // Firma vade gün sayısını çek
  const store = await sqlOne("SELECT payment_due_days FROM stores WHERE id = $1", [storeId]);
  if (!store) return httpError(res, 404, "Magaza bulunamadi.");

  const { serviceAmount, kdvAmount, unitAmount } = calcAmounts(totalAmount, kdvRate, quantity);
  const dueDate   = calcDueDate(periodKey, store.payment_due_days || 0);
  const invoiceNo = await getNextInvoiceNo();
  const id        = createId("sinv");
  const now       = nowIso();

  await sqlExec(
    `INSERT INTO store_invoices
       (id, invoice_no, store_id, invoice_date, total_amount, kdv_rate, quantity,
        kdv_amount, unit_amount, service_amount, period_key, due_date, description,
        ext_invoice_no, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8,$9,$10,$11,$12::date,$13,$14,$15,$16::timestamptz,$17::timestamptz)`,
    [id, invoiceNo, storeId, invoiceDate, Number(totalAmount), Number(kdvRate || 0),
     Number(quantity || 1), kdvAmount, unitAmount, serviceAmount,
     periodKey, dueDate, description || "",
     extInvoiceNo || null, req.authUser?.id || null, now, now],
  );
  const created = await sqlOne(
    `SELECT si.*, s.name AS store_name FROM store_invoices si
     LEFT JOIN stores s ON s.id = si.store_id WHERE si.id = $1`, [id],
  );
  return res.status(201).json({ ok: true, item: mapRow(created) });
}

// ── PUT /api/store-invoices/:id ────────────────────────────────────────────
export async function handleStoreInvoicesUpdate(req, res) {
  const existing = await sqlOne("SELECT * FROM store_invoices WHERE id = $1", [req.params.id]);
  if (!existing) return httpError(res, 404, "Fatura bulunamadi.");
  const body = req.body || {};
  const storeId     = body.storeId     || existing.store_id;
  const invoiceDate = body.invoiceDate || existing.invoice_date;
  const totalAmount = body.totalAmount !== undefined ? body.totalAmount : existing.total_amount;
  const kdvRate     = body.kdvRate     !== undefined ? body.kdvRate     : existing.kdv_rate;
  const quantity    = body.quantity    !== undefined ? body.quantity    : existing.quantity;
  const periodKey   = body.periodKey   || existing.period_key;
  const description  = body.description  !== undefined ? body.description  : existing.description;
  const extInvoiceNo = body.extInvoiceNo !== undefined ? body.extInvoiceNo : existing.ext_invoice_no;

  const store = await sqlOne("SELECT payment_due_days FROM stores WHERE id = $1", [storeId]);
  if (!store) return httpError(res, 404, "Magaza bulunamadi.");

  const { serviceAmount, kdvAmount, unitAmount } = calcAmounts(totalAmount, kdvRate, quantity);
  const dueDate = calcDueDate(periodKey, store.payment_due_days || 0);

  await sqlExec(
    `UPDATE store_invoices
     SET store_id=$2, invoice_date=$3::date, total_amount=$4, kdv_rate=$5, quantity=$6,
         kdv_amount=$7, unit_amount=$8, service_amount=$9, period_key=$10,
         due_date=$11::date, description=$12, ext_invoice_no=$13, updated_at=$14::timestamptz
     WHERE id=$1`,
    [req.params.id, storeId, invoiceDate, Number(totalAmount), Number(kdvRate || 0),
     Number(quantity || 1), kdvAmount, unitAmount, serviceAmount,
     periodKey, dueDate, description || "", extInvoiceNo || null, nowIso()],
  );
  const updated = await sqlOne(
    `SELECT si.*, s.name AS store_name FROM store_invoices si
     LEFT JOIN stores s ON s.id = si.store_id WHERE si.id = $1`, [req.params.id],
  );
  return res.json({ ok: true, item: mapRow(updated) });
}

// ── DELETE /api/store-invoices/:id ────────────────────────────────────────
export async function handleStoreInvoicesDelete(req, res) {
  const existing = await sqlOne("SELECT id FROM store_invoices WHERE id = $1", [req.params.id]);
  if (!existing) return httpError(res, 404, "Fatura bulunamadi.");
  await sqlExec("DELETE FROM store_invoices WHERE id = $1", [req.params.id]);
  return res.json({ ok: true });
}
