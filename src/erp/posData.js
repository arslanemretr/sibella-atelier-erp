import { applyProductStockAdjustments, getProductById, listProducts } from "./productsData";
import { readPersistentStore, writePersistentStore } from "./serverStore";

const SESSION_STORAGE_KEY = "sibella.erp.posSessions.v2";
const SALES_STORAGE_KEY = "sibella.erp.posSales.v2";

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function formatMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function seedSessions() {
  return [];
}

function seedSales() {
  return [];
}

function loadRecords(storageKey, seedFactory) {
  return readPersistentStore(storageKey, seedFactory());
}

function saveRecords(storageKey, records) {
  writePersistentStore(storageKey, records);
}

function normalizeSession(values, existingSession) {
  return {
    id: existingSession?.id || createId("possess"),
    sessionNo: values.sessionNo || `POS-${String(Date.now()).slice(-4)}`,
    registerName: values.registerName || "Magaza Ana Kasa",
    cashierName: values.cashierName || "Kasa Kullanıcısı",
    openingBalance: Number(values.openingBalance || 0),
    openedAt: existingSession?.openedAt || values.openedAt || nowIso(),
    closedAt: values.closedAt || existingSession?.closedAt || null,
    status: values.status || existingSession?.status || "Açık",
    note: values.note || "",
    createdAt: existingSession?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

function normalizeSale(values) {
  const lines = (values.lines || [])
    .filter((line) => line && line.productId && Number(line.quantity || 0) > 0)
    .map((line, index) => ({
      id: line.id || `posline-${index + 1}`,
      productId: line.productId,
      quantity: Number(line.quantity || 0),
      unitPrice: Number(line.unitPrice || 0),
      lineTotal: Number(line.quantity || 0) * Number(line.unitPrice || 0),
    }));

  const grossTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const discountType = values.discountType || "amount";
  const discountValue = Number(values.discountValue || 0);
  const discountAmount = discountType === "percent" ? (grossTotal * discountValue) / 100 : discountValue;
  const normalizedDiscountAmount = Math.min(Math.max(discountAmount, 0), grossTotal);
  const grandTotal = Math.max(grossTotal - normalizedDiscountAmount, 0);
  const subtotal = grandTotal / 1.2;
  const taxTotal = grandTotal - subtotal;

  return {
    id: createId("possale"),
    sessionId: values.sessionId,
    receiptNo: values.receiptNo || `FIS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    soldAt: values.soldAt || nowIso(),
    customerName: values.customerName || "Mağaza Müşterisi",
    paymentMethod: values.paymentMethod || "Nakit",
    note: values.note || "",
    lines,
    discountType,
    discountValue,
    discountAmount: normalizedDiscountAmount,
    subtotal,
    taxTotal,
    grandTotal,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function enrichSale(sale) {
  const productMap = Object.fromEntries(listProducts().map((item) => [item.id, item]));
  const lines = (sale.lines || []).map((line) => {
    const product = productMap[line.productId];
    return {
      ...line,
      productCode: product?.code || "-",
      productName: product?.name || "-",
      lineTotalDisplay: formatMoney(line.lineTotal),
      unitPriceDisplay: formatMoney(line.unitPrice),
    };
  });

  return {
    ...sale,
    lines,
    discountAmountDisplay: formatMoney(sale.discountAmount),
    subtotalDisplay: formatMoney(sale.subtotal),
    taxTotalDisplay: formatMoney(sale.taxTotal),
    grandTotalDisplay: formatMoney(sale.grandTotal),
  };
}

function enrichSession(session) {
  const sales = listPosSales().filter((sale) => sale.sessionId === session.id);
  const salesCount = sales.length;
  const totalSales = sales.reduce((sum, item) => sum + Number(item.grandTotal || 0), 0);

  return {
    ...session,
    salesCount,
    totalSales,
    totalSalesDisplay: formatMoney(totalSales),
    openingBalanceDisplay: formatMoney(session.openingBalance),
  };
}

export function listPosSessions() {
  return loadRecords(SESSION_STORAGE_KEY, seedSessions).map(enrichSession);
}

export function getPosSessionById(sessionId) {
  return loadRecords(SESSION_STORAGE_KEY, seedSessions).find((item) => item.id === sessionId) || null;
}

export function getOpenPosSessions() {
  return listPosSessions().filter((item) => item.status === "Açık");
}

export function createPosSession(values) {
  const store = loadRecords(SESSION_STORAGE_KEY, seedSessions);
  const record = normalizeSession(values);
  const nextStore = [record, ...store];
  saveRecords(SESSION_STORAGE_KEY, nextStore);
  return enrichSession(record);
}

export function closePosSession(sessionId) {
  const store = loadRecords(SESSION_STORAGE_KEY, seedSessions);
  const existing = store.find((item) => item.id === sessionId);
  if (!existing) {
    return null;
  }

  const updated = normalizeSession(
    {
      ...existing,
      status: "Kapalı",
      closedAt: nowIso(),
    },
    existing,
  );

  saveRecords(
    SESSION_STORAGE_KEY,
    store.map((item) => (item.id === sessionId ? updated : item)),
  );

  return enrichSession(updated);
}

export function listPosSales() {
  return loadRecords(SALES_STORAGE_KEY, seedSales).map(enrichSale);
}

export function createPosSale(values) {
  const openSession = getPosSessionById(values.sessionId);
  if (!openSession || openSession.status !== "Açık") {
    throw new Error("Açık POS oturumu bulunamadı.");
  }

  const record = normalizeSale(values);
  const store = loadRecords(SALES_STORAGE_KEY, seedSales);
  const nextStore = [record, ...store];
  saveRecords(SALES_STORAGE_KEY, nextStore);

  applyProductStockAdjustments(
    record.lines.map((line) => ({
      productId: line.productId,
      delta: -Number(line.quantity || 0),
    })),
  );

  return enrichSale(record);
}

export function buildPosProductCatalog() {
  return listProducts()
    .filter((item) => item.useInPos && item.status === "Aktif")
    .map((item) => ({
      ...item,
      quantityAvailable: Number(item.stock || 0),
      imageUrl: item.image,
    }));
}

export function findProductByBarcode(barcode) {
  if (!barcode) {
    return null;
  }

  return listProducts().find((item) => String(item.barcode || "").trim() === String(barcode).trim()) || null;
}

export function getProductSnapshot(productId) {
  return getProductById(productId);
}
