import nodemailer from "nodemailer";
import { getStoreValue } from "./db.js";

const SMTP_STORE_KEY = "sibella.erp.smtpSettings.v1";

function envBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

async function getSmtpSettingsFromStore() {
  const record = await getStoreValue(SMTP_STORE_KEY);
  const settings = record?.value;
  if (!settings || !settings.enabled) {
    return null;
  }

  return {
    host: String(settings.host || "").trim(),
    port: Number(settings.port || 587),
    secure: Boolean(settings.secure),
    username: String(settings.username || "").trim(),
    password: String(settings.password || ""),
    fromName: String(settings.fromName || "").trim(),
    fromEmail: String(settings.fromEmail || "").trim(),
  };
}

async function getSmtpSettings() {
  const storeSettings = await getSmtpSettingsFromStore();
  if (storeSettings) {
    return storeSettings;
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

export async function sendPasswordResetEmail({ toEmail, resetCode, expiresAt }) {
  const settings = await getSmtpSettings();
  if (!settings) {
    return { sent: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  const transporter = createTransportFromSettings(settings);
  const expiryText = expiresAt ? new Date(expiresAt).toLocaleString("tr-TR") : "-";

  const info = await transporter.sendMail({
    from: settings.fromName
      ? `"${settings.fromName}" <${settings.fromEmail}>`
      : settings.fromEmail,
    to: toEmail,
    subject: "Sibella Atelier - Sifre Yenileme Kodu",
    text: `Sifre yenileme kodunuz: ${resetCode}\nGecerlilik suresi: ${expiryText}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2 style="margin:0 0 12px;">Sifre Yenileme</h2>
        <p>Sifre yenileme kodunuz:</p>
        <p style="font-size: 22px; font-weight: 700; letter-spacing: 2px;">${resetCode}</p>
        <p>Bu kodun gecerlilik suresi: <strong>${expiryText}</strong></p>
      </div>
    `,
  });

  return {
    sent: Array.isArray(info?.accepted) && info.accepted.length > 0,
    accepted: info?.accepted || [],
    rejected: info?.rejected || [],
    messageId: info?.messageId || null,
  };
}

export async function sendSmtpTestEmail({ toEmail }) {
  const settings = await getSmtpSettings();
  if (!settings) {
    return { sent: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  const transporter = createTransportFromSettings(settings);
  const info = await transporter.sendMail({
    from: settings.fromName
      ? `"${settings.fromName}" <${settings.fromEmail}>`
      : settings.fromEmail,
    to: toEmail,
    subject: "Sibella Atelier - SMTP Test Maili",
    text: "SMTP ayarlariniz basariyla calisiyor. Bu bir test e-postasidir.",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2 style="margin:0 0 12px;">SMTP Test Basarili</h2>
        <p>SMTP ayarlariniz basariyla calisiyor.</p>
        <p>Bu bir test e-postasidir.</p>
      </div>
    `,
  });

  return {
    sent: Array.isArray(info?.accepted) && info.accepted.length > 0,
    accepted: info?.accepted || [],
    rejected: info?.rejected || [],
    messageId: info?.messageId || null,
  };
}
