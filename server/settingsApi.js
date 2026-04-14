import { sqlExec, sqlOne } from "./db.js";

function nowIso() {
  return new Date().toISOString();
}

function systemParametersRowToModel(row) {
  return {
    productCodeControlEnabled: row ? Boolean(row.product_code_control_enabled) : true,
    updatedAt: row?.updated_at || null,
  };
}

function smtpRowToModel(row) {
  return {
    enabled: row ? Boolean(row.enabled) : false,
    host: row?.host || "",
    port: Number(row?.port || 587),
    secure: row ? Boolean(row.secure) : false,
    username: row?.username || "",
    password: row?.password || "",
    fromName: row?.from_name || "Sibella Atelier",
    fromEmail: row?.from_email || "",
    updatedAt: row?.updated_at || null,
  };
}

export async function handleSystemParametersGet(_req, res) {
  const row = await sqlOne("SELECT * FROM system_parameters WHERE id = 1");
  return res.json({
    ok: true,
    item: systemParametersRowToModel(row),
  });
}

export async function handleSystemParametersPut(req, res) {
  const nextValues = {
    productCodeControlEnabled: Boolean(req.body?.productCodeControlEnabled),
    updatedAt: nowIso(),
  };

  await sqlExec(`
    INSERT INTO system_parameters (id, product_code_control_enabled, updated_at)
    VALUES (1, $1, $2::timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      product_code_control_enabled = EXCLUDED.product_code_control_enabled,
      updated_at = EXCLUDED.updated_at
  `, [nextValues.productCodeControlEnabled, nextValues.updatedAt]);

  return res.json({
    ok: true,
    item: nextValues,
  });
}

export async function handleSmtpSettingsGet(_req, res) {
  const row = await sqlOne("SELECT * FROM smtp_settings WHERE id = 1");
  return res.json({
    ok: true,
    item: smtpRowToModel(row),
  });
}

export async function handleSmtpSettingsPut(req, res) {
  const nextValues = {
    enabled: Boolean(req.body?.enabled),
    host: String(req.body?.host || "").trim(),
    port: Number(req.body?.port || 587),
    secure: Boolean(req.body?.secure),
    username: String(req.body?.username || "").trim(),
    password: String(req.body?.password || "").trim(),
    fromName: String(req.body?.fromName || "Sibella Atelier").trim(),
    fromEmail: String(req.body?.fromEmail || "").trim(),
    updatedAt: nowIso(),
  };

  await sqlExec(`
    INSERT INTO smtp_settings (id, enabled, host, port, secure, username, password, from_name, from_email, updated_at)
    VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)
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
    nextValues.enabled,
    nextValues.host,
    nextValues.port,
    nextValues.secure,
    nextValues.username,
    nextValues.password,
    nextValues.fromName,
    nextValues.fromEmail,
    nextValues.updatedAt,
  ]);

  return res.json({
    ok: true,
    item: nextValues,
  });
}
