import { requestCollection, requestCollectionSync } from "./apiClient";

function seedStockLocations() {
  return [];
}

export function listStockLocations() {
  return requestCollectionSync("/api/stock-locations", seedStockLocations());
}

export async function listStockLocationsFresh() {
  return requestCollection("/api/stock-locations", seedStockLocations());
}

export function listStockLocationBalances(stockLocationId) {
  return requestCollectionSync(`/api/stock-locations/${encodeURIComponent(stockLocationId)}/balances`, []);
}

export async function listStockLocationBalancesFresh(stockLocationId) {
  return requestCollection(`/api/stock-locations/${encodeURIComponent(stockLocationId)}/balances`, []);
}
