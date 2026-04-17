import crypto from "node:crypto";
import { sqlExec, sqlMany, sqlOne } from "./db.js";
import {
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

function httpError(res, status, message) {
  return res.status(status).json({ ok: false, message });
}

function mapStoreRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    code: row.code || "",
    name: row.name || "",
    taxNumber: row.tax_number || "",
    commissionRate: Number(row.commission_rate || 0),
    address: row.address || "",
    contactName: row.contact_name || "",
    contactPhone: row.contact_phone || "",
    contactEmail: row.contact_email || "",
    stockLocationId: row.stock_location_id || null,
    stockLocationName: row.stock_location_name || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapShipmentLineRow(row) {
  return {
    id: row.id,
    productId: row.product_id || null,
    isManualProduct: Boolean(row.is_manual_product),
    image: row.image || "",
    name: row.name || "",
    code: row.code || "",
    salePrice: Number(row.sale_price || 0),
    saleCurrency: row.sale_currency || "TRY",
    quantity: Number(row.quantity || 0),
    description: row.description || "",
    sortOrder: Number(row.sort_order || 0),
  };
}

async function listStoresRows() {
  const rows = await sqlMany(
    `
      SELECT s.*, sl.name AS stock_location_name
      FROM stores s
      INNER JOIN stock_locations sl ON sl.id = s.stock_location_id
      ORDER BY s.created_at DESC, s.name ASC
    `,
  );
  return rows.map(mapStoreRow);
}

async function getStoreRow(storeId) {
  const row = await sqlOne(
    `
      SELECT s.*, sl.name AS stock_location_name
      FROM stores s
      INNER JOIN stock_locations sl ON sl.id = s.stock_location_id
      WHERE s.id = $1
    `,
    [storeId],
  );
  return mapStoreRow(row);
}

function normalizeStore(values, existingRecord) {
  return {
    id: existingRecord?.id || createId("store"),
    code: String(values.code || "").trim(),
    name: String(values.name || "").trim(),
    taxNumber: String(values.taxNumber || "").trim(),
    commissionRate: Number(values.commissionRate || 0),
    address: String(values.address || "").trim(),
    contactName: String(values.contactName || "").trim(),
    contactPhone: String(values.contactPhone || "").trim(),
    contactEmail: String(values.contactEmail || "").trim(),
    stockLocationName: String(values.stockLocationName || "").trim(),
    stockLocationId: existingRecord?.stockLocationId || null,
    createdAt: existingRecord?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

async function createOrUpdateStoreRecord(values, existingRecord) {
  const storeId = await withInventoryTransaction(async (tx) => {
    const item = normalizeStore(values, existingRecord);
    if (!item.code || !item.name || !item.stockLocationName) {
      throw new Error("Magaza kodu, magaza adi ve stok yeri adi zorunludur.");
    }

    const duplicateCode = await tx.one(
      "SELECT id FROM stores WHERE code = $1 AND id <> COALESCE($2, '')",
      [item.code, existingRecord?.id || null],
    );
    if (duplicateCode) {
      throw new Error("Bu magaza kodu daha once kullanilmis.");
    }

    const duplicateLocation = await tx.one(
      `
        SELECT id
        FROM stock_locations
        WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
          AND id <> COALESCE($2, '')
      `,
      [item.stockLocationName, existingRecord?.stockLocationId || null],
    );
    if (duplicateLocation) {
      throw new Error("Bu stok yeri adi daha once kullanilmis.");
    }

    let stockLocationId = existingRecord?.stockLocationId;

    if (!stockLocationId) {
      stockLocationId = createId("stockloc");
      await tx.exec(
        `
          INSERT INTO stock_locations (id, name, store_id, is_default_main, created_at, updated_at)
          VALUES ($1, $2, $3, FALSE, $4::timestamptz, $5::timestamptz)
        `,
        [stockLocationId, item.stockLocationName, item.id, item.createdAt, item.updatedAt],
      );
    } else {
      await tx.exec(
        `
          UPDATE stock_locations
          SET name = $2,
              store_id = $3,
              updated_at = $4::timestamptz
          WHERE id = $1
        `,
        [stockLocationId, item.stockLocationName, item.id, item.updatedAt],
      );
    }

    if (!existingRecord) {
      await tx.exec(
        `
          INSERT INTO stores (
            id, code, name, tax_number, commission_rate, address, contact_name,
            contact_phone, contact_email, stock_location_id, created_at, updated_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz,$12::timestamptz)
        `,
        [
          item.id,
          item.code,
          item.name,
          item.taxNumber,
          item.commissionRate,
          item.address,
          item.contactName,
          item.contactPhone,
          item.contactEmail,
          stockLocationId,
          item.createdAt,
          item.updatedAt,
        ],
      );
    } else {
      await tx.exec(
        `
          UPDATE stores
          SET code = $2,
              name = $3,
              tax_number = $4,
              commission_rate = $5,
              address = $6,
              contact_name = $7,
              contact_phone = $8,
              contact_email = $9,
              stock_location_id = $10,
              updated_at = $11::timestamptz
          WHERE id = $1
        `,
        [
          item.id,
          item.code,
          item.name,
          item.taxNumber,
          item.commissionRate,
          item.address,
          item.contactName,
          item.contactPhone,
          item.contactEmail,
          stockLocationId,
          item.updatedAt,
        ],
      );
    }

    return item.id;
  });
  return getStoreRow(storeId);
}

async function deleteStoreRecord(storeId) {
  return withInventoryTransaction(async (tx) => {
    const existingStore = await tx.one("SELECT * FROM stores WHERE id = $1", [storeId]);
    if (!existingStore) {
      return false;
    }

    await tx.exec("DELETE FROM stores WHERE id = $1", [storeId]);
    await tx.exec("DELETE FROM stock_locations WHERE id = $1 AND is_default_main = FALSE", [existingStore.stock_location_id]);
    return true;
  });
}

async function listStockLocationRows() {
  const rows = await sqlMany(
    `
      SELECT
        sl.id,
        sl.name,
        sl.store_id,
        sl.is_default_main,
        sl.created_at,
        sl.updated_at,
        s.name AS store_name,
        COUNT(DISTINCT CASE WHEN COALESCE(slb.quantity, 0) > 0 THEN slb.product_id END) AS product_variety,
        COALESCE(SUM(CASE WHEN COALESCE(slb.quantity, 0) > 0 THEN slb.quantity ELSE 0 END), 0) AS total_quantity
      FROM stock_locations sl
      LEFT JOIN stores s ON s.id = sl.store_id
      LEFT JOIN stock_location_balances slb ON slb.stock_location_id = sl.id
      GROUP BY sl.id, sl.name, sl.store_id, sl.is_default_main, sl.created_at, sl.updated_at, s.name
      ORDER BY sl.is_default_main DESC, sl.name ASC
    `,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name || "",
    storeId: row.store_id || null,
    storeName: row.store_name || "",
    isDefaultMain: Boolean(row.is_default_main),
    productVariety: Number(row.product_variety || 0),
    totalQuantity: Number(row.total_quantity || 0),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }));
}

async function listStockLocationBalances(stockLocationId) {
  const rows = await sqlMany(
    `
      SELECT
        slb.stock_location_id,
        slb.product_id,
        slb.quantity,
        slb.updated_at,
        p.code AS product_code,
        p.name AS product_name,
        p.image AS product_image,
        p.sale_price,
        p.sale_currency
      FROM stock_location_balances slb
      INNER JOIN products p ON p.id = slb.product_id
      WHERE slb.stock_location_id = $1 AND COALESCE(slb.quantity, 0) > 0
      ORDER BY p.code ASC, p.name ASC
    `,
    [stockLocationId],
  );

  return rows.map((row) => ({
    stockLocationId: row.stock_location_id,
    productId: row.product_id,
    productCode: row.product_code || "",
    productName: row.product_name || "",
    productImage: row.product_image || "",
    salePrice: Number(row.sale_price || 0),
    saleCurrency: row.sale_currency || "TRY",
    quantity: Number(row.quantity || 0),
    updatedAt: row.updated_at || null,
  }));
}

async function listStoreShipmentRows() {
  const shipmentRows = await sqlMany("SELECT * FROM store_shipments ORDER BY created_at DESC, date DESC, shipment_no ASC");
  const lineRows = await sqlMany("SELECT * FROM store_shipment_lines ORDER BY shipment_id ASC, sort_order ASC, id ASC");
  const linesByShipmentId = new Map();

  lineRows.forEach((row) => {
    const items = linesByShipmentId.get(row.shipment_id) || [];
    items.push(mapShipmentLineRow(row));
    linesByShipmentId.set(row.shipment_id, items);
  });

  return shipmentRows.map((row) => {
    const lines = linesByShipmentId.get(row.id) || [];
    const totalQuantity = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    const totalAmount = lines.reduce((sum, line) => sum + (Number(line.quantity || 0) * Number(line.salePrice || 0)), 0);
    return {
      id: row.id,
      shipmentNo: row.shipment_no || "",
      storeId: row.store_id || null,
      storeName: row.store_name || "",
      date: row.date || "",
      shippingMethod: row.shipping_method || "Kargo",
      trackingNo: row.tracking_no || "",
      note: row.note || "",
      status: row.status || "Taslak",
      createdBy: row.created_by || null,
      sentAt: row.sent_at || null,
      lines,
      lineCount: lines.length,
      totalQuantity,
      totalAmount,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  });
}

async function getStoreShipmentRow(shipmentId) {
  return (await listStoreShipmentRows()).find((item) => item.id === shipmentId) || null;
}

function buildNextStoreShipmentNo(store, shipments) {
  const storeCode = String(store?.code || "GEN").trim().toUpperCase() || "GEN";
  const nextNumber = shipments.filter((item) => item.storeId === store?.id).length + 1;
  return `GND-${storeCode}-${String(nextNumber).padStart(4, "0")}`;
}

function normalizeShipmentLine(line, index, shipmentId) {
  return {
    id: line.id || `${shipmentId}-line-${index + 1}`,
    productId: line.productId || null,
    isManualProduct: Boolean(line.isManualProduct),
    image: line.image || "",
    name: String(line.name || "").trim(),
    code: String(line.code || "").trim(),
    salePrice: Number(line.salePrice || 0),
    saleCurrency: line.saleCurrency || "TRY",
    quantity: Number(line.quantity || 0),
    description: String(line.description || "").trim(),
  };
}

function normalizeStoreShipment(values, existingRecord, store, shipments) {
  const shipmentId = existingRecord?.id || createId("storeship");
  return {
    id: shipmentId,
    shipmentNo: existingRecord?.shipmentNo || values.shipmentNo || buildNextStoreShipmentNo(store, shipments),
    storeId: values.storeId || existingRecord?.storeId || null,
    storeName: store?.name || existingRecord?.storeName || "",
    date: values.date || existingRecord?.date || new Date().toISOString().slice(0, 10),
    shippingMethod: values.shippingMethod || existingRecord?.shippingMethod || "Kargo",
    trackingNo: values.trackingNo || existingRecord?.trackingNo || "",
    note: values.note || existingRecord?.note || "",
    status: values.status || existingRecord?.status || "Taslak",
    createdBy: values.createdBy || existingRecord?.createdBy || null,
    sentAt: existingRecord?.sentAt || null,
    lines: (values.lines || existingRecord?.lines || [])
      .map((line, index) => normalizeShipmentLine(line, index, shipmentId))
      .filter((line) => line.name || line.productId || line.code),
    createdAt: existingRecord?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

async function replaceStoreShipmentLines(tx, record) {
  await tx.exec("DELETE FROM store_shipment_lines WHERE shipment_id = $1", [record.id]);
  for (let index = 0; index < record.lines.length; index += 1) {
    const line = record.lines[index];
    await tx.exec(
      `
        INSERT INTO store_shipment_lines (
          id, shipment_id, product_id, is_manual_product, image, name, code,
          sale_price, sale_currency, quantity, description, sort_order
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `,
      [
        line.id,
        record.id,
        line.productId,
        line.isManualProduct,
        line.image,
        line.name,
        line.code,
        line.salePrice,
        line.saleCurrency,
        line.quantity,
        line.description,
        index + 1,
      ],
    );
  }
}

async function saveStoreShipment(values, existingRecord) {
  const shipmentId = await withInventoryTransaction(async (tx) => {
    const store = await tx.one(
      `
        SELECT s.*, sl.name AS stock_location_name
        FROM stores s
        INNER JOIN stock_locations sl ON sl.id = s.stock_location_id
        WHERE s.id = $1
      `,
      [values.storeId || existingRecord?.storeId || null],
    );
    if (!store) {
      throw new Error("Hedef magaza bulunamadi.");
    }
    if (existingRecord?.status === "Gonderildi") {
      throw new Error("Gonderilen kayitlar duzenlenemez.");
    }

    const allShipments = await listStoreShipmentRows();
    const item = normalizeStoreShipment(values, existingRecord, store, allShipments);

    if (!item.lines.length) {
      throw new Error("Gonderi icin en az bir satir eklenmelidir.");
    }

    if (!existingRecord) {
      await tx.exec(
        `
          INSERT INTO store_shipments (
            id, shipment_no, store_id, store_name, date, shipping_method, tracking_no,
            note, status, created_by, sent_at, created_at, updated_at
          )
          VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10,$11::timestamptz,$12::timestamptz,$13::timestamptz)
        `,
        [
          item.id,
          item.shipmentNo,
          item.storeId,
          item.storeName,
          item.date || null,
          item.shippingMethod,
          item.trackingNo,
          item.note,
          item.status,
          item.createdBy,
          item.sentAt,
          item.createdAt,
          item.updatedAt,
        ],
      );
    } else {
      await tx.exec(
        `
          UPDATE store_shipments
          SET shipment_no = $2,
              store_id = $3,
              store_name = $4,
              date = $5::date,
              shipping_method = $6,
              tracking_no = $7,
              note = $8,
              status = $9,
              created_by = $10,
              updated_at = $11::timestamptz
          WHERE id = $1
        `,
        [
          item.id,
          item.shipmentNo,
          item.storeId,
          item.storeName,
          item.date || null,
          item.shippingMethod,
          item.trackingNo,
          item.note,
          item.status,
          item.createdBy,
          item.updatedAt,
        ],
      );
    }

    await replaceStoreShipmentLines(tx, item);
    return item.id;
  });
  return getStoreShipmentRow(shipmentId);
}

async function sendStoreShipment(shipmentId) {
  const sentShipmentId = await withInventoryTransaction(async (tx) => {
    const shipment = await getStoreShipmentRow(shipmentId);
    if (!shipment) {
      throw new Error("Gonderi kaydi bulunamadi.");
    }
    if (shipment.status === "Gonderildi") {
      return shipment.id;
    }

    const invalidLine = (shipment.lines || []).find((line) => !line.productId);
    if (invalidLine) {
      throw new Error("Manuel satirlar urun kartina baglanmadan gonderilemez.");
    }

    const store = await tx.one("SELECT stock_location_id FROM stores WHERE id = $1", [shipment.storeId]);
    if (!store?.stock_location_id) {
      throw new Error("Magaza stok yeri bulunamadi.");
    }

    await replaceStockMovementsForSource(
      "store-shipment",
      shipment.id,
      (shipment.lines || []).map((line) => ({
        movementType: "GONDERI_GIRISI",
        direction: "IN",
        affectsStock: true,
        quantity: Number(line.quantity || 0),
        stockDelta: Number(line.quantity || 0),
        productId: line.productId,
        stockLocationId: store.stock_location_id,
        documentNo: shipment.shipmentNo,
        documentDate: shipment.date || shipment.createdAt || nowIso(),
        sourceLineId: line.id,
        partyId: shipment.storeId,
        partyName: shipment.storeName || "",
        unitAmount: Number(line.salePrice || 0),
        totalAmount: Number(line.quantity || 0) * Number(line.salePrice || 0),
        note: line.description || shipment.note || "",
        createdBy: shipment.createdBy || null,
        createdAt: shipment.createdAt || nowIso(),
      })),
      tx,
    );
    await rebuildStockBalancesFromMovements(tx);

    const sentAt = nowIso();
    await tx.exec(
      `
        UPDATE store_shipments
        SET status = $2,
            sent_at = $3::timestamptz,
            updated_at = $4::timestamptz
        WHERE id = $1
      `,
      [shipment.id, "Gonderildi", sentAt, sentAt],
    );

    return shipment.id;
  });
  return getStoreShipmentRow(sentShipmentId);
}

export async function handleStoresList(_req, res) {
  return res.json({ ok: true, items: await listStoresRows() });
}

export async function handleStoresCreate(req, res) {
  try {
    const item = await createOrUpdateStoreRecord(req.body || {});
    return res.status(201).json({ ok: true, item });
  } catch (error) {
    return httpError(res, 400, error?.message || "Magaza kaydi olusturulamadi.");
  }
}

export async function handleStoresUpdate(req, res) {
  const existing = await getStoreRow(req.params.id);
  if (!existing) {
    return httpError(res, 404, "Magaza kaydi bulunamadi.");
  }

  try {
    const item = await createOrUpdateStoreRecord(req.body || {}, existing);
    return res.json({ ok: true, item });
  } catch (error) {
    return httpError(res, 400, error?.message || "Magaza kaydi guncellenemedi.");
  }
}

export async function handleStoresDelete(req, res) {
  try {
    const deleted = await deleteStoreRecord(req.params.id);
    if (!deleted) {
      return httpError(res, 404, "Magaza kaydi bulunamadi.");
    }
    return res.json({ ok: true });
  } catch (error) {
    return httpError(res, 400, error?.message || "Magaza bagli kayitlar nedeniyle silinemedi.");
  }
}

export async function handleStockLocationsList(_req, res) {
  return res.json({ ok: true, items: await listStockLocationRows() });
}

export async function handleStockLocationBalancesList(req, res) {
  return res.json({ ok: true, items: await listStockLocationBalances(req.params.id) });
}

export async function handleStoreShipmentsList(_req, res) {
  return res.json({ ok: true, items: await listStoreShipmentRows() });
}

export async function handleStoreShipmentsCreate(req, res) {
  try {
    const item = await saveStoreShipment(req.body || {});
    return res.status(201).json({ ok: true, item });
  } catch (error) {
    return httpError(res, 400, error?.message || "Gonderi kaydi olusturulamadi.");
  }
}

export async function handleStoreShipmentsUpdate(req, res) {
  const existing = await getStoreShipmentRow(req.params.id);
  if (!existing) {
    return httpError(res, 404, "Gonderi kaydi bulunamadi.");
  }

  try {
    const item = await saveStoreShipment(req.body || {}, existing);
    return res.json({ ok: true, item });
  } catch (error) {
    return httpError(res, 400, error?.message || "Gonderi kaydi guncellenemedi.");
  }
}

export async function handleStoreShipmentsSend(req, res) {
  try {
    const item = await sendStoreShipment(req.params.id);
    return res.json({ ok: true, item });
  } catch (error) {
    const message = error?.message || "Gonderi islenemedi.";
    const status = message.includes("bulunamadi") ? 404 : 400;
    return httpError(res, status, message);
  }
}
