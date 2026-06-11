import { sendManagedEmail } from "./mailer.js";

export function sendSupplierLoginNotification({ supplierName, supplierEmail, ipAddress }) {
  const loginAt = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  void sendManagedEmail({
    eventKey: "supplier_login",
    context: {
      supplierName: supplierName || "-",
      supplierEmail: supplierEmail || "-",
      ipAddress: ipAddress || "-",
      loginAt,
    },
  });
}

export function sendDeliveryCreatedNotification({ deliveryNo, supplierName, supplierEmail, date, lineCount }) {
  const deliveryDate = date ? new Date(date).toLocaleDateString("tr-TR") : "-";
  const createdAt = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  void sendManagedEmail({
    eventKey: "delivery_created",
    context: {
      supplierName: supplierName || "-",
      supplierEmail: supplierEmail || "-",
      deliveryNo: deliveryNo || "-",
      deliveryDate,
      lineCount: String(lineCount ?? 0),
      createdAt,
    },
  });
}
