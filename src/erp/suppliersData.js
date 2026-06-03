import { listMasterData } from "./masterData";
import { mutateResourceSync, requestCollection, requestCollectionSync, requestJson, requestJsonSync } from "./apiClient";

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function loadStore() {
  return requestCollectionSync("/api/suppliers", []);
}

function normalizeSupplier(values, existingSupplier) {
  return {
    id: existingSupplier?.id || createId("sup"),
    shortCode: values.shortCode || "",
    company: values.company || "",
    logo: values.logo || "",
    contact: values.contact || "",
    email: values.email || "",
    phone: values.phone || "",
    city: values.city || "",
    iban: values.iban || "",
    taxNumber: values.taxNumber || "",
    taxOffice: values.taxOffice || "",
    address: values.address || "",
    procurementTypeId: values.procurementTypeId || null,
    paymentTermId: values.paymentTermId || null,
    status: values.status || "Aktif",
    note: values.note || "",
    createdAt: existingSupplier?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

function enrichSupplier(supplier) {
  const procurementMap = Object.fromEntries(listMasterData("procurement-types").map((item) => [item.id, item.name]));
  const paymentMap = Object.fromEntries(listMasterData("payment-terms").map((item) => [item.id, item.name]));

  return {
    ...supplier,
    procurementTypeLabel: procurementMap[supplier.procurementTypeId] || "-",
    paymentTermLabel: paymentMap[supplier.paymentTermId] || "-",
    initials: supplier.company
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase(),
  };
}

export function listSuppliers() {
  return loadStore().map(enrichSupplier);
}

export async function listSuppliersFresh({ slim = false } = {}) {
  const suppliersUrl = slim ? "/api/suppliers?slim=true" : "/api/suppliers";

  // slim modda tedarikçi listesi yeterli; etiket alanları gerekmez, master-data çekilmez
  if (slim) {
    const suppliers = await requestCollection(suppliersUrl, []);
    return suppliers.map((supplier) => ({
      ...supplier,
      procurementTypeLabel: "-",
      paymentTermLabel: "-",
      initials: supplier.company
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0] || "")
        .join("")
        .toUpperCase(),
    }));
  }

  const [suppliers, procurementTypes, paymentTerms] = await Promise.all([
    requestCollection(suppliersUrl, []),
    requestCollection("/api/master-data/procurement-types", []),
    requestCollection("/api/master-data/payment-terms", []),
  ]);
  const procurementMap = Object.fromEntries(procurementTypes.map((item) => [item.id, item.name]));
  const paymentMap = Object.fromEntries(paymentTerms.map((item) => [item.id, item.name]));

  return suppliers.map((supplier) => ({
    ...supplier,
    procurementTypeLabel: procurementMap[supplier.procurementTypeId] || "-",
    paymentTermLabel: paymentMap[supplier.paymentTermId] || "-",
    initials: supplier.company
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase(),
  }));
}

export function getSupplierById(supplierId) {
  return loadStore().find((item) => item.id === supplierId) || null;
}

export async function getSupplierByIdFresh(supplierId) {
  const data = await requestJson("GET", `/api/suppliers/${encodeURIComponent(supplierId)}`);
  return data?.item || null;
}

export function createSupplier(values) {
  return enrichSupplier(mutateResourceSync("POST", "/api/suppliers", values));
}

export function updateSupplier(supplierId, values) {
  return enrichSupplier(mutateResourceSync("PUT", `/api/suppliers/${encodeURIComponent(supplierId)}`, values));
}

export function importSuppliers(rows) {
  const currentStore = loadStore();
  const storeByEmail = new Map(currentStore.map((item) => [item.email || item.company, item]));

  rows.forEach((row) => {
    const key = row.email || row.company;
    if (!key) {
      return;
    }

    const existingSupplier = storeByEmail.get(key);
    const normalized = normalizeSupplier(row, existingSupplier);
    storeByEmail.set(key, normalized);
  });

  const nextStore = Array.from(storeByEmail.values());
  nextStore.forEach((record) => {
    const existing = currentStore.find((item) => item.id === record.id);
    if (existing) {
      mutateResourceSync("PUT", `/api/suppliers/${encodeURIComponent(record.id)}`, record);
    } else {
      mutateResourceSync("POST", "/api/suppliers", record);
    }
  });

  return loadStore().map(enrichSupplier);
}

export function deleteSupplier(supplierId) {
  const response = requestJsonSync("DELETE", `/api/suppliers/${encodeURIComponent(supplierId)}`);
  if (!response.ok) {
    throw new Error(response.message || "Tedarikci silinemedi.");
  }
}
