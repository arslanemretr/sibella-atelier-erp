import { mutateResourceSync, requestCollection, requestCollectionSync } from "./apiClient";
import { getStoreById, listStoresFresh } from "./storesData";
import { jsPDF, ensurePdfFont, drawPdfLogo, drawShipmentTableHeader, formatPdfDate, formatPdfMoney } from "./pdfUtils";

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function seedShipments() {
  return [];
}

function formatMoney(value, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function loadStore() {
  return requestCollectionSync("/api/store-shipments", seedShipments());
}

function normalizeShipmentLine(line, index, shipmentId) {
  return {
    id: line.id || `${shipmentId}-line-${index + 1}`,
    productId: line.productId || null,
    isManualProduct: Boolean(line.isManualProduct),
    image: line.image || "",
    name: line.name || "",
    code: line.code || "",
    salePrice: Number(line.salePrice || 0),
    saleCurrency: line.saleCurrency || "TRY",
    quantity: Number(line.quantity || 0),
    description: line.description || "",
  };
}

function enrichShipment(item) {
  const totalQuantity = (item.lines || []).reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  const totalAmount = (item.lines || []).reduce((sum, line) => sum + (Number(line.quantity || 0) * Number(line.salePrice || 0)), 0);
  return {
    ...item,
    lineCount: item.lineCount ?? (item.lines?.length || 0),
    totalQuantity,
    totalAmount,
    totalAmountDisplay: formatMoney(totalAmount, "TRY"),
  };
}

function buildNextShipmentNo(records, storeId) {
  const store = getStoreById(storeId);
  const storeCode = String(store?.code || "GEN").toUpperCase();
  const nextNumber = records.filter((item) => item.storeId === storeId).length + 1;
  return `GND-${storeCode}-${String(nextNumber).padStart(4, "0")}`;
}

function normalizeShipment(values, existingRecord) {
  const shipmentId = existingRecord?.id || createId("storeship");
  const records = loadStore();
  const storeId = values.storeId || existingRecord?.storeId || null;
  return {
    id: shipmentId,
    shipmentNo: existingRecord?.shipmentNo || values.shipmentNo || buildNextShipmentNo(records, storeId),
    storeId,
    date: values.date || existingRecord?.date || new Date().toISOString().slice(0, 10),
    shippingMethod: values.shippingMethod || existingRecord?.shippingMethod || "Kargo",
    trackingNo: values.trackingNo || existingRecord?.trackingNo || "",
    note: values.note || existingRecord?.note || "",
    status: values.status || existingRecord?.status || "Taslak",
    createdBy: values.createdBy || existingRecord?.createdBy || null,
    lines: (values.lines || existingRecord?.lines || []).map((line, index) => normalizeShipmentLine(line, index, shipmentId)),
    createdAt: existingRecord?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

export function listStoreShipments() {
  return loadStore().map(enrichShipment);
}

export async function listStoreShipmentsFresh() {
  const records = await requestCollection("/api/store-shipments", seedShipments());
  return records.map(enrichShipment);
}

export function getStoreShipmentById(shipmentId) {
  const shipment = loadStore().find((item) => item.id === shipmentId);
  return shipment ? enrichShipment(shipment) : null;
}

export function createStoreShipment(values) {
  return enrichShipment(mutateResourceSync("POST", "/api/store-shipments", normalizeShipment(values)));
}

export function updateStoreShipment(shipmentId, values) {
  return enrichShipment(
    mutateResourceSync("PUT", `/api/store-shipments/${encodeURIComponent(shipmentId)}`, normalizeShipment(values, getStoreShipmentById(shipmentId))),
  );
}

export function sendStoreShipment(shipmentId) {
  return enrichShipment(mutateResourceSync("POST", `/api/store-shipments/${encodeURIComponent(shipmentId)}/send`, {}));
}

export async function createStoreShipmentPdf(shipmentOrId) {
  const record =
    typeof shipmentOrId === "string"
      ? enrichShipment(loadStore().find((s) => s.id === shipmentOrId) || {})
      : enrichShipment(shipmentOrId);

  if (!record || !record.id) {
    return null;
  }

  const doc = new jsPDF();
  await ensurePdfFont(doc);
  let currentY = 18;

  doc.setFillColor(250, 242, 239);
  doc.roundedRect(14, 12, 182, 30, 3, 3, "F");
  await drawPdfLogo(doc);
  doc.setFontSize(18);
  doc.setTextColor(36, 36, 36);
  doc.text("Magaza Gonderi Formu", 105, 28, { align: "center" });
  doc.setFontSize(11);
  currentY = 50;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(220, 226, 235);
  doc.roundedRect(14, currentY, 182, 52, 3, 3, "FD");
  currentY += 8;

  const headerRows = [
    `Gonderi No: ${record.shipmentNo || "-"}`,
    `Magaza: ${record.storeName || "-"}`,
    `Tarih: ${formatPdfDate(record.date)}`,
    `Durum: ${record.status || "-"}`,
    `Gonderim Sekli: ${record.shippingMethod || "-"}`,
    `Kargo Takip No: ${record.trackingNo || "-"}`,
    `Toplam Kalem: ${record.lineCount || 0}`,
    `Toplam Adet: ${record.totalQuantity || 0}`,
    `Not: ${record.note || "-"}`,
    `Toplam Tutar: ${record.totalAmountDisplay || "-"}`,
  ];

  headerRows.forEach((row, index) => {
    const x = index % 2 === 0 ? 18 : 108;
    const y = currentY + Math.floor(index / 2) * 7;
    doc.text(row, x, y);
  });
  currentY += 48;

  doc.setFontSize(12);
  doc.text("Urunler", 14, currentY);
  currentY += 8;

  drawShipmentTableHeader(doc, currentY);
  currentY += 6;

  (record.lines || []).forEach((line) => {
    const rowHeight = 18;
    if (currentY > 260) {
      doc.addPage();
      currentY = 18;
      drawShipmentTableHeader(doc, currentY);
      currentY += 6;
    }

    doc.setDrawColor(232, 237, 243);
    doc.rect(14, currentY - 4, 182, rowHeight);

    if (typeof line.image === "string" && line.image.startsWith("data:image")) {
      try {
        doc.addImage(line.image, "JPEG", 16, currentY - 2, 10, 10);
      } catch {
        doc.rect(16, currentY - 2, 10, 10);
      }
    } else {
      doc.rect(16, currentY - 2, 10, 10);
    }

    doc.setFontSize(9);
    doc.setTextColor(36, 36, 36);
    doc.text(String(line.code || "-").slice(0, 14), 38, currentY + 3);

    const nameText = String(line.name || "-");
    const nameLines = doc.splitTextToSize(nameText, 58);
    doc.text(nameLines.slice(0, 2), 68, currentY + 3);

    doc.text(formatPdfMoney(line.salePrice, line.saleCurrency || "TRY"), 130, currentY + 3);
    doc.text(String(line.quantity || 0), 158, currentY + 3);
    doc.text(formatPdfMoney((line.quantity || 0) * (line.salePrice || 0), line.saleCurrency || "TRY"), 174, currentY + 3);

    currentY += rowHeight;
  });

  currentY += 6;
  doc.setFontSize(10);
  doc.setFillColor(246, 248, 251);
  doc.rect(14, currentY - 4, 182, 10, "F");
  doc.text(`Toplam: ${record.totalAmountDisplay || "-"}`, 180, currentY + 3, { align: "right" });

  doc.save(`${record.shipmentNo || "gonderi"}.pdf`);
}

export async function getNextStoreShipmentNoPreviewFresh(storeId) {
  const [records] = await Promise.all([
    requestCollection("/api/store-shipments", seedShipments()),
    listStoresFresh(),
  ]);
  return buildNextShipmentNo(records, storeId);
}
