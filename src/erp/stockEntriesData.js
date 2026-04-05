import { applyProductStockAdjustments, listProducts } from "./productsData";
import { listSuppliers } from "./suppliersData";
import { readPersistentStore, writePersistentStore } from "./serverStore";

const STORAGE_KEY = "sibella.erp.stockEntries.v2";

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function money(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function seedStockEntries() {
  return [];
}

function loadStore() {
  return readPersistentStore(STORAGE_KEY, seedStockEntries());
}

function saveStore(records) {
  writePersistentStore(STORAGE_KEY, records);
}

function normalizeLines(lines = [], existingEntry) {
  return lines
    .filter((line) => line && line.productId)
    .map((line, index) => ({
      id: line.id || `${existingEntry?.id || "stk"}-line-${index + 1}`,
      productId: line.productId,
      quantity: Number(line.quantity || 0),
      unitCost: Number(line.unitCost || 0),
      note: line.note || "",
    }));
}

function normalizeStockEntry(values, existingEntry) {
  return {
    id: existingEntry?.id || createId("stk"),
    documentNo: values.documentNo || "",
    sourcePartyId: values.sourcePartyId || null,
    date: values.date || "",
    stockType: values.stockType || "Urun",
    sourceType: values.sourceType || "Konsinye",
    status: values.status || existingEntry?.status || "Taslak",
    note: values.note || "",
    lines: normalizeLines(values.lines, existingEntry),
    createdAt: existingEntry?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

function enrichStockEntry(entry) {
  const supplierMap = Object.fromEntries(listSuppliers().map((item) => [item.id, item.company]));
  const productMap = Object.fromEntries(listProducts().map((item) => [item.id, item]));

  const lines = (entry.lines || []).map((line) => {
    const product = productMap[line.productId];
    const total = Number(line.quantity || 0) * Number(line.unitCost || 0);
    return {
      ...line,
      productCode: product?.code || "-",
      productName: product?.name || "-",
      unitCostDisplay: money(line.unitCost),
      lineTotal: total,
      lineTotalDisplay: money(total),
    };
  });

  const totalAmount = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  return {
    ...entry,
    sourcePartyName: supplierMap[entry.sourcePartyId] || "-",
    lines,
    lineCount: lines.length,
    totalAmount,
    totalAmountDisplay: money(totalAmount),
  };
}

function buildAdjustments(lines, multiplier = 1) {
  return lines.map((line) => ({
    productId: line.productId,
    delta: Number(line.quantity || 0) * multiplier,
  }));
}

export function listStockEntries() {
  return loadStore().map(enrichStockEntry);
}

export function getStockEntryById(stockEntryId) {
  return loadStore().find((item) => item.id === stockEntryId) || null;
}

export function createStockEntry(values) {
  const store = loadStore();
  const record = normalizeStockEntry(values);
  const nextStore = [record, ...store];
  saveStore(nextStore);
  if (record.status === "Tamamlandi") {
    applyProductStockAdjustments(buildAdjustments(record.lines, 1));
  }
  return enrichStockEntry(record);
}

export function updateStockEntry(stockEntryId, values) {
  const store = loadStore();
  const existingEntry = store.find((item) => item.id === stockEntryId);
  if (!existingEntry) {
    return null;
  }

  const updatedRecord = normalizeStockEntry(values, existingEntry);
  saveStore(store.map((item) => (item.id === stockEntryId ? updatedRecord : item)));
  const adjustments = [];
  if (existingEntry.status === "Tamamlandi") {
    adjustments.push(...buildAdjustments(existingEntry.lines || [], -1));
  }
  if (updatedRecord.status === "Tamamlandi") {
    adjustments.push(...buildAdjustments(updatedRecord.lines || [], 1));
  }
  if (adjustments.length) {
    applyProductStockAdjustments(adjustments);
  }
  return enrichStockEntry(updatedRecord);
}
