import { readPersistentStore, writePersistentStore } from "./serverStore";

const STORAGE_KEY = "sibella.erp.masterData.v1";

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function categoryPath(values) {
  return [values.level1, values.level2, values.level3, values.level4].filter(Boolean).join(" / ");
}

export const masterDataDefinitions = {
  categories: {
    entityKey: "categories",
    title: "Kategori Tanimlari",
    description: "Kategori / Alt Kategori / Alt Kategori seklinde 4 seviyeli agac yapisi.",
    relationText: ["Urun kartlarinda kategori seciminde kullanilir.", "Stok ve rapor filtrelerinde hiyerarsik gruplama saglar."],
    createLabel: "Kategori Kaydet",
    editTitle: "Kategori Duzenle",
    fields: [
      { name: "level1", label: "1. Seviye", required: true },
      { name: "level2", label: "2. Seviye" },
      { name: "level3", label: "3. Seviye" },
      { name: "level4", label: "4. Seviye" },
      { name: "status", label: "Durum", type: "select", options: ["Aktif", "Pasif"], required: true },
    ],
    columns: [
      { key: "level1", label: "1. Seviye" },
      { key: "level2", label: "2. Seviye" },
      { key: "level3", label: "3. Seviye" },
      { key: "level4", label: "4. Seviye" },
      { key: "fullPath", label: "Tam Yol" },
      { key: "status", label: "Durum" },
    ],
    normalize(values, existingRecord) {
      return {
        id: existingRecord?.id || createId("cat"),
        level1: values.level1 || "",
        level2: values.level2 || "",
        level3: values.level3 || "",
        level4: values.level4 || "",
        fullPath: categoryPath(values),
        status: values.status || "Aktif",
        createdAt: existingRecord?.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    },
    emptyValues: { level1: "", level2: "", level3: "", level4: "", status: "Aktif" },
    seed: [
      { id: "cat-001", level1: "Urunler", level2: "Konsinye", level3: "Kolye", level4: "Seramik", fullPath: "Urunler / Konsinye / Kolye / Seramik", status: "Aktif", createdAt: nowIso(), updatedAt: nowIso() },
      { id: "cat-002", level1: "Urunler", level2: "Kendi Uretim", level3: "Kupe", level4: "Nazar", fullPath: "Urunler / Kendi Uretim / Kupe / Nazar", status: "Aktif", createdAt: nowIso(), updatedAt: nowIso() },
    ],
  },
  collections: {
    entityKey: "collections",
    title: "Koleksiyon Tanimlari",
    description: "Urun kartlarinda kullanilacak koleksiyon tanimlari.",
    relationText: ["Urun kartlarinda koleksiyon secimi icin referans tablodur."],
    createLabel: "Koleksiyon Kaydet",
    editTitle: "Koleksiyon Duzenle",
    fields: [
      { name: "name", label: "Koleksiyon Adi", required: true },
      { name: "description", label: "Aciklama", type: "textarea" },
      { name: "status", label: "Durum", type: "select", options: ["Aktif", "Pasif"], required: true },
    ],
    columns: [
      { key: "name", label: "Koleksiyon" },
      { key: "description", label: "Aciklama" },
      { key: "status", label: "Durum" },
    ],
    normalize(values, existingRecord) {
      return {
        id: existingRecord?.id || createId("col"),
        name: values.name || "",
        description: values.description || "",
        status: values.status || "Aktif",
        createdAt: existingRecord?.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    },
    emptyValues: { name: "", description: "", status: "Aktif" },
    seed: [
      { id: "col-001", name: "Atelier Core", description: "Temel seri", status: "Aktif", createdAt: nowIso(), updatedAt: nowIso() },
      { id: "col-002", name: "Yaz 2026", description: "Sezon koleksiyonu", status: "Aktif", createdAt: nowIso(), updatedAt: nowIso() },
    ],
  },
  "pos-categories": {
    entityKey: "pos-categories",
    title: "POS Kategori Tanimlari",
    description: "Magaza ekraninda kullanilacak POS kategori gruplari.",
    relationText: ["POS urun filtrelerinde ve hizli satis gruplarinda kullanilir."],
    createLabel: "POS Kategori Kaydet",
    editTitle: "POS Kategori Duzenle",
    fields: [
      { name: "name", label: "POS Kategori Adi", required: true },
      { name: "description", label: "Aciklama", type: "textarea" },
      { name: "status", label: "Durum", type: "select", options: ["Aktif", "Pasif"], required: true },
    ],
    columns: [
      { key: "name", label: "POS Kategori" },
      { key: "description", label: "Aciklama" },
      { key: "status", label: "Durum" },
    ],
    normalize(values, existingRecord) {
      return {
        id: existingRecord?.id || createId("poscat"),
        name: values.name || "",
        description: values.description || "",
        status: values.status || "Aktif",
        createdAt: existingRecord?.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    },
    emptyValues: { name: "", description: "", status: "Aktif" },
    seed: [
      { id: "poscat-001", name: "Kolye", description: "Kolye urun grubu", status: "Aktif", createdAt: nowIso(), updatedAt: nowIso() },
      { id: "poscat-002", name: "Kupe", description: "Kupe urun grubu", status: "Aktif", createdAt: nowIso(), updatedAt: nowIso() },
    ],
  },
  "barcode-standards": {
    entityKey: "barcode-standards",
    title: "Barkod Standartlari",
    description: "Prefix, ayirici ve hane mantigina gore barkod standardi tanimlanir.",
    relationText: ["Urun kartlarinda barkod uretim standardi olarak referans verilir."],
    createLabel: "Standart Kaydet",
    editTitle: "Barkod Standarti Duzenle",
    fields: [
      { name: "name", label: "Standart Adi", required: true },
      { name: "prefix", label: "Prefix", required: true },
      { name: "separator", label: "Ayirici", required: true },
      { name: "digits", label: "Hane", type: "number", required: true },
      { name: "nextNumber", label: "Siradaki No", type: "number", required: true },
      { name: "status", label: "Durum", type: "select", options: ["Aktif", "Pasif"], required: true },
    ],
    columns: [
      { key: "name", label: "Standart" },
      { key: "prefix", label: "Prefix" },
      { key: "separator", label: "Ayirici" },
      { key: "digits", label: "Hane" },
      { key: "nextNumber", label: "Siradaki No" },
      { key: "status", label: "Durum" },
    ],
    normalize(values, existingRecord) {
      return {
        id: existingRecord?.id || createId("barcode"),
        name: values.name || "",
        prefix: values.prefix || "",
        separator: values.separator || "",
        digits: Number(values.digits || 0),
        nextNumber: Number(values.nextNumber || 0),
        status: values.status || "Aktif",
        createdAt: existingRecord?.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    },
    emptyValues: { name: "", prefix: "SBL", separator: "-", digits: 6, nextNumber: 1, status: "Aktif" },
    seed: [
      { id: "barcode-001", name: "Sibella Urun", prefix: "SBL", separator: "-", digits: 6, nextNumber: 128, status: "Aktif", createdAt: nowIso(), updatedAt: nowIso() },
    ],
  },
  "procurement-types": {
    entityKey: "procurement-types",
    title: "Tedarik Tipleri",
    description: "Direkt alim ve konsinye gibi tedarik tipleri.",
    relationText: ["Tedarikci kartlari ve satin alma belgelerinde referans olarak kullanilir."],
    createLabel: "Tedarik Tipi Kaydet",
    editTitle: "Tedarik Tipi Duzenle",
    fields: [
      { name: "name", label: "Tedarik Tipi", required: true },
      { name: "description", label: "Aciklama", type: "textarea" },
      { name: "status", label: "Durum", type: "select", options: ["Aktif", "Pasif"], required: true },
    ],
    columns: [
      { key: "name", label: "Tedarik Tipi" },
      { key: "description", label: "Aciklama" },
      { key: "status", label: "Durum" },
    ],
    normalize(values, existingRecord) {
      return {
        id: existingRecord?.id || createId("proc"),
        name: values.name || "",
        description: values.description || "",
        status: values.status || "Aktif",
        createdAt: existingRecord?.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    },
    emptyValues: { name: "", description: "", status: "Aktif" },
    seed: [
      { id: "proc-001", name: "Konsinye", description: "Satildikca odeme modeli", status: "Aktif", createdAt: nowIso(), updatedAt: nowIso() },
      { id: "proc-002", name: "Direkt Alim", description: "Direkt satin alma modeli", status: "Aktif", createdAt: nowIso(), updatedAt: nowIso() },
    ],
  },
  "payment-terms": {
    entityKey: "payment-terms",
    title: "Odeme Kosullari",
    description: "Vade ve aciklama bilgisi ile odeme kosulu tanimlari.",
    relationText: ["Tedarikci kartlari ve satin alma kayitlarinda odeme plani seciminde kullanilir."],
    createLabel: "Odeme Kosulu Kaydet",
    editTitle: "Odeme Kosulu Duzenle",
    fields: [
      { name: "name", label: "Odeme Kosulu", required: true },
      { name: "days", label: "Gun", type: "number", required: true },
      { name: "description", label: "Aciklama", type: "textarea" },
      { name: "status", label: "Durum", type: "select", options: ["Aktif", "Pasif"], required: true },
    ],
    columns: [
      { key: "name", label: "Odeme Kosulu" },
      { key: "days", label: "Gun" },
      { key: "description", label: "Aciklama" },
      { key: "status", label: "Durum" },
    ],
    normalize(values, existingRecord) {
      return {
        id: existingRecord?.id || createId("pay"),
        name: values.name || "",
        days: Number(values.days || 0),
        description: values.description || "",
        status: values.status || "Aktif",
        createdAt: existingRecord?.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
    },
    emptyValues: { name: "", days: 0, description: "", status: "Aktif" },
    seed: [
      { id: "pay-001", name: "Pesin", days: 0, description: "Pesin odeme", status: "Aktif", createdAt: nowIso(), updatedAt: nowIso() },
      { id: "pay-002", name: "30 Gun Vade", days: 30, description: "Teslim sonrasi odeme", status: "Aktif", createdAt: nowIso(), updatedAt: nowIso() },
    ],
  },
};

function buildInitialStore() {
  return Object.fromEntries(
    Object.entries(masterDataDefinitions).map(([key, definition]) => [key, definition.seed]),
  );
}

export function loadMasterDataStore() {
  const parsed = readPersistentStore(STORAGE_KEY, buildInitialStore());
  return Object.fromEntries(
    Object.keys(masterDataDefinitions).map((key) => [key, parsed[key] || masterDataDefinitions[key].seed]),
  );
}

export function saveMasterDataStore(store) {
  writePersistentStore(STORAGE_KEY, store);
}

export function listMasterData(entityKey) {
  const store = loadMasterDataStore();
  return store[entityKey] || [];
}

export function createMasterData(entityKey, values) {
  const definition = masterDataDefinitions[entityKey];
  const store = loadMasterDataStore();
  const record = definition.normalize(values);
  const nextStore = {
    ...store,
    [entityKey]: [record, ...(store[entityKey] || [])],
  };

  saveMasterDataStore(nextStore);
  return record;
}

export function updateMasterData(entityKey, recordId, values) {
  const definition = masterDataDefinitions[entityKey];
  const store = loadMasterDataStore();
  const currentRecords = store[entityKey] || [];
  const existingRecord = currentRecords.find((item) => item.id === recordId);
  if (!existingRecord) {
    return null;
  }

  const updatedRecord = definition.normalize(values, existingRecord);
  const nextStore = {
    ...store,
    [entityKey]: currentRecords.map((item) => (item.id === recordId ? updatedRecord : item)),
  };

  saveMasterDataStore(nextStore);
  return updatedRecord;
}
