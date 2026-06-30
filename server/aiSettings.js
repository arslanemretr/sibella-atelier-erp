// AI ayarlari: Anthropic API anahtari (DB'de sifreli) + model.
// Anahtar UI'dan girilir, DB'de AES-256-GCM ile sifreli tutulur, tarayiciya
// asla tam haliyle donmez (maskeli). Sifreleme ana anahtari ortamdan
// (AI_ENC_SECRET) ya da DATABASE_URL'den turetilir; API anahtari hardcoded degil.

/* global process */
import crypto from "node:crypto";
import { sqlExec, sqlOne } from "./db.js";

const DEFAULT_MODEL = "claude-opus-4-8";

function masterKey() {
  const secret = String(process.env.AI_ENC_SECRET || process.env.DATABASE_URL || "sibella-ai-fallback-secret");
  // 32 baytlik anahtar
  return crypto.scryptSync(secret, "sibella-ai-enc-salt", 32);
}

function encryptSecret(plain) {
  const text = String(plain || "");
  if (!text) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

function decryptSecret(stored) {
  const value = String(stored || "");
  if (!value || !value.startsWith("v1:")) return "";
  try {
    const [, ivB64, tagB64, dataB64] = value.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return "";
  }
}

function maskKey(key) {
  const k = String(key || "");
  if (!k) return "";
  if (k.length <= 12) return "••••";
  return `${k.slice(0, 7)}••••${k.slice(-4)}`;
}

function nowIso() {
  return new Date().toISOString();
}

export async function ensureAiSettingsReady() {
  await sqlExec(`
    CREATE TABLE IF NOT EXISTS ai_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      api_key_enc TEXT,
      model TEXT NOT NULL DEFAULT '${DEFAULT_MODEL}',
      updated_at TIMESTAMPTZ
    )
  `);
  await sqlExec(`INSERT INTO ai_settings (id, model) VALUES (1, '${DEFAULT_MODEL}') ON CONFLICT (id) DO NOTHING`);
}

async function loadRow() {
  return sqlOne("SELECT * FROM ai_settings WHERE id = 1");
}

// Sunucu ici kullanim: ham API anahtari (DB sifreli -> coz; yoksa env fallback)
export async function getAiApiKey() {
  const row = await loadRow();
  const fromDb = decryptSecret(row?.api_key_enc);
  if (fromDb) return fromDb;
  return String(process.env.ANTHROPIC_API_KEY || "").trim();
}

export async function getAiModel() {
  const row = await loadRow();
  return row?.model || DEFAULT_MODEL;
}

// ─── HTTP handler'lari ────────────────────────────────────────────────────────
export async function handleAiSettingsGet(_req, res) {
  const row = await loadRow();
  const dbKey = decryptSecret(row?.api_key_enc);
  const envKey = String(process.env.ANTHROPIC_API_KEY || "").trim();
  const effective = dbKey || envKey;
  return res.json({
    ok: true,
    item: {
      hasKey: Boolean(effective),
      keySource: dbKey ? "db" : (envKey ? "env" : "none"),
      keyMasked: maskKey(effective),
      model: row?.model || DEFAULT_MODEL,
      updatedAt: row?.updated_at || null,
    },
  });
}

export async function handleAiSettingsPut(req, res) {
  const row = await loadRow();
  const model = String(req.body?.model || row?.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;

  // apiKey yalnizca yeni bir deger girildiyse guncellenir.
  // Bos string => degisiklik yok. "__CLEAR__" => anahtari sil.
  let apiKeyEnc = row?.api_key_enc || null;
  const incoming = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
  if (incoming === "__CLEAR__") {
    apiKeyEnc = null;
  } else if (incoming) {
    apiKeyEnc = encryptSecret(incoming);
  }

  await sqlExec(`
    INSERT INTO ai_settings (id, api_key_enc, model, updated_at)
    VALUES (1, $1, $2, $3::timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      api_key_enc = EXCLUDED.api_key_enc,
      model = EXCLUDED.model,
      updated_at = EXCLUDED.updated_at
  `, [apiKeyEnc, model, nowIso()]);

  const effective = decryptSecret(apiKeyEnc) || String(process.env.ANTHROPIC_API_KEY || "").trim();
  return res.json({
    ok: true,
    item: {
      hasKey: Boolean(effective),
      keySource: decryptSecret(apiKeyEnc) ? "db" : (process.env.ANTHROPIC_API_KEY ? "env" : "none"),
      keyMasked: maskKey(effective),
      model,
      updatedAt: nowIso(),
    },
  });
}
