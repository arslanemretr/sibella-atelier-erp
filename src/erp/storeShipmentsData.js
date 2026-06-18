import { mutateResourceSync, requestCollection, requestCollectionSync, requestJson } from "./apiClient";
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

// Bir gorsel URL'sini (or. /api/products/:id/image) PDF'e gomulebilecek data URL'e cevirir.
// SVG (placeholder) atlanir; jsPDF SVG'yi addImage ile cizemez.
async function fetchImageDataUrl(url) {
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || !String(blob.type || "").startsWith("image/") || String(blob.type).includes("svg")) return null;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
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

export async function createStoreShipmentPdf(shipmentOrId) {
  const record =
    typeof shipmentOrId === "string"
      ? await getStoreShipmentFresh(shipmentOrId, { withImages: true })
      : enrichShipment(shipmentOrId);

  if (!record || !record.id) {
    return null;
  }

  const doc = new jsPDF();
  await ensurePdfFont(doc);
  const FONT = doc.getFontList()?.NotoSans ? "NotoSans" : "helvetica";

  // Renk paleti
  const CORAL = [232, 103, 78];
  const CORAL_SOFT = [253, 238, 233];
  const CORAL_HL = [250, 224, 215];
  const INK = [45, 45, 50];
  const GRAY = [148, 142, 134];
  const SEP = [238, 236, 240];
  const setFill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2]);

  const M = 16;          // sol kenar
  const R = 194;         // sag kenar
  const W = R - M;       // 178

  // Satir gorsellerini PDF oncesi data URL'e cozumle (base64 yoksa urun ucundan)
  const lineImages = await Promise.all((record.lines || []).map(async (line) => {
    if (typeof line.image === "string" && line.image.startsWith("data:image") && !line.image.includes("svg")) return line.image;
    const url = line.productId ? `/api/products/${line.productId}/image` : (line.imageUrl || "");
    return url ? fetchImageDataUrl(url) : null;
  }));

  // ---- Baslik: sol logo + sag baslik ----
  const logo = await fetchImageDataUrl("/pdf-logo.png").catch(() => null);
  if (logo) {
    try { doc.addImage(logo, logo.includes("image/png") ? "PNG" : "JPEG", M, 13, 40, 16); } catch { /* yoksay */ }
  }
  setText(INK);
  doc.setFontSize(17);
  doc.text("MAĞAZA GÖNDERİ FORMU", R, 24, { align: "right" });
  setDraw(CORAL);
  doc.setLineWidth(0.4);
  doc.line(M, 36, R, 36);
  setFill(CORAL);
  doc.circle(105, 36, 1.4, "F");

  // ---- Magaza karti ----
  let y = 44;
  const cardH = 76;
  setFill([252, 248, 246]);
  setDraw([241, 232, 227]);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, W, cardH, 4, 4, "FD");

  // Magaza ikon kutusu + ad
  setFill(CORAL);
  doc.roundedRect(M + 6, y + 8, 22, 22, 4, 4, "F");
  setFill([255, 255, 255]);
  doc.rect(M + 11, y + 16, 12, 8, "F");
  doc.triangle(M + 10, y + 16, M + 24, y + 16, M + 17, y + 12, "F");
  setText(CORAL);
  doc.setFontSize(8);
  doc.text("MAĞAZA BİLGİSİ", M + 34, y + 15);
  setText(INK);
  doc.setFontSize(15);
  doc.text(String(record.storeName || "-"), M + 34, y + 24);

  // ---- Bilgi izgarasi (3 sutun x 3 satir) ----
  const colX = [M + 6, M + 64, M + 122];
  const gridTop = y + 42;
  const rowGap = 16;
  const infoItem = (cx, cy, label, value, highlight) => {
    if (highlight) {
      setFill(CORAL_HL);
      doc.roundedRect(cx - 3, cy - 8, 56, 18, 3, 3, "F");
    }
    setFill(CORAL);
    doc.circle(cx + 2, cy - 1, 3.4, "F");
    setText(GRAY);
    doc.setFontSize(7.5);
    doc.text(String(label), cx + 9, cy - 2.5);
    setText(highlight ? CORAL : INK);
    doc.setFontSize(10);
    doc.text(String(value), cx + 9, cy + 3.5);
  };
  const cur = record.saleCurrency || "TRY";
  const items = [
    ["Gönderi No", record.shipmentNo || "-"],
    ["Tarih", formatPdfDate(record.date)],
    ["Durum", record.status || "-"],
    ["Gönderim Şekli", record.shippingMethod || "-"],
    ["Kargo Takip No", record.trackingNo || "-"],
    ["Not", record.note || "-"],
    ["Toplam Kalem", String(record.lineCount || 0)],
    ["Toplam Adet", String(record.totalQuantity || 0)],
    ["Toplam Tutar", record.totalAmountDisplay || "-", true],
  ];
  items.forEach(([label, value, highlight], i) => {
    const cx = colX[i % 3];
    const cy = gridTop + Math.floor(i / 3) * rowGap;
    infoItem(cx, cy, label, value, highlight);
  });

  // ---- Urunler bolum basligi ----
  y += cardH + 12;
  setFill(CORAL);
  doc.roundedRect(M, y - 5, 6, 6, 1.5, 1.5, "F");
  setText(CORAL);
  doc.setFontSize(13);
  doc.text("ÜRÜNLER", M + 10, y);
  y += 6;

  // ---- Tablo basligi (coral bant) ----
  const PX = { thumb: 19, code: 40, name: 64, price: 150, qty: 166, total: R - 2 };
  const drawHeadBand = (top) => {
    setFill(CORAL);
    doc.roundedRect(M, top, W, 9, 2, 2, "F");
    setText([255, 255, 255]);
    doc.setFontSize(8.5);
    doc.text("Görsel", PX.thumb, top + 6);
    doc.text("Kod", PX.code, top + 6);
    doc.text("Ürün Adı", PX.name, top + 6);
    doc.text("Birim Fiyat", PX.price, top + 6, { align: "right" });
    doc.text("Adet", PX.qty, top + 6, { align: "center" });
    doc.text("Toplam", PX.total, top + 6, { align: "right" });
  };
  drawHeadBand(y);
  y += 9;

  // ---- Satirlar ----
  const ROW_H = 16;
  (record.lines || []).forEach((line, idx) => {
    if (y + ROW_H > 276) {
      doc.addPage();
      y = 16;
      drawHeadBand(y);
      y += 9;
    }
    const rowTop = y;
    const midY = rowTop + ROW_H / 2;

    // gorsel
    const img = lineImages[idx];
    setFill([247, 245, 242]);
    setDraw(SEP);
    doc.roundedRect(PX.thumb - 1, rowTop + 2, 12, 12, 2, 2, "FD");
    if (img) {
      try { doc.addImage(img, img.includes("image/png") ? "PNG" : "JPEG", PX.thumb - 1, rowTop + 2, 12, 12); } catch { /* placeholder kalir */ }
    }

    setText(INK);
    doc.setFontSize(9);
    doc.text(String(line.code || "-").slice(0, 16), PX.code, midY + 1);
    const nameLines = doc.splitTextToSize(String(line.name || "-"), 78).slice(0, 2);
    doc.text(nameLines, PX.name, nameLines.length > 1 ? midY - 1.5 : midY + 1);
    doc.text(formatPdfMoney(line.salePrice, cur), PX.price, midY + 1, { align: "right" });
    doc.text(String(line.quantity || 0), PX.qty, midY + 1, { align: "center" });
    setText(CORAL);
    doc.text(formatPdfMoney((line.quantity || 0) * (line.salePrice || 0), cur), PX.total, midY + 1, { align: "right" });

    setDraw(SEP);
    doc.setLineWidth(0.2);
    doc.line(M, rowTop + ROW_H, R, rowTop + ROW_H);
    y += ROW_H;
  });

  // ---- Footer ----
  const fy = 280;
  setFill(CORAL_SOFT);
  doc.roundedRect(M, fy, W, 13, 3, 3, "F");
  setText(CORAL);
  doc.setFontSize(8.5);
  const footY = fy + 8;
  const foot = [["Sibella Atelier", M + 14], ["info@sibellaatelier.com", M + 70], ["www.sibellaatelier.com", M + 128]];
  foot.forEach(([txt, fx]) => {
    setFill(CORAL);
    doc.circle(fx - 5, footY - 1.5, 2, "F");
    setText(CORAL);
    doc.text(txt, fx, footY);
  });

  doc.save(`${record.shipmentNo || "gonderi"}.pdf`);
}

export async function getNextStoreShipmentNoPreviewFresh(storeId) {
  const [records] = await Promise.all([
    requestCollection("/api/store-shipments", []),
    listStoresFresh(),
  ]);
  return buildNextShipmentNo(records, storeId);
}
