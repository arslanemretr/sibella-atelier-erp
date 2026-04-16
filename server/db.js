/* global process */
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
  const tx = {
    async many(text, params = []) {
      const result = await client.query(text, params);
      return result.rows;
    },
    async one(text, params = []) {
      const rows = await tx.many(text, params);
      return rows[0] || null;
    },
    async exec(text, params = []) {
      await client.query(text, params);
    },
  };

  try {
    await client.query("BEGIN");
    const result = await callback(tx, client);
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

  if (await tableExists("suppliers")) {
    await sqlExec("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS logo TEXT");
  }

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

async function ensureDefaultStockLocationAndBalances() {
  const now = new Date().toISOString();
  const defaultLocationName = "Şarköy Mağaza";

  let mainLocation = await sqlOne(
    `
      SELECT id
      FROM stock_locations
      WHERE is_default_main = TRUE
      ORDER BY created_at ASC NULLS LAST, id ASC
      LIMIT 1
    `,
  );

  if (!mainLocation) {
    mainLocation = await sqlOne(
      `
        INSERT INTO stock_locations (id, name, store_id, is_default_main, created_at, updated_at)
        VALUES ($1, $2, NULL, TRUE, $3::timestamptz, $4::timestamptz)
        ON CONFLICT (name)
        DO UPDATE
        SET is_default_main = TRUE,
            updated_at = EXCLUDED.updated_at
        RETURNING id
      `,
      ["stockloc-main", defaultLocationName, now, now],
    );
  }

  await sqlExec(
    `
      UPDATE stock_locations
      SET is_default_main = CASE WHEN id = $1 THEN TRUE ELSE FALSE END,
          updated_at = $2::timestamptz
    `,
    [mainLocation.id, now],
  );

  const existingBalances = await sqlOne(
    "SELECT COUNT(*)::int AS count FROM stock_location_balances WHERE stock_location_id = $1",
    [mainLocation.id],
  );

  if (Number(existingBalances?.count || 0) === 0) {
    const productRows = await sqlMany("SELECT id, stock FROM products");
    for (const product of productRows) {
      await sqlExec(
        `
          INSERT INTO stock_location_balances (stock_location_id, product_id, quantity, updated_at)
          VALUES ($1, $2, $3, $4::timestamptz)
          ON CONFLICT (stock_location_id, product_id)
          DO UPDATE
          SET quantity = EXCLUDED.quantity,
              updated_at = EXCLUDED.updated_at
        `,
        [mainLocation.id, product.id, Number(product.stock || 0), now],
      );
    }
  }
}

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = (async () => {
      await ensureCoreSchema();
      await ensureApplicationSchema();
      await ensureDefaultStockLocationAndBalances();
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  await initPromise;
}

export async function ensureDatabaseReady() {
  await ensureInitialized();
}

export function getDatabaseRuntimeInfo() {
  return {
    engine: "postgresql",
    postgresMirrorEnabled: false,
    sqlitePath: null,
  };
}

export { sqlExec, sqlMany, sqlOne, tableExists, withTransaction };
