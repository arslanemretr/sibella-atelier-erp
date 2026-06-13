import { requestCollection, requestCollectionSync, requestJson } from "./apiClient";

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

export async function correctStockLocation(stockLocationId, { productId, actualQty, note }) {
  return requestJson("POST", `/api/stock-locations/${encodeURIComponent(stockLocationId)}/correct`, { productId, actualQty, note });
}
