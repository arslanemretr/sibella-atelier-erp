import { requestCollection, requestJson } from "./apiClient";

export async function listEarningsRecordsFresh() {
  return requestCollection("/api/supplier-earnings", []);
}

export async function upsertEarningsRecord(data) {
  const payload = await requestJson("POST", "/api/supplier-earnings", data);
  return payload?.item || null;
}
