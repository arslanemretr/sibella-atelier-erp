import { requestCollection, requestCollectionSync } from "./apiClient";

export function listStockLocations() {
  return requestCollectionSync("/api/stock-locations", []);
}

export async function listStockLocationsFresh() {
  return requestCollection("/api/stock-locations", []);
}

export function listStockLocationBalances(stockLocationId) {
  return requestCollectionSync(`/api/stock-locations/${encodeURIComponent(stockLocationId)}/balances`, []);
}

export async function listStockLocationBalancesFresh(stockLocationId) {
  return requestCollection(`/api/stock-locations/${encodeURIComponent(stockLocationId)}/balances`, []);
}
