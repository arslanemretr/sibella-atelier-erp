import { sqlMany } from "./db.js";
import { sendDirectEmail } from "./mailer.js";

async function getYoneticiEmails() {
  const rows = await sqlMany(
    `SELECT email FROM users WHERE role = 'Yonetici' AND status = 'Aktif'`,
    [],
  ).catch(() => []);
  return rows.map((r) => r.email).filter(Boolean);
}

export async function sendSupplierLoginNotification({ supplierName, supplierEmail, ipAddress }) {
  try {
    const toEmails = await getYoneticiEmails();
    if (!toEmails.length) return;

    const now = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

    await sendDirectEmail({
      eventKey: "supplier_login",
      toEmails,
      subject: `Tedarikçi Girişi: ${supplierName}`,
      textBody: `${supplierName} (${supplierEmail}) sisteme giriş yaptı.\nTarih: ${now}\nIP: ${ipAddress || "-"}`,
      htmlBody: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <div style="background:#d86d5b;padding:18px 24px">
            <h2 style="margin:0;color:#fff;font-size:16px">Tedarikçi Sistem Girişi</h2>
          </div>
          <div style="padding:24px;background:#fff">
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:6px 0;color:#6b7280;width:140px">Tedarikçi</td><td style="padding:6px 0;font-weight:600">${supplierName}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">E-posta</td><td style="padding:6px 0">${supplierEmail}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Tarih / Saat</td><td style="padding:6px 0">${now}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">IP Adresi</td><td style="padding:6px 0">${ipAddress || "-"}</td></tr>
            </table>
          </div>
          <div style="padding:12px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af">
            Bu bildirim otomatik olarak gönderilmiştir.
          </div>
        </div>`,
    });
  } catch (err) {
    console.error("[notificationMailer] supplier login notification failed:", err?.message);
  }
}

export async function sendDeliveryCreatedNotification({ deliveryNo, supplierName, supplierEmail, date, lineCount }) {
  try {
    const toEmails = await getYoneticiEmails();
    if (!toEmails.length) return;

    const now = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
    const deliveryDate = date
      ? new Date(date).toLocaleDateString("tr-TR")
      : "-";

    await sendDirectEmail({
      eventKey: "delivery_created",
      toEmails,
      subject: `Yeni Teslimat Listesi: ${deliveryNo} — ${supplierName}`,
      textBody: `${supplierName} yeni bir teslimat listesi oluşturdu.\nNo: ${deliveryNo}\nTarih: ${deliveryDate}\nÜrün sayısı: ${lineCount}\nOluşturulma: ${now}`,
      htmlBody: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <div style="background:#1677ff;padding:18px 24px">
            <h2 style="margin:0;color:#fff;font-size:16px">Yeni Teslimat Listesi Oluşturuldu</h2>
          </div>
          <div style="padding:24px;background:#fff">
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:6px 0;color:#6b7280;width:140px">Teslimat No</td><td style="padding:6px 0;font-weight:600">${deliveryNo}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Tedarikçi</td><td style="padding:6px 0">${supplierName}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">E-posta</td><td style="padding:6px 0">${supplierEmail || "-"}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Teslimat Tarihi</td><td style="padding:6px 0">${deliveryDate}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Ürün Sayısı</td><td style="padding:6px 0">${lineCount} kalem</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Oluşturulma</td><td style="padding:6px 0">${now}</td></tr>
            </table>
          </div>
          <div style="padding:12px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af">
            Bu bildirim otomatik olarak gönderilmiştir.
          </div>
        </div>`,
    });
  } catch (err) {
    console.error("[notificationMailer] delivery created notification failed:", err?.message);
  }
}
