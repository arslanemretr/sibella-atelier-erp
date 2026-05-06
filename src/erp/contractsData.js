import { listSuppliers, listSuppliersFresh } from "./suppliersData";
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

function seedContracts() {
  return [];
}

function loadStore() {
  return requestCollectionSync("/api/contracts", seedContracts());
}

function normalizeContract(values, existingContract) {
  return {
    id: existingContract?.id || createId("con"),
    supplierId: values.supplierId || null,
    startDate: values.startDate || "",
    endDate: values.endDate || "",
    commissionRate: Number(values.commissionRate || 0),
    pdfName: values.pdfName || "",
    pdfDataUrl: values.pdfDataUrl || "",
    createdAt: existingContract?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

function enrichContract(record) {
  const supplierMap = Object.fromEntries(listSuppliers().map((supplier) => [supplier.id, supplier.company]));
  return {
    ...record,
    supplierName: supplierMap[record.supplierId] || "-",
  };
}

export function listContracts() {
  return loadStore().map(enrichContract);
}

export async function listContractsFresh() {
  const [contracts, suppliers] = await Promise.all([
    requestCollection("/api/contracts", seedContracts()),
    listSuppliersFresh({ slim: true }),
  ]);
  const supplierMap = Object.fromEntries(suppliers.map((supplier) => [supplier.id, supplier.company]));
  return contracts.map((record) => ({
    ...record,
    supplierName: supplierMap[record.supplierId] || "-",
  }));
}

export function createContract(values) {
  return enrichContract(mutateResourceSync("POST", "/api/contracts", normalizeContract(values)));
}

export function updateContract(contractId, values) {
  return enrichContract(mutateResourceSync("PUT", `/api/contracts/${encodeURIComponent(contractId)}`, normalizeContract(values, { id: contractId })));
}

export function deleteContract(contractId) {
  const response = requestJsonSync("DELETE", `/api/contracts/${encodeURIComponent(contractId)}`);
  if (!response.ok) {
    throw new Error(response.message || "Sozlesme silinemedi.");
  }
}
