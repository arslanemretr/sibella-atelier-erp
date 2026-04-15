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

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = (async () => {
      await ensureCoreSchema();
      await ensureApplicationSchema();
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

export { sqlExec, sqlMany, sqlOne, tableExists };
