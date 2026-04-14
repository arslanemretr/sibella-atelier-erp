/* global process */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
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

function uniqueById(items = []) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = item?.id || crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }
  return output;
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

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function tableExists(tableName) {
  const row = await sqlOne("SELECT to_regclass($1) AS reg", [`public.${tableName}`]);
  return Boolean(row?.reg);
}

async function ensureCoreSchema() {
  await sqlExec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT,
      email TEXT UNIQUE,
      password TEXT NOT NULL,
      role TEXT,
      supplier_id TEXT,
      status TEXT,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    );
  `);

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

async function ensureApplicationSchema() {
  const schemaPath = path.resolve(process.cwd(), "database/postgresql/schema.sql");
  if (!fs.existsSync(schemaPath)) {
    return;
  }
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  if (!schemaSql.trim()) {
    return;
  }
  const statements = schemaSql
    .split(/;\s*\r?\n/)
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await sqlExec(statement);
  }
}

async function syncMasterDataToTables(client, value) {
  const categories = Array.isArray(value?.categories) ? value.categories : [];
  const collections = Array.isArray(value?.collections) ? value.collections : [];
  const posCategories = Array.isArray(value?.["pos-categories"]) ? value["pos-categories"] : [];
  const barcodeStandards = Array.isArray(value?.["barcode-standards"]) ? value["barcode-standards"] : [];
  const procurementTypes = Array.isArray(value?.["procurement-types"]) ? value["procurement-types"] : [];
  const paymentTerms = Array.isArray(value?.["payment-terms"]) ? value["payment-terms"] : [];

  for (const item of categories) {
    await client.query(`
      INSERT INTO categories (id, level1, level2, level3, level4, full_path, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        level1 = EXCLUDED.level1,
        level2 = EXCLUDED.level2,
        level3 = EXCLUDED.level3,
        level4 = EXCLUDED.level4,
        full_path = EXCLUDED.full_path,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    `, [item.id, item.level1 || "", item.level2 || "", item.level3 || "", item.level4 || "", item.fullPath || "", item.status || "Aktif", item.createdAt || nowIso(), item.updatedAt || nowIso()]);
  }

  for (const item of collections) {
    await client.query(`
      INSERT INTO collections (id, name, description, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    `, [item.id, item.name || "", item.description || "", item.status || "Aktif", item.createdAt || nowIso(), item.updatedAt || nowIso()]);
  }

  for (const item of posCategories) {
    await client.query(`
      INSERT INTO pos_categories (id, name, description, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    `, [item.id, item.name || "", item.description || "", item.status || "Aktif", item.createdAt || nowIso(), item.updatedAt || nowIso()]);
  }

  for (const item of barcodeStandards) {
    await client.query(`
      INSERT INTO barcode_standards (id, name, prefix, separator, digits, next_number, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        prefix = EXCLUDED.prefix,
        separator = EXCLUDED.separator,
        digits = EXCLUDED.digits,
        next_number = EXCLUDED.next_number,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    `, [item.id, item.name || "", item.prefix || "", item.separator || "", Number(item.digits || 0), Number(item.nextNumber || 0), item.status || "Aktif", item.createdAt || nowIso(), item.updatedAt || nowIso()]);
  }

  for (const item of procurementTypes) {
    await client.query(`
      INSERT INTO procurement_types (id, name, description, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    `, [item.id, item.name || "", item.description || "", item.status || "Aktif", item.createdAt || nowIso(), item.updatedAt || nowIso()]);
  }

  for (const item of paymentTerms) {
    await client.query(`
      INSERT INTO payment_terms (id, name, days, description, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        days = EXCLUDED.days,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    `, [item.id, item.name || "", Number(item.days || 0), item.description || "", item.status || "Aktif", item.createdAt || nowIso(), item.updatedAt || nowIso()]);
  }
}

async function syncSuppliersToTables(client, value) {
  const suppliers = uniqueById(Array.isArray(value) ? value : []);
  const procurementTypeIds = new Set((await client.query("SELECT id FROM procurement_types")).rows.map((row) => row.id));
  const paymentTermIds = new Set((await client.query("SELECT id FROM payment_terms")).rows.map((row) => row.id));
  for (const item of suppliers) {
    await client.query(`
      INSERT INTO suppliers (
        id, short_code, company, contact, email, phone, city, iban, tax_number, tax_office, address,
        procurement_type_id, payment_term_id, status, note, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::timestamptz,$17::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        short_code = EXCLUDED.short_code,
        company = EXCLUDED.company,
        contact = EXCLUDED.contact,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        city = EXCLUDED.city,
        iban = EXCLUDED.iban,
        tax_number = EXCLUDED.tax_number,
        tax_office = EXCLUDED.tax_office,
        address = EXCLUDED.address,
        procurement_type_id = EXCLUDED.procurement_type_id,
        payment_term_id = EXCLUDED.payment_term_id,
        status = EXCLUDED.status,
        note = EXCLUDED.note,
        updated_at = EXCLUDED.updated_at
    `, [
      item.id, item.shortCode || "", item.company || "", item.contact || "", item.email || "", item.phone || "",
      item.city || "", item.iban || "", item.taxNumber || "", item.taxOffice || "", item.address || "",
      procurementTypeIds.has(item.procurementTypeId) ? item.procurementTypeId : null,
      paymentTermIds.has(item.paymentTermId) ? item.paymentTermId : null,
      item.status || "Aktif", item.note || "",
      item.createdAt || nowIso(), item.updatedAt || nowIso(),
    ]);
  }
}

async function syncProductsToTables(client, value) {
  const products = uniqueById(Array.isArray(value) ? value : []);
  const categoryIds = new Set((await client.query("SELECT id FROM categories")).rows.map((row) => row.id));
  const collectionIds = new Set((await client.query("SELECT id FROM collections")).rows.map((row) => row.id));
  const posCategoryIds = new Set((await client.query("SELECT id FROM pos_categories")).rows.map((row) => row.id));
  const supplierIds = new Set((await client.query("SELECT id FROM suppliers")).rows.map((row) => row.id));
  const userIds = new Set((await client.query("SELECT id FROM users")).rows.map((row) => row.id));
  for (const item of products) {
    await client.query(`
      INSERT INTO products (
        id, code, name, sale_price, sale_currency, cost, cost_currency, category_id, collection_id, pos_category_id,
        supplier_id, barcode, supplier_code, min_stock, supplier_lead_time, stock, product_type, sales_tax, image,
        is_for_sale, is_for_purchase, use_in_pos, track_inventory, status, workflow_status, created_by, notes, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28::timestamptz,$29::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        sale_price = EXCLUDED.sale_price,
        sale_currency = EXCLUDED.sale_currency,
        cost = EXCLUDED.cost,
        cost_currency = EXCLUDED.cost_currency,
        category_id = EXCLUDED.category_id,
        collection_id = EXCLUDED.collection_id,
        pos_category_id = EXCLUDED.pos_category_id,
        supplier_id = EXCLUDED.supplier_id,
        barcode = EXCLUDED.barcode,
        supplier_code = EXCLUDED.supplier_code,
        min_stock = EXCLUDED.min_stock,
        supplier_lead_time = EXCLUDED.supplier_lead_time,
        stock = EXCLUDED.stock,
        product_type = EXCLUDED.product_type,
        sales_tax = EXCLUDED.sales_tax,
        image = EXCLUDED.image,
        is_for_sale = EXCLUDED.is_for_sale,
        is_for_purchase = EXCLUDED.is_for_purchase,
        use_in_pos = EXCLUDED.use_in_pos,
        track_inventory = EXCLUDED.track_inventory,
        status = EXCLUDED.status,
        workflow_status = EXCLUDED.workflow_status,
        created_by = EXCLUDED.created_by,
        notes = EXCLUDED.notes,
        updated_at = EXCLUDED.updated_at
    `, [
      item.id, item.code || "", item.name || "", Number(item.salePrice || 0), item.saleCurrency || "TRY",
      Number(item.cost || 0), item.costCurrency || "TRY",
      categoryIds.has(item.categoryId) ? item.categoryId : null,
      collectionIds.has(item.collectionId) ? item.collectionId : null,
      posCategoryIds.has(item.posCategoryId) ? item.posCategoryId : null,
      supplierIds.has(item.supplierId) ? item.supplierId : null,
      item.barcode || "", item.supplierCode || "",
      Number(item.minStock || 0), Number(item.supplierLeadTime || 0), Number(item.stock || 0), item.productType || "kendi",
      item.salesTax || "", item.image || "", Boolean(item.isForSale), Boolean(item.isForPurchase), Boolean(item.useInPos),
      Boolean(item.trackInventory), item.status || "Aktif", item.workflowStatus || "Taslak", userIds.has(item.createdBy) ? item.createdBy : null,
      item.notes || "", item.createdAt || nowIso(), item.updatedAt || nowIso(),
    ]);

    await client.query("DELETE FROM product_features WHERE product_id = $1", [item.id]);
    for (const [index, feature] of (Array.isArray(item.features) ? item.features : []).entries()) {
      await client.query(`
        INSERT INTO product_features (id, product_id, name, value, sort_order)
        VALUES ($1,$2,$3,$4,$5)
      `, [feature.id || `${item.id}-feat-${index + 1}`, item.id, feature.name || "", feature.value || "", index + 1]);
    }
  }
}

async function syncPurchasesToTables(client, value) {
  const purchases = uniqueById(Array.isArray(value) ? value : []);
  const supplierIds = new Set((await client.query("SELECT id FROM suppliers")).rows.map((row) => row.id));
  const procurementTypeIds = new Set((await client.query("SELECT id FROM procurement_types")).rows.map((row) => row.id));
  const paymentTermIds = new Set((await client.query("SELECT id FROM payment_terms")).rows.map((row) => row.id));
  const productIds = new Set((await client.query("SELECT id FROM products")).rows.map((row) => row.id));
  await client.query("DELETE FROM purchase_lines");
  await client.query("DELETE FROM purchases");
  for (const purchase of purchases) {
    await client.query(`
      INSERT INTO purchases (id, document_no, supplier_id, date, procurement_type_id, payment_term_id, description, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz)
    `, [
      purchase.id, purchase.documentNo || "", supplierIds.has(purchase.supplierId) ? purchase.supplierId : null, purchase.date || null,
      procurementTypeIds.has(purchase.procurementTypeId) ? purchase.procurementTypeId : null,
      paymentTermIds.has(purchase.paymentTermId) ? purchase.paymentTermId : null, purchase.description || "",
      purchase.createdAt || nowIso(), purchase.updatedAt || nowIso(),
    ]);

    for (const [index, line] of (Array.isArray(purchase.lines) ? purchase.lines : []).entries()) {
      await client.query(`
        INSERT INTO purchase_lines (id, purchase_id, product_id, quantity, unit_price, note, sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [`${purchase.id}-line-${index + 1}`, purchase.id, productIds.has(line.productId) ? line.productId : null, Number(line.quantity || 0), Number(line.unitPrice || 0), line.note || "", index + 1]);
    }
  }
}

async function syncContractsToTables(client, value) {
  const contracts = uniqueById(Array.isArray(value) ? value : []);
  const supplierIds = new Set((await client.query("SELECT id FROM suppliers")).rows.map((row) => row.id));
  await client.query("DELETE FROM consignment_contracts");
  for (const item of contracts) {
    await client.query(`
      INSERT INTO consignment_contracts (id, supplier_id, start_date, end_date, commission_rate, pdf_name, pdf_data_url, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz)
    `, [
      item.id, supplierIds.has(item.supplierId) ? item.supplierId : null, item.startDate || null, item.endDate || null, Number(item.commissionRate || 0),
      item.pdfName || "", item.pdfDataUrl || "", item.createdAt || nowIso(), item.updatedAt || nowIso(),
    ]);
  }
}

async function syncStockEntriesToTables(client, value) {
  const entries = uniqueById(Array.isArray(value) ? value : []);
  const supplierIds = new Set((await client.query("SELECT id FROM suppliers")).rows.map((row) => row.id));
  const productIds = new Set((await client.query("SELECT id FROM products")).rows.map((row) => row.id));
  await client.query("DELETE FROM stock_lines");
  await client.query("DELETE FROM stock_entries");
  for (const entry of entries) {
    await client.query(`
      INSERT INTO stock_entries (id, document_no, source_party_id, date, stock_type, source_type, status, note, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10::timestamptz)
    `, [
      entry.id, entry.documentNo || "", supplierIds.has(entry.sourcePartyId) ? entry.sourcePartyId : null, entry.date || null, entry.stockType || "Urun",
      entry.sourceType || "", entry.status || "Taslak", entry.note || "", entry.createdAt || nowIso(), entry.updatedAt || nowIso(),
    ]);

    for (const [index, line] of (Array.isArray(entry.lines) ? entry.lines : []).entries()) {
      await client.query(`
        INSERT INTO stock_lines (id, stock_entry_id, product_id, quantity, unit_cost, note, sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [`${entry.id}-line-${index + 1}`, entry.id, productIds.has(line.productId) ? line.productId : null, Number(line.quantity || 0), Number(line.unitCost || 0), line.note || "", index + 1]);
    }
  }
}

async function syncPosSessionsToTables(client, value) {
  const sessions = uniqueById(Array.isArray(value) ? value : []);
  for (const item of sessions) {
    await client.query(`
      INSERT INTO pos_sessions (id, session_no, register_name, cashier_name, opening_balance, opened_at, closed_at, status, note, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz,$8,$9,$10::timestamptz,$11::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        session_no = EXCLUDED.session_no,
        register_name = EXCLUDED.register_name,
        cashier_name = EXCLUDED.cashier_name,
        opening_balance = EXCLUDED.opening_balance,
        opened_at = EXCLUDED.opened_at,
        closed_at = EXCLUDED.closed_at,
        status = EXCLUDED.status,
        note = EXCLUDED.note,
        updated_at = EXCLUDED.updated_at
    `, [
      item.id, item.sessionNo || "", item.registerName || "", item.cashierName || "", Number(item.openingBalance || 0),
      item.openedAt || null, item.closedAt || null, item.status || "", item.note || "", item.createdAt || nowIso(), item.updatedAt || nowIso(),
    ]);
  }
}

async function syncPosSalesToTables(client, value) {
  const sales = uniqueById(Array.isArray(value) ? value : []);
  const sessionIds = new Set((await client.query("SELECT id FROM pos_sessions")).rows.map((row) => row.id));
  const productIds = new Set((await client.query("SELECT id FROM products")).rows.map((row) => row.id));
  await client.query("DELETE FROM pos_sale_lines");
  await client.query("DELETE FROM pos_sales");
  for (const sale of sales) {
    await client.query(`
      INSERT INTO pos_sales (
        id, session_id, receipt_no, sold_at, customer_name, payment_method, note, discount_type, discount_value,
        discount_amount, subtotal, tax_total, grand_total, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4::timestamptz,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::timestamptz,$15::timestamptz)
    `, [
      sale.id, sessionIds.has(sale.sessionId) ? sale.sessionId : null, sale.receiptNo || "", sale.soldAt || sale.createdAt || null, sale.customerName || "",
      sale.paymentMethod || "", sale.note || "", sale.discountType || "", Number(sale.discountValue || 0),
      Number(sale.discountAmount || 0), Number(sale.subtotal || 0), Number(sale.taxTotal || 0), Number(sale.grandTotal || 0),
      sale.createdAt || nowIso(), sale.updatedAt || nowIso(),
    ]);

    for (const [index, line] of (Array.isArray(sale.lines) ? sale.lines : []).entries()) {
      await client.query(`
        INSERT INTO pos_sale_lines (id, sale_id, product_id, quantity, unit_price, line_total, sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [`${sale.id}-line-${index + 1}`, sale.id, productIds.has(line.productId) ? line.productId : null, Number(line.quantity || 0), Number(line.unitPrice || 0), Number(line.lineTotal || 0), index + 1]);
    }
  }
}

async function syncDeliveryListsToTables(client, value) {
  const deliveries = uniqueById(Array.isArray(value) ? value : []);
  const supplierIds = new Set((await client.query("SELECT id FROM suppliers")).rows.map((row) => row.id));
  const productIds = new Set((await client.query("SELECT id FROM products")).rows.map((row) => row.id));
  const userIds = new Set((await client.query("SELECT id FROM users")).rows.map((row) => row.id));
  await client.query("DELETE FROM delivery_lines");
  await client.query("DELETE FROM delivery_lists");
  for (const delivery of deliveries) {
    await client.query(`
      INSERT INTO delivery_lists (
        id, delivery_no, supplier_id, supplier_name, contact_name, supplier_email, date, shipping_method,
        tracking_no, note, status, created_by, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::timestamptz,$14::timestamptz)
    `, [
      delivery.id, delivery.deliveryNo || "", supplierIds.has(delivery.supplierId) ? delivery.supplierId : null, delivery.supplierName || "", delivery.contactName || "",
      delivery.supplierEmail || "", delivery.date || null, delivery.shippingMethod || "", delivery.trackingNo || "",
      delivery.note || "", delivery.status || "Taslak", userIds.has(delivery.createdBy) ? delivery.createdBy : null, delivery.createdAt || nowIso(), delivery.updatedAt || nowIso(),
    ]);

    for (const [index, line] of (Array.isArray(delivery.lines) ? delivery.lines : []).entries()) {
      await client.query(`
        INSERT INTO delivery_lines (
          id, delivery_list_id, product_id, is_new_product, image, name, code, sale_price, sale_currency, quantity, description, sort_order
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [
        `${delivery.id}-line-${index + 1}`, delivery.id, productIds.has(line.productId) ? line.productId : null, Boolean(line.isNewProduct),
        line.image || "", line.name || "", line.code || "", Number(line.salePrice || 0), line.saleCurrency || "TRY",
        Number(line.quantity || 0), line.description || "", index + 1,
      ]);
    }
  }
}

async function syncSystemParametersToTables(client, value) {
  await client.query(`
    INSERT INTO system_parameters (id, product_code_control_enabled, updated_at)
    VALUES (1, $1, $2::timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      product_code_control_enabled = EXCLUDED.product_code_control_enabled,
      updated_at = EXCLUDED.updated_at
  `, [Boolean(value?.productCodeControlEnabled), nowIso()]);
}

async function syncSmtpSettingsToTables(client, value) {
  await client.query(`
    INSERT INTO smtp_settings (id, enabled, host, port, secure, username, password, from_name, from_email, updated_at)
    VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      host = EXCLUDED.host,
      port = EXCLUDED.port,
      secure = EXCLUDED.secure,
      username = EXCLUDED.username,
      password = EXCLUDED.password,
      from_name = EXCLUDED.from_name,
      from_email = EXCLUDED.from_email,
      updated_at = EXCLUDED.updated_at
  `, [
    Boolean(value?.enabled), value?.host || "", Number(value?.port || 587), Boolean(value?.secure), value?.username || "",
    value?.password || "", value?.fromName || "", value?.fromEmail || "", nowIso(),
  ]);
}

const tableSyncHandlers = {
  "sibella.erp.masterData.v1": syncMasterDataToTables,
  "sibella.erp.suppliers.v1": syncSuppliersToTables,
  "sibella.erp.products.v1": syncProductsToTables,
  "sibella.erp.purchases.v2": syncPurchasesToTables,
  "sibella.erp.contracts.v1": syncContractsToTables,
  "sibella.erp.stockEntries.v2": syncStockEntriesToTables,
  "sibella.erp.posSessions.v2": syncPosSessionsToTables,
  "sibella.erp.posSales.v2": syncPosSalesToTables,
  "sibella.erp.deliveryLists.v1": syncDeliveryListsToTables,
  "sibella.erp.systemParameters.v1": syncSystemParametersToTables,
  "sibella.erp.smtpSettings.v1": syncSmtpSettingsToTables,
};

async function syncStoreValueToTables(key, value) {
  const handler = tableSyncHandlers[key];
  if (!handler) {
    return;
  }
  await withTransaction(async (client) => {
    await handler(client, value);
  });
}

async function syncExistingStoresToTables() {
  const syncOrder = [
    "sibella.erp.masterData.v1",
    "sibella.erp.suppliers.v1",
    "sibella.erp.products.v1",
    "sibella.erp.purchases.v2",
    "sibella.erp.contracts.v1",
    "sibella.erp.stockEntries.v2",
    "sibella.erp.posSessions.v2",
    "sibella.erp.posSales.v2",
    "sibella.erp.deliveryLists.v1",
    "sibella.erp.systemParameters.v1",
    "sibella.erp.smtpSettings.v1",
  ];

  for (const key of syncOrder) {
    const row = await sqlOne("SELECT value FROM kv_store WHERE key = $1", [key]);
    if (!row) {
      continue;
    }
    await syncStoreValueToTables(key, row.value);
  }
}

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = (async () => {
      await ensureCoreSchema();
      await ensureApplicationSchema();
      await syncExistingStoresToTables();
    })().catch((error) => {
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
  await syncStoreValueToTables(key, value);
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

export async function ensureDatabaseReady() {
  await ensureInitialized();
}

export function getDatabaseRuntimeInfo() {
  return {
    engine: "postgresql",
    postgresMirrorEnabled: true,
    sqlitePath: null,
  };
}

export { sqlExec, sqlMany, sqlOne };
