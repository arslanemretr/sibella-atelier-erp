import crypto from "node:crypto";
import { sqlExec, sqlMany, sqlOne } from "./db.js";

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function addDays(isoString, days) {
  const d = new Date(isoString);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function httpError(res, status, message) {
  return res.status(status).json({ ok: false, message });
}

async function ensureEarningsSchema() {
  await sqlExec(`
    CREATE TABLE IF NOT EXISTS supplier_earnings_records (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL REFERENCES suppliers(id),
      period_key TEXT NOT NULL,
      invoice_no TEXT,
      invoice_date TIMESTAMPTZ,
      payment_due_date TIMESTAMPTZ,
      payment_date TIMESTAMPTZ,
      note TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      UNIQUE (supplier_id, period_key)
    )
  `);
}

export async function ensureEarningsReady() {
  await ensureEarningsSchema();
}

function mapRecordRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    supplierId: row.supplier_id,
    periodKey: row.period_key,
    invoiceNo: row.invoice_no || null,
    invoiceDate: row.invoice_date || null,
    paymentDueDate: row.payment_due_date || null,
    paymentDate: row.payment_date || null,
    note: row.note || "",
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export async function handleEarningsRecordsList(_req, res) {
  const rows = await sqlMany(
    "SELECT * FROM supplier_earnings_records ORDER BY period_key DESC, supplier_id ASC",
  );
  return res.json({ ok: true, items: rows.map(mapRecordRow) });
}

export async function handleEarningsRecordsUpsert(req, res) {
  const { supplierId, periodKey, invoiceNo, invoiceDate, paymentDate, note } = req.body || {};

  if (!supplierId || !periodKey) {
    return httpError(res, 400, "supplierId ve periodKey zorunludur.");
  }

  try {
    const existing = await sqlOne(
      "SELECT * FROM supplier_earnings_records WHERE supplier_id = $1 AND period_key = $2",
      [supplierId, periodKey],
    );

    const now = nowIso();
    const normalizedInvoiceDate = invoiceDate || null;
    const paymentDueDate = normalizedInvoiceDate ? addDays(normalizedInvoiceDate, 15) : null;

    let record;
    if (existing) {
      record = await sqlOne(
        `
          UPDATE supplier_earnings_records
          SET invoice_no = $3,
              invoice_date = $4::timestamptz,
              payment_due_date = $5::timestamptz,
              payment_date = $6::timestamptz,
              note = $7,
              updated_at = $8::timestamptz
          WHERE supplier_id = $1 AND period_key = $2
          RETURNING *
        `,
        [
          supplierId,
          periodKey,
          invoiceNo || null,
          normalizedInvoiceDate,
          paymentDueDate,
          paymentDate || null,
          String(note || "").trim(),
          now,
        ],
      );
    } else {
      const createdBy = req.authUser?.id || null;
      record = await sqlOne(
        `
          INSERT INTO supplier_earnings_records (
            id, supplier_id, period_key, invoice_no, invoice_date,
            payment_due_date, payment_date, note, created_by, created_at, updated_at
          )
          VALUES ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz,$7::timestamptz,$8,$9,$10::timestamptz,$11::timestamptz)
          RETURNING *
        `,
        [
          createId("earnrec"),
          supplierId,
          periodKey,
          invoiceNo || null,
          normalizedInvoiceDate,
          paymentDueDate,
          paymentDate || null,
          String(note || "").trim(),
          createdBy,
          now,
          now,
        ],
      );
    }

    return res.json({ ok: true, item: mapRecordRow(record) });
  } catch (error) {
    return httpError(res, 400, error?.message || "Hakediş kaydı oluşturulamadı.");
  }
}
