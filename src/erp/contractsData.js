import { listSuppliers } from "./suppliersData";
import { readPersistentStore, writePersistentStore } from "./serverStore";

const STORAGE_KEY = "sibella.erp.contracts.v1";

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
  return readPersistentStore(STORAGE_KEY, seedContracts());
}

function saveStore(records) {
  writePersistentStore(STORAGE_KEY, records);
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
  const supplierMap = Object.fromEntries(
    listSuppliers().map((supplier) => [supplier.id, supplier.company]),
  );

  return {
    ...record,
    supplierName: supplierMap[record.supplierId] || "-",
  };
}

export function listContracts() {
  return loadStore().map(enrichContract);
}

export function createContract(values) {
  const store = loadStore();
  const record = normalizeContract(values);
  const nextStore = [record, ...store];
  saveStore(nextStore);
  return enrichContract(record);
}

export function updateContract(contractId, values) {
  const store = loadStore();
  const existingRecord = store.find((item) => item.id === contractId);
  if (!existingRecord) {
    return null;
  }

  const updatedRecord = normalizeContract(values, existingRecord);
  saveStore(store.map((item) => (item.id === contractId ? updatedRecord : item)));
  return enrichContract(updatedRecord);
}

export function deleteContract(contractId) {
  const store = loadStore();
  saveStore(store.filter((item) => item.id !== contractId));
}
