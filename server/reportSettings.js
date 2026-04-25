import { sqlExec, sqlOne } from "./db.js";
import { sendDirectEmail } from "./mailer.js";

function getDefaultConsolidatedEarningsHtmlTemplate() {
  return `
<div style="margin:0;padding:32px 20px;background:linear-gradient(180deg,#fff8f5 0%,#ffe8e0 100%);font-family:Arial,sans-serif;color:#43302c;">
  <div style="max-width:820px;margin:0 auto;background:#ffffff;border:1px solid #f2d8d0;border-radius:28px;overflow:hidden;box-shadow:0 24px 60px rgba(216,109,91,0.16);">
    <div style="padding:28px 32px 24px;background:linear-gradient(135deg,#f4a08d 0%,#d96f5d 100%);color:#ffffff;">
      <table role="presentation" style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top;">
            <img src="{{logoUrl}}" alt="Sibella Atelier" style="height:54px;max-width:220px;object-fit:contain;display:block;filter:brightness(0) invert(1);" />
            <div style="margin-top:18px;font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.88;">Sibella Atelier</div>
            <h1 style="margin:10px 0 0;font-size:30px;line-height:1.2;font-weight:700;">Toplu Hakedis Raporu</h1>
            <p style="margin:12px 0 0;font-size:14px;line-height:1.6;max-width:520px;opacity:0.95;">
              {{periodLabel}} donemine ait tum tedarikci satis, komisyon ve hakedis ozetleri bu raporda derlenmistir.
            </p>
          </td>
          <td style="width:170px;vertical-align:top;text-align:right;">
            <div style="display:inline-block;padding:12px 14px;border-radius:18px;background:rgba(255,255,255,0.18);font-size:12px;line-height:1.5;text-align:left;">
              <div style="opacity:0.8;text-transform:uppercase;letter-spacing:1px;">Olusturma</div>
              <div style="margin-top:6px;font-size:14px;font-weight:700;">{{generatedAt}}</div>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding:28px 32px 32px;">
      <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:12px 12px;margin:0 0 18px;">
        <tr>
          <td style="width:50%;padding:18px 20px;border-radius:20px;background:#fff4ef;border:1px solid #f5d2c8;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.4px;color:#a56b60;">Tedarikci Sayisi</div>
            <div style="margin-top:10px;font-size:28px;font-weight:700;color:#c75f4d;">{{supplierCount}}</div>
          </td>
          <td style="width:50%;padding:18px 20px;border-radius:20px;background:#fff8ea;border:1px solid #f5dfb4;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.4px;color:#a07d2d;">Toplam Satis</div>
            <div style="margin-top:10px;font-size:28px;font-weight:700;color:#8d6820;">{{grossTotal}}</div>
          </td>
        </tr>
        <tr>
          <td style="width:50%;padding:18px 20px;border-radius:20px;background:#eef6ff;border:1px solid #cde1f8;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.4px;color:#5b7898;">Net Satis</div>
            <div style="margin-top:10px;font-size:26px;font-weight:700;color:#365d86;">{{netTotal}}</div>
          </td>
          <td style="width:50%;padding:18px 20px;border-radius:20px;background:#edf8ef;border:1px solid #cde7d1;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.4px;color:#53795b;">Toplam Hakedis</div>
            <div style="margin-top:10px;font-size:26px;font-weight:700;color:#2f7d46;">{{earningsTotal}}</div>
          </td>
        </tr>
      </table>

      <div style="margin:0 0 18px;padding:16px 18px;border-radius:18px;background:#fff6f2;border:1px dashed #ebb8aa;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.4px;color:#a56b60;">Toplam Komisyon</div>
        <div style="margin-top:8px;font-size:22px;font-weight:700;color:#b45443;">{{commissionTotal}}</div>
      </div>

      <div style="border:1px solid #f1dfd9;border-radius:22px;overflow:hidden;">
        <table role="presentation" style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#fff4ef;">
              <th style="padding:14px 16px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:1.2px;color:#8b6b64;">Tedarikci</th>
              <th style="padding:14px 16px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:1.2px;color:#8b6b64;">Donem</th>
              <th style="padding:14px 16px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:1.2px;color:#8b6b64;">Toplam Satis</th>
              <th style="padding:14px 16px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:1.2px;color:#8b6b64;">Net Satis</th>
              <th style="padding:14px 16px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:1.2px;color:#8b6b64;">Komisyon</th>
              <th style="padding:14px 16px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:1.2px;color:#8b6b64;">Hakedis</th>
            </tr>
          </thead>
          <tbody>
            {{reportRowsHtml}}
          </tbody>
        </table>
      </div>

      <p style="margin:18px 0 0;font-size:12px;line-height:1.7;color:#8c7a76;">
        Bu e-posta sistem tarafindan otomatik olusturulmustur. Rapor icerigi <strong>{{periodLabel}}</strong> donemine ait konsolide hakedis ozetidir.
      </p>
    </div>
  </div>
</div>`.trim();
}

function isLegacyConsolidatedTemplate(htmlTemplate) {
  const html = String(htmlTemplate || "");
  if (!html) {
    return true;
  }
  return (
    html.includes("<p>Sibella Atelier</p>") ||
    html.includes("{{reportRowsHtml}} TedarikciDonemToplam SatisNet SatisKomisyonHakedis") ||
    html.includes("Toplu Hakedis Raporu</h1><p>{{periodLabel}} donemi raporu {{generatedAt}} tarihinde")
  );
}

const REPORT_DEFINITIONS = {
  "consolidated-earnings": {
    key: "consolidated-earnings",
    name: "Toplu Hakedis Raporu",
    description: "Yonetici hakedis ekranindaki donemsel toplamlarin planli mail dagitimi icin kullanilir.",
    defaultValues: {
      enabled: false,
      frequency: "monthly",
      dayOfMonth: 2,
      sendHour: 9,
      sendMinute: 0,
      periodOffsetMonths: -1,
      recipientEmails: "",
      subjectTemplate: "Toplu Hakedis Raporu - {{periodLabel}}",
      htmlTemplate: getDefaultConsolidatedEarningsHtmlTemplate(),
      lastRunAt: null,
      lastRunStatus: "",
      updatedAt: null,
    },
  },
};

function nowIso() {
  return new Date().toISOString();
}

function getReportDefinition(reportKey) {
  return REPORT_DEFINITIONS[reportKey] || null;
}

function clampInteger(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}

function reportScheduleRowToModel(reportKey, row) {
  const definition = getReportDefinition(reportKey);
  const defaults = definition?.defaultValues || {};

  const normalizedHtmlTemplate = isLegacyConsolidatedTemplate(row?.html_template)
    ? defaults.htmlTemplate || getDefaultConsolidatedEarningsHtmlTemplate()
    : (row?.html_template || defaults.htmlTemplate || "");

  return {
    reportKey,
    name: definition?.name || reportKey,
    enabled: row ? Boolean(row.enabled) : Boolean(defaults.enabled),
    frequency: row?.frequency || defaults.frequency || "monthly",
    dayOfMonth: row ? Number(row.day_of_month || defaults.dayOfMonth || 2) : Number(defaults.dayOfMonth || 2),
    sendHour: row ? Number(row.send_hour ?? defaults.sendHour ?? 9) : Number(defaults.sendHour ?? 9),
    sendMinute: row ? Number(row.send_minute ?? defaults.sendMinute ?? 0) : Number(defaults.sendMinute ?? 0),
    periodOffsetMonths: row ? Number(row.period_offset_months ?? defaults.periodOffsetMonths ?? -1) : Number(defaults.periodOffsetMonths ?? -1),
    recipientEmails: row?.recipient_emails || defaults.recipientEmails || "",
    subjectTemplate: row?.subject_template || defaults.subjectTemplate || "",
    htmlTemplate: normalizedHtmlTemplate,
    lastRunAt: row?.last_run_at || defaults.lastRunAt || null,
    lastRunStatus: row?.last_run_status || defaults.lastRunStatus || "",
    updatedAt: row?.updated_at || defaults.updatedAt || null,
  };
}

export async function handleReportScheduleGet(req, res) {
  const reportKey = String(req.params?.reportKey || "").trim();
  const definition = getReportDefinition(reportKey);
  if (!definition) {
    return res.status(404).json({ ok: false, message: "Rapor tanimi bulunamadi." });
  }

  const row = await sqlOne("SELECT * FROM report_schedules WHERE report_key = $1", [reportKey]);
  return res.json({
    ok: true,
    item: reportScheduleRowToModel(reportKey, row),
    meta: {
      definition,
    },
  });
}

export async function handleReportSchedulePut(req, res) {
  const reportKey = String(req.params?.reportKey || "").trim();
  const definition = getReportDefinition(reportKey);
  if (!definition) {
    return res.status(404).json({ ok: false, message: "Rapor tanimi bulunamadi." });
  }

  const nextValues = {
    reportKey,
    name: definition.name,
    enabled: Boolean(req.body?.enabled),
    frequency: "monthly",
    dayOfMonth: clampInteger(req.body?.dayOfMonth, definition.defaultValues.dayOfMonth, 1, 31),
    sendHour: clampInteger(req.body?.sendHour, definition.defaultValues.sendHour, 0, 23),
    sendMinute: clampInteger(req.body?.sendMinute, definition.defaultValues.sendMinute, 0, 59),
    periodOffsetMonths: clampInteger(req.body?.periodOffsetMonths, definition.defaultValues.periodOffsetMonths, -12, 0),
    recipientEmails: String(req.body?.recipientEmails || "").trim(),
    subjectTemplate: String(req.body?.subjectTemplate || definition.defaultValues.subjectTemplate).trim() || definition.defaultValues.subjectTemplate,
    htmlTemplate: String(req.body?.htmlTemplate || definition.defaultValues.htmlTemplate).trim() || definition.defaultValues.htmlTemplate,
    updatedAt: nowIso(),
  };

  await sqlExec(`
    INSERT INTO report_schedules (
      report_key,
      name,
      enabled,
      frequency,
      day_of_month,
      send_hour,
      send_minute,
      period_offset_months,
      recipient_emails,
      subject_template,
      html_template,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz)
    ON CONFLICT (report_key) DO UPDATE SET
      name = EXCLUDED.name,
      enabled = EXCLUDED.enabled,
      frequency = EXCLUDED.frequency,
      day_of_month = EXCLUDED.day_of_month,
      send_hour = EXCLUDED.send_hour,
      send_minute = EXCLUDED.send_minute,
      period_offset_months = EXCLUDED.period_offset_months,
      recipient_emails = EXCLUDED.recipient_emails,
      subject_template = EXCLUDED.subject_template,
      html_template = EXCLUDED.html_template,
      updated_at = EXCLUDED.updated_at
  `, [
    nextValues.reportKey,
    nextValues.name,
    nextValues.enabled,
    nextValues.frequency,
    nextValues.dayOfMonth,
    nextValues.sendHour,
    nextValues.sendMinute,
    nextValues.periodOffsetMonths,
    nextValues.recipientEmails,
    nextValues.subjectTemplate,
    nextValues.htmlTemplate,
    nextValues.updatedAt,
  ]);

  return res.json({
    ok: true,
    item: {
      ...nextValues,
      lastRunAt: null,
      lastRunStatus: "",
    },
  });
}

function parseEmailList(value) {
  return String(value || "")
    .split(/[\n,;]+/)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

export async function handleConsolidatedEarningsSendNow(req, res) {
  const toEmails = Array.isArray(req.body?.toEmails) ? req.body.toEmails : [];
  const subject = String(req.body?.subject || "").trim();
  const htmlBody = String(req.body?.htmlBody || "").trim();
  const textBody = String(req.body?.textBody || "").trim();
  const periodKey = String(req.body?.periodKey || "").trim();

  if (!toEmails.length || !subject || !htmlBody || !textBody || !periodKey) {
    return res.status(400).json({
      ok: false,
      message: "Mail gonderimi icin alici, konu, icerik ve donem bilgisi zorunludur.",
    });
  }

  const normalizedToEmails = parseEmailList(toEmails.join(","));
  if (!normalizedToEmails.length) {
    return res.status(400).json({
      ok: false,
      message: "Gecerli alici mail adresi bulunamadi.",
    });
  }

  try {
    const result = await sendDirectEmail({
      eventKey: "report_consolidated_earnings_manual",
      toEmails: normalizedToEmails,
      subject,
      textBody,
      htmlBody,
      details: {
        reportKey: "consolidated-earnings",
        periodKey,
      },
    });

    if (!result?.sent) {
      return res.status(400).json({
        ok: false,
        message: "Mail gonderilemedi. SMTP ayarlarinizi kontrol edin.",
      });
    }

    return res.json({
      ok: true,
      message: "Toplu hakedis raporu gonderildi.",
      messageId: result.messageId,
      accepted: result.accepted || [],
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error?.message || "Toplu hakedis raporu gonderilemedi.",
    });
  }
}
