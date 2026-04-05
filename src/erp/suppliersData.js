import { listMasterData } from "./masterData";
import { readPersistentStore, writePersistentStore } from "./serverStore";

const STORAGE_KEY = "sibella.erp.suppliers.v1";

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function seedSuppliers() {
  return [
    {
      id: "sup-001",
      shortCode: "MINA",
      company: "Mina Aksesuar",
      contact: "Mina Demir",
      email: "mina@atelier.com",
      phone: "0532 455 11 22",
      city: "Istanbul",
      iban: "TR12 0006 2000 1234 5678 9012 34",
      taxNumber: "1234567890",
      taxOffice: "Beyoglu",
      address: "Cihangir Mah. Siraselviler Cad. No:12 Beyoglu / Istanbul",
      procurementTypeId: "proc-001",
      paymentTermId: "pay-002",
      status: "Aktif",
      note: "Konsinye calisilan ana tedarikci",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "sup-002",
      shortCode: "ANKA",
      company: "Anka Seramik",
      contact: "Can Ozturk",
      email: "anka@atelier.com",
      phone: "0533 101 10 10",
      city: "Kutahya",
      iban: "TR54 0006 4000 9988 7766 5544 33",
      taxNumber: "9988776655",
      taxOffice: "Kutahya",
      address: "Saray Mah. Seramik Sok. No:8 Merkez / Kutahya",
      procurementTypeId: "proc-002",
      paymentTermId: "pay-001",
      status: "Aktif",
      note: "Direkt alim yapiyor",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "sup-003",
      shortCode: "LORA",
      company: "Lora Design",
      contact: "Lora Koc",
      email: "lora@atelier.com",
      phone: "0537 777 34 55",
      city: "Izmir",
      iban: "TR88 0006 7000 4455 6677 8899 00",
      taxNumber: "4455667788",
      taxOffice: "Konak",
      address: "Alsancak Mah. Kordon Cad. No:45 Konak / Izmir",
      procurementTypeId: "proc-002",
      paymentTermId: "pay-002",
      status: "Aktif",
      note: "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];
}

function loadStore() {
  return readPersistentStore(STORAGE_KEY, seedSuppliers());
}

function saveStore(records) {
  writePersistentStore(STORAGE_KEY, records);
}

function normalizeSupplier(values, existingSupplier) {
  return {
    id: existingSupplier?.id || createId("sup"),
    shortCode: values.shortCode || "",
    company: values.company || "",
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

export function getSupplierById(supplierId) {
  return loadStore().find((item) => item.id === supplierId) || null;
}

export function createSupplier(values) {
  const store = loadStore();
  const record = normalizeSupplier(values);
  const nextStore = [record, ...store];
  saveStore(nextStore);
  return enrichSupplier(record);
}

export function updateSupplier(supplierId, values) {
  const store = loadStore();
  const existingSupplier = store.find((item) => item.id === supplierId);
  if (!existingSupplier) {
    return null;
  }

  const updatedRecord = normalizeSupplier(values, existingSupplier);
  saveStore(store.map((item) => (item.id === supplierId ? updatedRecord : item)));
  return enrichSupplier(updatedRecord);
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
  saveStore(nextStore);
  return nextStore.map(enrichSupplier);
}

export function deleteSupplier(supplierId) {
  const store = loadStore();
  saveStore(store.filter((item) => item.id !== supplierId));
}
