import crypto from "node:crypto";
import { sqlExec, sqlMany, sqlOne } from "./db.js";
import {
  assertStockLocationStockAvailable,
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

let ensureDeliveryLineSchemaPromise = null;
let deliveryLineSchemaInfo = null;

export async function ensureStockLocationInSessions() {
  const hasCol = await columnExists("pos_sessions", "stock_location_id");
  if (!hasCol) {
    await sqlExec("ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS stock_location_id TEXT REFERENCES stock_locations(id)");
  }
}

async function columnExists(tableName, columnName) {
  const rows = await sqlMany(
    `SELECT 1 AS found
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     LIMIT 1`,
    [tableName, columnName],
  );
  return Boolean(rows[0]?.found);
}

async function ensureDeliveryLineSchema() {
  if (!ensureDeliveryLineSchemaPromise) {
    ensureDeliveryLineSchemaPromise = (async () => {
      await sqlExec("ALTER TABLE delivery_lines ADD COLUMN IF NOT EXISTS delivery_list_id TEXT");
      await sqlExec("ALTER TABLE delivery_lines ADD COLUMN IF NOT EXISTS category_id TEXT");
      await sqlExec("ALTER TABLE delivery_lines ADD COLUMN IF NOT EXISTS category_label TEXT");
      await sqlExec("ALTER TABLE delivery_lines ADD COLUMN IF NOT EXISTS collection_id TEXT");
      await sqlExec("ALTER TABLE delivery_lines ADD COLUMN IF NOT EXISTS collection_label TEXT");

      const hasDeliveryId = await columnExists("delivery_lines", "delivery_id");
      deliveryLineSchemaInfo = {
        hasDeliveryId,
      };

      if (hasDeliveryId) {
        await sqlExec(`
          UPDATE delivery_lines
          SET delivery_list_id = delivery_id
          WHERE delivery_list_id IS NULL AND delivery_id IS NOT NULL
        `);
      }
    })().catch((error) => {
      ensureDeliveryLineSchemaPromise = null;
      deliveryLineSchemaInfo = null;
      throw error;
    });
  }

  await ensureDeliveryLineSchemaPromise;
  return deliveryLineSchemaInfo || { hasDeliveryId: false };
}

function httpError(res, status, message) {
  return res.status(status).json({ ok: false, message });
}

async function resolveSupplierIdForAuthUser(authUser) {
  if (authUser?.supplierId) {
    return authUser.supplierId;
  }

  const normalizedEmail = String(authUser?.email || "").trim().toLowerCase();
  const normalizedName = String(authUser?.fullName || "").trim().toLowerCase();
  if (!normalizedEmail && !normalizedName) {
    return null;
  }

  const row = await sqlOne(
    `
      SELECT id
      FROM suppliers
      WHERE ($1 <> '' AND LOWER(TRIM(COALESCE(email, ''))) = $1)
         OR ($2 <> '' AND LOWER(TRIM(COALESCE(contact, ''))) = $2)
         OR ($2 <> '' AND LOWER(TRIM(COALESCE(company, ''))) = $2)
      ORDER BY created_at DESC, company ASC
      LIMIT 1
    `,
    [normalizedEmail, normalizedName],
  );

  return row?.id || null;
}

async function listContractsRows() {
  const rows = await sqlMany("SELECT * FROM consignment_contracts ORDER BY created_at DESC, start_date DESC");
  return rows.map((row) => ({
    id: row.id,
    supplierId: row.supplier_id || null,
    startDate: row.start_date || "",
    endDate: row.end_date || "",
    commissionRate: Number(row.commission_rate || 0),
    pdfName: row.pdf_name || "",
    pdfDataUrl: row.pdf_data_url || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }));
}

async function getContractRow(contractId) {
  return (await listContractsRows()).find((item) => item.id === contractId) || null;
}

function normalizeContract(values, existingContract) {
  return {
    id: existingContract?.id || createId("con"),
    supplierId: values.supplierId || null,
    startDate: values.startDate || "",
    endDate: values.endDate || "",
    commissionRate: Number(values.commissionRate || 0),
    pdfName: values.pdfName || "",
    pdfDataUrl: values.pdfDataUrl || "",
    createdAt: existingContract?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

async function listPosSalesRows() {
  const saleRows = await sqlMany("SELECT * FROM pos_sales ORDER BY created_at DESC, sold_at DESC");
  const lineRows = await sqlMany("SELECT * FROM pos_sale_lines ORDER BY sale_id ASC, sort_order ASC, id ASC");
  const linesBySaleId = new Map();

  lineRows.forEach((row) => {
    const items = linesBySaleId.get(row.sale_id) || [];
    items.push({
      id: row.id,
      productId: row.product_id || null,
      quantity: Number(row.quantity || 0),
      unitPrice: Number(row.unit_price || 0),
      lineTotal: Number(row.line_total || 0),
    });
    linesBySaleId.set(row.sale_id, items);
  });

  return saleRows.map((row) => ({
    id: row.id,
    sessionId: row.session_id || null,
    stockLocationId: row.stock_location_id || null,
    receiptNo: row.receipt_no || "",
    soldAt: row.sold_at || null,
    customerName: row.customer_name || "",
    paymentMethod: row.payment_method || "",
    note: row.note || "",
    discountType: row.discount_type || "amount",
    discountValue: Number(row.discount_value || 0),
    discountAmount: Number(row.discount_amount || 0),
    subtotal: Number(row.subtotal || 0),
    taxTotal: Number(row.tax_total || 0),
    grandTotal: Number(row.grand_total || 0),
    lines: linesBySaleId.get(row.id) || [],
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }));
}

function normalizePosStatus(status) {
  if (!status || status === "Acik" || status === "Açık") return "Açık";
  return "Kapalı";
}

async function listPosSessionsRows() {
  const rows = await sqlMany(`
    SELECT s.*,
           COUNT(p.id)::int           AS sales_count,
           COALESCE(SUM(p.grand_total), 0) AS total_sales
    FROM pos_sessions s
    LEFT JOIN pos_sales p ON p.session_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC, s.opened_at DESC
  `);
  return rows.map((row) => ({
    id: row.id,
    sessionNo: row.session_no || "",
    registerName: row.register_name || "",
    cashierName: row.cashier_name || "",
    stockLocationId: row.stock_location_id || null,
    openingBalance: Number(row.opening_balance || 0),
    openedAt: row.opened_at || null,
    closedAt: row.closed_at || null,
    status: normalizePosStatus(row.status),
    note: row.note || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    salesCount: Number(row.sales_count || 0),
    totalSales: Number(row.total_sales || 0),
  }));
}

async function getPosSessionRow(sessionId) {
  return (await listPosSessionsRows()).find((item) => item.id === sessionId) || null;
}

async function getSingleSessionRow(sessionId) {
  const row = await sqlOne("SELECT * FROM pos_sessions WHERE id = $1", [sessionId]);
  if (!row) return null;
  const totalsRow = await sqlOne(
    "SELECT COUNT(*)::int AS cnt, COALESCE(SUM(grand_total), 0) AS total FROM pos_sales WHERE session_id = $1",
    [sessionId],
  );
  const totalSales = Number(totalsRow?.total || 0);
  return {
    id: row.id,
    sessionNo: row.session_no || "",
    registerName: row.register_name || "",
    cashierName: row.cashier_name || "",
    stockLocationId: row.stock_location_id || null,
    openingBalance: Number(row.opening_balance || 0),
    openedAt: row.opened_at || null,
    closedAt: row.closed_at || null,
    status: normalizePosStatus(row.status),
    note: row.note || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    salesCount: Number(totalsRow?.cnt || 0),
    totalSales,
  };
}

async function normalizePosSession(values, existingSession) {
  let sessionNo = values.sessionNo || existingSession?.sessionNo;
  if (!sessionNo) {
    const countRow = await sqlOne("SELECT COUNT(*)::int AS cnt FROM pos_sessions");
    sessionNo = `POS-${String(Number(countRow?.cnt || 0) + 1).padStart(3, "0")}`;
  }
  return {
    id: existingSession?.id || createId("possess"),
    sessionNo,
    registerName: values.registerName || existingSession?.registerName || "",
    cashierName: values.cashierName || existingSession?.cashierName || "",
    stockLocationId: values.stockLocationId || existingSession?.stockLocationId || null,
    openingBalance: Number(values.openingBalance || 0),
    openedAt: existingSession?.openedAt || values.openedAt || nowIso(),
    closedAt: values.closedAt || existingSession?.closedAt || null,
    status: normalizePosStatus(values.status || existingSession?.status),
    note: values.note || "",
    createdAt: existingSession?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

function normalizePosSale(values) {
  const saleId = createId("possale");
  const lines = (values.lines || [])
    .filter((line) => line && line.productId && Number(line.quantity || 0) > 0)
    .map((line, index) => ({
      id: line.id || `${saleId}-line-${index + 1}`,
      productId: line.productId,
      quantity: Number(line.quantity || 0),
      unitPrice: Number(line.unitPrice || 0),
      lineTotal: Number(line.quantity || 0) * Number(line.unitPrice || 0),
    }));

  const grossTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const discountType = values.discountType || "amount";
  const discountValue = Number(values.discountValue || 0);
  const rawDiscountAmount = discountType === "percent" ? (grossTotal * discountValue) / 100 : discountValue;
  const discountAmount = Math.min(Math.max(rawDiscountAmount, 0), grossTotal);
  const grandTotal = Math.max(grossTotal - discountAmount, 0);
  const subtotal = grandTotal / 1.2;
  const taxTotal = grandTotal - subtotal;

  return {
    id: saleId,
    sessionId: values.sessionId || null,
    stockLocationId: values.stockLocationId || null,
    receiptNo: values.receiptNo || `FIS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    soldAt: values.soldAt || nowIso(),
    customerName: values.customerName || "Magaza Musterisi",
    paymentMethod: values.paymentMethod || "Nakit",
    note: values.note || "",
    discountType,
    discountValue,
    discountAmount,
    subtotal,
    taxTotal,
    grandTotal,
    lines,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

async function listDeliveryRows() {
  const schemaInfo = await ensureDeliveryLineSchema();
  const deliveryRows = await sqlMany("SELECT * FROM delivery_lists ORDER BY created_at DESC, date DESC");
  const lineRows = await sqlMany(
    schemaInfo.hasDeliveryId
      ? "SELECT * FROM delivery_lines ORDER BY COALESCE(delivery_list_id, delivery_id) ASC, sort_order ASC, id ASC"
      : "SELECT * FROM delivery_lines ORDER BY delivery_list_id ASC, sort_order ASC, id ASC",
  );
  const linesByDeliveryId = new Map();

  lineRows.forEach((row) => {
    const relatedDeliveryId = row.delivery_list_id || row.delivery_id || null;
    const items = linesByDeliveryId.get(relatedDeliveryId) || [];
    items.push({
      id: row.id,
      productId: row.product_id || null,
      isNewProduct: Boolean(row.is_new_product),
      image: row.image || "",
      name: row.name || "",
      code: row.code || "",
      salePrice: Number(row.sale_price || 0),
      saleCurrency: row.sale_currency || "TRY",
      quantity: Number(row.quantity || 0),
      description: row.description || "",
      categoryId: row.category_id || null,
      categoryLabel: row.category_label || "",
      collectionId: row.collection_id || null,
      collectionLabel: row.collection_label || "",
    });
    linesByDeliveryId.set(relatedDeliveryId, items);
  });

  return deliveryRows.map((row) => ({
    id: row.id,
    deliveryNo: row.delivery_no || "",
    supplierId: row.supplier_id || null,
    supplierName: row.supplier_name || "",
    contactName: row.contact_name || "",
    supplierEmail: row.supplier_email || "",
    date: row.date || "",
    shippingMethod: row.shipping_method || "Kargo",
    trackingNo: row.tracking_no || "",
    note: row.note || "",
    status: row.status || "Taslak",
    createdBy: row.created_by || null,
    lines: linesByDeliveryId.get(row.id) || [],
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }));
}

async function getDeliveryRow(deliveryId) {
  return (await listDeliveryRows()).find((item) => item.id === deliveryId) || null;
}

function normalizeDelivery(values, existingRecord) {
  const deliveryId = existingRecord?.id || createId("dlv");
  return {
    id: deliveryId,
    deliveryNo: existingRecord?.deliveryNo || values.deliveryNo || "",
    supplierId: values.supplierId || existingRecord?.supplierId || null,
    supplierName: values.supplierName || existingRecord?.supplierName || "",
    contactName: values.contactName || existingRecord?.contactName || "",
    supplierEmail: values.supplierEmail || existingRecord?.supplierEmail || "",
    date: values.date || existingRecord?.date || new Date().toISOString().slice(0, 10),
    shippingMethod: values.shippingMethod || existingRecord?.shippingMethod || "Kargo",
    trackingNo: values.trackingNo || existingRecord?.trackingNo || "",
    note: values.note || existingRecord?.note || "",
    status: values.status || existingRecord?.status || "Taslak",
    createdBy: values.createdBy || existingRecord?.createdBy || null,
    lines: (values.lines || existingRecord?.lines || []).map((line, index) => ({
      id: line.id || `${deliveryId}-line-${index + 1}`,
      productId: line.productId || null,
      isNewProduct: Boolean(line.isNewProduct),
      image: line.image || "",
      name: line.name || "",
      code: line.code || "",
      salePrice: Number(line.salePrice || 0),
      saleCurrency: line.saleCurrency || "TRY",
      quantity: Number(line.quantity || 0),
      description: line.description || "",
      categoryId: line.categoryId || null,
      categoryLabel: line.categoryLabel || "",
      collectionId: line.collectionId || null,
      collectionLabel: line.collectionLabel || "",
    })),
    createdAt: existingRecord?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

async function replaceDeliveryLines(record) {
  const schemaInfo = await ensureDeliveryLineSchema();
  await sqlExec(
    schemaInfo.hasDeliveryId
      ? "DELETE FROM delivery_lines WHERE delivery_list_id = $1 OR delivery_id = $1"
      : "DELETE FROM delivery_lines WHERE delivery_list_id = $1",
    [record.id],
  );
  for (let index = 0; index < record.lines.length; index += 1) {
    const line = record.lines[index];
    if (schemaInfo.hasDeliveryId) {
      await sqlExec(`
        INSERT INTO delivery_lines (
          id, delivery_id, delivery_list_id, product_id, is_new_product, image, name, code,
          sale_price, sale_currency, quantity, description, sort_order, category_id, category_label,
          collection_id, collection_label
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      `, [
        line.id,
        record.id,
        record.id,
        line.productId,
        line.isNewProduct,
        line.image,
        line.name,
        line.code,
        line.salePrice,
        line.saleCurrency,
        line.quantity,
        line.description,
        index + 1,
        line.categoryId,
        line.categoryLabel || "",
        line.collectionId,
        line.collectionLabel || "",
      ]);
      continue;
    }

    await sqlExec(`
      INSERT INTO delivery_lines (
        id, delivery_list_id, product_id, is_new_product, image, name, code,
        sale_price, sale_currency, quantity, description, sort_order, category_id, category_label,
        collection_id, collection_label
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    `, [
      line.id,
      record.id,
      line.productId,
      line.isNewProduct,
      line.image,
      line.name,
      line.code,
      line.salePrice,
      line.saleCurrency,
      line.quantity,
      line.description,
      index + 1,
      line.categoryId,
      line.categoryLabel || "",
      line.collectionId,
      line.collectionLabel || "",
    ]);
  }
}

export async function handleContractsList(req, res) {
  const items = await listContractsRows();
  if (req.authUser?.role !== "Tedarikci") {
    return res.json({ ok: true, items });
  }

  const supplierId = await resolveSupplierIdForAuthUser(req.authUser);

  return res.json({
    ok: true,
    items: items.filter((item) => item.supplierId === supplierId),
  });
}

export async function handleContractsCreate(req, res) {
  try {
    const item = normalizeContract(req.body || {});
    await sqlExec(`
      INSERT INTO consignment_contracts (id, supplier_id, start_date, end_date, commission_rate, pdf_name, pdf_data_url, created_at, updated_at)
      VALUES ($1,$2,$3::date,$4::date,$5,$6,$7,$8::timestamptz,$9::timestamptz)
    `, [item.id, item.supplierId, item.startDate || null, item.endDate || null, item.commissionRate, item.pdfName, item.pdfDataUrl, item.createdAt, item.updatedAt]);
    return res.status(201).json({ ok: true, item: await getContractRow(item.id) });
  } catch (error) {
    return httpError(res, 400, error?.message || "Sozlesme olusturulamadi.");
  }
}

export async function handleContractsUpdate(req, res) {
  const existing = await getContractRow(req.params.id);
  if (!existing) {
    return httpError(res, 404, "Sozlesme bulunamadi.");
  }
  try {
    const item = normalizeContract(req.body || {}, existing);
    await sqlExec(`
      UPDATE consignment_contracts
      SET supplier_id=$2, start_date=$3::date, end_date=$4::date, commission_rate=$5, pdf_name=$6, pdf_data_url=$7, updated_at=$8::timestamptz
      WHERE id=$1
    `, [item.id, item.supplierId, item.startDate || null, item.endDate || null, item.commissionRate, item.pdfName, item.pdfDataUrl, item.updatedAt]);
    return res.json({ ok: true, item: await getContractRow(item.id) });
  } catch (error) {
    return httpError(res, 400, error?.message || "Sozlesme guncellenemedi.");
  }
}

export async function handleContractsDelete(req, res) {
  await sqlExec("DELETE FROM consignment_contracts WHERE id = $1", [req.params.id]);
  return res.json({ ok: true });
}

export async function handlePosSessionsList(_req, res) {
  return res.json({ ok: true, items: await listPosSessionsRows() });
}

export async function handlePosSessionsCreate(req, res) {
  try {
    const item = await normalizePosSession(req.body || {});
    await sqlExec(`
      INSERT INTO pos_sessions (id, session_no, register_name, cashier_name, stock_location_id, opening_balance, opened_at, closed_at, status, note, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9,$10,$11::timestamptz,$12::timestamptz)
    `, [item.id, item.sessionNo, item.registerName, item.cashierName, item.stockLocationId, item.openingBalance, item.openedAt, item.closedAt, item.status, item.note, item.createdAt, item.updatedAt]);
    return res.status(201).json({ ok: true, item: await getSingleSessionRow(item.id) });
  } catch (error) {
    return httpError(res, 400, error?.message || "POS oturumu olusturulamadi.");
  }
}

export async function handlePosSessionsClose(req, res) {
  const existing = await getSingleSessionRow(req.params.id);
  if (!existing) {
    return httpError(res, 404, "POS oturumu bulunamadi.");
  }
  const closedAt = nowIso();
  const updatedAt = nowIso();
  await sqlExec(`
    UPDATE pos_sessions
    SET closed_at=$2::timestamptz, status=$3, updated_at=$4::timestamptz
    WHERE id=$1
  `, [existing.id, closedAt, "Kapalı", updatedAt]);
  return res.json({ ok: true, item: await getSingleSessionRow(existing.id) });
}

export async function handlePosSalesList(req, res) {
  const items = await listPosSalesRows();
  if (req.authUser?.role !== "Tedarikci") {
    return res.json({ ok: true, items });
  }

  const supplierId = await resolveSupplierIdForAuthUser(req.authUser);
  const supplierProductRows = await sqlMany("SELECT id FROM products WHERE supplier_id = $1", [supplierId]);
  const allowedProductIds = new Set(supplierProductRows.map((row) => row.id));
  const filteredItems = items
    .map((sale) => ({
      ...sale,
      lines: (sale.lines || []).filter((line) => allowedProductIds.has(line.productId)),
    }))
    .filter((sale) => sale.lines.length > 0);

  return res.json({ ok: true, items: filteredItems });
}

export async function handlePosSalesCreate(req, res) {
  const session = await getPosSessionRow(req.body?.sessionId);
  if (!session || session.status !== "Açık") {
    return httpError(res, 400, "Acik POS oturumu bulunamadi.");
  }
  try {
    const rawItem = normalizePosSale(req.body || {});
    const item = { ...rawItem, stockLocationId: rawItem.stockLocationId || session.stockLocationId };
    if (!item.stockLocationId) {
      return httpError(res, 400, "Stok yeri secimi zorunludur.");
    }
    await withInventoryTransaction(async (tx) => {
      await assertStockLocationStockAvailable(item.stockLocationId, item.lines, tx);
      await tx.exec(`
        INSERT INTO pos_sales (id, session_id, stock_location_id, receipt_no, sold_at, customer_name, payment_method, note, discount_type, discount_value, discount_amount, subtotal, tax_total, grand_total, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::timestamptz,$16::timestamptz)
      `, [item.id, item.sessionId, item.stockLocationId, item.receiptNo, item.soldAt, item.customerName, item.paymentMethod, item.note, item.discountType, item.discountValue, item.discountAmount, item.subtotal, item.taxTotal, item.grandTotal, item.createdAt, item.updatedAt]);
      for (let index = 0; index < item.lines.length; index += 1) {
        const line = item.lines[index];
        await tx.exec(`
          INSERT INTO pos_sale_lines (id, sale_id, product_id, quantity, unit_price, line_total, sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [line.id, item.id, line.productId, line.quantity, line.unitPrice, line.lineTotal, index + 1]);
      }
      await replaceStockMovementsForSource(
        "pos-sale",
        item.id,
        item.lines.map((line) => ({
          movementType: "SATIS_CIKISI",
          direction: "OUT",
          affectsStock: true,
          quantity: Number(line.quantity || 0),
          stockDelta: -Number(line.quantity || 0),
          productId: line.productId,
          stockLocationId: item.stockLocationId,
          documentNo: item.receiptNo,
          documentDate: item.soldAt,
          sourceLineId: line.id,
          partyName: item.customerName || "POS",
          unitAmount: Number(line.unitPrice || 0),
          totalAmount: Number(line.lineTotal || 0),
          note: item.note || "",
          createdAt: item.createdAt,
        })),
        tx,
      );
      await rebuildStockBalancesFromMovements(tx);
    });
    return res.status(201).json({ ok: true, item });
  } catch (error) {
    return httpError(res, 400, error?.message || "POS satisi olusturulamadi.");
  }
}

export async function handleDeliveryListsList(_req, res) {
  return res.json({ ok: true, items: await listDeliveryRows() });
}

export async function handleDeliveryListsCreate(req, res) {
  try {
    const item = normalizeDelivery(req.body || {});
    if (!item.deliveryNo) {
      item.deliveryNo = `TES-${String(Date.now()).slice(-6)}`;
    }
    await sqlExec(`
      INSERT INTO delivery_lists (id, delivery_no, supplier_id, supplier_name, contact_name, supplier_email, date, shipping_method, tracking_no, note, status, created_by, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,$11,$12,$13::timestamptz,$14::timestamptz)
    `, [item.id, item.deliveryNo, item.supplierId, item.supplierName, item.contactName, item.supplierEmail, item.date || null, item.shippingMethod, item.trackingNo, item.note, item.status, item.createdBy, item.createdAt, item.updatedAt]);
    await replaceDeliveryLines(item);
    return res.status(201).json({ ok: true, item: await getDeliveryRow(item.id) });
  } catch (error) {
    console.error("handleDeliveryListsCreate hatasi:", error?.message, error?.stack);
    return httpError(res, 400, error?.message || "Teslimat kaydi olusturulamadi.");
  }
}

export async function handleDeliveryListsUpdate(req, res) {
  const existing = await getDeliveryRow(req.params.id);
  if (!existing) {
    return httpError(res, 404, "Teslimat kaydi bulunamadi.");
  }
  try {
    const item = normalizeDelivery(req.body || {}, existing);
    await sqlExec(`
      UPDATE delivery_lists
      SET delivery_no=$2, supplier_id=$3, supplier_name=$4, contact_name=$5, supplier_email=$6, date=$7::date,
          shipping_method=$8, tracking_no=$9, note=$10, status=$11, created_by=$12, updated_at=$13::timestamptz
      WHERE id=$1
    `, [item.id, item.deliveryNo, item.supplierId, item.supplierName, item.contactName, item.supplierEmail, item.date || null, item.shippingMethod, item.trackingNo, item.note, item.status, item.createdBy, item.updatedAt]);
    await replaceDeliveryLines(item);
    return res.json({ ok: true, item: await getDeliveryRow(item.id) });
  } catch (error) {
    console.error("handleDeliveryListsUpdate hatasi:", error?.message, error?.stack);
    return httpError(res, 400, error?.message || "Teslimat kaydi guncellenemedi.");
  }
}

export async function handleDeliveryListsComplete(req, res) {
  const existing = await getDeliveryRow(req.params.id);
  if (!existing) {
    return httpError(res, 404, "Teslimat kaydi bulunamadi.");
  }
  const invalidLines = (existing.lines || []).filter((line) => !line.productId);
  if (invalidLines.length > 0) {
    return httpError(res, 400, "Bazi satirlar urun kartina bagli degil.");
  }
  try {
    const timestamp = nowIso();
    await withInventoryTransaction(async (tx) => {
      const mainLocation = await getMainStockLocation(tx);
      await replaceStockMovementsForSource(
        "delivery-list",
        existing.id,
        existing.lines.map((line, index) => ({
          movementType: "MAGAZA_STOK_GIRISI",
          direction: "IN",
          affectsStock: true,
          quantity: Number(line.quantity || 0),
          stockDelta: Number(line.quantity || 0),
          productId: line.productId,
          stockLocationId: mainLocation?.id || null,
          documentNo: existing.deliveryNo || existing.id,
          documentDate: existing.date || timestamp,
          sourceLineId: line.id || `${existing.id}-line-${index + 1}`,
          partyId: existing.supplierId,
          partyName: existing.supplierName || "",
          unitAmount: 0,
          totalAmount: 0,
          note: line.description || existing.note || "",
          createdBy: existing.createdBy || null,
          createdAt: existing.createdAt || timestamp,
        })),
        tx,
      );
      await rebuildStockBalancesFromMovements(tx);
      await tx.exec(`
        UPDATE delivery_lists
        SET status=$2, updated_at=$3::timestamptz
        WHERE id=$1
      `, [existing.id, "Tamamlandi", timestamp]);
    });
    return res.json({ ok: true, item: await getDeliveryRow(existing.id) });
  } catch (error) {
    return httpError(res, 400, error?.message || "Teslimat stoğa aktarilamadi.");
  }
}
