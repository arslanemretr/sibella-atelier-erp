import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Database from "better-sqlite3";
import pg from "pg";

const { Client } = pg;

const sqlitePath = process.env.SQLITE_PATH || path.resolve(process.cwd(), "data", "erp.sqlite");
const pgUrl = process.env.DATABASE_URL;
const applySchema = process.argv.includes("--apply-schema");
const schemaPath = path.resolve(process.cwd(), "database", "postgresql", "schema.sql");

if (!pgUrl) {
  console.error("DATABASE_URL bulunamadi. Ornek: postgresql://user:pass@localhost:5432/erpsibella");
  process.exit(1);
}

if (!fs.existsSync(sqlitePath)) {
  console.error(`SQLite dosyasi bulunamadi: ${sqlitePath}`);
  process.exit(1);
}

const sqlite = new Database(sqlitePath, { readonly: true });
const client = new Client({ connectionString: pgUrl });

const TABLE_ORDER = [
  "categories",
  "collections",
  "pos_categories",
  "barcode_standards",
  "procurement_types",
  "payment_terms",
  "suppliers",
  "users",
  "products",
  "product_features",
  "purchases",
  "purchase_lines",
  "consignment_contracts",
  "stock_entries",
  "stock_lines",
  "pos_sessions",
  "pos_sales",
  "pos_sale_lines",
  "delivery_lists",
  "delivery_lines",
  "system_parameters",
  "smtp_settings",
  "auth_sessions",
  "password_reset_tokens",
  "login_attempts",
  "kv_store",
  "store_meta",
];

const BOOL_COLUMNS = new Set([
  "products.is_for_sale",
  "products.is_for_purchase",
  "products.use_in_pos",
  "products.track_inventory",
  "delivery_lines.is_new_product",
  "system_parameters.product_code_control_enabled",
  "smtp_settings.enabled",
  "smtp_settings.secure",
  "login_attempts.success",
]);

const sqliteTables = new Set(
  sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name),
);

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, "\"\"")}"`;
}

function normalizeValue(table, column, value) {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  const key = `${table}.${column}`;
  if (BOOL_COLUMNS.has(key)) {
    return Boolean(value);
  }

  if (table === "kv_store" && column === "value") {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  return value;
}

async function migrateTable(table) {
  if (!sqliteTables.has(table)) {
    console.log(`- ${table}: SQLite tarafinda bulunamadi, atlandi.`);
    return;
  }

  const rows = sqlite.prepare(`SELECT * FROM ${quoteIdent(table)}`).all();
  if (rows.length === 0) {
    console.log(`- ${table}: kayit yok.`);
    return;
  }

  const columns = Object.keys(rows[0]);
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const insertSql = `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) VALUES (${placeholders})`;

  for (const row of rows) {
    const values = columns.map((column) => normalizeValue(table, column, row[column]));
    await client.query(insertSql, values);
  }

  console.log(`- ${table}: ${rows.length} kayit tasindi.`);
}

async function run() {
  await client.connect();
  await client.query("BEGIN");

  try {
    const foundMappedTableCount = TABLE_ORDER.filter((table) => sqliteTables.has(table)).length;
    if (foundMappedTableCount === 0) {
      throw new Error(
        "SQLite dosyasinda beklenen tablolar bulunamadi. Muhtemelen eksik kopya alindi (WAL/SHM dahil degil) veya SQLITE_PATH yanlis.",
      );
    }

    if (applySchema) {
      const schemaSql = fs.readFileSync(schemaPath, "utf8");
      await client.query(schemaSql);
      console.log("PostgreSQL schema uygulandi.");
    }

    for (const table of [...TABLE_ORDER].reverse()) {
      await client.query(`TRUNCATE TABLE ${quoteIdent(table)} RESTART IDENTITY CASCADE`);
    }

    for (const table of TABLE_ORDER) {
      await migrateTable(table);
    }

    await client.query("COMMIT");
    console.log("SQLite -> PostgreSQL migration tamamlandi.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration hatasi:", error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
