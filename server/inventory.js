import crypto from "node:crypto";
import { sqlExec, sqlMany, sqlOne, withTransaction } from "./db.js";

export const MAIN_STOCK_LOCATION_NAME = "Şarköy Mağaza";

const MOVEMENT_TYPE_META = {
  MAGAZA_STOK_GIRISI: { label: "Magaza Stok Girisi", direction: "IN" },
  GONDERI_GIRISI: { label: "Gonderi Girisi", direction: "IN" },
  SATIS_CIKISI: { label: "Satis Cikisi", direction: "OUT" },
  SATINALMA_BELGESI: { label: "Satinalma Belgesi", direction: "IN" },
  STOK_DUZELTME: { label: "Stok Duzeltme", direction: "IN" },
  STOK_GIRIS: { label: "Stok Girisi", direction: "IN" },
};

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createExecutor(tx) {
  if (!tx) {
    return {
      one: sqlOne,
      many: sqlMany,
      exec: sqlExec,
    };
  }

  return tx;
}

function mapMovementRow(row) {
  const meta = MOVEMENT_TYPE_META[row.movement_type] || {
    label: row.movement_type || "Hareket",
    direction: row.direction || "IN",
  };
  return {
    id: row.id,
    movementType: row.movement_type || "",
    movementTypeLabel: meta.label,
    direction: row.direction || meta.direction,
    affectsStock: Boolean(row.affects_stock),
    quantity: Number(row.quantity || 0),
    stockDelta: Number(row.stock_delta || 0),
    productId: row.product_id || null,
    productCode: row.product_code || "-",
    productName: row.product_name || "-",
    stockLocationId: row.stock_location_id || null,
    stockLocationName: row.stock_location_name || "",
    isDefaultMain: Boolean(row.is_default_main),
    storeId: row.store_id || null,
    storeName: row.store_name || "",
    documentNo: row.document_no || "",
    documentDate: row.document_date || null,
    sourceModule: row.source_module || "",
    sourceId: row.source_id || null,
    sourceLineId: row.source_line_id || null,
    partyId: row.party_id || null,
    partyName: row.party_name || "",
    unitAmount: Number(row.unit_amount || 0),
    totalAmount: Number(row.total_amount || 0),
    note: row.note || "",
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
  };
}

function normalizeMovementRecord(record) {
  const meta = MOVEMENT_TYPE_META[record.movementType] || {
    direction: record.direction || "IN",
  };
  const quantity = Number(record.quantity || 0);
  const stockDelta =
    typeof record.stockDelta !== "undefined"
      ? Number(record.stockDelta || 0)
      : meta.direction === "OUT"
        ? -quantity
        : quantity;

  return {
    id: record.id || createId("mov"),
    movementType: String(record.movementType || "").trim(),
    direction: record.direction || meta.direction || "IN",
    affectsStock: Boolean(record.affectsStock),
    quantity,
    stockDelta: record.affectsStock ? stockDelta : 0,
    productId: record.productId || null,
    stockLocationId: record.stockLocationId || null,
    documentNo: String(record.documentNo || "").trim(),
    documentDate: record.documentDate || null,
    sourceModule: String(record.sourceModule || "").trim() || null,
    sourceId: record.sourceId || null,
    sourceLineId: record.sourceLineId || null,
    partyId: record.partyId || null,
    partyName: String(record.partyName || "").trim(),
    unitAmount: Number(record.unitAmount || 0),
    totalAmount: Number(
      typeof record.totalAmount !== "undefined"
        ? record.totalAmount
        : quantity * Number(record.unitAmount || 0),
    ),
    note: String(record.note || "").trim(),
    createdBy: record.createdBy || null,
    createdAt: record.createdAt || nowIso(),
  };
}

async function ensureStockMovementSchema() {
  await sqlExec("ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS stock_location_id TEXT REFERENCES stock_locations(id)");
  await sqlExec(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      movement_type TEXT NOT NULL,
      direction TEXT NOT NULL,
      affects_stock BOOLEAN NOT NULL DEFAULT FALSE,
      quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
      stock_delta DOUBLE PRECISION NOT NULL DEFAULT 0,
      product_id TEXT REFERENCES products(id),
      stock_location_id TEXT REFERENCES stock_locations(id),
      document_no TEXT,
      document_date TIMESTAMPTZ,
      source_module TEXT,
      source_id TEXT,
      source_line_id TEXT,
      party_id TEXT,
      party_name TEXT,
      unit_amount DOUBLE PRECISION,
      total_amount DOUBLE PRECISION,
      note TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMPTZ
    )
  `);
  await sqlExec(`
    CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_source_line_unique_idx
    ON stock_movements (source_module, source_id, source_line_id, movement_type)
    WHERE source_module IS NOT NULL AND source_id IS NOT NULL AND source_line_id IS NOT NULL
  `);
  await sqlExec(`
    CREATE INDEX IF NOT EXISTS stock_movements_document_date_idx
    ON stock_movements (document_date DESC, created_at DESC)
  `);
  await sqlExec(`
    CREATE INDEX IF NOT EXISTS stock_movements_product_location_idx
    ON stock_movements (product_id, stock_location_id)
  `);
}

export async function getMainStockLocation(tx) {
  const executor = createExecutor(tx);
  return executor.one(
    `
      SELECT *
      FROM stock_locations
      WHERE is_default_main = TRUE
      ORDER BY created_at ASC NULLS LAST, id ASC
      LIMIT 1
    `,
  );
}

export async function getStockLocationById(stockLocationId, tx) {
  const executor = createExecutor(tx);
  if (!stockLocationId) {
    return null;
  }
  return executor.one("SELECT * FROM stock_locations WHERE id = $1", [stockLocationId]);
}

async function syncProductsStockSnapshot(tx) {
  const executor = createExecutor(tx);
  const mainLocation = await getMainStockLocation(executor);
  if (!mainLocation) {
    return;
  }

  await executor.exec("UPDATE products SET stock = 0");
  await executor.exec(
    `
      UPDATE products p
      SET stock = balances.quantity
      FROM (
        SELECT product_id, quantity
        FROM stock_location_balances
        WHERE stock_location_id = $1
      ) balances
      WHERE p.id = balances.product_id
    `,
    [mainLocation.id],
  );
}

export async function syncMainBalanceWithProductStock(productId, tx) {
  const executor = createExecutor(tx);
  const mainLocation = await getMainStockLocation(executor);
  if (!mainLocation || !productId) {
    return null;
  }

  const product = await executor.one("SELECT id, stock FROM products WHERE id = $1", [productId]);
  if (!product) {
    return null;
  }

  await executor.exec(
    `
      INSERT INTO stock_location_balances (stock_location_id, product_id, quantity, updated_at)
      VALUES ($1, $2, $3, $4::timestamptz)
      ON CONFLICT (stock_location_id, product_id)
      DO UPDATE
      SET quantity = EXCLUDED.quantity,
          updated_at = EXCLUDED.updated_at
    `,
    [mainLocation.id, product.id, Number(product.stock || 0), nowIso()],
  );

  return {
    stockLocationId: mainLocation.id,
    productId: product.id,
    quantity: Number(product.stock || 0),
  };
}

export async function applyProductStockDelta(productId, delta, tx) {
  const executor = createExecutor(tx);
  const product = await executor.one(
    `
      UPDATE products
      SET stock = GREATEST(0, COALESCE(stock, 0) + $2),
          updated_at = $3::timestamptz
      WHERE id = $1
      RETURNING id, stock
    `,
    [productId, Number(delta || 0), nowIso()],
  );

  if (!product) {
    return null;
  }

  await syncMainBalanceWithProductStock(product.id, executor);
  return {
    productId: product.id,
    stock: Number(product.stock || 0),
  };
}

export async function assertProductStockAvailable(lines, tx) {
  const executor = createExecutor(tx);
  const quantitiesByProductId = new Map();

  (lines || []).forEach((line) => {
    if (!line?.productId) {
      return;
    }
    quantitiesByProductId.set(
      line.productId,
      Number(quantitiesByProductId.get(line.productId) || 0) + Number(line.quantity || 0),
    );
  });

  for (const [productId, requiredQuantity] of quantitiesByProductId.entries()) {
    const product = await executor.one("SELECT id, name, stock FROM products WHERE id = $1", [productId]);
    const available = Number(product?.stock || 0);
    if (!product || available < Number(requiredQuantity || 0)) {
      const productName = product?.name || "Urun";
      throw new Error(`${productName} icin yeterli merkez stok bulunmuyor.`);
    }
  }
}

export async function assertStockLocationStockAvailable(stockLocationId, lines, tx) {
  const executor = createExecutor(tx);
  const stockLocation = await getStockLocationById(stockLocationId, executor);
  if (!stockLocation) {
    throw new Error("Stok yeri bulunamadi.");
  }

  const quantitiesByProductId = new Map();
  (lines || []).forEach((line) => {
    if (!line?.productId) {
      return;
    }
    quantitiesByProductId.set(
      line.productId,
      Number(quantitiesByProductId.get(line.productId) || 0) + Number(line.quantity || 0),
    );
  });

  for (const [productId, requiredQuantity] of quantitiesByProductId.entries()) {
    const row = await executor.one(
      `
        SELECT
          p.name,
          COALESCE(slb.quantity, 0) AS quantity
        FROM products p
        LEFT JOIN stock_location_balances slb
          ON slb.product_id = p.id
         AND slb.stock_location_id = $2
        WHERE p.id = $1
      `,
      [productId, stockLocationId],
    );
    const available = Number(row?.quantity || 0);
    if (!row || available < Number(requiredQuantity || 0)) {
      const productName = row?.name || "Urun";
      throw new Error(`${productName} icin secilen stok yerinde yeterli stok bulunmuyor.`);
    }
  }
}

export async function incrementStockLocationBalance(stockLocationId, productId, quantity, tx) {
  const executor = createExecutor(tx);
  await executor.exec(
    `
      INSERT INTO stock_location_balances (stock_location_id, product_id, quantity, updated_at)
      VALUES ($1, $2, $3, $4::timestamptz)
      ON CONFLICT (stock_location_id, product_id)
      DO UPDATE
      SET quantity = stock_location_balances.quantity + EXCLUDED.quantity,
          updated_at = EXCLUDED.updated_at
    `,
    [stockLocationId, productId, Number(quantity || 0), nowIso()],
  );
}

export async function replaceStockMovementsForSource(sourceModule, sourceId, movementRecords, tx) {
  const executor = createExecutor(tx);
  if (!sourceModule || !sourceId) {
    throw new Error("Stok hareket kaynagi zorunludur.");
  }

  await executor.exec(
    "DELETE FROM stock_movements WHERE source_module = $1 AND source_id = $2",
    [sourceModule, sourceId],
  );

  for (const rawRecord of movementRecords || []) {
    const record = normalizeMovementRecord({
      ...rawRecord,
      sourceModule,
      sourceId,
    });
    if (!record.movementType || !record.sourceLineId) {
      continue;
    }

    await executor.exec(
      `
        INSERT INTO stock_movements (
          id, movement_type, direction, affects_stock, quantity, stock_delta, product_id,
          stock_location_id, document_no, document_date, source_module, source_id, source_line_id,
          party_id, party_name, unit_amount, total_amount, note, created_by, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::timestamptz)
      `,
      [
        record.id,
        record.movementType,
        record.direction,
        record.affectsStock,
        record.quantity,
        record.stockDelta,
        record.productId,
        record.stockLocationId,
        record.documentNo,
        record.documentDate,
        record.sourceModule,
        record.sourceId,
        record.sourceLineId,
        record.partyId,
        record.partyName,
        record.unitAmount,
        record.totalAmount,
        record.note,
        record.createdBy,
        record.createdAt,
      ],
    );
  }
}

export async function rebuildStockBalancesFromMovements(tx) {
  const executor = createExecutor(tx);

  await executor.exec("DELETE FROM stock_location_balances");
  await executor.exec(
    `
      INSERT INTO stock_location_balances (stock_location_id, product_id, quantity, updated_at)
      SELECT
        stock_location_id,
        product_id,
        SUM(stock_delta) AS quantity,
        MAX(created_at) AS updated_at
      FROM stock_movements
      WHERE affects_stock = TRUE
        AND stock_location_id IS NOT NULL
        AND product_id IS NOT NULL
      GROUP BY stock_location_id, product_id
      HAVING SUM(stock_delta) <> 0
    `,
  );

  await syncProductsStockSnapshot(executor);
}

export async function listStockMovementRows() {
  const rows = await sqlMany(
    `
      SELECT
        sm.*,
        p.code AS product_code,
        p.name AS product_name,
        sl.name AS stock_location_name,
        sl.is_default_main,
        sl.store_id,
        s.name AS store_name
      FROM stock_movements sm
      LEFT JOIN products p ON p.id = sm.product_id
      LEFT JOIN stock_locations sl ON sl.id = sm.stock_location_id
      LEFT JOIN stores s ON s.id = sl.store_id
      ORDER BY sm.document_date DESC NULLS LAST, sm.created_at DESC NULLS LAST, sm.document_no DESC NULLS LAST, sm.id DESC
    `,
  );

  return rows.map(mapMovementRow);
}

export async function listProductStockLocationBalances(productId) {
  const rows = await sqlMany(
    `
      SELECT
        slb.stock_location_id,
        sl.name AS stock_location_name,
        sl.is_default_main,
        sl.store_id,
        s.name AS store_name,
        slb.quantity,
        slb.updated_at
      FROM stock_location_balances slb
      INNER JOIN stock_locations sl ON sl.id = slb.stock_location_id
      LEFT JOIN stores s ON s.id = sl.store_id
      WHERE slb.product_id = $1 AND COALESCE(slb.quantity, 0) > 0
      ORDER BY sl.is_default_main DESC, sl.name ASC
    `,
    [productId],
  );

  return rows.map((row) => ({
    stockLocationId: row.stock_location_id,
    stockLocationName: row.stock_location_name || "",
    isDefaultMain: Boolean(row.is_default_main),
    storeId: row.store_id || null,
    storeName: row.store_name || "",
    quantity: Number(row.quantity || 0),
    updatedAt: row.updated_at || null,
  }));
}

function groupRowsBySource(rows, sourceKey) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = row[sourceKey];
    if (!key) {
      return;
    }
    const items = grouped.get(key) || [];
    items.push(row);
    grouped.set(key, items);
  });
  return grouped;
}

async function backfillPurchaseDocumentMovements(tx, mainLocationId) {
  const purchaseRows = await tx.many(
    `
      SELECT
        p.id AS purchase_id,
        p.document_no,
        p.date,
        p.description,
        p.created_at,
        p.supplier_id,
        s.company AS supplier_name,
        pl.id AS line_id,
        pl.product_id,
        pl.quantity,
        pl.unit_price,
        pl.note
      FROM purchases p
      INNER JOIN purchase_lines pl ON pl.purchase_id = p.id
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      ORDER BY p.created_at ASC NULLS LAST, p.id ASC, pl.sort_order ASC, pl.id ASC
    `,
  );
  const grouped = groupRowsBySource(purchaseRows, "purchase_id");

  for (const [purchaseId, rows] of grouped.entries()) {
    await replaceStockMovementsForSource(
      "purchase",
      purchaseId,
      rows.map((row) => ({
        movementType: "SATINALMA_BELGESI",
        direction: "IN",
        affectsStock: false,
        quantity: Number(row.quantity || 0),
        stockDelta: 0,
        productId: row.product_id || null,
        stockLocationId: mainLocationId,
        documentNo: row.document_no || "",
        documentDate: row.date || row.created_at || null,
        sourceLineId: row.line_id,
        partyId: row.supplier_id || null,
        partyName: row.supplier_name || "",
        unitAmount: Number(row.unit_price || 0),
        totalAmount: Number(row.quantity || 0) * Number(row.unit_price || 0),
        note: row.note || row.description || "",
        createdAt: row.created_at || nowIso(),
      })),
      tx,
    );
  }
}

async function backfillStockEntryMovements(tx, mainLocationId) {
  const entryRows = await tx.many(
    `
      SELECT
        se.id AS stock_entry_id,
        se.document_no,
        se.date,
        se.source_type,
        se.note AS entry_note,
        se.created_at,
        se.source_party_id,
        s.company AS supplier_name,
        sl.id AS line_id,
        sl.product_id,
        sl.quantity,
        sl.unit_cost,
        sl.note AS line_note
      FROM stock_entries se
      INNER JOIN stock_lines sl ON sl.stock_entry_id = se.id
      LEFT JOIN suppliers s ON s.id = se.source_party_id
      ORDER BY se.created_at ASC NULLS LAST, se.id ASC, sl.sort_order ASC, sl.id ASC
    `,
  );
  const grouped = groupRowsBySource(entryRows, "stock_entry_id");

  for (const [stockEntryId, rows] of grouped.entries()) {
    await replaceStockMovementsForSource(
      "stock-entry",
      stockEntryId,
      rows.map((row) => ({
        movementType:
          row.source_type === "Sayim Duzeltme"
            ? "STOK_DUZELTME"
            : row.source_type === "Tedarikci Teslimati"
              ? "MAGAZA_STOK_GIRISI"
              : "STOK_GIRIS",
        direction: "IN",
        affectsStock: true,
        quantity: Number(row.quantity || 0),
        stockDelta: Number(row.quantity || 0),
        productId: row.product_id || null,
        stockLocationId: mainLocationId,
        documentNo: row.document_no || "",
        documentDate: row.date || row.created_at || null,
        sourceLineId: row.line_id,
        partyId: row.source_party_id || null,
        partyName: row.supplier_name || row.source_type || "",
        unitAmount: Number(row.unit_cost || 0),
        totalAmount: Number(row.quantity || 0) * Number(row.unit_cost || 0),
        note: row.line_note || row.entry_note || "",
        createdAt: row.created_at || nowIso(),
      })),
      tx,
    );
  }
}

async function backfillPosSaleMovements(tx, mainLocationId) {
  const saleRows = await tx.many(
    `
      SELECT
        ps.id AS sale_id,
        ps.receipt_no,
        ps.sold_at,
        ps.customer_name,
        ps.note,
        ps.created_at,
        ps.stock_location_id,
        psl.id AS line_id,
        psl.product_id,
        psl.quantity,
        psl.unit_price,
        psl.line_total
      FROM pos_sales ps
      INNER JOIN pos_sale_lines psl ON psl.sale_id = ps.id
      ORDER BY ps.created_at ASC NULLS LAST, ps.id ASC, psl.sort_order ASC, psl.id ASC
    `,
  );
  const grouped = groupRowsBySource(saleRows, "sale_id");

  for (const [saleId, rows] of grouped.entries()) {
    const stockLocationId = rows[0]?.stock_location_id || mainLocationId;
    await replaceStockMovementsForSource(
      "pos-sale",
      saleId,
      rows.map((row) => ({
        movementType: "SATIS_CIKISI",
        direction: "OUT",
        affectsStock: true,
        quantity: Number(row.quantity || 0),
        stockDelta: -Number(row.quantity || 0),
        productId: row.product_id || null,
        stockLocationId,
        documentNo: row.receipt_no || "",
        documentDate: row.sold_at || row.created_at || null,
        sourceLineId: row.line_id,
        partyName: row.customer_name || "POS",
        unitAmount: Number(row.unit_price || 0),
        totalAmount: Number(row.line_total || (Number(row.quantity || 0) * Number(row.unit_price || 0))),
        note: row.note || "",
        createdAt: row.created_at || nowIso(),
      })),
      tx,
    );
  }
}

async function backfillStoreShipmentMovements(tx) {
  const shipmentRows = await tx.many(
    `
      SELECT
        ss.id AS shipment_id,
        ss.shipment_no,
        ss.date,
        ss.note,
        ss.created_at,
        ss.store_id,
        ss.store_name,
        s.stock_location_id,
        ssl.id AS line_id,
        ssl.product_id,
        ssl.quantity,
        ssl.sale_price,
        ssl.description
      FROM store_shipments ss
      INNER JOIN stores s ON s.id = ss.store_id
      INNER JOIN store_shipment_lines ssl ON ssl.shipment_id = ss.id
      WHERE ss.status = 'Gonderildi'
      ORDER BY ss.created_at ASC NULLS LAST, ss.id ASC, ssl.sort_order ASC, ssl.id ASC
    `,
  );
  const grouped = groupRowsBySource(shipmentRows, "shipment_id");

  for (const [shipmentId, rows] of grouped.entries()) {
    await replaceStockMovementsForSource(
      "store-shipment",
      shipmentId,
      rows.map((row) => ({
        movementType: "GONDERI_GIRISI",
        direction: "IN",
        affectsStock: true,
        quantity: Number(row.quantity || 0),
        stockDelta: Number(row.quantity || 0),
        productId: row.product_id || null,
        stockLocationId: row.stock_location_id || null,
        documentNo: row.shipment_no || "",
        documentDate: row.date || row.created_at || null,
        sourceLineId: row.line_id,
        partyId: row.store_id || null,
        partyName: row.store_name || "",
        unitAmount: Number(row.sale_price || 0),
        totalAmount: Number(row.quantity || 0) * Number(row.sale_price || 0),
        note: row.description || row.note || "",
        createdAt: row.created_at || nowIso(),
      })),
      tx,
    );
  }
}

export async function ensureStockMovementsReady() {
  await ensureStockMovementSchema();
  await withInventoryTransaction(async (tx) => {
    const mainLocation = await getMainStockLocation(tx);
    if (!mainLocation) {
      return;
    }

    await backfillPurchaseDocumentMovements(tx, mainLocation.id);
    await backfillStockEntryMovements(tx, mainLocation.id);
    await backfillPosSaleMovements(tx, mainLocation.id);
    await backfillStoreShipmentMovements(tx);
    await rebuildStockBalancesFromMovements(tx);
  });
}

export async function withInventoryTransaction(callback) {
  return withTransaction(callback);
}
