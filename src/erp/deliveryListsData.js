import { getProductById, listProductsFresh } from "./productsData";
import { mutateResourceSync, requestCollection, requestCollectionSync, requestJson } from "./apiClient";
import { getSupplierById, listSuppliers, listSuppliersFresh } from "./suppliersData";
import { getBrandingFresh } from "./brandingData";
import { jsPDF, ensurePdfFont, formatPdfDate, formatPdfMoney, fetchImageDataUrl, toDrawableDataUrl, resolveImageData, renderItemsPdf } from "./pdfUtils";

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


function loadStore() {
  return requestCollectionSync("/api/delivery-lists", []);
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
  const records = await requestCollection(url, []);

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
  const records = await requestCollection("/api/delivery-lists?slim=true", []);
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

export async function createDeliveryPdf(recordOrId, supplierData = null) {
  const deliveryRecord =
    typeof recordOrId === "string"
      ? enrichRecord(getDeliveryListById(recordOrId))
      : enrichRecord(recordOrId);

  if (!deliveryRecord) {
    return null;
  }

  const doc = new jsPDF();
  await ensurePdfFont(doc);

  const supplier = supplierData || listSuppliers().find((item) => item.id === deliveryRecord.supplierId);

  // Satir gorsellerini SIRALI cozumle (gonderi PDF'i ile ayni mantik)
  const lineImages = [];
  for (const line of (deliveryRecord.lines || [])) {
    let resolved = null;
    if (typeof line.image === "string" && line.image.startsWith("data:image")) {
      resolved = await toDrawableDataUrl(line.image);
    }
    if (!resolved) {
      const url = line.productId ? `/api/products/${line.productId}/image` : (line.image || "");
      resolved = url ? await resolveImageData(url) : null;
    }
    lineImages.push(resolved);
  }

  // Marka (Sibella, alici) logosu — sistemden
  let brandingLogo = null;
  try { const b = await getBrandingFresh(); if (b?.logoUrl) brandingLogo = await fetchImageDataUrl(b.logoUrl); } catch { /* yoksay */ }
  if (!brandingLogo) { try { brandingLogo = await fetchImageDataUrl("/pdf-logo.png"); } catch { brandingLogo = null; } }

  // Gonderen firma (tedarikci) logosu — parti kartinda gosterilir
  let partyLogo = null;
  try { if (supplier?.logo) partyLogo = await resolveImageData(supplier.logo); } catch { partyLogo = null; }

  renderItemsPdf(doc, {
    title: "TESLİMAT FORMU",
    partyLabel: "TEDARİKÇİ",
    partyName: deliveryRecord.supplierName || supplier?.company || "-",
    partyLogo,
    docNoLabel: "Teslimat No",
    docNo: deliveryRecord.deliveryNo || "-",
    dateText: formatPdfDate(deliveryRecord.date),
    summary: [
      ["Toplam Kalem", String(deliveryRecord.lineCount || (deliveryRecord.lines || []).length || 0)],
      ["Toplam Adet", String(deliveryRecord.totalQuantity || 0)],
      ["Toplam Tutar", formatPdfMoney(deliveryRecord.totalAmount, "TRY")],
    ],
    lines: deliveryRecord.lines || [],
    lineImages,
    currency: "TRY",
    brandingLogo,
  });

  doc.save(`${deliveryRecord.deliveryNo || "teslimat"}.pdf`);
  return deliveryRecord;
}
