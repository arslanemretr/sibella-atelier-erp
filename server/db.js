/* global process */
import { Pool } from "pg";

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL zorunludur. Uygulama artik sadece PostgreSQL ile calisir.");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

let initPromise = null;

function nowIso() {
  return new Date().toISOString();
}

function intToBool(value) {
  if (typeof value === "boolean") {
    return value;
  }
  return Number(value || 0) === 1;
}

async function sqlMany(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function sqlOne(text, params = []) {
  const rows = await sqlMany(text, params);
  return rows[0] || null;
}

async function sqlExec(text, params = []) {
  await pool.query(text, params);
}

async function tableExists(tableName) {
  const row = await sqlOne("SELECT to_regclass($1) AS reg", [`public.${tableName}`]);
  return Boolean(row?.reg);
}

async function ensureCoreSchema() {
  await sqlExec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await sqlExec(`
    CREATE TABLE IF NOT EXISTS store_meta (
      key TEXT PRIMARY KEY,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await sqlExec(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL,
      user_agent TEXT,
      ip_address TEXT
    );
  `);

  await sqlExec(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      ip_address TEXT,
      attempted_at TIMESTAMPTZ NOT NULL,
      success BOOLEAN NOT NULL,
      failure_reason TEXT,
      user_id TEXT
    );
  `);

  await sqlExec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      requested_ip TEXT
    );
  `);
}

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = ensureCoreSchema().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  await initPromise;
}

async function setStoreMeta(key, updatedAt) {
  await sqlExec(`
    INSERT INTO store_meta (key, updated_at)
    VALUES ($1, $2::timestamptz)
    ON CONFLICT (key) DO UPDATE SET updated_at = EXCLUDED.updated_at
  `, [key, updatedAt]);
}

async function setKvStore(key, value, updatedAt) {
  await sqlExec(`
    INSERT INTO kv_store (key, value, updated_at)
    VALUES ($1, $2::jsonb, $3::timestamptz)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
  `, [key, JSON.stringify(value), updatedAt]);
}

async function buildMasterDataFromTables() {
  const hasCategories = await tableExists("categories");
  if (!hasCategories) {
    return null;
  }

  return {
    categories: (await sqlMany("SELECT * FROM categories ORDER BY created_at DESC")).map((row) => ({
      id: row.id, level1: row.level1, level2: row.level2, level3: row.level3, level4: row.level4, fullPath: row.full_path, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    })),
    collections: (await sqlMany("SELECT * FROM collections ORDER BY created_at DESC")).map((row) => ({
      id: row.id, name: row.name, description: row.description, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    })),
    "pos-categories": (await sqlMany("SELECT * FROM pos_categories ORDER BY created_at DESC")).map((row) => ({
      id: row.id, name: row.name, description: row.description, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    })),
    "barcode-standards": (await sqlMany("SELECT * FROM barcode_standards ORDER BY created_at DESC")).map((row) => ({
      id: row.id, name: row.name, prefix: row.prefix, separator: row.separator, digits: row.digits, nextNumber: row.next_number, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    })),
    "procurement-types": (await sqlMany("SELECT * FROM procurement_types ORDER BY created_at DESC")).map((row) => ({
      id: row.id, name: row.name, description: row.description, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    })),
    "payment-terms": (await sqlMany("SELECT * FROM payment_terms ORDER BY created_at DESC")).map((row) => ({
      id: row.id, name: row.name, days: row.days, description: row.description, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    })),
  };
}

async function buildUsersFromTable() {
  const hasUsers = await tableExists("users");
  if (!hasUsers) {
    return null;
  }

  return (await sqlMany("SELECT * FROM users ORDER BY created_at DESC")).map((row) => ({
    id: row.id, fullName: row.full_name, email: row.email, password: row.password, role: row.role, supplierId: row.supplier_id, status: row.status, lastLoginAt: row.last_login_at, createdAt: row.created_at, updatedAt: row.updated_at,
  }));
}

async function buildSuppliersFromTable() {
  const hasSuppliers = await tableExists("suppliers");
  if (!hasSuppliers) {
    return null;
  }
  return (await sqlMany("SELECT * FROM suppliers ORDER BY created_at DESC")).map((row) => ({
    id: row.id, shortCode: row.short_code, company: row.company, contact: row.contact, email: row.email, phone: row.phone, city: row.city, iban: row.iban, taxNumber: row.tax_number, taxOffice: row.tax_office, address: row.address, procurementTypeId: row.procurement_type_id, paymentTermId: row.payment_term_id, status: row.status, note: row.note, createdAt: row.created_at, updatedAt: row.updated_at,
  }));
}

async function buildProductsFromTable() {
  const hasProducts = await tableExists("products");
  if (!hasProducts) {
    return null;
  }

  const features = await sqlMany("SELECT * FROM product_features ORDER BY sort_order ASC");
  const featureMap = features.reduce((acc, row) => {
    acc[row.product_id] ||= [];
    acc[row.product_id].push({ id: row.id, name: row.name, value: row.value });
    return acc;
  }, {});

  return (await sqlMany("SELECT * FROM products ORDER BY created_at DESC")).map((row) => ({
    id: row.id, code: row.code, name: row.name, salePrice: row.sale_price, saleCurrency: row.sale_currency, cost: row.cost, costCurrency: row.cost_currency,
    categoryId: row.category_id, collectionId: row.collection_id, posCategoryId: row.pos_category_id, supplierId: row.supplier_id, barcode: row.barcode,
    supplierCode: row.supplier_code, minStock: row.min_stock, supplierLeadTime: row.supplier_lead_time, stock: row.stock, productType: row.product_type,
    salesTax: row.sales_tax, image: row.image, isForSale: intToBool(row.is_for_sale), isForPurchase: intToBool(row.is_for_purchase),
    useInPos: intToBool(row.use_in_pos), trackInventory: intToBool(row.track_inventory), status: row.status, workflowStatus: row.workflow_status,
    createdBy: row.created_by, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at, features: featureMap[row.id] || [],
  }));
}

async function readParentChildSet(parentSql, childSql, mapParent, mapChild, parentIdField, childForeignField, childArrayKey) {
  const children = await sqlMany(childSql);
  const childMap = children.reduce((acc, row) => {
    acc[row[childForeignField]] ||= [];
    acc[row[childForeignField]].push(mapChild(row));
    return acc;
  }, {});

  return (await sqlMany(parentSql)).map((row) => ({
    ...mapParent(row),
    [childArrayKey]: childMap[row[parentIdField]] || [],
  }));
}

async function buildPurchasesFromTables() {
  if (!(await tableExists("purchases"))) {
    return null;
  }
  return readParentChildSet(
    "SELECT * FROM purchases ORDER BY created_at DESC",
    "SELECT * FROM purchase_lines ORDER BY sort_order ASC",
    (row) => ({
      id: row.id, documentNo: row.document_no, supplierId: row.supplier_id, date: row.date, procurementTypeId: row.procurement_type_id,
      paymentTermId: row.payment_term_id, description: row.description, createdAt: row.created_at, updatedAt: row.updated_at,
    }),
    (row) => ({
      id: row.id, productId: row.product_id, quantity: row.quantity, unitPrice: row.unit_price, note: row.note,
    }),
    "id",
    "purchase_id",
    "lines",
  );
}

async function buildContractsFromTable() {
  if (!(await tableExists("consignment_contracts"))) {
    return null;
  }
  return (await sqlMany("SELECT * FROM consignment_contracts ORDER BY created_at DESC")).map((row) => ({
    id: row.id, supplierId: row.supplier_id, startDate: row.start_date, endDate: row.end_date, commissionRate: row.commission_rate,
    pdfName: row.pdf_name, pdfDataUrl: row.pdf_data_url, createdAt: row.created_at, updatedAt: row.updated_at,
  }));
}

async function buildStockEntriesFromTables() {
  if (!(await tableExists("stock_entries"))) {
    return null;
  }
  return readParentChildSet(
    "SELECT * FROM stock_entries ORDER BY created_at DESC",
    "SELECT * FROM stock_lines ORDER BY sort_order ASC",
    (row) => ({
      id: row.id, documentNo: row.document_no, sourcePartyId: row.source_party_id, date: row.date, stockType: row.stock_type,
      sourceType: row.source_type, status: row.status, note: row.note, createdAt: row.created_at, updatedAt: row.updated_at,
    }),
    (row) => ({
      id: row.id, productId: row.product_id, quantity: row.quantity, unitCost: row.unit_cost, note: row.note,
    }),
    "id",
    "stock_entry_id",
    "lines",
  );
}

async function buildPosSessionsFromTable() {
  if (!(await tableExists("pos_sessions"))) {
    return null;
  }
  return (await sqlMany("SELECT * FROM pos_sessions ORDER BY created_at DESC")).map((row) => ({
    id: row.id, sessionNo: row.session_no, registerName: row.register_name, cashierName: row.cashier_name, openingBalance: row.opening_balance,
    openedAt: row.opened_at, closedAt: row.closed_at, status: row.status, note: row.note, createdAt: row.created_at, updatedAt: row.updated_at,
  }));
}

async function buildPosSalesFromTables() {
  if (!(await tableExists("pos_sales"))) {
    return null;
  }
  return readParentChildSet(
    "SELECT * FROM pos_sales ORDER BY created_at DESC",
    "SELECT * FROM pos_sale_lines ORDER BY sort_order ASC",
    (row) => ({
      id: row.id, sessionId: row.session_id, receiptNo: row.receipt_no, soldAt: row.sold_at, customerName: row.customer_name, paymentMethod: row.payment_method,
      note: row.note, discountType: row.discount_type, discountValue: row.discount_value, discountAmount: row.discount_amount, subtotal: row.subtotal, taxTotal: row.tax_total,
      grandTotal: row.grand_total, createdAt: row.created_at, updatedAt: row.updated_at,
    }),
    (row) => ({
      id: row.id, productId: row.product_id, quantity: row.quantity, unitPrice: row.unit_price, lineTotal: row.line_total,
    }),
    "id",
    "sale_id",
    "lines",
  );
}

async function buildDeliveryListsFromTables() {
  if (!(await tableExists("delivery_lists"))) {
    return null;
  }
  return readParentChildSet(
    "SELECT * FROM delivery_lists ORDER BY created_at DESC",
    "SELECT * FROM delivery_lines ORDER BY sort_order ASC",
    (row) => ({
      id: row.id, deliveryNo: row.delivery_no, supplierId: row.supplier_id, supplierName: row.supplier_name, contactName: row.contact_name, supplierEmail: row.supplier_email,
      date: row.date, shippingMethod: row.shipping_method, trackingNo: row.tracking_no, note: row.note, status: row.status, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at,
    }),
    (row) => ({
      id: row.id, productId: row.product_id, isNewProduct: intToBool(row.is_new_product), image: row.image, name: row.name, code: row.code,
      salePrice: row.sale_price, saleCurrency: row.sale_currency, quantity: row.quantity, description: row.description,
    }),
    "id",
    "delivery_list_id",
    "lines",
  );
}

async function buildSystemParametersFromTable() {
  if (!(await tableExists("system_parameters"))) {
    return null;
  }
  const row = await sqlOne("SELECT * FROM system_parameters WHERE id = 1");
  if (!row) {
    return null;
  }
  return { productCodeControlEnabled: intToBool(row.product_code_control_enabled) };
}

async function buildSmtpSettingsFromTable() {
  if (!(await tableExists("smtp_settings"))) {
    return null;
  }
  const row = await sqlOne("SELECT * FROM smtp_settings WHERE id = 1");
  if (!row) {
    return null;
  }
  return {
    enabled: intToBool(row.enabled),
    host: row.host || "",
    port: Number(row.port || 587),
    secure: intToBool(row.secure),
    username: row.username || "",
    password: row.password || "",
    fromName: row.from_name || "",
    fromEmail: row.from_email || "",
  };
}

const backfillBuilders = {
  "sibella.erp.masterData.v1": buildMasterDataFromTables,
  "sibella.erp.users.v1": buildUsersFromTable,
  "sibella.erp.suppliers.v1": buildSuppliersFromTable,
  "sibella.erp.products.v1": buildProductsFromTable,
  "sibella.erp.purchases.v2": buildPurchasesFromTables,
  "sibella.erp.contracts.v1": buildContractsFromTable,
  "sibella.erp.stockEntries.v2": buildStockEntriesFromTables,
  "sibella.erp.posSessions.v2": buildPosSessionsFromTable,
  "sibella.erp.posSales.v2": buildPosSalesFromTables,
  "sibella.erp.deliveryLists.v1": buildDeliveryListsFromTables,
  "sibella.erp.systemParameters.v1": buildSystemParametersFromTable,
  "sibella.erp.smtpSettings.v1": buildSmtpSettingsFromTable,
};

async function ensureKeyInitialized(key) {
  await ensureInitialized();
  const existingMeta = await sqlOne("SELECT key, updated_at FROM store_meta WHERE key = $1", [key]);
  const existingValue = await sqlOne("SELECT key FROM kv_store WHERE key = $1", [key]);
  if (existingMeta && existingValue) {
    return;
  }

  const builder = backfillBuilders[key];
  if (!builder) {
    return;
  }

  const builtValue = await builder();
  if (typeof builtValue === "undefined" || builtValue === null) {
    return;
  }

  const updatedAt = nowIso();
  await setKvStore(key, builtValue, updatedAt);
  await setStoreMeta(key, updatedAt);
}

export async function getStoreValue(key) {
  await ensureKeyInitialized(key);
  const row = await sqlOne("SELECT key, value, updated_at FROM kv_store WHERE key = $1", [key]);
  if (!row) {
    return null;
  }
  return {
    value: row.value,
    updatedAt: row.updated_at || nowIso(),
  };
}

export async function setStoreValue(key, value) {
  await ensureInitialized();
  const updatedAt = nowIso();
  await setKvStore(key, value, updatedAt);
  await setStoreMeta(key, updatedAt);

  return {
    key,
    value,
    updatedAt,
  };
}

export async function listStoreKeys() {
  await ensureInitialized();
  return sqlMany("SELECT key, updated_at FROM store_meta ORDER BY key");
}

export function getDatabaseRuntimeInfo() {
  return {
    engine: "postgresql",
    postgresMirrorEnabled: true,
    sqlitePath: null,
  };
}

export { sqlExec, sqlMany, sqlOne };
