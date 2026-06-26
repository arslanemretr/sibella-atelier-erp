import { mutateResourceSync, requestCollection, requestCollectionSync, requestJson } from "./apiClient";
import { getStoreById, listStoresFresh } from "./storesData";
import { getBrandingFresh } from "./brandingData";
import { jsPDF, ensurePdfFont, formatPdfDate, fetchImageDataUrl, toDrawableDataUrl, renderItemsPdf } from "./pdfUtils";

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
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
  return requestCollectionSync("/api/store-shipments", []);
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
  // Liste endpoint'i satirlari bos doner ama toplamlari ayrica saglar;
  // satir varsa onlardan hesapla, yoksa backend'in donduldugu toplamlari kullan
  const hasLines = (item.lines || []).length > 0;
  const totalQuantity = hasLines
    ? item.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
    : Number(item.totalQuantity || 0);
  const totalAmount = hasLines
    ? item.lines.reduce((sum, line) => sum + (Number(line.quantity || 0) * Number(line.salePrice || 0)), 0)
    : Number(item.totalAmount || 0);
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
  const records = await requestCollection("/api/store-shipments", []);
  return records.map(enrichShipment);
}

export function getStoreShipmentById(shipmentId) {
  const shipment = loadStore().find((item) => item.id === shipmentId);
  return shipment ? enrichShipment(shipment) : null;
}

export async function getStoreShipmentFresh(shipmentId, { withImages = true } = {}) {
  // withImages=false: editor hizli acilir (agir base64 satir gorselleri yerine imageUrl gelir)
  const query = withImages ? "" : "?images=false";
  const payload = await requestJson("GET", `/api/store-shipments/${encodeURIComponent(shipmentId)}${query}`);
  if (!payload?.item) return null;
  return enrichShipment(payload.item);
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

export async function createStoreShipmentPdf(shipmentOrId, { returnBase64 = false } = {}) {
  const record =
    typeof shipmentOrId === "string"
      ? await getStoreShipmentFresh(shipmentOrId, { withImages: true })
      : enrichShipment(shipmentOrId);

  if (!record || !record.id) {
    return null;
  }

  const doc = new jsPDF();
  await ensurePdfFont(doc);

  // Satir gorsellerini SIRALI cozumle (Promise.all degil; paralel cozumde bazilari dusuyordu)
  const lineImages = [];
  for (const line of (record.lines || [])) {
    let resolved = null;
    if (typeof line.image === "string" && line.image.startsWith("data:image")) {
      resolved = await toDrawableDataUrl(line.image);
    }
    if (!resolved) {
      const url = line.productId ? `/api/products/${line.productId}/image` : (line.imageUrl || "");
      resolved = url ? await fetchImageDataUrl(url) : null;
    }
    lineImages.push(resolved);
  }

  // Marka (Sibella) logosu — sistemden
  let brandingLogo = null;
  try { const b = await getBrandingFresh(); if (b?.logoUrl) brandingLogo = await fetchImageDataUrl(b.logoUrl); } catch { /* yoksay */ }
  if (!brandingLogo) { try { brandingLogo = await fetchImageDataUrl("/pdf-logo.png"); } catch { brandingLogo = null; } }

  renderItemsPdf(doc, {
    title: "MAĞAZA GÖNDERİ FORMU",
    partyLabel: "MAĞAZA",
    partyName: record.storeName || "-",
    partyLogo: null,
    docNoLabel: "Gönderi No",
    docNo: record.shipmentNo || "-",
    dateText: formatPdfDate(record.date),
    summary: [
      ["Toplam Kalem", String(record.lineCount || 0)],
      ["Toplam Adet", String(record.totalQuantity || 0)],
      ["Toplam Tutar", record.totalAmountDisplay || "-"],
    ],
    lines: record.lines || [],
    lineImages,
    currency: record.saleCurrency || "TRY",
    brandingLogo,
  });

  if (returnBase64) {
    // "data:application/pdf;base64,...." → yalnizca base64 govde
    const uri = doc.output("datauristring");
    return String(uri).split(",")[1] || "";
  }
  doc.save(`${record.shipmentNo || "gonderi"}.pdf`);
  return null;
}

// Gonderi PDF'ini (base64) backend'e gonderip magaza e-postasina mailler
export async function emailStoreShipment(shipmentId, pdfBase64) {
  return requestJson("POST", `/api/store-shipments/${encodeURIComponent(shipmentId)}/email`, { pdfBase64 });
}

export async function getNextStoreShipmentNoPreviewFresh(storeId) {
  const [records] = await Promise.all([
    requestCollection("/api/store-shipments", []),
    listStoresFresh(),
  ]);
  return buildNextShipmentNo(records, storeId);
}
