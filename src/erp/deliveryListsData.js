import { jsPDF } from "jspdf";
import { getProductById } from "./productsData";
import { readPersistentStore, writePersistentStore } from "./serverStore";
import { getSupplierById, listSuppliers } from "./suppliersData";

const STORAGE_KEY = "sibella.erp.deliveryLists.v1";

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

function formatPdfNumber(value) {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPdfMoney(value, currency = "TRY") {
  const currencyLabel = currency === "TRY" ? "TL" : currency;
  return `${formatPdfNumber(value)} ${currencyLabel}`;
}

function seedDeliveryLists() {
  return [];
}

function loadStore() {
  return readPersistentStore(STORAGE_KEY, seedDeliveryLists());
}

function saveStore(records) {
  writePersistentStore(STORAGE_KEY, records);
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
    createdBy: values.createdBy || existingRecord?.createdBy || null,
    lines,
    createdAt: existingRecord?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

export function listDeliveryLists() {
  return loadStore().map(enrichRecord);
}

export function listDeliveryListsBySupplier(supplierId) {
  return loadStore()
    .filter((item) => item.supplierId === supplierId)
    .map(enrichRecord);
}

export function getDeliveryListById(deliveryListId) {
  return loadStore().find((item) => item.id === deliveryListId) || null;
}

export function createDeliveryList(values) {
  const store = loadStore();
  const record = normalizeDeliveryRecord(values);
  const nextStore = [record, ...store];
  saveStore(nextStore);
  return enrichRecord(record);
}

export function getNextDeliveryNoPreview(supplierId) {
  return getNextDeliveryNo(loadStore(), supplierId);
}

export function updateDeliveryList(deliveryListId, values) {
  const store = loadStore();
  const existingRecord = store.find((item) => item.id === deliveryListId);
  if (!existingRecord) {
    return null;
  }

  const updatedRecord = normalizeDeliveryRecord(values, existingRecord);
  saveStore(store.map((item) => (item.id === deliveryListId ? updatedRecord : item)));
  return enrichRecord(updatedRecord);
}

export function createDeliveryPdf(recordOrId) {
  const deliveryRecord =
    typeof recordOrId === "string"
      ? enrichRecord(getDeliveryListById(recordOrId))
      : enrichRecord(recordOrId);

  if (!deliveryRecord) {
    return null;
  }

  const doc = new jsPDF();
  let currentY = 18;

  doc.setFillColor(250, 242, 239);
  doc.roundedRect(14, 12, 182, 22, 3, 3, "F");
  doc.setFontSize(18);
  doc.setTextColor(36, 36, 36);
  doc.text("Sibella Teslim Formu", 18, 26);
  doc.setFontSize(11);
  doc.text(`Teslimat Kodu: ${deliveryRecord.deliveryNo}`, 138, 22);
  doc.text(`Olusturma Tarihi: ${deliveryRecord.date}`, 138, 28);
  currentY = 42;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(220, 226, 235);
  doc.roundedRect(14, currentY, 182, 38, 3, 3, "FD");
  currentY += 8;

  doc.setFontSize(11);
  const supplier = listSuppliers().find((item) => item.id === deliveryRecord.supplierId);
  const headerRows = [
    `Teslimat No: ${deliveryRecord.deliveryNo}`,
    `Tedarikci Firma: ${deliveryRecord.supplierName}`,
    `Yetkili Kisi: ${deliveryRecord.contactName || supplier?.contact || "-"}`,
    `E-posta: ${deliveryRecord.supplierEmail || supplier?.email || "-"}`,
    `Tarih: ${deliveryRecord.date}`,
    `Gonderim Sekli: ${deliveryRecord.shippingMethod || "-"}`,
    `Kargo Takip No: ${deliveryRecord.trackingNo || "-"}`,
  ];

  headerRows.forEach((row, index) => {
    const x = index % 2 === 0 ? 18 : 108;
    const y = currentY + Math.floor(index / 2) * 7;
    doc.text(row, x, y);
  });
  currentY += 28;

  doc.setFontSize(12);
  doc.text("Urunler", 14, currentY);
  currentY += 8;

  doc.setFontSize(10);
  doc.setFillColor(246, 248, 251);
  doc.rect(14, currentY - 5, 182, 8, "F");
  doc.text("Gorsel", 16, currentY);
  doc.text("Kod", 38, currentY);
  doc.text("Urun Adi", 68, currentY);
  doc.text("Fiyat", 132, currentY);
  doc.text("Adet", 156, currentY);
  doc.text("Tutar", 174, currentY);
  currentY += 6;

  deliveryRecord.lines.forEach((line) => {
    const rowHeight = 18;
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
    const nameLines = doc.splitTextToSize(line.name || "-", 58);
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
    if (currentY > 260) {
      doc.addPage();
      currentY = 18;
    }
  });

  currentY += 4;
  doc.setFontSize(12);
  doc.text(`Toplam Adet: ${deliveryRecord.totalQuantity}`, 14, currentY);
  currentY += 7;
  doc.text(`Toplam Tutar: ${formatPdfMoney(deliveryRecord.totalAmount, "TRY")}`, 14, currentY);
  currentY += 10;
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
