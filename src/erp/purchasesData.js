import { listMasterData } from "./masterData";
import { applyProductStockAdjustments, listProducts } from "./productsData";
import { listSuppliers } from "./suppliersData";
import { readPersistentStore, writePersistentStore } from "./serverStore";

const STORAGE_KEY = "sibella.erp.purchases.v2";

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function seedPurchases() {
  return [];
}

function loadStore() {
  return readPersistentStore(STORAGE_KEY, seedPurchases());
}

function saveStore(records) {
  writePersistentStore(STORAGE_KEY, records);
}

function money(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function normalizeLines(lines = [], existingPurchase) {
  return lines
    .filter((line) => line && line.productId)
    .map((line, index) => ({
      id: line.id || `${existingPurchase?.id || "pur"}-line-${index + 1}`,
      productId: line.productId,
      quantity: Number(line.quantity || 0),
      unitPrice: Number(line.unitPrice || 0),
      note: line.note || "",
    }));
}

function normalizePurchase(values, existingPurchase) {
  return {
    id: existingPurchase?.id || createId("pur"),
    documentNo: values.documentNo || "",
    supplierId: values.supplierId || null,
    date: values.date || "",
    procurementTypeId: values.procurementTypeId || null,
    paymentTermId: values.paymentTermId || null,
    description: values.description || "",
    lines: normalizeLines(values.lines, existingPurchase),
    createdAt: existingPurchase?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

function enrichPurchase(purchase) {
  const supplierMap = Object.fromEntries(listSuppliers().map((item) => [item.id, item.company]));
  const procurementMap = Object.fromEntries(listMasterData("procurement-types").map((item) => [item.id, item.name]));
  const paymentMap = Object.fromEntries(listMasterData("payment-terms").map((item) => [item.id, item.name]));
  const products = Object.fromEntries(listProducts().map((item) => [item.id, item]));

  const lines = (purchase.lines || []).map((line) => {
    const product = products[line.productId];
    return {
      ...line,
      productName: product?.name || "-",
      productCode: product?.code || "-",
      lineTotal: Number(line.quantity || 0) * Number(line.unitPrice || 0),
      lineTotalDisplay: money(Number(line.quantity || 0) * Number(line.unitPrice || 0)),
      unitPriceDisplay: money(line.unitPrice),
    };
  });

  const totalAmount = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  return {
    ...purchase,
    supplierName: supplierMap[purchase.supplierId] || "-",
    procurementTypeLabel: procurementMap[purchase.procurementTypeId] || "-",
    paymentTermLabel: paymentMap[purchase.paymentTermId] || "-",
    lines,
    totalAmount,
    totalAmountDisplay: money(totalAmount),
    lineCount: lines.length,
  };
}

function buildAdjustments(lines, multiplier = 1) {
  return lines.map((line) => ({
    productId: line.productId,
    delta: Number(line.quantity || 0) * multiplier,
  }));
}

export function listPurchases() {
  return loadStore().map(enrichPurchase);
}

export function getPurchaseById(purchaseId) {
  return loadStore().find((item) => item.id === purchaseId) || null;
}

export function createPurchase(values) {
  const store = loadStore();
  const record = normalizePurchase(values);
  const nextStore = [record, ...store];
  saveStore(nextStore);
  applyProductStockAdjustments(buildAdjustments(record.lines, 1));
  return enrichPurchase(record);
}

export function updatePurchase(purchaseId, values) {
  const store = loadStore();
  const existingPurchase = store.find((item) => item.id === purchaseId);
  if (!existingPurchase) {
    return null;
  }

  const updatedRecord = normalizePurchase(values, existingPurchase);
  saveStore(store.map((item) => (item.id === purchaseId ? updatedRecord : item)));
  applyProductStockAdjustments([
    ...buildAdjustments(existingPurchase.lines || [], -1),
    ...buildAdjustments(updatedRecord.lines || [], 1),
  ]);
  return enrichPurchase(updatedRecord);
}
