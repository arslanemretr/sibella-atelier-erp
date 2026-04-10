/* global process */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { Pool } from "pg";
import { hashPassword, isPasswordHash } from "./passwords.js";

const dataDir = path.resolve(process.cwd(), "data");
const dbPath = path.join(dataDir, "erp.sqlite");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const postgresUrl = String(process.env.DATABASE_URL || "").trim();
const postgresMirrorEnabled = Boolean(postgresUrl);
const pgPool = postgresMirrorEnabled
  ? new Pool({
    connectionString: postgresUrl,
  })
  : null;
let pgStoreReadyPromise = null;

db.exec(`
  CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS store_meta (
    key TEXT PRIMARY KEY,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    level1 TEXT,
    level2 TEXT,
    level3 TEXT,
    level4 TEXT,
    full_path TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS pos_categories (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS barcode_standards (
    id TEXT PRIMARY KEY,
    name TEXT,
    prefix TEXT,
    separator TEXT,
    digits INTEGER,
    next_number INTEGER,
    status TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS procurement_types (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS payment_terms (
    id TEXT PRIMARY KEY,
    name TEXT,
    days INTEGER,
    description TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    short_code TEXT,
    company TEXT,
    contact TEXT,
    email TEXT,
    phone TEXT,
    city TEXT,
    iban TEXT,
    tax_number TEXT,
    tax_office TEXT,
    address TEXT,
    procurement_type_id TEXT,
    payment_term_id TEXT,
    status TEXT,
    note TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT,
    supplier_id TEXT,
    status TEXT,
    last_login_at TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT,
    sale_price REAL,
    sale_currency TEXT,
    cost REAL,
    cost_currency TEXT,
    category_id TEXT,
    collection_id TEXT,
    pos_category_id TEXT,
    supplier_id TEXT,
    barcode TEXT,
    supplier_code TEXT,
    min_stock REAL,
    supplier_lead_time REAL,
    stock REAL,
    product_type TEXT,
    sales_tax TEXT,
    image TEXT,
    is_for_sale INTEGER,
    is_for_purchase INTEGER,
    use_in_pos INTEGER,
    track_inventory INTEGER,
    status TEXT,
    workflow_status TEXT,
    created_by TEXT,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS product_features (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    name TEXT,
    value TEXT,
    sort_order INTEGER,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    document_no TEXT,
    supplier_id TEXT,
    date TEXT,
    procurement_type_id TEXT,
    payment_term_id TEXT,
    description TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  CREATE TABLE IF NOT EXISTS purchase_lines (
    id TEXT PRIMARY KEY,
    purchase_id TEXT NOT NULL,
    product_id TEXT,
    quantity REAL,
    unit_price REAL,
    note TEXT,
    sort_order INTEGER,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS consignment_contracts (
    id TEXT PRIMARY KEY,
    supplier_id TEXT,
    start_date TEXT,
    end_date TEXT,
    commission_rate REAL,
    pdf_name TEXT,
    pdf_data_url TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  CREATE TABLE IF NOT EXISTS stock_entries (
    id TEXT PRIMARY KEY,
    document_no TEXT,
    source_party_id TEXT,
    date TEXT,
    stock_type TEXT,
    source_type TEXT,
    status TEXT,
    note TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (source_party_id) REFERENCES suppliers(id)
  );

  CREATE TABLE IF NOT EXISTS stock_lines (
    id TEXT PRIMARY KEY,
    stock_entry_id TEXT NOT NULL,
    product_id TEXT,
    quantity REAL,
    unit_cost REAL,
    note TEXT,
    sort_order INTEGER,
    FOREIGN KEY (stock_entry_id) REFERENCES stock_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS pos_sessions (
    id TEXT PRIMARY KEY,
    session_no TEXT,
    register_name TEXT,
    cashier_name TEXT,
    opening_balance REAL,
    opened_at TEXT,
    closed_at TEXT,
    status TEXT,
    note TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS pos_sales (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    receipt_no TEXT,
    sold_at TEXT,
    customer_name TEXT,
    payment_method TEXT,
    note TEXT,
    discount_type TEXT,
    discount_value REAL,
    discount_amount REAL,
    subtotal REAL,
    tax_total REAL,
    grand_total REAL,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (session_id) REFERENCES pos_sessions(id)
  );

  CREATE TABLE IF NOT EXISTS pos_sale_lines (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL,
    product_id TEXT,
    quantity REAL,
    unit_price REAL,
    line_total REAL,
    sort_order INTEGER,
    FOREIGN KEY (sale_id) REFERENCES pos_sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS delivery_lists (
    id TEXT PRIMARY KEY,
    delivery_no TEXT,
    supplier_id TEXT,
    supplier_name TEXT,
    contact_name TEXT,
    supplier_email TEXT,
    date TEXT,
    shipping_method TEXT,
    tracking_no TEXT,
    note TEXT,
    status TEXT,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS delivery_lines (
    id TEXT PRIMARY KEY,
    delivery_list_id TEXT NOT NULL,
    product_id TEXT,
    is_new_product INTEGER,
    image TEXT,
    name TEXT,
    code TEXT,
    sale_price REAL,
    sale_currency TEXT,
    quantity REAL,
    description TEXT,
    sort_order INTEGER,
    FOREIGN KEY (delivery_list_id) REFERENCES delivery_lists(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS system_parameters (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    product_code_control_enabled INTEGER,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS smtp_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER NOT NULL DEFAULT 0,
    host TEXT,
    port INTEGER,
    secure INTEGER NOT NULL DEFAULT 0,
    username TEXT,
    password TEXT,
    from_name TEXT,
    from_email TEXT,
    updated_at TEXT
  );
`);

function nowIso() {
  return new Date().toISOString();
}

function ensurePostgresStoreTables() {
  if (!pgPool) {
    return Promise.resolve();
  }

  if (!pgStoreReadyPromise) {
    pgStoreReadyPromise = (async () => {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS kv_store (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        );
      `);
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS store_meta (
          key TEXT PRIMARY KEY,
          updated_at TIMESTAMPTZ NOT NULL
        );
      `);
    })().catch((error) => {
      pgStoreReadyPromise = null;
      throw error;
    });
  }

  return pgStoreReadyPromise;
}

async function mirrorStoreValueToPostgres(key, value, updatedAt) {
  if (!pgPool) {
    return;
  }

  try {
    await ensurePostgresStoreTables();
    await pgPool.query(`
      INSERT INTO kv_store (key, value, updated_at)
      VALUES ($1, $2::jsonb, $3::timestamptz)
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    `, [key, JSON.stringify(value), updatedAt]);
    await pgPool.query(`
      INSERT INTO store_meta (key, updated_at)
      VALUES ($1, $2::timestamptz)
      ON CONFLICT (key)
      DO UPDATE SET updated_at = EXCLUDED.updated_at
    `, [key, updatedAt]);
  } catch (error) {
    console.error(`[pg-mirror] ${key} mirror hatasi:`, error?.message || error);
  }
}

function boolToInt(value) {
  return value ? 1 : 0;
}

function intToBool(value) {
  return Boolean(value);
}

function updateMeta(key) {
  db.prepare(`
    INSERT INTO store_meta (key, updated_at)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET updated_at = excluded.updated_at
  `).run(key, nowIso());
}

function ensureSupplier(id) {
  if (!id) return;
  db.prepare(`
    INSERT OR IGNORE INTO suppliers (id, short_code, company, contact, email, phone, city, iban, tax_number, tax_office, address, procurement_type_id, payment_term_id, status, note, created_at, updated_at)
    VALUES (?, '', ?, '', '', '', '', '', '', '', '', NULL, NULL, 'Aktif', '', ?, ?)
  `).run(id, id, nowIso(), nowIso());
}

function ensureUser(id) {
  if (!id) return;
  db.prepare(`
    INSERT OR IGNORE INTO users (id, full_name, email, password, role, supplier_id, status, last_login_at, created_at, updated_at)
    VALUES (?, ?, ?, '', 'Yonetici', NULL, 'Aktif', NULL, ?, ?)
  `).run(id, id, `${id}@placeholder.local`, nowIso(), nowIso());
}

function ensureCategory(id) {
  if (!id) return;
  db.prepare(`
    INSERT OR IGNORE INTO categories (id, level1, level2, level3, level4, full_path, status, created_at, updated_at)
    VALUES (?, ?, '', '', '', ?, 'Aktif', ?, ?)
  `).run(id, id, id, nowIso(), nowIso());
}

function ensureCollection(id) {
  if (!id) return;
  db.prepare(`
    INSERT OR IGNORE INTO collections (id, name, description, status, created_at, updated_at)
    VALUES (?, ?, '', 'Aktif', ?, ?)
  `).run(id, id, nowIso(), nowIso());
}

function ensurePosCategory(id) {
  if (!id) return;
  db.prepare(`
    INSERT OR IGNORE INTO pos_categories (id, name, description, status, created_at, updated_at)
    VALUES (?, ?, '', 'Aktif', ?, ?)
  `).run(id, id, nowIso(), nowIso());
}

function legacyValueFor(key) {
  const row = db.prepare("SELECT value, updated_at FROM kv_store WHERE key = ?").get(key);
  if (!row) {
    return null;
  }
  return {
    value: JSON.parse(row.value),
    updatedAt: row.updated_at,
  };
}

function listRows(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function getRow(sql, params = []) {
  return db.prepare(sql).get(...params);
}

const writeMasterData = db.transaction((value) => {
  db.prepare("DELETE FROM categories").run();
  (value.categories || []).forEach((item) => {
    db.prepare(`
      INSERT INTO categories (id, level1, level2, level3, level4, full_path, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.level1 || "", item.level2 || "", item.level3 || "", item.level4 || "", item.fullPath || "", item.status || "", item.createdAt || "", item.updatedAt || "");
  });

  db.prepare("DELETE FROM collections").run();
  (value.collections || []).forEach((item) => {
    db.prepare(`
      INSERT INTO collections (id, name, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(item.id, item.name || "", item.description || "", item.status || "", item.createdAt || "", item.updatedAt || "");
  });

  db.prepare("DELETE FROM pos_categories").run();
  (value["pos-categories"] || []).forEach((item) => {
    db.prepare(`
      INSERT INTO pos_categories (id, name, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(item.id, item.name || "", item.description || "", item.status || "", item.createdAt || "", item.updatedAt || "");
  });

  db.prepare("DELETE FROM barcode_standards").run();
  (value["barcode-standards"] || []).forEach((item) => {
    db.prepare(`
      INSERT INTO barcode_standards (id, name, prefix, separator, digits, next_number, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.name || "", item.prefix || "", item.separator || "", Number(item.digits || 0), Number(item.nextNumber || 0), item.status || "", item.createdAt || "", item.updatedAt || "");
  });

  db.prepare("DELETE FROM procurement_types").run();
  (value["procurement-types"] || []).forEach((item) => {
    db.prepare(`
      INSERT INTO procurement_types (id, name, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(item.id, item.name || "", item.description || "", item.status || "", item.createdAt || "", item.updatedAt || "");
  });

  db.prepare("DELETE FROM payment_terms").run();
  (value["payment-terms"] || []).forEach((item) => {
    db.prepare(`
      INSERT INTO payment_terms (id, name, days, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.name || "", Number(item.days || 0), item.description || "", item.status || "", item.createdAt || "", item.updatedAt || "");
  });
});

function readMasterData() {
  return {
    categories: listRows("SELECT * FROM categories ORDER BY created_at DESC").map((row) => ({
      id: row.id, level1: row.level1, level2: row.level2, level3: row.level3, level4: row.level4, fullPath: row.full_path, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    })),
    collections: listRows("SELECT * FROM collections ORDER BY created_at DESC").map((row) => ({
      id: row.id, name: row.name, description: row.description, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    })),
    "pos-categories": listRows("SELECT * FROM pos_categories ORDER BY created_at DESC").map((row) => ({
      id: row.id, name: row.name, description: row.description, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    })),
    "barcode-standards": listRows("SELECT * FROM barcode_standards ORDER BY created_at DESC").map((row) => ({
      id: row.id, name: row.name, prefix: row.prefix, separator: row.separator, digits: row.digits, nextNumber: row.next_number, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    })),
    "procurement-types": listRows("SELECT * FROM procurement_types ORDER BY created_at DESC").map((row) => ({
      id: row.id, name: row.name, description: row.description, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    })),
    "payment-terms": listRows("SELECT * FROM payment_terms ORDER BY created_at DESC").map((row) => ({
      id: row.id, name: row.name, days: row.days, description: row.description, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    })),
  };
}

const writeUsers = db.transaction((value) => {
  db.prepare("DELETE FROM users").run();
  value.forEach((item) => {
    ensureSupplier(item.supplierId || null);
    const normalizedPassword = item.password
      ? (isPasswordHash(item.password) ? item.password : hashPassword(item.password))
      : "";
    db.prepare(`
      INSERT INTO users (id, full_name, email, password, role, supplier_id, status, last_login_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.fullName || "", item.email || "", normalizedPassword, item.role || "", item.supplierId || null, item.status || "", item.lastLoginAt || null, item.createdAt || "", item.updatedAt || "");
  });
});

function readUsers() {
  return listRows("SELECT * FROM users ORDER BY created_at DESC").map((row) => ({
    id: row.id, fullName: row.full_name, email: row.email, password: row.password, role: row.role, supplierId: row.supplier_id, status: row.status, lastLoginAt: row.last_login_at, createdAt: row.created_at, updatedAt: row.updated_at,
  }));
}

function mergeUsersByEmail(currentUsers, incomingUsers) {
  const mergedByEmail = new Map();

  [...currentUsers, ...incomingUsers].forEach((user) => {
    const emailKey = String(user?.email || "").trim().toLowerCase();
    const mapKey = emailKey || String(user?.id || "");

    if (!mapKey) {
      return;
    }

    const existing = mergedByEmail.get(mapKey);
    mergedByEmail.set(mapKey, {
      ...(existing || {}),
      ...user,
      id: existing?.id || user?.id,
      fullName: user?.fullName || existing?.fullName || "",
      email: user?.email || existing?.email || "",
      password: user?.password || existing?.password || "",
      role: user?.role || existing?.role || "",
      supplierId: user?.supplierId ?? existing?.supplierId ?? null,
      status: user?.status || existing?.status || "Aktif",
      lastLoginAt: user?.lastLoginAt || existing?.lastLoginAt || null,
      createdAt: existing?.createdAt || user?.createdAt || nowIso(),
      updatedAt: nowIso(),
    });
  });

  return Array.from(mergedByEmail.values()).sort((left, right) => {
    return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
  });
}

const writeSuppliers = db.transaction((value) => {
  db.prepare("DELETE FROM suppliers").run();
  value.forEach((item) => {
    db.prepare(`
      INSERT INTO suppliers (id, short_code, company, contact, email, phone, city, iban, tax_number, tax_office, address, procurement_type_id, payment_term_id, status, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.shortCode || "", item.company || "", item.contact || "", item.email || "", item.phone || "", item.city || "", item.iban || "", item.taxNumber || "", item.taxOffice || "", item.address || "", item.procurementTypeId || null, item.paymentTermId || null, item.status || "", item.note || "", item.createdAt || "", item.updatedAt || "");
  });
});

function readSuppliers() {
  return listRows("SELECT * FROM suppliers ORDER BY created_at DESC").map((row) => ({
    id: row.id, shortCode: row.short_code, company: row.company, contact: row.contact, email: row.email, phone: row.phone, city: row.city, iban: row.iban, taxNumber: row.tax_number, taxOffice: row.tax_office, address: row.address, procurementTypeId: row.procurement_type_id, paymentTermId: row.payment_term_id, status: row.status, note: row.note, createdAt: row.created_at, updatedAt: row.updated_at,
  }));
}

const writeProducts = db.transaction((value) => {
  db.prepare("DELETE FROM product_features").run();
  db.prepare("DELETE FROM products").run();
  value.forEach((item) => {
    ensureCategory(item.categoryId || null);
    ensureCollection(item.collectionId || null);
    ensurePosCategory(item.posCategoryId || null);
    ensureSupplier(item.supplierId || null);
    ensureUser(item.createdBy || null);
    db.prepare(`
      INSERT INTO products (id, code, name, sale_price, sale_currency, cost, cost_currency, category_id, collection_id, pos_category_id, supplier_id, barcode, supplier_code, min_stock, supplier_lead_time, stock, product_type, sales_tax, image, is_for_sale, is_for_purchase, use_in_pos, track_inventory, status, workflow_status, created_by, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id, item.code || "", item.name || "", Number(item.salePrice || 0), item.saleCurrency || "TRY", Number(item.cost || 0), item.costCurrency || "TRY",
      item.categoryId || null, item.collectionId || null, item.posCategoryId || null, item.supplierId || null, item.barcode || "", item.supplierCode || "",
      Number(item.minStock || 0), Number(item.supplierLeadTime || 0), Number(item.stock || 0), item.productType || "", item.salesTax || "", item.image || "",
      boolToInt(item.isForSale), boolToInt(item.isForPurchase), boolToInt(item.useInPos), boolToInt(item.trackInventory), item.status || "", item.workflowStatus || "Taslak", item.createdBy || null, item.notes || "", item.createdAt || "", item.updatedAt || "",
    );

    (item.features || []).forEach((feature, index) => {
      db.prepare(`
        INSERT INTO product_features (id, product_id, name, value, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `).run(feature.id || `${item.id}-feat-${index + 1}`, item.id, feature.name || "", feature.value || "", index + 1);
    });
  });
});

function readProducts() {
  const features = listRows("SELECT * FROM product_features ORDER BY sort_order ASC");
  const featureMap = features.reduce((acc, row) => {
    acc[row.product_id] ||= [];
    acc[row.product_id].push({ id: row.id, name: row.name, value: row.value });
    return acc;
  }, {});

  return listRows("SELECT * FROM products ORDER BY created_at DESC").map((row) => ({
    id: row.id, code: row.code, name: row.name, salePrice: row.sale_price, saleCurrency: row.sale_currency, cost: row.cost, costCurrency: row.cost_currency,
    categoryId: row.category_id, collectionId: row.collection_id, posCategoryId: row.pos_category_id, supplierId: row.supplier_id, barcode: row.barcode,
    supplierCode: row.supplier_code, minStock: row.min_stock, supplierLeadTime: row.supplier_lead_time, stock: row.stock, productType: row.product_type,
    salesTax: row.sales_tax, image: row.image, isForSale: intToBool(row.is_for_sale), isForPurchase: intToBool(row.is_for_purchase),
    useInPos: intToBool(row.use_in_pos), trackInventory: intToBool(row.track_inventory), status: row.status, workflowStatus: row.workflow_status,
    createdBy: row.created_by, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at, features: featureMap[row.id] || [],
  }));
}

function readParentChildSet(parentSql, childSql, mapParent, mapChild, parentIdField, childForeignField, childArrayKey) {
  const children = listRows(childSql);
  const childMap = children.reduce((acc, row) => {
    acc[row[childForeignField]] ||= [];
    acc[row[childForeignField]].push(mapChild(row));
    return acc;
  }, {});

  return listRows(parentSql).map((row) => ({
    ...mapParent(row),
    [childArrayKey]: childMap[row[parentIdField]] || [],
  }));
}

const writePurchasesTx = db.transaction((value) => {
  db.prepare("DELETE FROM purchase_lines").run();
  db.prepare("DELETE FROM purchases").run();
  value.forEach((item) => {
    ensureSupplier(item.supplierId || null);
    db.prepare(`
      INSERT INTO purchases (id, document_no, supplier_id, date, procurement_type_id, payment_term_id, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.documentNo || "", item.supplierId || null, item.date || "", item.procurementTypeId || null, item.paymentTermId || null, item.description || "", item.createdAt || "", item.updatedAt || "");
    (item.lines || []).forEach((line, index) => {
      ensureSupplier(item.supplierId || null);
      db.prepare(`
        INSERT INTO purchase_lines (id, purchase_id, product_id, quantity, unit_price, note, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(line.id || `${item.id}-line-${index + 1}`, item.id, line.productId || null, Number(line.quantity || 0), Number(line.unitPrice || 0), line.note || "", index + 1);
    });
  });
});

function readPurchases() {
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

const writeContractsTx = db.transaction((value) => {
  db.prepare("DELETE FROM consignment_contracts").run();
  value.forEach((item) => {
    ensureSupplier(item.supplierId || null);
    db.prepare(`
      INSERT INTO consignment_contracts (id, supplier_id, start_date, end_date, commission_rate, pdf_name, pdf_data_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      item.supplierId || null,
      item.startDate || "",
      item.endDate || "",
      Number(item.commissionRate || 0),
      item.pdfName || "",
      item.pdfDataUrl || "",
      item.createdAt || "",
      item.updatedAt || "",
    );
  });
});

function readContracts() {
  return listRows("SELECT * FROM consignment_contracts ORDER BY created_at DESC").map((row) => ({
    id: row.id,
    supplierId: row.supplier_id,
    startDate: row.start_date,
    endDate: row.end_date,
    commissionRate: row.commission_rate,
    pdfName: row.pdf_name,
    pdfDataUrl: row.pdf_data_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

const writeStockEntriesTx = db.transaction((value) => {
  db.prepare("DELETE FROM stock_lines").run();
  db.prepare("DELETE FROM stock_entries").run();
  value.forEach((item) => {
    ensureSupplier(item.sourcePartyId || null);
    db.prepare(`
      INSERT INTO stock_entries (id, document_no, source_party_id, date, stock_type, source_type, status, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.documentNo || "", item.sourcePartyId || null, item.date || "", item.stockType || "", item.sourceType || "", item.status || "", item.note || "", item.createdAt || "", item.updatedAt || "");
    (item.lines || []).forEach((line, index) => {
      db.prepare(`
        INSERT INTO stock_lines (id, stock_entry_id, product_id, quantity, unit_cost, note, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(line.id || `${item.id}-line-${index + 1}`, item.id, line.productId || null, Number(line.quantity || 0), Number(line.unitCost || 0), line.note || "", index + 1);
    });
  });
});

function readStockEntries() {
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

const writePosSessionsTx = db.transaction((value) => {
  db.prepare("DELETE FROM pos_sessions").run();
  value.forEach((item) => {
    db.prepare(`
      INSERT INTO pos_sessions (id, session_no, register_name, cashier_name, opening_balance, opened_at, closed_at, status, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.sessionNo || "", item.registerName || "", item.cashierName || "", Number(item.openingBalance || 0), item.openedAt || "", item.closedAt || null, item.status || "", item.note || "", item.createdAt || "", item.updatedAt || "");
  });
});

function readPosSessions() {
  return listRows("SELECT * FROM pos_sessions ORDER BY created_at DESC").map((row) => ({
    id: row.id, sessionNo: row.session_no, registerName: row.register_name, cashierName: row.cashier_name, openingBalance: row.opening_balance,
    openedAt: row.opened_at, closedAt: row.closed_at, status: row.status, note: row.note, createdAt: row.created_at, updatedAt: row.updated_at,
  }));
}

const writePosSalesTx = db.transaction((value) => {
  db.prepare("DELETE FROM pos_sale_lines").run();
  db.prepare("DELETE FROM pos_sales").run();
  value.forEach((item) => {
    db.prepare(`
      INSERT INTO pos_sales (id, session_id, receipt_no, sold_at, customer_name, payment_method, note, discount_type, discount_value, discount_amount, subtotal, tax_total, grand_total, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.sessionId || null, item.receiptNo || "", item.soldAt || "", item.customerName || "", item.paymentMethod || "", item.note || "", item.discountType || "amount", Number(item.discountValue || 0), Number(item.discountAmount || 0), Number(item.subtotal || 0), Number(item.taxTotal || 0), Number(item.grandTotal || 0), item.createdAt || "", item.updatedAt || "");
    (item.lines || []).forEach((line, index) => {
      db.prepare(`
        INSERT INTO pos_sale_lines (id, sale_id, product_id, quantity, unit_price, line_total, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(line.id || `${item.id}-line-${index + 1}`, item.id, line.productId || null, Number(line.quantity || 0), Number(line.unitPrice || 0), Number(line.lineTotal || 0), index + 1);
    });
  });
});

function readPosSales() {
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

const writeDeliveryListsTx = db.transaction((value) => {
  db.prepare("DELETE FROM delivery_lines").run();
  db.prepare("DELETE FROM delivery_lists").run();
  value.forEach((item) => {
    ensureSupplier(item.supplierId || null);
    ensureUser(item.createdBy || null);
    db.prepare(`
      INSERT INTO delivery_lists (id, delivery_no, supplier_id, supplier_name, contact_name, supplier_email, date, shipping_method, tracking_no, note, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.deliveryNo || "", item.supplierId || null, item.supplierName || "", item.contactName || "", item.supplierEmail || "", item.date || "", item.shippingMethod || "", item.trackingNo || "", item.note || "", item.status || "", item.createdBy || null, item.createdAt || "", item.updatedAt || "");
    (item.lines || []).forEach((line, index) => {
      db.prepare(`
        INSERT INTO delivery_lines (id, delivery_list_id, product_id, is_new_product, image, name, code, sale_price, sale_currency, quantity, description, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(line.id || `${item.id}-line-${index + 1}`, item.id, line.productId || null, boolToInt(line.isNewProduct), line.image || "", line.name || "", line.code || "", Number(line.salePrice || 0), line.saleCurrency || "TRY", Number(line.quantity || 0), line.description || "", index + 1);
    });
  });
});

function readDeliveryLists() {
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

const writeSystemParametersTx = db.transaction((value) => {
  db.prepare("DELETE FROM system_parameters").run();
  db.prepare(`
    INSERT INTO system_parameters (id, product_code_control_enabled, updated_at)
    VALUES (1, ?, ?)
  `).run(boolToInt(value.productCodeControlEnabled), nowIso());
});

function readSystemParameters() {
  const row = getRow("SELECT * FROM system_parameters WHERE id = 1");
  if (!row) {
    return null;
  }

  return {
    productCodeControlEnabled: intToBool(row.product_code_control_enabled),
  };
}

const writeSmtpSettingsTx = db.transaction((value) => {
  db.prepare("DELETE FROM smtp_settings").run();
  db.prepare(`
    INSERT INTO smtp_settings (id, enabled, host, port, secure, username, password, from_name, from_email, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    boolToInt(value.enabled),
    String(value.host || "").trim(),
    Number(value.port || 587),
    boolToInt(value.secure),
    String(value.username || "").trim(),
    String(value.password || ""),
    String(value.fromName || "").trim(),
    String(value.fromEmail || "").trim(),
    nowIso(),
  );
});

function readSmtpSettings() {
  const row = getRow("SELECT * FROM smtp_settings WHERE id = 1");
  if (!row) {
    return {
      enabled: false,
      host: "",
      port: 587,
      secure: false,
      username: "",
      password: "",
      fromName: "",
      fromEmail: "",
    };
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

const handlers = {
  "sibella.erp.masterData.v1": { read: readMasterData, write: writeMasterData },
  "sibella.erp.users.v1": { read: readUsers, write: writeUsers },
  "sibella.erp.suppliers.v1": { read: readSuppliers, write: writeSuppliers },
  "sibella.erp.products.v1": { read: readProducts, write: writeProducts },
  "sibella.erp.purchases.v2": { read: readPurchases, write: writePurchasesTx },
  "sibella.erp.contracts.v1": { read: readContracts, write: writeContractsTx },
  "sibella.erp.stockEntries.v2": { read: readStockEntries, write: writeStockEntriesTx },
  "sibella.erp.posSessions.v2": { read: readPosSessions, write: writePosSessionsTx },
  "sibella.erp.posSales.v2": { read: readPosSales, write: writePosSalesTx },
  "sibella.erp.deliveryLists.v1": { read: readDeliveryLists, write: writeDeliveryListsTx },
  "sibella.erp.systemParameters.v1": { read: readSystemParameters, write: writeSystemParametersTx },
  "sibella.erp.smtpSettings.v1": { read: readSmtpSettings, write: writeSmtpSettingsTx },
};

export function getStoreValue(key) {
  const meta = getRow("SELECT updated_at FROM store_meta WHERE key = ?", [key]);

  if (!meta) {
    if (key === "sibella.erp.users.v1") {
      updateMeta(key);
    } else {
      const legacy = legacyValueFor(key);
      if (legacy && handlers[key]) {
        handlers[key].write(legacy.value);
        updateMeta(key);
      } else {
        return null;
      }
    }
  }

  const handler = handlers[key];
  if (!handler) {
    const fallback = legacyValueFor(key);
    return fallback;
  }

  return {
    value: handler.read(),
    updatedAt: getRow("SELECT updated_at FROM store_meta WHERE key = ?", [key])?.updated_at || nowIso(),
  };
}

export function setStoreValue(key, value) {
  const handler = handlers[key];
  if (!handler) {
    throw new Error(`Desteklenmeyen store key: ${key}`);
  }

  handler.write(value);
  updateMeta(key);
  const updatedAt = getRow("SELECT updated_at FROM store_meta WHERE key = ?", [key])?.updated_at || nowIso();
  void mirrorStoreValueToPostgres(key, value, updatedAt);

  return {
    key,
    value,
    updatedAt,
  };
}

export function listStoreKeys() {
  return listRows("SELECT key, updated_at FROM store_meta ORDER BY key");
}

export function getDatabaseRuntimeInfo() {
  return {
    sqlitePath: dbPath,
    postgresMirrorEnabled,
  };
}
