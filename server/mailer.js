import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import { sqlOne } from "./db.js";
import { buildEmailContent, recordEmailDeliveryLog } from "./mailSettings.js";

function envBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

async function getSmtpSettingsFromTable() {
  const row = await sqlOne("SELECT * FROM smtp_settings WHERE id = 1");
  if (!row || !row.enabled) {
    return null;
  }

  return {
    host: String(row.host || "").trim(),
    port: Number(row.port || 587),
    secure: Boolean(row.secure),
    username: String(row.username || "").trim(),
    password: String(row.password || ""),
    fromName: String(row.from_name || "").trim(),
    fromEmail: String(row.from_email || "").trim(),
  };
}

async function getSmtpSettings() {
  const dbSettings = await getSmtpSettingsFromTable();
  if (dbSettings) {
    return dbSettings;
  }

  if (!process.env.SMTP_HOST) {
    return null;
  }

  return {
    host: String(process.env.SMTP_HOST || "").trim(),
    port: Number(process.env.SMTP_PORT || 587),
    secure: envBool(process.env.SMTP_SECURE, false),
    username: String(process.env.SMTP_USERNAME || "").trim(),
    password: String(process.env.SMTP_PASSWORD || ""),
    fromName: String(process.env.SMTP_FROM_NAME || "Sibella Atelier").trim(),
    fromEmail: String(process.env.SMTP_FROM_EMAIL || process.env.SMTP_USERNAME || "").trim(),
  };
}

function createTransportFromSettings(settings) {
  return nodemailer.createTransport({
    host: settings.host,
    port: Number(settings.port || 587),
    secure: Boolean(settings.secure),
    auth: {
      user: settings.username,
      pass: settings.password,
    },
  });
}

function getAssetRootPath() {
  return path.resolve(String(process.env.ASSET_STORAGE_PATH || path.resolve(process.cwd(), "data/assets")).trim());
}

function resolveAttachmentFile(attachment) {
  const url = String(attachment?.url || "").trim();
  if (!url.startsWith("/api/assets/")) {
    return null;
  }

  const relativePath = url.replace(/^\/api\/assets\//, "");
  const assetRoot = getAssetRootPath();
  const resolvedPath = path.resolve(assetRoot, relativePath);
  if (!resolvedPath.startsWith(assetRoot)) {
    return null;
  }
  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  return {
    filename: String(attachment?.name || path.basename(resolvedPath)).trim() || path.basename(resolvedPath),
    path: resolvedPath,
  };
}

function resolveAttachments(attachments) {
  return (attachments || [])
    .map(resolveAttachmentFile)
    .filter(Boolean);
}

async function sendManagedEmail({ eventKey, context }) {
  const settings = await getSmtpSettings();
  if (!settings) {
    return { sent: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  const finalContext = {
    appName: settings.fromName || "Sibella Atelier",
    ...context,
  };

  const content = await buildEmailContent(eventKey, finalContext);
  if (!content?.subject || !content?.textBody || !content?.htmlBody || !Array.isArray(content?.toEmails) || content.toEmails.length === 0) {
    await recordEmailDeliveryLog({
      eventKey,
      scenarioId: content?.scenarioId || null,
      scenarioName: content?.scenarioName || null,
      templateId: content?.templateId || null,
      templateName: content?.templateName || null,
      toEmails: content?.toEmails || [],
      ccEmails: content?.ccEmails || [],
      bccEmails: content?.bccEmails || [],
      subject: content?.subject || "",
      status: "Hata",
      errorMessage: "Aktif ve eslesen bir mail senaryosu bulunamadi.",
      attachmentCount: 0,
      details: { reason: "EMAIL_SCENARIO_NOT_FOUND" },
    });
    return { sent: false, reason: "EMAIL_SCENARIO_NOT_FOUND" };
  }

  const transporter = createTransportFromSettings(settings);
  const resolvedAttachments = resolveAttachments(content.attachments);

  try {
    const info = await transporter.sendMail({
      from: settings.fromName
        ? `"${settings.fromName}" <${settings.fromEmail}>`
        : settings.fromEmail,
      to: content.toEmails,
      cc: content.ccEmails.length ? content.ccEmails : undefined,
      bcc: content.bccEmails.length ? content.bccEmails : undefined,
      subject: content.subject,
      text: content.textBody,
      html: content.htmlBody,
      attachments: resolvedAttachments.length ? resolvedAttachments : undefined,
    });

    const sent = Array.isArray(info?.accepted) && info.accepted.length > 0;
    await recordEmailDeliveryLog({
      eventKey,
      scenarioId: content.scenarioId,
      scenarioName: content.scenarioName,
      templateId: content.templateId,
      templateName: content.templateName,
      toEmails: content.toEmails,
      ccEmails: content.ccEmails,
      bccEmails: content.bccEmails,
      subject: content.subject,
      status: sent ? "Basarili" : "Reddedildi",
      messageId: info?.messageId || null,
      errorMessage: sent ? null : "Mail alici tarafindan kabul edilmedi.",
      attachmentCount: resolvedAttachments.length,
      details: {
        accepted: info?.accepted || [],
        rejected: info?.rejected || [],
      },
    });

    return {
      sent,
      accepted: info?.accepted || [],
      rejected: info?.rejected || [],
      messageId: info?.messageId || null,
      toEmails: content.toEmails,
      ccEmails: content.ccEmails,
      bccEmails: content.bccEmails,
      attachmentCount: resolvedAttachments.length,
    };
  } catch (error) {
    await recordEmailDeliveryLog({
      eventKey,
      scenarioId: content.scenarioId,
      scenarioName: content.scenarioName,
      templateId: content.templateId,
      templateName: content.templateName,
      toEmails: content.toEmails,
      ccEmails: content.ccEmails,
      bccEmails: content.bccEmails,
      subject: content.subject,
      status: "Hata",
      errorMessage: error?.message || "Mail gonderilemedi.",
      attachmentCount: resolvedAttachments.length,
      details: { reason: "SEND_FAILED" },
    });
    throw error;
  }
}

export async function isSmtpConfigured() {
  const settings = await getSmtpSettings();
  return Boolean(
    settings &&
    settings.host &&
    settings.port &&
    settings.username &&
    settings.password &&
    settings.fromEmail,
  );
}

export async function sendPasswordResetEmail({ toEmail, resetCode, expiresAt, role }) {
  const expiryText = expiresAt ? new Date(expiresAt).toLocaleString("tr-TR") : "-";
  return sendManagedEmail({
    eventKey: "password_reset_requested",
    context: {
      toEmail,
      role,
      resetCode,
      expiresAt: expiryText,
    },
  });
}

export async function sendSmtpTestEmail({ toEmail }) {
  return sendManagedEmail({
    eventKey: "smtp_test_requested",
    context: {
      toEmail,
      currentDateTime: new Date().toLocaleString("tr-TR"),
    },
  });
}
