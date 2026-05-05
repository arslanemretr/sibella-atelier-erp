import crypto from "node:crypto";
import { sqlExec, sqlMany, sqlOne } from "./db.js";
import { listProductStockLocationBalances, syncMainBalanceWithProductStock } from "./inventory.js";

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

let ensureSupplierLogoColumnPromise = null;

async function ensureSupplierLogoColumn() {
  if (!ensureSupplierLogoColumnPromise) {
    ensureSupplierLogoColumnPromise = sqlExec("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS logo TEXT").catch((error) => {
      ensureSupplierLogoColumnPromise = null;
      throw error;
    });
  }

  await ensureSupplierLogoColumnPromise;
}

export async function ensureBarcodeStandardsReady() {
  await sqlExec("ALTER TABLE barcode_standards ADD COLUMN IF NOT EXISTS standard_prefix TEXT DEFAULT '111'");
  await sqlExec("ALTER TABLE barcode_standards ADD COLUMN IF NOT EXISTS supplier_id TEXT REFERENCES suppliers(id)");
  await sqlExec("ALTER TABLE barcode_standards ADD COLUMN IF NOT EXISTS supplier_short_code TEXT");
  await sqlExec("ALTER TABLE barcode_standards ADD COLUMN IF NOT EXISTS customer_seq_no TEXT");
  await sqlExec("ALTER TABLE barcode_standards ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT 'Konsinye'");
  await sqlExec("ALTER TABLE barcode_standards ADD COLUMN IF NOT EXISTS customer_type_code TEXT DEFAULT '0020'");
  await sqlExec("ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode_standard_id TEXT REFERENCES barcode_standards(id)");
}

const MASTER_DATA_CONFIG = {
  categories: {
    table: "categories",
    prefix: "cat",
    orderBy: "created_at DESC, full_path ASC",
    mapRow(row) {
      return {
        id: row.id,
        level1: row.level1 || "",
        level2: row.level2 || "",
        level3: row.level3 || "",
        level4: row.level4 || "",
        fullPath: row.full_path || "",
        status: row.status || "Aktif",
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
      };
    },
    normalize(values, existingRecord) {
      return {
        id: existingRecord?.id || createId("cat"),
        level1: String(values.level1 || "").trim(),
        level2: String(values.level2 || "").trim(),
        level3: String(values.level3 || "").trim(),
        level4: String(values.level4 || "").trim(),
        fullPath: [values.level1, values.level2, values.level3, values.level4].filter(Boolean).join(" / "),
        status: values.status || "Aktif",
        createdAt: existingRecord?.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    },
    async insert(record) {
      await sqlExec(`
        INSERT INTO categories (id, level1, level2, level3, level4, full_path, status, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz)
      `, [record.id, record.level1, record.level2, record.level3, record.level4, record.fullPath, record.status, record.createdAt, record.updatedAt]);
    },
    async update(record) {
      await sqlExec(`
        UPDATE categories
        SET level1=$2, level2=$3, level3=$4, level4=$5, full_path=$6, status=$7, updated_at=$8::timestamptz
        WHERE id=$1
      `, [record.id, record.level1, record.level2, record.level3, record.level4, record.fullPath, record.status, record.updatedAt]);
    },
  },
  collections: {
    table: "collections",
    prefix: "col",
    orderBy: "created_at DESC, name ASC",
    mapRow(row) {
      return {
        id: row.id,
        name: row.name || "",
        description: row.description || "",
        status: row.status || "Aktif",
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
      };
    },
    normalize(values, existingRecord) {
      return {
        id: existingRecord?.id || createId("col"),
        name: String(values.name || "").trim(),
        description: String(values.description || "").trim(),
        status: values.status || "Aktif",
        createdAt: existingRecord?.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    },
    async insert(record) {
      await sqlExec(`
        INSERT INTO collections (id, name, description, status, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz)
      `, [record.id, record.name, record.description, record.status, record.createdAt, record.updatedAt]);
    },
    async update(record) {
      await sqlExec(`
        UPDATE collections
        SET name=$2, description=$3, status=$4, updated_at=$5::timestamptz
        WHERE id=$1
      `, [record.id, record.name, record.description, record.status, record.updatedAt]);
    },
  },
  "pos-categories": {
    table: "pos_categories",
    prefix: "poscat",
    orderBy: "created_at DESC, name ASC",
    mapRow(row) {
      return {
        id: row.id,
        name: row.name || "",
        description: row.description || "",
        status: row.status || "Aktif",
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
      };
    },
    normalize(values, existingRecord) {
      return {
        id: existingRecord?.id || createId("poscat"),
        name: String(values.name || "").trim(),
        description: String(values.description || "").trim(),
        status: values.status || "Aktif",
        createdAt: existingRecord?.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    },
    async insert(record) {
      await sqlExec(`
        INSERT INTO pos_categories (id, name, description, status, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz)
      `, [record.id, record.name, record.description, record.status, record.createdAt, record.updatedAt]);
    },
    async update(record) {
      await sqlExec(`
        UPDATE pos_categories
        SET name=$2, description=$3, status=$4, updated_at=$5::timestamptz
        WHERE id=$1
      `, [record.id, record.name, record.description, record.status, record.updatedAt]);
    },
  },
  "barcode-standards": {
    table: "barcode_standards",
    prefix: "barcode",
    orderBy: "created_at DESC, name ASC",
    mapRow(row) {
      return {
        id: row.id,
        name: row.name || "",
        standardPrefix: row.standard_prefix || "111",
        supplierId: row.supplier_id || null,
        supplierShortCode: row.supplier_short_code || "",
        customerSeqNo: row.customer_seq_no || "",
        customerType: row.customer_type || "Konsinye",
        customerTypeCode: row.customer_type_code || "0020",
        status: row.status || "Aktif",
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
      };
    },
    normalize(values, existingRecord) {
      return {
        id: existingRecord?.id || createId("barcode"),
        name: String(values.name || "").trim(),
        standardPrefix: String(values.standardPrefix || "111").trim(),
        supplierId: values.supplierId || null,
        supplierShortCode: String(values.supplierShortCode || "").trim(),
        customerSeqNo: String(values.customerSeqNo || "").trim().padStart(2, "0").slice(-2),
        customerType: values.customerType || "Konsinye",
        customerTypeCode: String(values.customerTypeCode || "0020").trim(),
        status: values.status || "Aktif",
        createdAt: existingRecord?.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    },
    async insert(record) {
      await sqlExec(`
        INSERT INTO barcode_standards (id, name, standard_prefix, supplier_id, supplier_short_code, customer_seq_no, customer_type, customer_type_code, status, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11::timestamptz)
      `, [record.id, record.name, record.standardPrefix, record.supplierId, record.supplierShortCode, record.customerSeqNo, record.customerType, record.customerTypeCode, record.status, record.createdAt, record.updatedAt]);
    },
    async update(record) {
      await sqlExec(`
        UPDATE barcode_standards
        SET name=$2, standard_prefix=$3, supplier_id=$4, supplier_short_code=$5, customer_seq_no=$6, customer_type=$7, customer_type_code=$8, status=$9, updated_at=$10::timestamptz
        WHERE id=$1
      `, [record.id, record.name, record.standardPrefix, record.supplierId, record.supplierShortCode, record.customerSeqNo, record.customerType, record.customerTypeCode, record.status, record.updatedAt]);
    },
  },
  "procurement-types": {
    table: "procurement_types",
    prefix: "proc",
    orderBy: "created_at DESC, name ASC",
    mapRow(row) {
      return {
        id: row.id,
        name: row.name || "",
        description: row.description || "",
        status: row.status || "Aktif",
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
      };
    },
    normalize(values, existingRecord) {
      return {
        id: existingRecord?.id || createId("proc"),
        name: String(values.name || "").trim(),
        description: String(values.description || "").trim(),
        status: values.status || "Aktif",
        createdAt: existingRecord?.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    },
    async insert(record) {
      await sqlExec(`
        INSERT INTO procurement_types (id, name, description, status, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz)
      `, [record.id, record.name, record.description, record.status, record.createdAt, record.updatedAt]);
    },
    async update(record) {
      await sqlExec(`
        UPDATE procurement_types
        SET name=$2, description=$3, status=$4, updated_at=$5::timestamptz
        WHERE id=$1
      `, [record.id, record.name, record.description, record.status, record.updatedAt]);
    },
  },
  "payment-terms": {
    table: "payment_terms",
    prefix: "pay",
    orderBy: "created_at DESC, name ASC",
    mapRow(row) {
      return {
        id: row.id,
        name: row.name || "",
        days: Number(row.days || 0),
        description: row.description || "",
        status: row.status || "Aktif",
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
      };
    },
    normalize(values, existingRecord) {
      return {
        id: existingRecord?.id || createId("pay"),
        name: String(values.name || "").trim(),
        days: Number(values.days || 0),
        description: String(values.description || "").trim(),
        status: values.status || "Aktif",
        createdAt: existingRecord?.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    },
    async insert(record) {
      await sqlExec(`
        INSERT INTO payment_terms (id, name, days, description, status, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz)
      `, [record.id, record.name, record.days, record.description, record.status, record.createdAt, record.updatedAt]);
    },
    async update(record) {
      await sqlExec(`
        UPDATE payment_terms
        SET name=$2, days=$3, description=$4, status=$5, updated_at=$6::timestamptz
        WHERE id=$1
      `, [record.id, record.name, record.days, record.description, record.status, record.updatedAt]);
    },
  },
};

function mapSupplierRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    shortCode: row.short_code || "",
    company: row.company || "",
    logo: row.logo || "",
    contact: row.contact || "",
    email: row.email || "",
    phone: row.phone || "",
    city: row.city || "",
    iban: row.iban || "",
    taxNumber: row.tax_number || "",
    taxOffice: row.tax_office || "",
    address: row.address || "",
    procurementTypeId: row.procurement_type_id || null,
    paymentTermId: row.payment_term_id || null,
    status: row.status || "Aktif",
    note: row.note || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function normalizeSupplier(values, existingRecord) {
  return {
    id: existingRecord?.id || createId("sup"),
    shortCode: String(values.shortCode || "").trim(),
    company: String(values.company || "").trim(),
    logo: String(values.logo || "").trim(),
    contact: String(values.contact || "").trim(),
    email: String(values.email || "").trim(),
    phone: String(values.phone || "").trim(),
    city: String(values.city || "").trim(),
    iban: String(values.iban || "").trim(),
    taxNumber: String(values.taxNumber || "").trim(),
    taxOffice: String(values.taxOffice || "").trim(),
    address: String(values.address || "").trim(),
    procurementTypeId: values.procurementTypeId || null,
    paymentTermId: values.paymentTermId || null,
    status: values.status || "Aktif",
    note: String(values.note || "").trim(),
    createdAt: existingRecord?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

async function listMasterDataRows(entityKey) {
  const config = MASTER_DATA_CONFIG[entityKey];
  if (!config) {
    return null;
  }
  const rows = await sqlMany(`SELECT * FROM ${config.table} ORDER BY ${config.orderBy}`);
  return rows.map(config.mapRow);
}

async function getMasterDataRow(entityKey, recordId) {
  const config = MASTER_DATA_CONFIG[entityKey];
  if (!config) {
    return null;
  }
  return config.mapRow(await sqlOne(`SELECT * FROM ${config.table} WHERE id = $1`, [recordId]));
}

async function listSuppliersRows() {
  await ensureSupplierLogoColumn();
  const rows = await sqlMany("SELECT * FROM suppliers ORDER BY created_at DESC, company ASC");
  return rows.map(mapSupplierRow);
}

async function getSupplierRow(supplierId) {
  await ensureSupplierLogoColumn();
  return mapSupplierRow(await sqlOne("SELECT * FROM suppliers WHERE id = $1", [supplierId]));
}

async function listProductsRows() {
  const productRows = await sqlMany(`
    SELECT
      p.*,
      COALESCE(stock_totals.total_stock, 0) AS total_stock,
      COALESCE(sale_totals.sold_quantity, 0) AS sold_quantity,
      COALESCE(return_totals.return_quantity, 0) AS return_quantity
    FROM products p
    LEFT JOIN (
      SELECT product_id, SUM(quantity) AS total_stock
      FROM stock_location_balances
      GROUP BY product_id
    ) stock_totals ON stock_totals.product_id = p.id
    LEFT JOIN (
      SELECT product_id, SUM(quantity) AS sold_quantity
      FROM pos_sale_lines
      GROUP BY product_id
    ) sale_totals ON sale_totals.product_id = p.id
    LEFT JOIN (
      SELECT product_id, SUM(quantity) AS return_quantity
      FROM pos_return_lines
      GROUP BY product_id
    ) return_totals ON return_totals.product_id = p.id
    ORDER BY p.created_at DESC, p.code ASC
  `);
  const featureRows = await sqlMany("SELECT * FROM product_features ORDER BY product_id ASC, sort_order ASC, id ASC");
  const featuresByProductId = new Map();
  featureRows.forEach((row) => {
    const items = featuresByProductId.get(row.product_id) || [];
    items.push({
      id: row.id,
      name: row.name || "",
      value: row.value || "",
    });
    featuresByProductId.set(row.product_id, items);
  });

  return productRows.map((row) => ({
    id: row.id,
    code: row.code || "",
    name: row.name || "",
    salePrice: Number(row.sale_price || 0),
    saleCurrency: row.sale_currency || "TRY",
    cost: Number(row.cost || 0),
    costCurrency: row.cost_currency || "TRY",
    categoryId: row.category_id || null,
    collectionId: row.collection_id || null,
    posCategoryId: row.pos_category_id || null,
    supplierId: row.supplier_id || null,
    barcode: row.barcode || "",
    supplierCode: row.supplier_code || "",
    minStock: Number(row.min_stock || 0),
    supplierLeadTime: Number(row.supplier_lead_time || 0),
    stock: Number(row.stock || 0),
    totalStock: Number((row.total_stock ?? row.stock) || 0),
    productType: row.product_type || "kendi",
    salesTax: row.sales_tax || "%20",
    image: row.image || "/products/baroque-necklace.svg",
    isForSale: Boolean(row.is_for_sale),
    isForPurchase: Boolean(row.is_for_purchase),
    useInPos: Boolean(row.use_in_pos),
    trackInventory: Boolean(row.track_inventory),
    status: row.status || "Aktif",
    workflowStatus: row.workflow_status || "Taslak",
    createdBy: row.created_by || null,
    notes: row.notes || "",
    barcodeStandardId: row.barcode_standard_id || null,
    soldQuantity: Number(row.sold_quantity || 0),
    returnQuantity: Number(row.return_quantity || 0),
    features: featuresByProductId.get(row.id) || [],
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }));
}

async function getProductRow(productId) {
  const items = await listProductsRows();
  return items.find((item) => item.id === productId) || null;
}

function normalizeProduct(values, existingRecord) {
  const recordId = existingRecord?.id || createId("prd");
  return {
    id: recordId,
    code: String(values.code || "").trim(),
    name: String(values.name || "").trim(),
    salePrice: Number(values.salePrice || 0),
    saleCurrency: values.saleCurrency || "TRY",
    cost: Number(values.cost || 0),
    costCurrency: values.costCurrency || "TRY",
    categoryId: values.categoryId || null,
    collectionId: values.collectionId || null,
    posCategoryId: values.posCategoryId || null,
    supplierId: values.supplierId || null,
    barcode: String(values.barcode || "").trim(),
    supplierCode: String(values.supplierCode || "").trim(),
    minStock: Number(values.minStock || 0),
    supplierLeadTime: Number(values.supplierLeadTime || 0),
    stock: existingRecord?.stock ?? Number(values.stock || 0),
    productType: values.productType || "kendi",
    salesTax: values.salesTax || "%20",
    image: values.image || "/products/baroque-necklace.svg",
    isForSale: Boolean(values.isForSale),
    isForPurchase: Boolean(values.isForPurchase),
    useInPos: Boolean(values.useInPos),
    trackInventory: Boolean(values.trackInventory),
    status: values.status || "Aktif",
    workflowStatus: values.workflowStatus || existingRecord?.workflowStatus || "Taslak",
    createdBy: values.createdBy || existingRecord?.createdBy || null,
    notes: String(values.notes || "").trim(),
    barcodeStandardId: values.barcodeStandardId || existingRecord?.barcodeStandardId || null,
    features: Array.isArray(values.features)
      ? values.features
          .filter((item) => item && (item.name || item.value))
          .map((item, index) => ({
            id: item.id || `${recordId}-feat-${index + 1}`,
            name: String(item.name || "").trim(),
            value: String(item.value || "").trim(),
          }))
      : (existingRecord?.features || []),
    createdAt: existingRecord?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

async function replaceProductFeatures(productId, features) {
  await sqlExec("DELETE FROM product_features WHERE product_id = $1", [productId]);
  for (let index = 0; index < features.length; index += 1) {
    const item = features[index];
    await sqlExec(`
      INSERT INTO product_features (id, product_id, name, value, sort_order)
      VALUES ($1,$2,$3,$4,$5)
    `, [item.id, productId, item.name, item.value, index + 1]);
  }
}

function httpError(res, status, message) {
  return res.status(status).json({
    ok: false,
    message,
  });
}

export async function handleMasterDataList(req, res) {
  const items = await listMasterDataRows(req.params.entityKey);
  if (!items) {
    return httpError(res, 404, "Gecersiz master data tipi.");
  }
  return res.json({ ok: true, items });
}

export async function handleMasterDataCreate(req, res) {
  const config = MASTER_DATA_CONFIG[req.params.entityKey];
  if (!config) {
    return httpError(res, 404, "Gecersiz master data tipi.");
  }
  try {
    const item = config.normalize(req.body || {});
    await config.insert(item);
    return res.status(201).json({ ok: true, item });
  } catch (error) {
    return httpError(res, 400, error?.message || "Kayit olusturulamadi.");
  }
}

export async function handleMasterDataUpdate(req, res) {
  const config = MASTER_DATA_CONFIG[req.params.entityKey];
  if (!config) {
    return httpError(res, 404, "Gecersiz master data tipi.");
  }
  const existing = await getMasterDataRow(req.params.entityKey, req.params.id);
  if (!existing) {
    return httpError(res, 404, "Kayit bulunamadi.");
  }
  try {
    const item = config.normalize(req.body || {}, existing);
    await config.update(item);
    return res.json({ ok: true, item });
  } catch (error) {
    return httpError(res, 400, error?.message || "Kayit guncellenemedi.");
  }
}

export async function handleSuppliersList(_req, res) {
  return res.json({
    ok: true,
    items: await listSuppliersRows(),
  });
}

export async function handleSuppliersCreate(req, res) {
  try {
    await ensureSupplierLogoColumn();
    const item = normalizeSupplier(req.body || {});
    await sqlExec(`
      INSERT INTO suppliers (
        id, short_code, company, logo, contact, email, phone, city, iban, tax_number, tax_office, address,
        procurement_type_id, payment_term_id, status, note, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::timestamptz,$18::timestamptz)
    `, [
      item.id, item.shortCode, item.company, item.logo, item.contact, item.email, item.phone, item.city, item.iban,
      item.taxNumber, item.taxOffice, item.address, item.procurementTypeId, item.paymentTermId, item.status,
      item.note, item.createdAt, item.updatedAt,
    ]);
    return res.status(201).json({ ok: true, item: await getSupplierRow(item.id) });
  } catch (error) {
    return httpError(res, 400, error?.message || "Tedarikci olusturulamadi.");
  }
}

export async function handleSuppliersUpdate(req, res) {
  await ensureSupplierLogoColumn();
  const existing = await getSupplierRow(req.params.id);
  if (!existing) {
    return httpError(res, 404, "Tedarikci bulunamadi.");
  }
  try {
    const item = normalizeSupplier(req.body || {}, existing);
    await sqlExec(`
      UPDATE suppliers
      SET short_code=$2, company=$3, logo=$4, contact=$5, email=$6, phone=$7, city=$8, iban=$9, tax_number=$10,
          tax_office=$11, address=$12, procurement_type_id=$13, payment_term_id=$14, status=$15, note=$16,
          updated_at=$17::timestamptz
      WHERE id=$1
    `, [
      item.id, item.shortCode, item.company, item.logo, item.contact, item.email, item.phone, item.city, item.iban,
      item.taxNumber, item.taxOffice, item.address, item.procurementTypeId, item.paymentTermId, item.status,
      item.note, item.updatedAt,
    ]);
    return res.json({ ok: true, item: await getSupplierRow(item.id) });
  } catch (error) {
    return httpError(res, 400, error?.message || "Tedarikci guncellenemedi.");
  }
}

export async function handleSuppliersDelete(req, res) {
  await ensureSupplierLogoColumn();
  const existing = await getSupplierRow(req.params.id);
  if (!existing) {
    return httpError(res, 404, "Tedarikci bulunamadi.");
  }
  try {
    await sqlExec("DELETE FROM suppliers WHERE id = $1", [req.params.id]);
    return res.json({ ok: true });
  } catch {
    return httpError(res, 400, "Tedarikci bagli kayitlar nedeniyle silinemedi.");
  }
}

export async function handleProductsList(_req, res) {
  return res.json({
    ok: true,
    items: await listProductsRows(),
  });
}

export async function handleProductsCreate(req, res) {
  try {
    const item = normalizeProduct(req.body || {});
    await sqlExec(`
      INSERT INTO products (
        id, code, name, sale_price, sale_currency, cost, cost_currency, category_id, collection_id, pos_category_id,
        supplier_id, barcode, supplier_code, min_stock, supplier_lead_time, stock, product_type, sales_tax, image,
        is_for_sale, is_for_purchase, use_in_pos, track_inventory, status, workflow_status, created_by, notes,
        barcode_standard_id, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29::timestamptz,$30::timestamptz)
    `, [
      item.id, item.code, item.name, item.salePrice, item.saleCurrency, item.cost, item.costCurrency,
      item.categoryId, item.collectionId, item.posCategoryId, item.supplierId, item.barcode, item.supplierCode,
      item.minStock, item.supplierLeadTime, item.stock, item.productType, item.salesTax, item.image,
      item.isForSale, item.isForPurchase, item.useInPos, item.trackInventory, item.status, item.workflowStatus,
      item.createdBy, item.notes, item.barcodeStandardId, item.createdAt, item.updatedAt,
    ]);
    await replaceProductFeatures(item.id, item.features);
    await syncMainBalanceWithProductStock(item.id);
    return res.status(201).json({ ok: true, item: await getProductRow(item.id) });
  } catch (error) {
    return httpError(res, 400, error?.message || "Urun olusturulamadi.");
  }
}

export async function handleProductsUpdate(req, res) {
  const existing = await getProductRow(req.params.id);
  if (!existing) {
    return httpError(res, 404, "Urun bulunamadi.");
  }
  try {
    const item = normalizeProduct(req.body || {}, existing);
    await sqlExec(`
      UPDATE products
      SET code=$2, name=$3, sale_price=$4, sale_currency=$5, cost=$6, cost_currency=$7, category_id=$8, collection_id=$9,
          pos_category_id=$10, supplier_id=$11, barcode=$12, supplier_code=$13, min_stock=$14, supplier_lead_time=$15,
          stock=$16, product_type=$17, sales_tax=$18, image=$19, is_for_sale=$20, is_for_purchase=$21, use_in_pos=$22,
          track_inventory=$23, status=$24, workflow_status=$25, created_by=$26, notes=$27, barcode_standard_id=$28,
          updated_at=$29::timestamptz
      WHERE id=$1
    `, [
      item.id, item.code, item.name, item.salePrice, item.saleCurrency, item.cost, item.costCurrency,
      item.categoryId, item.collectionId, item.posCategoryId, item.supplierId, item.barcode, item.supplierCode,
      item.minStock, item.supplierLeadTime, item.stock, item.productType, item.salesTax, item.image,
      item.isForSale, item.isForPurchase, item.useInPos, item.trackInventory, item.status, item.workflowStatus,
      item.createdBy, item.notes, item.barcodeStandardId, item.updatedAt,
    ]);
    await replaceProductFeatures(item.id, item.features);
    await syncMainBalanceWithProductStock(item.id);
    return res.json({ ok: true, item: await getProductRow(item.id) });
  } catch (error) {
    return httpError(res, 400, error?.message || "Urun guncellenemedi.");
  }
}

export async function handleProductStockLocationBalances(req, res) {
  const existing = await getProductRow(req.params.id);
  if (!existing) {
    return httpError(res, 404, "Urun bulunamadi.");
  }

  return res.json({
    ok: true,
    items: await listProductStockLocationBalances(req.params.id),
  });
}

export async function handleProductsDelete(req, res) {
  const existing = await getProductRow(req.params.id);
  if (!existing) {
    return httpError(res, 404, "Urun bulunamadi.");
  }
  try {
    await sqlExec("DELETE FROM products WHERE id = $1", [req.params.id]);
    return res.json({ ok: true });
  } catch {
    return httpError(res, 400, "Urun bagli kayitlar nedeniyle silinemedi.");
  }
}
