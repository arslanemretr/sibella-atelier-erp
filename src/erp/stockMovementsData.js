import { requestCollection, requestCollectionSync } from "./apiClient";

export function listStockMovements() {
  return requestCollectionSync("/api/stock-movements", []);
}

export async function listStockMovementsFresh() {
  return requestCollection("/api/stock-movements", []);
}
