import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const sqlitePath = path.resolve(process.cwd(), "data", "erp.sqlite");
const outputPath = path.resolve(process.cwd(), "dokumanlar", "sqlite-schema.sql");

const db = new Database(sqlitePath, { readonly: true });
const rows = db
  .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all();

const content = rows
  .map((row) => `-- ${row.name}\n${String(row.sql || "").trim()};\n`)
  .join("\n");

fs.writeFileSync(outputPath, content, "utf8");
console.log(`SQLite schema dosyasi olusturuldu: ${outputPath}`);
