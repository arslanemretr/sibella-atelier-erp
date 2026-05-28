import { sqlExec, sqlOne } from "./db.js";

// ---------------------------------------------------------------------------
// Branding Settings
// ---------------------------------------------------------------------------

export async function ensureBrandingReady() {
  await sqlExec(`
    CREATE TABLE IF NOT EXISTS branding_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      app_name TEXT NOT NULL DEFAULT 'App',
      app_tagline TEXT DEFAULT '',
      primary_color TEXT NOT NULL DEFAULT '#1677ff',
      logo_url TEXT,
      mobile_logo_url TEXT,
      support_email TEXT DEFAULT '',
      storage_prefix TEXT NOT NULL DEFAULT 'app',
      updated_at TIMESTAMPTZ
    )
  `);
  await sqlExec(`INSERT INTO branding_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
}

function brandingRowToModel(row) {
  return {
    appName: row?.app_name || "App",
    appTagline: row?.app_tagline || "",
    primaryColor: row?.primary_color || "#1677ff",
    logoUrl: row?.logo_url || null,
    mobileLogoUrl: row?.mobile_logo_url || null,
    supportEmail: row?.support_email || "",
    storagePrefix: row?.storage_prefix || "app",
    updatedAt: row?.updated_at || null,
  };
}

export async function handleBrandingGet(_req, res) {
  const row = await sqlOne("SELECT * FROM branding_settings WHERE id = 1");
  return res.json({ ok: true, item: brandingRowToModel(row) });
}

export async function handleBrandingPut(req, res) {
  const next = {
    appName: String(req.body?.appName || "App").trim(),
    appTagline: String(req.body?.appTagline || "").trim(),
    primaryColor: String(req.body?.primaryColor || "#1677ff").trim(),
    logoUrl: req.body?.logoUrl || null,
    mobileLogoUrl: req.body?.mobileLogoUrl || null,
    supportEmail: String(req.body?.supportEmail || "").trim(),
    storagePrefix: String(req.body?.storagePrefix || "app").trim(),
    updatedAt: nowIso(),
  };

  await sqlExec(`
    INSERT INTO branding_settings (id, app_name, app_tagline, primary_color, logo_url, mobile_logo_url, support_email, storage_prefix, updated_at)
    VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8::timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      app_name = EXCLUDED.app_name,
      app_tagline = EXCLUDED.app_tagline,
      primary_color = EXCLUDED.primary_color,
      logo_url = EXCLUDED.logo_url,
      mobile_logo_url = EXCLUDED.mobile_logo_url,
      support_email = EXCLUDED.support_email,
      storage_prefix = EXCLUDED.storage_prefix,
      updated_at = EXCLUDED.updated_at
  `, [next.appName, next.appTagline, next.primaryColor, next.logoUrl, next.mobileLogoUrl, next.supportEmail, next.storagePrefix, next.updatedAt]);

  return res.json({ ok: true, item: next });
}
export {
  handleEmailDeliveryLogsList,
  handleEmailScenariosCreate,
  handleEmailScenariosDelete,
  handleEmailScenariosList,
  handleEmailScenariosUpdate,
  handleEmailTemplatesCreate,
  handleEmailTemplatesDelete,
  handleEmailTemplatesList,
  handleEmailTemplatesUpdate,
  mailEventDefinitions,
} from "./mailSettings.js";

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
