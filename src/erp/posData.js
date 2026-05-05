import { getProductById, listProducts, listProductsRawFresh } from "./productsData";
import { mutateResourceSync, requestCollection, requestCollectionSync } from "./apiClient";

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

function loadSessions() {
  return requestCollectionSync("/api/pos-sessions", seedSessions());
}

function loadSales() {
  return requestCollectionSync("/api/pos-sales", seedSales());
}

function normalizeSession(values, existingSession) {
  const rawStatus = values.status || existingSession?.status;
  const status = (!rawStatus || rawStatus === "Acik" || rawStatus === "Açık") ? "Açık" : "Kapalı";
  return {
    id: existingSession?.id || createId("possess"),
    sessionNo: values.sessionNo || existingSession?.sessionNo || "",
    registerName: values.registerName || existingSession?.registerName || "",
    cashierName: values.cashierName || existingSession?.cashierName || "",
    stockLocationId: values.stockLocationId || existingSession?.stockLocationId || null,
    openingBalance: Number(values.openingBalance || 0),
    openedAt: existingSession?.openedAt || values.openedAt || nowIso(),
    closedAt: values.closedAt || existingSession?.closedAt || null,
    status,
    note: values.note || "",
    createdAt: existingSession?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

function normalizeSale(values) {
  const lines = (values.lines || [])
    .filter((line) => line && line.productId && Number(line.quantity || 0) > 0)
    .map((line) => ({
      id: line.id || createId("posline"),
      productId: line.productId,
      quantity: Number(line.quantity || 0),
      unitPrice: Number(line.unitPrice || 0),
      lineTotal: Number(line.quantity || 0) * Number(line.unitPrice || 0),
    }));

  const grossTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const discountType = values.discountType || "amount";
  const discountValue = Number(values.discountValue || 0);
  const rawDiscount = discountType === "percent" ? (grossTotal * discountValue) / 100 : discountValue;
  const discountAmount = Math.min(Math.max(rawDiscount, 0), grossTotal);
  const grandTotal = Math.max(grossTotal - discountAmount, 0);
  const subtotal = grandTotal / 1.2;
  const taxTotal = grandTotal - subtotal;

  return {
    sessionId: values.sessionId,
    stockLocationId: values.stockLocationId || null,
    receiptNo: values.receiptNo || `FIS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    soldAt: values.soldAt || nowIso(),
    customerName: values.customerName || "Magaza Musterisi",
    paymentMethod: values.paymentMethod || "Nakit",
    note: values.note || "",
    lines,
    discountType,
    discountValue,
    discountAmount,
    subtotal,
    taxTotal,
    grandTotal,
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
  const totalSales = sales.reduce((sum, item) => sum + Number(item.grandTotal || 0), 0);
  const rawStatus = session.status;
  const status = (!rawStatus || rawStatus === "Acik" || rawStatus === "Açık") ? "Açık" : "Kapalı";
  return {
    ...session,
    status,
    stockLocationId: session.stockLocationId || null,
    salesCount: sales.length,
    totalSales,
    totalSalesDisplay: formatMoney(totalSales),
    openingBalanceDisplay: formatMoney(session.openingBalance),
  };
}

export function listPosSessions() {
  return loadSessions().map(enrichSession);
}

export async function listPosSessionsFresh() {
  const sessions = await requestCollection("/api/pos-sessions", seedSessions());
  return sessions.map((session) => ({
    ...session,
    totalSalesDisplay: formatMoney(session.totalSales || 0),
    openingBalanceDisplay: formatMoney(session.openingBalance || 0),
  }));
}

export function getPosSessionById(sessionId) {
  return loadSessions().find((item) => item.id === sessionId) || null;
}

export function getOpenPosSessions() {
  return listPosSessions().filter((item) => item.status === "Açık");
}

export function createPosSession(values) {
  return enrichSession(mutateResourceSync("POST", "/api/pos-sessions", normalizeSession(values)));
}

export function closePosSession(sessionId) {
  return enrichSession(mutateResourceSync("POST", `/api/pos-sessions/${encodeURIComponent(sessionId)}/close`, {}));
}

export function listPosSales() {
  return loadSales().map(enrichSale);
}

export async function listPosSalesFresh(productsOverride = null, options = {}) {
  const query = options.sessionId ? `?sessionId=${encodeURIComponent(options.sessionId)}` : "";
  const [sales, products] = await Promise.all([
    requestCollection(`/api/pos-sales${query}`, seedSales()),
    productsOverride ? Promise.resolve(productsOverride) : listProductsRawFresh(),
  ]);
  const productMap = Object.fromEntries(products.map((item) => [item.id, item]));

  return sales.map((sale) => {
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
  });
}

export function createPosSale(values) {
  const openSession = getPosSessionById(values.sessionId);
  if (!openSession || !["Acik", "Açık"].includes(openSession.status)) {
    throw new Error("Acik POS oturumu bulunamadi.");
  }
  return enrichSale(mutateResourceSync("POST", "/api/pos-sales", normalizeSale(values)));
}

export function buildPosProductCatalog() {
  return listProducts()
    .filter((item) => item.useInPos && item.status === "Aktif")
    .map((item) => ({
      ...item,
      quantityAvailable: Number((item.totalStock ?? item.stock) || 0),
      imageUrl: item.image,
    }));
}

export async function buildPosProductCatalogFresh() {
  const products = await requestCollection("/api/products", []);
  return products
    .filter((item) => item.useInPos && item.status === "Aktif")
    .map((item) => ({
      ...item,
      quantityAvailable: Number((item.totalStock ?? item.stock) || 0),
      imageUrl: item.image,
    }));
}

export async function getOpenPosSessionsFresh() {
  const sessions = await listPosSessionsFresh();
  return sessions.filter((item) => item.status === "Açık");
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

export async function listPosReturnsFresh() {
  const returns = await requestCollection("/api/pos-returns", []);
  return returns.map((ret) => ({
    ...ret,
    totalAmount: (ret.lines || []).reduce((sum, l) => sum + Number(l.lineTotal || 0), 0),
    totalQuantity: (ret.lines || []).reduce((sum, l) => sum + Number(l.quantity || 0), 0),
  }));
}

export function createPosReturn(values) {
  return mutateResourceSync("POST", "/api/pos-returns", values);
}
