import { getProductById, listProductsFresh } from "./productsData";
import { mutateResourceSync, requestCollection, requestCollectionSync, requestJson } from "./apiClient";
import { getSupplierById, listSuppliers, listSuppliersFresh } from "./suppliersData";
import { jsPDF, ensurePdfFont, drawPdfLogo, drawDeliveryTableHeader, formatPdfDate, formatPdfMoney } from "./pdfUtils";

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function getNextDeliveryNo(records, supplierId) {
  const supplier = getSupplierById(supplierId);
  const supplierCode = (supplier?.shortCode || "GENL").toUpperCase();
  const nextNumber = records.filter((item) => item.supplierId === supplierId).length + 1;
  return `TES-${supplierCode}-${String(nextNumber).padStart(4, "0")}`;
}

function formatMoney(value, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}


function seedDeliveryLists() {
  return [];
}

function loadStore() {
  return requestCollectionSync("/api/delivery-lists", seedDeliveryLists());
}

function normalizeLine(line, index) {
  const selectedProduct = line.productId ? getProductById(line.productId) : null;

  return {
    id: line.id || createId("dll"),
    productId: line.productId || null,
    isNewProduct: Boolean(line.isNewProduct),
    image: line.image || selectedProduct?.image || "/products/baroque-necklace.svg",
    name: line.name || selectedProduct?.name || "",
    code: line.code || selectedProduct?.code || "",
    salePrice: Number(line.salePrice ?? selectedProduct?.salePrice ?? 0),
    saleCurrency: line.saleCurrency || selectedProduct?.saleCurrency || "TRY",
    quantity: Number(line.quantity || 1),
    categoryId: line.categoryId ?? selectedProduct?.categoryId ?? null,
    categoryLabel: line.categoryLabel || selectedProduct?.categoryLabel || "",
    collectionId: line.collectionId ?? selectedProduct?.collectionId ?? null,
    collectionLabel: line.collectionLabel || selectedProduct?.collectionLabel || "",
    description: line.description || "",
    sortOrder: index + 1,
  };
}

function enrichRecord(record) {
  const supplier = getSupplierById(record.supplierId);
  const totalQuantity = (record.lines || []).reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  const totalAmount = (record.lines || []).reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.salePrice || 0), 0);

  return {
    ...record,
    supplierName: record.supplierName || supplier?.company || "-",
    contactName: record.contactName || supplier?.contact || "-",
    totalQuantity,
    totalAmount,
    totalAmountDisplay: formatMoney(totalAmount, "TRY"),
    statusLabel: record.status || "Taslak",
    lineCount: record.lines?.length || 0,
  };
}

function normalizeDeliveryRecord(values, existingRecord) {
  const store = loadStore();
  const supplier = getSupplierById(values.supplierId || existingRecord?.supplierId);
  const lines = (values.lines || existingRecord?.lines || []).map((line, index) => normalizeLine(line, index));

  return {
    id: existingRecord?.id || createId("dlv"),
    deliveryNo: existingRecord?.deliveryNo || values.deliveryNo || getNextDeliveryNo(store, values.supplierId || existingRecord?.supplierId),
    supplierId: values.supplierId || existingRecord?.supplierId || null,
    supplierName: supplier?.company || values.supplierName || "",
    contactName: values.contactName || supplier?.contact || "",
    supplierEmail: values.supplierEmail || supplier?.email || "",
    date: values.date || existingRecord?.date || new Date().toISOString().slice(0, 10),
    shippingMethod: values.shippingMethod || existingRecord?.shippingMethod || "Kargo",
    trackingNo: values.trackingNo || existingRecord?.trackingNo || "",
    note: values.note || existingRecord?.note || "",
    status: values.status || existingRecord?.status || "Taslak",
    stockEntryId: values.stockEntryId || existingRecord?.stockEntryId || null,
    inventoryPostedAt: values.inventoryPostedAt || existingRecord?.inventoryPostedAt || null,
    createdBy: values.createdBy || existingRecord?.createdBy || null,
    lines,
    createdAt: existingRecord?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

export function listDeliveryLists() {
  return loadStore().map(enrichRecord);
}

export async function listDeliveryListsFresh({ slim = false } = {}) {
  const url = slim ? "/api/delivery-lists?slim=true" : "/api/delivery-lists";
  const records = await requestCollection(url, seedDeliveryLists());

  return records.map((record) => {
    const totalQuantity = record.totalQuantity ?? (record.lines || []).reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    const totalAmount = record.totalAmount ?? (record.lines || []).reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.salePrice || 0), 0);

    return {
      ...record,
      totalQuantity,
      totalAmount,
      totalAmountDisplay: formatMoney(totalAmount, "TRY"),
      statusLabel: record.status || "Taslak",
      lineCount: record.lineCount ?? record.lines?.length ?? 0,
    };
  });
}

export async function getDeliveryListByIdFresh(deliveryId) {
  const data = await requestJson("GET", `/api/delivery-lists/${encodeURIComponent(deliveryId)}`);
  return data?.item || null;
}

export function listDeliveryListsBySupplier(supplierId) {
  return loadStore()
    .filter((item) => item.supplierId === supplierId)
    .map(enrichRecord);
}

export async function listDeliveryListsBySupplierFresh(supplierId) {
  const records = await listDeliveryListsFresh({ slim: true });
  return records.filter((item) => item.supplierId === supplierId);
}

export function getDeliveryListById(deliveryListId) {
  return loadStore().find((item) => item.id === deliveryListId) || null;
}

export function createDeliveryList(values) {
  return enrichRecord(mutateResourceSync("POST", "/api/delivery-lists", values));
}

export function getNextDeliveryNoPreview(supplierId) {
  return getNextDeliveryNo(loadStore(), supplierId);
}

export async function getNextDeliveryNoPreviewFresh(supplierId, supplierShortCode) {
  const records = await requestCollection("/api/delivery-lists?slim=true", seedDeliveryLists());
  let resolvedCode = supplierShortCode;
  if (!resolvedCode) {
    const suppliers = await listSuppliersFresh({ slim: true });
    resolvedCode = suppliers.find((item) => item.id === supplierId)?.shortCode || "";
  }
  const supplierCode = (resolvedCode || "GENL").toUpperCase();
  const nextNumber = records.filter((item) => item.supplierId === supplierId).length + 1;
  return `TES-${supplierCode}-${String(nextNumber).padStart(4, "0")}`;
}

export function updateDeliveryList(deliveryListId, values) {
  return enrichRecord(mutateResourceSync("PUT", `/api/delivery-lists/${encodeURIComponent(deliveryListId)}`, values));
}

export function completeDeliveryReceipt(deliveryListId) {
  return enrichRecord(mutateResourceSync("POST", `/api/delivery-lists/${encodeURIComponent(deliveryListId)}/complete`, {}));
}

export function deleteDeliveryList(deliveryListId) {
  return mutateResourceSync("DELETE", `/api/delivery-lists/${encodeURIComponent(deliveryListId)}`);
}

export async function createDeliveryPdf(recordOrId) {
  const deliveryRecord =
    typeof recordOrId === "string"
      ? enrichRecord(getDeliveryListById(recordOrId))
      : enrichRecord(recordOrId);

  if (!deliveryRecord) {
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
  doc.text("Teslim Formu", 105, 28, { align: "center" });
  doc.setFontSize(11);
  currentY = 50;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(220, 226, 235);
  doc.roundedRect(14, currentY, 182, 52, 3, 3, "FD");
  currentY += 8;

  doc.setFontSize(11);
  const supplier = listSuppliers().find((item) => item.id === deliveryRecord.supplierId);
  const headerRows = [
    `Teslimat Kodu: ${deliveryRecord.deliveryNo}`,
    `Tedarikci Firma: ${deliveryRecord.supplierName}`,
    `Yetkili Kisi: ${deliveryRecord.contactName || supplier?.contact || "-"}`,
    `E-posta: ${deliveryRecord.supplierEmail || supplier?.email || "-"}`,
    `Tarih: ${formatPdfDate(deliveryRecord.date)}`,
    `Durum: ${deliveryRecord.status || "Taslak"}`,
    `Gonderim Sekli: ${deliveryRecord.shippingMethod || "-"}`,
    `Kargo Takip No: ${deliveryRecord.trackingNo || "-"}`,
    `Toplam Adet: ${deliveryRecord.totalQuantity}`,
    `Toplam Tutar: ${formatPdfMoney(deliveryRecord.totalAmount, "TRY")}`,
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

  drawDeliveryTableHeader(doc, currentY);
  currentY += 6;

  deliveryRecord.lines.forEach((line) => {
    const rowHeight = 18;
    if (currentY > 260) {
      doc.addPage();
      currentY = 18;
      drawDeliveryTableHeader(doc, currentY);
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

    doc.text(line.code || "-", 38, currentY + 3);
    const nameLines = doc.splitTextToSize(String(line.name || "-"), 58);
    doc.text(nameLines.slice(0, 2), 68, currentY + 1);
    doc.text(formatPdfMoney(line.salePrice, line.saleCurrency), 148, currentY + 3, { align: "right" });
    doc.text(String(line.quantity || 0), 156, currentY + 3, { align: "center" });
    doc.text(formatPdfMoney((Number(line.quantity || 0) * Number(line.salePrice || 0)), line.saleCurrency), 192, currentY + 3, { align: "right" });

    if (line.description) {
      const descLines = doc.splitTextToSize(line.description, 120);
      doc.setFontSize(8);
      doc.text(descLines.slice(0, 1), 68, currentY + 8);
      doc.setFontSize(10);
    }

    currentY += rowHeight + 2;
  });

  currentY += 8;
  doc.setFontSize(10);
  doc.text(`Not: ${deliveryRecord.note || "-"}`, 14, currentY);
  currentY += 20;
  doc.line(20, currentY, 80, currentY);
  doc.line(120, currentY, 180, currentY);
  doc.text("Tedarikci Imza / Kase", 24, currentY + 6);
  doc.text("Alici Imza / Kase", 128, currentY + 6);

  doc.save(`${deliveryRecord.deliveryNo || "teslimat"}.pdf`);
  return deliveryRecord;
}
