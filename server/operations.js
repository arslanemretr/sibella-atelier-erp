import crypto from "node:crypto";
import { sqlExec, sqlMany, sqlOne } from "./db.js";
import {
  getMainStockLocation,
  rebuildStockBalancesFromMovements,
  replaceStockMovementsForSource,
  withInventoryTransaction,
} from "./inventory.js";

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function buildLineDeltaMap(previousLines = [], nextLines = []) {
  const deltaMap = new Map();
  const addLine = (line, direction) => {
    if (!line?.productId) {
      return;
    }
    deltaMap.set(
      line.productId,
      Number(deltaMap.get(line.productId) || 0) + (Number(line.quantity || 0) * direction),
    );
  };

  previousLines.forEach((line) => addLine(line, -1));
  nextLines.forEach((line) => addLine(line, 1));
  return deltaMap;
}

function mapPurchaseRows(purchaseRows, lineRows) {
  const linesByPurchaseId = new Map();
  lineRows.forEach((row) => {
    const items = linesByPurchaseId.get(row.purchase_id) || [];
    items.push({
      id: row.id,
      productId: row.product_id || null,
      quantity: Number(row.quantity || 0),
      unitPrice: Number(row.unit_price || 0),
      note: row.note || "",
    });
    linesByPurchaseId.set(row.purchase_id, items);
  });

  return purchaseRows.map((row) => ({
    id: row.id,
    documentNo: row.document_no || "",
    supplierId: row.supplier_id || null,
    date: row.date || "",
    procurementTypeId: row.procurement_type_id || null,
    paymentTermId: row.payment_term_id || null,
    description: row.description || "",
    lines: linesByPurchaseId.get(row.id) || [],
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }));
}

function mapStockEntryRows(entryRows, lineRows) {
  const linesByEntryId = new Map();
  lineRows.forEach((row) => {
    const items = linesByEntryId.get(row.stock_entry_id) || [];
    items.push({
      id: row.id,
      productId: row.product_id || null,
      quantity: Number(row.quantity || 0),
      unitCost: Number(row.unit_cost || 0),
      note: row.note || "",
    });
    linesByEntryId.set(row.stock_entry_id, items);
  });

  return entryRows.map((row) => ({
    id: row.id,
    documentNo: row.document_no || "",
    sourcePartyId: row.source_party_id || null,
    date: row.date || "",
    stockType: row.stock_type || "Urun",
    sourceType: row.source_type || "Konsinye",
    status: row.status || "Taslak",
    note: row.note || "",
    lines: linesByEntryId.get(row.id) || [],
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }));
}

async function listPurchasesRows() {
  const purchaseRows = await sqlMany("SELECT * FROM purchases ORDER BY created_at DESC, document_no ASC");
  const lineRows = await sqlMany("SELECT * FROM purchase_lines ORDER BY purchase_id ASC, sort_order ASC, id ASC");
  return mapPurchaseRows(purchaseRows, lineRows);
}

async function getPurchaseRow(purchaseId) {
  return (await listPurchasesRows()).find((item) => item.id === purchaseId) || null;
}

async function listStockEntryRows() {
  const entryRows = await sqlMany("SELECT * FROM stock_entries ORDER BY created_at DESC, document_no ASC");
  const lineRows = await sqlMany("SELECT * FROM stock_lines ORDER BY stock_entry_id ASC, sort_order ASC, id ASC");
  return mapStockEntryRows(entryRows, lineRows);
}

async function listStockEntryRowsForSupplier(supplierId) {
  const entryRows = await sqlMany("SELECT * FROM stock_entries ORDER BY created_at DESC, document_no ASC");
  const lineRows = await sqlMany(`
    SELECT sl.*
    FROM stock_lines sl
    INNER JOIN products p ON p.id = sl.product_id
    WHERE p.supplier_id = $1
    ORDER BY sl.stock_entry_id ASC, sl.sort_order ASC, sl.id ASC
  `, [supplierId]);

  const filteredRows = mapStockEntryRows(entryRows, lineRows);
  return filteredRows.filter((item) => Array.isArray(item.lines) && item.lines.length > 0);
}

async function getStockEntryRow(stockEntryId) {
  return (await listStockEntryRows()).find((item) => item.id === stockEntryId) || null;
}

function normalizePurchase(values, existingPurchase) {
  const purchaseId = existingPurchase?.id || createId("pur");
  return {
    id: purchaseId,
    documentNo: values.documentNo || "",
    supplierId: values.supplierId || null,
    date: values.date || "",
    procurementTypeId: values.procurementTypeId || null,
    paymentTermId: values.paymentTermId || null,
    description: values.description || "",
    lines: (values.lines || [])
      .filter((line) => line && line.productId)
      .map((line, index) => ({
        id: line.id || `${purchaseId}-line-${index + 1}`,
        productId: line.productId,
        quantity: Number(line.quantity || 0),
        unitPrice: Number(line.unitPrice || 0),
        note: line.note || "",
      })),
    createdAt: existingPurchase?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

function normalizeStockEntry(values, existingEntry) {
  const entryId = existingEntry?.id || createId("stk");
  return {
    id: entryId,
    documentNo: values.documentNo || "",
    sourcePartyId: values.sourcePartyId || null,
    date: values.date || "",
    stockType: values.stockType || "Urun",
    sourceType: values.sourceType || "Konsinye",
    status: values.status || existingEntry?.status || "Taslak",
    note: values.note || "",
    lines: (values.lines || [])
      .filter((line) => line && line.productId)
      .map((line, index) => ({
        id: line.id || `${entryId}-line-${index + 1}`,
        productId: line.productId,
        quantity: Number(line.quantity || 0),
        unitCost: Number(line.unitCost || 0),
        note: line.note || "",
      })),
    createdAt: existingEntry?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

async function replacePurchaseLines(record, tx) {
  const executor = tx || { exec: sqlExec };
  await executor.exec("DELETE FROM purchase_lines WHERE purchase_id = $1", [record.id]);
  for (let index = 0; index < record.lines.length; index += 1) {
    const line = record.lines[index];
    await executor.exec(`
      INSERT INTO purchase_lines (id, purchase_id, product_id, quantity, unit_price, note, sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [line.id, record.id, line.productId, line.quantity, line.unitPrice, line.note, index + 1]);
  }
}

async function replaceStockLines(record, tx) {
  const executor = tx || { exec: sqlExec };
  await executor.exec("DELETE FROM stock_lines WHERE stock_entry_id = $1", [record.id]);
  for (let index = 0; index < record.lines.length; index += 1) {
    const line = record.lines[index];
    await executor.exec(`
      INSERT INTO stock_lines (id, stock_entry_id, product_id, quantity, unit_cost, note, sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [line.id, record.id, line.productId, line.quantity, line.unitCost, line.note, index + 1]);
  }
}

function httpError(res, status, message) {
  return res.status(status).json({
    ok: false,
    message,
  });
}

async function resolveSupplierName(supplierId, tx) {
  if (!supplierId) {
    return "";
  }
  const row = await tx.one("SELECT company FROM suppliers WHERE id = $1", [supplierId]);
  return row?.company || "";
}

export async function handlePurchasesList(_req, res) {
  return res.json({
    ok: true,
    items: await listPurchasesRows(),
  });
}

export async function handlePurchasesCreate(req, res) {
  try {
    const item = normalizePurchase(req.body || {});
    await withInventoryTransaction(async (tx) => {
      await tx.exec(`
        INSERT INTO purchases (id, document_no, supplier_id, date, procurement_type_id, payment_term_id, description, created_at, updated_at)
        VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8::timestamptz,$9::timestamptz)
      `, [item.id, item.documentNo, item.supplierId, item.date || null, item.procurementTypeId, item.paymentTermId, item.description, item.createdAt, item.updatedAt]);
      await replacePurchaseLines(item, tx);
      const mainLocation = await getMainStockLocation(tx);
      const supplierName = await resolveSupplierName(item.supplierId, tx);
      await replaceStockMovementsForSource(
        "purchase",
        item.id,
        item.lines.map((line) => ({
          movementType: "SATINALMA_BELGESI",
          direction: "IN",
          affectsStock: false,
          quantity: Number(line.quantity || 0),
          stockDelta: 0,
          productId: line.productId,
          stockLocationId: mainLocation?.id || null,
          documentNo: item.documentNo,
          documentDate: item.date || item.createdAt,
          sourceLineId: line.id,
          partyId: item.supplierId,
          partyName: supplierName,
          unitAmount: Number(line.unitPrice || 0),
          totalAmount: Number(line.quantity || 0) * Number(line.unitPrice || 0),
          note: line.note || item.description || "",
          createdAt: item.createdAt,
        })),
        tx,
      );
    });
    return res.status(201).json({ ok: true, item: await getPurchaseRow(item.id) });
  } catch (error) {
    return httpError(res, 400, error?.message || "Satin alma kaydi olusturulamadi.");
  }
}

export async function handlePurchasesUpdate(req, res) {
  const existing = await getPurchaseRow(req.params.id);
  if (!existing) {
    return httpError(res, 404, "Satin alma kaydi bulunamadi.");
  }
  try {
    const item = normalizePurchase(req.body || {}, existing);
    await withInventoryTransaction(async (tx) => {
      await tx.exec(`
        UPDATE purchases
        SET document_no=$2, supplier_id=$3, date=$4::date, procurement_type_id=$5, payment_term_id=$6, description=$7, updated_at=$8::timestamptz
        WHERE id=$1
      `, [item.id, item.documentNo, item.supplierId, item.date || null, item.procurementTypeId, item.paymentTermId, item.description, item.updatedAt]);
      await replacePurchaseLines(item, tx);
      const mainLocation = await getMainStockLocation(tx);
      const supplierName = await resolveSupplierName(item.supplierId, tx);
      await replaceStockMovementsForSource(
        "purchase",
        item.id,
        item.lines.map((line) => ({
          movementType: "SATINALMA_BELGESI",
          direction: "IN",
          affectsStock: false,
          quantity: Number(line.quantity || 0),
          stockDelta: 0,
          productId: line.productId,
          stockLocationId: mainLocation?.id || null,
          documentNo: item.documentNo,
          documentDate: item.date || item.updatedAt,
          sourceLineId: line.id,
          partyId: item.supplierId,
          partyName: supplierName,
          unitAmount: Number(line.unitPrice || 0),
          totalAmount: Number(line.quantity || 0) * Number(line.unitPrice || 0),
          note: line.note || item.description || "",
          createdAt: item.createdAt,
        })),
        tx,
      );
    });
    return res.json({ ok: true, item: await getPurchaseRow(item.id) });
  } catch (error) {
    return httpError(res, 400, error?.message || "Satin alma kaydi guncellenemedi.");
  }
}

export async function handleStockEntriesList(req, res) {
  const authUser = req.authUser || null;
  const items =
    authUser?.role === "Tedarikci" && authUser?.supplierId
      ? await listStockEntryRowsForSupplier(authUser.supplierId)
      : await listStockEntryRows();

  return res.json({
    ok: true,
    items,
  });
}

export async function handleStockEntriesCreate(req, res) {
  try {
    const item = normalizeStockEntry(req.body || {});
    await withInventoryTransaction(async (tx) => {
      const mainLocation = await getMainStockLocation(tx);
      const supplierName = await resolveSupplierName(item.sourcePartyId, tx);
      await tx.exec(`
        INSERT INTO stock_entries (id, document_no, source_party_id, date, stock_type, source_type, status, note, created_at, updated_at)
        VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8,$9::timestamptz,$10::timestamptz)
      `, [item.id, item.documentNo, item.sourcePartyId, item.date || null, item.stockType, item.sourceType, item.status, item.note, item.createdAt, item.updatedAt]);
      await tx.exec("DELETE FROM stock_lines WHERE stock_entry_id = $1", [item.id]);
      for (let index = 0; index < item.lines.length; index += 1) {
        const line = item.lines[index];
        await tx.exec(`
          INSERT INTO stock_lines (id, stock_entry_id, product_id, quantity, unit_cost, note, sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [line.id, item.id, line.productId, line.quantity, line.unitCost, line.note, index + 1]);
      }
      await replaceStockMovementsForSource(
        "stock-entry",
        item.id,
        item.lines.map((line) => ({
          movementType:
            item.sourceType === "Sayim Duzeltme"
              ? "STOK_DUZELTME"
              : item.sourceType === "Tedarikci Teslimati"
                ? "MAGAZA_STOK_GIRISI"
                : "STOK_GIRIS",
          direction: "IN",
          affectsStock: true,
          quantity: Number(line.quantity || 0),
          stockDelta: Number(line.quantity || 0),
          productId: line.productId,
          stockLocationId: mainLocation?.id || null,
          documentNo: item.documentNo,
          documentDate: item.date || item.createdAt,
          sourceLineId: line.id,
          partyId: item.sourcePartyId,
          partyName: supplierName || item.sourceType || "",
          unitAmount: Number(line.unitCost || 0),
          totalAmount: Number(line.quantity || 0) * Number(line.unitCost || 0),
          note: line.note || item.note || "",
          createdAt: item.createdAt,
        })),
        tx,
      );
      await rebuildStockBalancesFromMovements(tx);
    });
    return res.status(201).json({ ok: true, item: await getStockEntryRow(item.id) });
  } catch (error) {
    return httpError(res, 400, error?.message || "Stok girisi olusturulamadi.");
  }
}

export async function handleStockEntriesUpdate(req, res) {
  const existing = await getStockEntryRow(req.params.id);
  if (!existing) {
    return httpError(res, 404, "Stok girisi bulunamadi.");
  }
  try {
    const item = normalizeStockEntry(req.body || {}, existing);
    await withInventoryTransaction(async (tx) => {
      const mainLocation = await getMainStockLocation(tx);
      const supplierName = await resolveSupplierName(item.sourcePartyId, tx);
      await tx.exec(`
        UPDATE stock_entries
        SET document_no=$2, source_party_id=$3, date=$4::date, stock_type=$5, source_type=$6, status=$7, note=$8, updated_at=$9::timestamptz
        WHERE id=$1
      `, [item.id, item.documentNo, item.sourcePartyId, item.date || null, item.stockType, item.sourceType, item.status, item.note, item.updatedAt]);
      await tx.exec("DELETE FROM stock_lines WHERE stock_entry_id = $1", [item.id]);
      for (let index = 0; index < item.lines.length; index += 1) {
        const line = item.lines[index];
        await tx.exec(`
          INSERT INTO stock_lines (id, stock_entry_id, product_id, quantity, unit_cost, note, sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [line.id, item.id, line.productId, line.quantity, line.unitCost, line.note, index + 1]);
      }
      await replaceStockMovementsForSource(
        "stock-entry",
        item.id,
        item.lines.map((line) => ({
          movementType:
            item.sourceType === "Sayim Duzeltme"
              ? "STOK_DUZELTME"
              : item.sourceType === "Tedarikci Teslimati"
                ? "MAGAZA_STOK_GIRISI"
                : "STOK_GIRIS",
          direction: "IN",
          affectsStock: true,
          quantity: Number(line.quantity || 0),
          stockDelta: Number(line.quantity || 0),
          productId: line.productId,
          stockLocationId: mainLocation?.id || null,
          documentNo: item.documentNo,
          documentDate: item.date || item.updatedAt,
          sourceLineId: line.id,
          partyId: item.sourcePartyId,
          partyName: supplierName || item.sourceType || "",
          unitAmount: Number(line.unitCost || 0),
          totalAmount: Number(line.quantity || 0) * Number(line.unitCost || 0),
          note: line.note || item.note || "",
          createdAt: item.createdAt,
        })),
        tx,
      );
      await rebuildStockBalancesFromMovements(tx);
    });
    return res.json({ ok: true, item: await getStockEntryRow(item.id) });
  } catch (error) {
    return httpError(res, 400, error?.message || "Stok girisi guncellenemedi.");
  }
}
