import { listMasterData } from "./masterData";
import { listProducts } from "./productsData";
import { listSuppliers } from "./suppliersData";
import { mutateResourceSync, requestCollection, requestCollectionSync } from "./apiClient";

function seedPurchases() {
  return [];
}

function loadStore() {
  return requestCollectionSync("/api/purchases", seedPurchases());
}

function money(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
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

function enrichPurchasesWithLookups(purchases, lookups = {}) {
  const {
    suppliers = [],
    procurementTypes = [],
    paymentTerms = [],
    products = [],
  } = lookups;
  const supplierMap = Object.fromEntries(suppliers.map((item) => [item.id, item.company]));
  const procurementMap = Object.fromEntries(procurementTypes.map((item) => [item.id, item.name]));
  const paymentMap = Object.fromEntries(paymentTerms.map((item) => [item.id, item.name]));
  const productMap = Object.fromEntries(products.map((item) => [item.id, item]));

  return purchases.map((purchase) => {
    const lines = (purchase.lines || []).map((line) => {
      const product = productMap[line.productId];
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
  });
}

export function listPurchases() {
  return loadStore().map(enrichPurchase);
}

export async function listPurchasesFresh(lookups = {}) {
  const purchases = await requestCollection("/api/purchases", seedPurchases());
  return enrichPurchasesWithLookups(purchases, lookups);
}

export function getPurchaseById(purchaseId) {
  return loadStore().find((item) => item.id === purchaseId) || null;
}

export function createPurchase(values) {
  return enrichPurchase(mutateResourceSync("POST", "/api/purchases", values));
}

export function updatePurchase(purchaseId, values) {
  return enrichPurchase(mutateResourceSync("PUT", `/api/purchases/${encodeURIComponent(purchaseId)}`, values));
}
