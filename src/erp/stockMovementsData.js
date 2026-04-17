import { requestCollection, requestCollectionSync } from "./apiClient";

function seedStockMovements() {
  return [];
}

export function listStockMovements() {
  return requestCollectionSync("/api/stock-movements", seedStockMovements());
}

export async function listStockMovementsFresh() {
  return requestCollection("/api/stock-movements", seedStockMovements());
}
