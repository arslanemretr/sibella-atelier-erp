const RESET_MARKER_KEY = "sibella.erp.operationalReset.v1";

const OPERATIONAL_KEYS = [
  "sibella.erp.purchases.v1",
  "sibella.erp.stockEntries.v1",
  "sibella.erp.posSessions.v1",
  "sibella.erp.posSales.v1",
  "sibella.erp.posDraftOrders.v1",
  "sibella.erp.productFilters.v1",
  "sibella.erp.supplierFilters.v1",
  "sibella.erp.purchaseFilters.v1",
  "sibella.erp.stockMovementFilters.v1",
];

export function resetOperationalDataIfNeeded() {
  if (typeof window === "undefined") {
    return;
  }

  if (window.localStorage.getItem(RESET_MARKER_KEY)) {
    return;
  }

  OPERATIONAL_KEYS.forEach((key) => window.localStorage.removeItem(key));
  window.localStorage.setItem(RESET_MARKER_KEY, new Date().toISOString());
}
