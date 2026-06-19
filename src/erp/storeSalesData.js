import { requestCollection, requestJson } from "./apiClient";

// Mağaza satışları — liste/tekil/oluştur/güncelle/sil + sonraki satış no.

export async function listStoreSalesFresh(filters = {}) {
  const params = new URLSearchParams();
  if (filters.storeId) params.set("storeId", filters.storeId);
  if (filters.periodKey) params.set("periodKey", filters.periodKey);
  if (filters.periodFrom) params.set("periodFrom", filters.periodFrom);
  if (filters.periodTo) params.set("periodTo", filters.periodTo);
  const qs = params.toString();
  return requestCollection(`/api/store-sales${qs ? `?${qs}` : ""}`, []);
}

export async function getStoreSaleFresh(saleId) {
  const payload = await requestJson("GET", `/api/store-sales/${encodeURIComponent(saleId)}`);
  return payload?.item || null;
}

export async function getNextStoreSaleNoFresh(storeId) {
  const payload = await requestJson("GET", `/api/store-sales/next-no?storeId=${encodeURIComponent(storeId)}`);
  return payload?.saleNo || "";
}

export async function createStoreSale(values) {
  const payload = await requestJson("POST", "/api/store-sales", values);
  if (!payload?.item) throw new Error("Satis kaydedilemedi.");
  return payload.item;
}

export async function updateStoreSale(saleId, values) {
  const payload = await requestJson("PUT", `/api/store-sales/${encodeURIComponent(saleId)}`, values);
  if (!payload?.item) throw new Error("Satis guncellenemedi.");
  return payload.item;
}

export async function deleteStoreSale(saleId) {
  return requestJson("DELETE", `/api/store-sales/${encodeURIComponent(saleId)}`);
}
