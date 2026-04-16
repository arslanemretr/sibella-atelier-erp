import { mutateResourceSync, requestCollection, requestCollectionSync, requestJsonSync } from "./apiClient";

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function seedStores() {
  return [];
}

function loadStore() {
  return requestCollectionSync("/api/stores", seedStores());
}

function normalizeStore(values, existingStore) {
  return {
    id: existingStore?.id || createId("store"),
    code: values.code || "",
    name: values.name || "",
    taxNumber: values.taxNumber || "",
    commissionRate: Number(values.commissionRate || 0),
    address: values.address || "",
    contactName: values.contactName || "",
    contactPhone: values.contactPhone || "",
    contactEmail: values.contactEmail || "",
    stockLocationName: values.stockLocationName || "",
    createdAt: existingStore?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

function enrichStore(store) {
  return {
    ...store,
    initials: String(store.name || "")
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase(),
  };
}

export function listStores() {
  return loadStore().map(enrichStore);
}

export async function listStoresFresh() {
  const stores = await requestCollection("/api/stores", seedStores());
  return stores.map(enrichStore);
}

export function getStoreById(storeId) {
  const store = loadStore().find((item) => item.id === storeId);
  return store ? enrichStore(store) : null;
}

export function createStore(values) {
  const normalized = normalizeStore(values);
  return enrichStore(mutateResourceSync("POST", "/api/stores", normalized));
}

export function updateStore(storeId, values) {
  const normalized = normalizeStore(values, getStoreById(storeId));
  return enrichStore(mutateResourceSync("PUT", `/api/stores/${encodeURIComponent(storeId)}`, normalized));
}

export function deleteStore(storeId) {
  const response = requestJsonSync("DELETE", `/api/stores/${encodeURIComponent(storeId)}`);
  if (!response.ok) {
    throw new Error(response.message || "Magaza silinemedi.");
  }
}
