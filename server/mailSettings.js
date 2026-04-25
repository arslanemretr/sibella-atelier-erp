import { sqlExec, sqlMany, sqlOne } from "./db.js";

const APP_NAME = "Sibella Atelier";
const emailScenarioRecipientModes = ["event", "fixed", "event_plus_fixed"];
const emailConditionOperators = [
  { value: "equals", label: "Esittir" },
  { value: "not_equals", label: "Esit Degildir" },
  { value: "contains", label: "Icerir" },
  { value: "not_contains", label: "Icermez" },
  { value: "starts_with", label: "Ile Baslar" },
  { value: "ends_with", label: "Ile Biter" },
  { value: "is_empty", label: "Bos" },
  { value: "is_not_empty", label: "Bos Degil" },
];

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function slugify(value, fallback) {
  const normalized = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function normalizeStatus(value) {
  return String(value || "").trim() === "Pasif" ? "Pasif" : "Aktif";
}

function parseJsonArray(value, fallback = []) {
  if (!value) {
    return [...fallback];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [...fallback];
  } catch {
    return [...fallback];
  }
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseEmailList(value) {
  if (Array.isArray(value)) {
    return uniqueStrings(value.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean));
  }
  return uniqueStrings(
    String(value || "")
      .split(/[\n,;]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function serializeEmailList(value) {
  return parseEmailList(value).join(", ");
}

function validateEmailAddress(value) {
  if (!value) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function validateEmailList(list) {
  return parseEmailList(list).every(validateEmailAddress);
}

function normalizeEventKey(value) {
  const supported = new Set(["password_reset_requested", "smtp_test_requested"]);
  const normalized = String(value || "").trim();
  return supported.has(normalized) ? normalized : null;
}

function normalizeRecipientMode(value) {
  return emailScenarioRecipientModes.includes(value) ? value : "event";
}

function normalizeMatchType(value) {
  return String(value || "").trim() === "any" ? "any" : "all";
}

function normalizeConditionOperator(value) {
  return emailConditionOperators.some((item) => item.value === value) ? value : "equals";
}

function normalizeConditionValue(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function normalizeAttachmentRecords(value) {
  const records = Array.isArray(value) ? value : parseJsonArray(value);
  return records
    .map((item) => ({
      name: String(item?.name || "").trim(),
      url: String(item?.url || "").trim(),
    }))
    .filter((item) => item.url);
}

const commonConditionFields = [
  {
    key: "toEmail",
    label: "Alici E-posta",
    operators: ["equals", "contains", "starts_with", "ends_with", "not_equals", "is_empty", "is_not_empty"],
  },
  {
    key: "role",
    label: "Rol",
    operators: ["equals", "not_equals", "is_empty", "is_not_empty"],
  },
];

export const mailEventDefinitions = [
  {
    key: "password_reset_requested",
    label: "Sifre Yenileme Istendi",
    variables: ["appName", "toEmail", "role", "resetCode", "expiresAt"],
    sampleContext: {
      appName: APP_NAME,
      toEmail: "kullanici@ornek.com",
      role: "Magaza",
      resetCode: "472981",
      expiresAt: "22.04.2026 14:30",
    },
    conditionFields: [
      ...commonConditionFields,
      {
        key: "resetCode",
        label: "Sifre Kodu",
        operators: ["equals", "contains", "starts_with", "ends_with", "not_equals", "is_empty", "is_not_empty"],
      },
      {
        key: "expiresAt",
        label: "Gecerlilik Tarihi",
        operators: ["equals", "contains", "starts_with", "ends_with", "not_equals", "is_empty", "is_not_empty"],
      },
    ],
  },
  {
    key: "smtp_test_requested",
    label: "SMTP Test Maili",
    variables: ["appName", "toEmail", "currentDateTime"],
    sampleContext: {
      appName: APP_NAME,
      toEmail: "test@ornek.com",
      currentDateTime: "22.04.2026 14:30",
    },
    conditionFields: [
      {
        key: "toEmail",
        label: "Alici E-posta",
        operators: ["equals", "contains", "starts_with", "ends_with", "not_equals", "is_empty", "is_not_empty"],
      },
      {
        key: "currentDateTime",
        label: "Tetiklenme Zamani",
        operators: ["equals", "contains", "starts_with", "ends_with", "not_equals", "is_empty", "is_not_empty"],
      },
    ],
  },
];

const eventDefinitionMap = new Map(mailEventDefinitions.map((item) => [item.key, item]));

const defaultTemplates = [
  {
    id: "mailtpl-password-reset-default",
    name: "Varsayilan Sifre Yenileme",
    code: "password-reset-default",
    eventKey: "password_reset_requested",
    description: "Sifre yenileme talebinde gonderilen varsayilan sistem sablonu.",
    subject: "{{appName}} - Sifre Yenileme Kodu",
    textBody: "Sifre yenileme kodunuz: {{resetCode}}\nGecerlilik suresi: {{expiresAt}}",
    htmlBody: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2 style="margin:0 0 12px;">Sifre Yenileme</h2>
        <p>Sifre yenileme kodunuz:</p>
        <p style="font-size:22px; font-weight:700; letter-spacing:2px;">{{resetCode}}</p>
        <p>Bu kodun gecerlilik suresi: <strong>{{expiresAt}}</strong></p>
      </div>
    `.trim(),
    status: "Aktif",
    isSystem: true,
  },
  {
    id: "mailtpl-smtp-test-default",
    name: "Varsayilan SMTP Test",
    code: "smtp-test-default",
    eventKey: "smtp_test_requested",
    description: "SMTP test gonderiminde kullanilan varsayilan sistem sablonu.",
    subject: "{{appName}} - SMTP Test Maili",
    textBody: "SMTP ayarlariniz basariyla calisiyor. Bu bir test e-postasidir.\nTarih: {{currentDateTime}}",
    htmlBody: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2 style="margin:0 0 12px;">SMTP Test Basarili</h2>
        <p>SMTP ayarlariniz basariyla calisiyor.</p>
        <p>Bu bir test e-postasidir.</p>
        <p>Tarih: <strong>{{currentDateTime}}</strong></p>
      </div>
    `.trim(),
    status: "Aktif",
    isSystem: true,
  },
];

const defaultScenarios = [
  {
    id: "mailscn-password-reset-default",
    name: "Varsayilan Sifre Yenileme Senaryosu",
    code: "password-reset-default-scenario",
    eventKey: "password_reset_requested",
    templateId: "mailtpl-password-reset-default",
    recipientMode: "event",
    fixedToEmails: "",
    ccEmails: "",
    bccEmails: "",
    matchType: "all",
    roleCondition: "",
    emailContains: "",
    conditions: [],
    attachments: [],
    sortOrder: 100,
    stopAfterMatch: true,
    status: "Aktif",
    isSystem: true,
  },
  {
    id: "mailscn-smtp-test-default",
    name: "Varsayilan SMTP Test Senaryosu",
    code: "smtp-test-default-scenario",
    eventKey: "smtp_test_requested",
    templateId: "mailtpl-smtp-test-default",
    recipientMode: "event",
    fixedToEmails: "",
    ccEmails: "",
    bccEmails: "",
    matchType: "all",
    roleCondition: "",
    emailContains: "",
    conditions: [],
    attachments: [],
    sortOrder: 100,
    stopAfterMatch: true,
    status: "Aktif",
    isSystem: true,
  },
];

function buildLegacyConditions(row) {
  const conditions = [];
  if (row?.role_condition) {
    conditions.push({
      field: "role",
      operator: "equals",
      value: String(row.role_condition || "").trim(),
    });
  }
  if (row?.email_contains) {
    conditions.push({
      field: "toEmail",
      operator: "contains",
      value: String(row.email_contains || "").trim(),
    });
  }
  return conditions;
}

function templateRowToModel(row) {
  const eventDefinition = eventDefinitionMap.get(row.event_key);
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    eventKey: row.event_key,
    eventLabel: eventDefinition?.label || row.event_key,
    description: row.description || "",
    subject: row.subject || "",
    textBody: row.text_body || "",
    htmlBody: row.html_body || "",
    status: row.status || "Aktif",
    isSystem: Boolean(row.is_system),
    variableKeys: eventDefinition?.variables || [],
    sampleContext: eventDefinition?.sampleContext || {},
    conditionFields: eventDefinition?.conditionFields || [],
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function scenarioRowToModel(row) {
  const eventDefinition = eventDefinitionMap.get(row.event_key);
  const storedConditions = parseJsonArray(row.conditions_json);
  const legacyConditions = buildLegacyConditions(row);
  const normalizedConditions = [...legacyConditions, ...storedConditions].map((item) => ({
    field: String(item?.field || "").trim(),
    operator: normalizeConditionOperator(item?.operator),
    value: normalizeConditionValue(item?.value),
  })).filter((item) => item.field);

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    eventKey: row.event_key,
    eventLabel: eventDefinition?.label || row.event_key,
    templateId: row.template_id || null,
    templateName: row.template_name || "",
    recipientMode: normalizeRecipientMode(row.recipient_mode),
    fixedToEmails: serializeEmailList(row.fixed_to_emails || row.recipient_email || ""),
    ccEmails: serializeEmailList(row.cc_emails || ""),
    bccEmails: serializeEmailList(row.bcc_emails || ""),
    matchType: normalizeMatchType(row.match_type),
    roleCondition: row.role_condition || "",
    emailContains: row.email_contains || "",
    conditions: normalizedConditions,
    attachments: normalizeAttachmentRecords(row.attachments_json),
    sortOrder: Number(row.sort_order || 100),
    stopAfterMatch: Boolean(row.stop_after_match),
    status: row.status || "Aktif",
    isSystem: Boolean(row.is_system),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function deliveryLogRowToModel(row) {
  const eventDefinition = eventDefinitionMap.get(row.event_key);
  return {
    id: row.id,
    eventKey: row.event_key,
    eventLabel: eventDefinition?.label || row.event_key,
    scenarioId: row.scenario_id || null,
    scenarioName: row.scenario_name || "-",
    templateId: row.template_id || null,
    templateName: row.template_name || "-",
    toEmails: serializeEmailList(row.to_emails || ""),
    ccEmails: serializeEmailList(row.cc_emails || ""),
    bccEmails: serializeEmailList(row.bcc_emails || ""),
    subject: row.subject || "",
    status: row.status || "Hata",
    messageId: row.message_id || null,
    errorMessage: row.error_message || "",
    attachmentCount: Number(row.attachment_count || 0),
    details: (() => {
      try {
        return row.details_json ? JSON.parse(row.details_json) : null;
      } catch {
        return null;
      }
    })(),
    createdAt: row.created_at || null,
  };
}

export function renderTemplateString(template, context) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = context?.[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function sanitizeConditions(value, eventKey, fallback = []) {
  const eventDefinition = eventDefinitionMap.get(eventKey);
  const allowedFields = new Set((eventDefinition?.conditionFields || []).map((item) => item.key));
  const source = Array.isArray(value) ? value : fallback;
  return source
    .map((item) => ({
      field: String(item?.field || "").trim(),
      operator: normalizeConditionOperator(item?.operator),
      value: normalizeConditionValue(item?.value),
    }))
    .filter((item) => allowedFields.has(item.field));
}

function sanitizeAttachmentRecords(value) {
  return normalizeAttachmentRecords(value);
}

function ensureValidEmailLists(payload) {
  const fields = [
    { key: "fixedToEmails", label: "Alici e-posta" },
    { key: "ccEmails", label: "CC e-posta" },
    { key: "bccEmails", label: "BCC e-posta" },
  ];
  for (const field of fields) {
    if (!validateEmailList(payload[field.key] || "")) {
      throw new Error(`${field.label} alaninda gecersiz bir e-posta var.`);
    }
  }
}

function sanitizeTemplatePayload(body, existingRecord = null) {
  const eventKey = normalizeEventKey(body?.eventKey || existingRecord?.event_key);
  if (!eventKey) {
    throw new Error("Gecerli bir mail olayi seciniz.");
  }

  const name = String(body?.name || existingRecord?.name || "").trim();
  const subject = String(body?.subject || existingRecord?.subject || "").trim();
  const textBody = String(body?.textBody ?? existingRecord?.text_body ?? "").trim();
  const htmlBody = String(body?.htmlBody ?? existingRecord?.html_body ?? "").trim();

  if (!name) {
    throw new Error("Sablon adi zorunludur.");
  }
  if (!subject) {
    throw new Error("Konu zorunludur.");
  }
  if (!textBody) {
    throw new Error("Duz metin icerigi zorunludur.");
  }
  if (!htmlBody) {
    throw new Error("HTML icerigi zorunludur.");
  }

  return {
    name,
    code: slugify(body?.code || name, existingRecord?.code || "mail-template"),
    eventKey,
    description: String(body?.description || existingRecord?.description || "").trim(),
    subject,
    textBody,
    htmlBody,
    status: normalizeStatus(body?.status || existingRecord?.status || "Aktif"),
  };
}

function sanitizeScenarioPayload(body, existingRecord = null) {
  const eventKey = normalizeEventKey(body?.eventKey || existingRecord?.event_key);
  if (!eventKey) {
    throw new Error("Gecerli bir senaryo olayi seciniz.");
  }

  const name = String(body?.name || existingRecord?.name || "").trim();
  const templateId = String(body?.templateId || existingRecord?.template_id || "").trim();
  if (!name) {
    throw new Error("Senaryo adi zorunludur.");
  }
  if (!templateId) {
    throw new Error("Sablon seciniz.");
  }

  const storedExisting = scenarioRowToModel(existingRecord || { event_key: eventKey });
  const payload = {
    name,
    code: slugify(body?.code || name, existingRecord?.code || "mail-scenario"),
    eventKey,
    templateId,
    recipientMode: normalizeRecipientMode(body?.recipientMode || existingRecord?.recipient_mode || "event"),
    fixedToEmails: serializeEmailList(body?.fixedToEmails ?? body?.recipientEmail ?? storedExisting.fixedToEmails),
    ccEmails: serializeEmailList(body?.ccEmails ?? storedExisting.ccEmails),
    bccEmails: serializeEmailList(body?.bccEmails ?? storedExisting.bccEmails),
    matchType: normalizeMatchType(body?.matchType || existingRecord?.match_type || "all"),
    roleCondition: String(body?.roleCondition || existingRecord?.role_condition || "").trim(),
    emailContains: String(body?.emailContains || existingRecord?.email_contains || "").trim(),
    conditions: sanitizeConditions(body?.conditions, eventKey, storedExisting.conditions),
    attachments: sanitizeAttachmentRecords(body?.attachments ?? storedExisting.attachments),
    sortOrder: Number(body?.sortOrder ?? existingRecord?.sort_order ?? 100),
    stopAfterMatch: body?.stopAfterMatch === undefined
      ? Boolean(existingRecord?.stop_after_match ?? true)
      : Boolean(body?.stopAfterMatch),
    status: normalizeStatus(body?.status || existingRecord?.status || "Aktif"),
  };

  ensureValidEmailLists(payload);
  if (payload.recipientMode !== "event" && parseEmailList(payload.fixedToEmails).length === 0) {
    throw new Error("Sabit alici modunda en az bir alici e-postasi girin.");
  }

  return payload;
}

export async function ensureMailSettingsSeeded() {
  for (const template of defaultTemplates) {
    const timestamp = nowIso();
    await sqlExec(`
      INSERT INTO email_templates (
        id, name, code, event_key, description, subject, text_body, html_body,
        status, is_system, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz)
      ON CONFLICT (code) DO NOTHING
    `, [
      template.id,
      template.name,
      template.code,
      template.eventKey,
      template.description,
      template.subject,
      template.textBody,
      template.htmlBody,
      template.status,
      template.isSystem,
      timestamp,
      timestamp,
    ]);
  }

  for (const scenario of defaultScenarios) {
    const timestamp = nowIso();
    await sqlExec(`
      INSERT INTO email_scenarios (
        id, name, code, event_key, template_id, recipient_mode, recipient_email,
        fixed_to_emails, cc_emails, bcc_emails, match_type, role_condition, email_contains,
        conditions_json, attachments_json, sort_order, stop_after_match, status, is_system, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, '', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::timestamptz, $20::timestamptz)
      ON CONFLICT (code) DO NOTHING
    `, [
      scenario.id,
      scenario.name,
      scenario.code,
      scenario.eventKey,
      scenario.templateId,
      scenario.recipientMode,
      scenario.fixedToEmails,
      scenario.ccEmails,
      scenario.bccEmails,
      scenario.matchType,
      scenario.roleCondition,
      scenario.emailContains,
      JSON.stringify(scenario.conditions),
      JSON.stringify(scenario.attachments),
      scenario.sortOrder,
      scenario.stopAfterMatch,
      scenario.status,
      scenario.isSystem,
      timestamp,
      timestamp,
    ]);
  }
}

export async function listEmailTemplates() {
  await ensureMailSettingsSeeded();
  const rows = await sqlMany(`
    SELECT *
    FROM email_templates
    ORDER BY is_system DESC, event_key ASC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, name ASC
  `);
  return rows.map(templateRowToModel);
}

export async function listEmailScenarios() {
  await ensureMailSettingsSeeded();
  const rows = await sqlMany(`
    SELECT sc.*, tpl.name AS template_name
    FROM email_scenarios sc
    LEFT JOIN email_templates tpl ON tpl.id = sc.template_id
    ORDER BY sc.event_key ASC, sc.sort_order ASC, sc.updated_at DESC NULLS LAST, sc.created_at DESC NULLS LAST, sc.name ASC
  `);
  return rows.map(scenarioRowToModel);
}

export async function listEmailDeliveryLogs() {
  const rows = await sqlMany(`
    SELECT *
    FROM email_delivery_logs
    ORDER BY created_at DESC NULLS LAST, id DESC
    LIMIT 250
  `);
  return rows.map(deliveryLogRowToModel);
}

async function findTemplateById(id) {
  if (!id) {
    return null;
  }
  return sqlOne("SELECT * FROM email_templates WHERE id = $1", [id]);
}

async function findScenarioById(id) {
  if (!id) {
    return null;
  }
  return sqlOne("SELECT * FROM email_scenarios WHERE id = $1", [id]);
}

function matchesOperator(actualValue, operator, expectedValue) {
  const actual = String(actualValue ?? "").trim().toLowerCase();
  const expected = String(expectedValue ?? "").trim().toLowerCase();

  switch (operator) {
    case "equals":
      return actual === expected;
    case "not_equals":
      return actual !== expected;
    case "contains":
      return actual.includes(expected);
    case "not_contains":
      return !actual.includes(expected);
    case "starts_with":
      return actual.startsWith(expected);
    case "ends_with":
      return actual.endsWith(expected);
    case "is_empty":
      return actual.length === 0;
    case "is_not_empty":
      return actual.length > 0;
    default:
      return actual === expected;
  }
}

function evaluateScenarioConditions(scenario, context) {
  const conditions = scenario.conditions || [];
  if (conditions.length === 0) {
    return true;
  }

  const results = conditions.map((condition) => matchesOperator(
    context?.[condition.field],
    condition.operator,
    condition.value,
  ));

  return scenario.matchType === "any"
    ? results.some(Boolean)
    : results.every(Boolean);
}

function buildRecipientLists(scenario, context) {
  const eventRecipients = parseEmailList(context?.toEmail);
  const fixedRecipients = parseEmailList(scenario.fixedToEmails);
  const ccEmails = parseEmailList(scenario.ccEmails);
  const bccEmails = parseEmailList(scenario.bccEmails);

  let toEmails = [];
  if (scenario.recipientMode === "fixed") {
    toEmails = fixedRecipients;
  } else if (scenario.recipientMode === "event_plus_fixed") {
    toEmails = uniqueStrings([...eventRecipients, ...fixedRecipients]);
  } else {
    toEmails = eventRecipients;
  }

  return {
    toEmails,
    ccEmails,
    bccEmails,
  };
}

export async function resolveEmailScenario(eventKey, context = {}) {
  await ensureMailSettingsSeeded();
  const rows = await sqlMany(`
    SELECT
      sc.*,
      tpl.id AS template_id_ref,
      tpl.name AS template_name,
      tpl.code AS template_code,
      tpl.event_key AS template_event_key,
      tpl.description AS template_description,
      tpl.subject AS template_subject,
      tpl.text_body AS template_text_body,
      tpl.html_body AS template_html_body,
      tpl.status AS template_status,
      tpl.is_system AS template_is_system,
      tpl.created_at AS template_created_at,
      tpl.updated_at AS template_updated_at
    FROM email_scenarios sc
    LEFT JOIN email_templates tpl ON tpl.id = sc.template_id
    WHERE sc.event_key = $1
      AND sc.status = 'Aktif'
    ORDER BY sc.sort_order ASC, sc.created_at ASC NULLS LAST, sc.id ASC
  `, [eventKey]);

  for (const row of rows) {
    if (!row.template_id || String(row.template_status || "Pasif").trim() !== "Aktif") {
      continue;
    }

    const scenario = scenarioRowToModel(row);
    if (!evaluateScenarioConditions(scenario, context)) {
      continue;
    }

    const recipients = buildRecipientLists(scenario, context);
    if (recipients.toEmails.length === 0) {
      continue;
    }

    return {
      scenario,
      template: templateRowToModel({
        id: row.template_id_ref,
        name: row.template_name,
        code: row.template_code,
        event_key: row.template_event_key,
        description: row.template_description,
        subject: row.template_subject,
        text_body: row.template_text_body,
        html_body: row.template_html_body,
        status: row.template_status,
        is_system: row.template_is_system,
        created_at: row.template_created_at,
        updated_at: row.template_updated_at,
      }),
      recipients,
    };
  }

  return null;
}

export async function buildEmailContent(eventKey, context = {}) {
  const resolved = await resolveEmailScenario(eventKey, context);
  const selectedTemplate = resolved?.template;

  if (!selectedTemplate) {
    return null;
  }

  return {
    subject: renderTemplateString(selectedTemplate.subject, context),
    textBody: renderTemplateString(selectedTemplate.textBody, context),
    htmlBody: renderTemplateString(selectedTemplate.htmlBody, context),
    templateName: selectedTemplate.name,
    templateId: selectedTemplate.id,
    scenarioName: resolved?.scenario?.name || null,
    scenarioId: resolved?.scenario?.id || null,
    toEmails: resolved?.recipients?.toEmails || [],
    ccEmails: resolved?.recipients?.ccEmails || [],
    bccEmails: resolved?.recipients?.bccEmails || [],
    attachments: resolved?.scenario?.attachments || [],
  };
}

export async function recordEmailDeliveryLog({
  eventKey,
  scenarioId,
  scenarioName,
  templateId,
  templateName,
  toEmails,
  ccEmails,
  bccEmails,
  subject,
  status,
  messageId,
  errorMessage,
  attachmentCount,
  details,
}) {
  await sqlExec(`
    INSERT INTO email_delivery_logs (
      id, event_key, scenario_id, scenario_name, template_id, template_name,
      to_emails, cc_emails, bcc_emails, subject, status, message_id,
      error_message, attachment_count, details_json, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::timestamptz)
  `, [
    createId("maillog"),
    eventKey,
    scenarioId || null,
    scenarioName || null,
    templateId || null,
    templateName || null,
    serializeEmailList(toEmails),
    serializeEmailList(ccEmails),
    serializeEmailList(bccEmails),
    subject || "",
    status || "Hata",
    messageId || null,
    errorMessage || null,
    Number(attachmentCount || 0),
    details ? JSON.stringify(details) : null,
    nowIso(),
  ]);
}

export async function handleEmailTemplatesList(_req, res) {
  return res.json({
    ok: true,
    items: await listEmailTemplates(),
    meta: {
      events: mailEventDefinitions,
      statuses: ["Aktif", "Pasif"],
    },
  });
}

export async function handleEmailTemplatesCreate(req, res) {
  try {
    await ensureMailSettingsSeeded();
    const payload = sanitizeTemplatePayload(req.body);
    const duplicate = await sqlOne("SELECT id FROM email_templates WHERE code = $1", [payload.code]);
    if (duplicate) {
      return res.status(400).json({ ok: false, message: "Bu sablon kodu zaten kullaniliyor." });
    }

    const now = nowIso();
    const id = createId("mailtpl");
    await sqlExec(`
      INSERT INTO email_templates (
        id, name, code, event_key, description, subject, text_body, html_body,
        status, is_system, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, $10::timestamptz, $11::timestamptz)
    `, [
      id,
      payload.name,
      payload.code,
      payload.eventKey,
      payload.description,
      payload.subject,
      payload.textBody,
      payload.htmlBody,
      payload.status,
      now,
      now,
    ]);

    return res.json({ ok: true, item: templateRowToModel(await findTemplateById(id)) });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error?.message || "Sablon kaydi basarisiz oldu." });
  }
}

export async function handleEmailTemplatesUpdate(req, res) {
  try {
    await ensureMailSettingsSeeded();
    const existing = await findTemplateById(req.params.id);
    if (!existing) {
      return res.status(404).json({ ok: false, message: "Sablon bulunamadi." });
    }

    const payload = sanitizeTemplatePayload(req.body, existing);
    const duplicate = await sqlOne("SELECT id FROM email_templates WHERE code = $1 AND id <> $2", [payload.code, existing.id]);
    if (duplicate) {
      return res.status(400).json({ ok: false, message: "Bu sablon kodu zaten kullaniliyor." });
    }

    const now = nowIso();
    await sqlExec(`
      UPDATE email_templates
      SET name = $2,
          code = $3,
          event_key = $4,
          description = $5,
          subject = $6,
          text_body = $7,
          html_body = $8,
          status = $9,
          updated_at = $10::timestamptz
      WHERE id = $1
    `, [
      existing.id,
      payload.name,
      payload.code,
      payload.eventKey,
      payload.description,
      payload.subject,
      payload.textBody,
      payload.htmlBody,
      payload.status,
      now,
    ]);

    return res.json({ ok: true, item: templateRowToModel(await findTemplateById(existing.id)) });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error?.message || "Sablon guncellenemedi." });
  }
}

export async function handleEmailTemplatesDelete(req, res) {
  await ensureMailSettingsSeeded();
  const existing = await findTemplateById(req.params.id);
  if (!existing) {
    return res.status(404).json({ ok: false, message: "Sablon bulunamadi." });
  }
  if (existing.is_system) {
    return res.status(400).json({ ok: false, message: "Sistem sablonlari silinemez." });
  }

  const scenarioUsage = await sqlOne("SELECT COUNT(*)::int AS count FROM email_scenarios WHERE template_id = $1", [existing.id]);
  if (Number(scenarioUsage?.count || 0) > 0) {
    return res.status(400).json({ ok: false, message: "Bu sablon bir senaryoda kullaniliyor." });
  }

  await sqlExec("DELETE FROM email_templates WHERE id = $1", [existing.id]);
  return res.json({ ok: true });
}

export async function handleEmailScenariosList(_req, res) {
  return res.json({
    ok: true,
    items: await listEmailScenarios(),
    meta: {
      events: mailEventDefinitions,
      statuses: ["Aktif", "Pasif"],
      recipientModes: [
        { value: "event", label: "Olay Alicisi" },
        { value: "fixed", label: "Sabit Alicilar" },
        { value: "event_plus_fixed", label: "Olay + Sabit Alicilar" },
      ],
      roles: ["Yonetici", "Magaza", "Muhasebe", "Tedarikci"],
      conditionOperators: emailConditionOperators,
    },
  });
}

export async function handleEmailScenariosCreate(req, res) {
  try {
    await ensureMailSettingsSeeded();
    const payload = sanitizeScenarioPayload(req.body);
    const duplicate = await sqlOne("SELECT id FROM email_scenarios WHERE code = $1", [payload.code]);
    if (duplicate) {
      return res.status(400).json({ ok: false, message: "Bu senaryo kodu zaten kullaniliyor." });
    }

    const template = await findTemplateById(payload.templateId);
    if (!template) {
      return res.status(400).json({ ok: false, message: "Secilen sablon bulunamadi." });
    }
    if (template.event_key !== payload.eventKey) {
      return res.status(400).json({ ok: false, message: "Sablon ve senaryo ayni mail olayina bagli olmalidir." });
    }

    const now = nowIso();
    const id = createId("mailscn");
    await sqlExec(`
      INSERT INTO email_scenarios (
        id, name, code, event_key, template_id, recipient_mode, recipient_email,
        fixed_to_emails, cc_emails, bcc_emails, match_type, role_condition, email_contains,
        conditions_json, attachments_json, sort_order, stop_after_match, status, is_system, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, '', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, FALSE, $18::timestamptz, $19::timestamptz)
    `, [
      id,
      payload.name,
      payload.code,
      payload.eventKey,
      payload.templateId,
      payload.recipientMode,
      payload.fixedToEmails,
      payload.ccEmails,
      payload.bccEmails,
      payload.matchType,
      payload.roleCondition,
      payload.emailContains,
      JSON.stringify(payload.conditions),
      JSON.stringify(payload.attachments),
      payload.sortOrder,
      payload.stopAfterMatch,
      payload.status,
      now,
      now,
    ]);

    return res.json({
      ok: true,
      item: scenarioRowToModel(await sqlOne(`
        SELECT sc.*, tpl.name AS template_name
        FROM email_scenarios sc
        LEFT JOIN email_templates tpl ON tpl.id = sc.template_id
        WHERE sc.id = $1
      `, [id])),
    });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error?.message || "Senaryo kaydi basarisiz oldu." });
  }
}

export async function handleEmailScenariosUpdate(req, res) {
  try {
    await ensureMailSettingsSeeded();
    const existing = await findScenarioById(req.params.id);
    if (!existing) {
      return res.status(404).json({ ok: false, message: "Senaryo bulunamadi." });
    }

    const payload = sanitizeScenarioPayload(req.body, existing);
    const duplicate = await sqlOne("SELECT id FROM email_scenarios WHERE code = $1 AND id <> $2", [payload.code, existing.id]);
    if (duplicate) {
      return res.status(400).json({ ok: false, message: "Bu senaryo kodu zaten kullaniliyor." });
    }

    const template = await findTemplateById(payload.templateId);
    if (!template) {
      return res.status(400).json({ ok: false, message: "Secilen sablon bulunamadi." });
    }
    if (template.event_key !== payload.eventKey) {
      return res.status(400).json({ ok: false, message: "Sablon ve senaryo ayni mail olayina bagli olmalidir." });
    }

    const now = nowIso();
    await sqlExec(`
      UPDATE email_scenarios
      SET name = $2,
          code = $3,
          event_key = $4,
          template_id = $5,
          recipient_mode = $6,
          recipient_email = '',
          fixed_to_emails = $7,
          cc_emails = $8,
          bcc_emails = $9,
          match_type = $10,
          role_condition = $11,
          email_contains = $12,
          conditions_json = $13,
          attachments_json = $14,
          sort_order = $15,
          stop_after_match = $16,
          status = $17,
          updated_at = $18::timestamptz
      WHERE id = $1
    `, [
      existing.id,
      payload.name,
      payload.code,
      payload.eventKey,
      payload.templateId,
      payload.recipientMode,
      payload.fixedToEmails,
      payload.ccEmails,
      payload.bccEmails,
      payload.matchType,
      payload.roleCondition,
      payload.emailContains,
      JSON.stringify(payload.conditions),
      JSON.stringify(payload.attachments),
      payload.sortOrder,
      payload.stopAfterMatch,
      payload.status,
      now,
    ]);

    return res.json({
      ok: true,
      item: scenarioRowToModel(await sqlOne(`
        SELECT sc.*, tpl.name AS template_name
        FROM email_scenarios sc
        LEFT JOIN email_templates tpl ON tpl.id = sc.template_id
        WHERE sc.id = $1
      `, [existing.id])),
    });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error?.message || "Senaryo guncellenemedi." });
  }
}

export async function handleEmailScenariosDelete(req, res) {
  await ensureMailSettingsSeeded();
  const existing = await findScenarioById(req.params.id);
  if (!existing) {
    return res.status(404).json({ ok: false, message: "Senaryo bulunamadi." });
  }
  if (existing.is_system) {
    return res.status(400).json({ ok: false, message: "Sistem senaryolari silinemez." });
  }

  await sqlExec("DELETE FROM email_scenarios WHERE id = $1", [existing.id]);
  return res.json({ ok: true });
}

export async function handleEmailDeliveryLogsList(_req, res) {
  return res.json({
    ok: true,
    items: await listEmailDeliveryLogs(),
  });
}
