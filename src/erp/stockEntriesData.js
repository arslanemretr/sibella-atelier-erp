import { listProducts } from "./productsData";
import { listSuppliers } from "./suppliersData";
import { mutateResourceSync, requestCollection, requestCollectionSync } from "./apiClient";

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
  return requestCollectionSync("/api/stock-entries", seedStockEntries());
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

function enrichStockEntriesWithLookups(entries, lookups = {}) {
  const { suppliers = [], products = [] } = lookups;
  const supplierMap = Object.fromEntries(suppliers.map((item) => [item.id, item.company]));
  const productMap = Object.fromEntries(products.map((item) => [item.id, item]));

  return entries.map((entry) => {
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
  });
}

export function listStockEntries() {
  return loadStore().map(enrichStockEntry);
}

export async function listStockEntriesFresh(lookups = {}) {
  const entries = await requestCollection("/api/stock-entries", seedStockEntries());
  return enrichStockEntriesWithLookups(entries, lookups);
}

export function getStockEntryById(stockEntryId) {
  return loadStore().find((item) => item.id === stockEntryId) || null;
}

export function createStockEntry(values) {
  return enrichStockEntry(mutateResourceSync("POST", "/api/stock-entries", values));
}

export function updateStockEntry(stockEntryId, values) {
  return enrichStockEntry(mutateResourceSync("PUT", `/api/stock-entries/${encodeURIComponent(stockEntryId)}`, values));
}
