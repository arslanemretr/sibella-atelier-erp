import { listMasterData } from "./masterData";
import { listSuppliers } from "./suppliersData";
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

function formatMoney(value, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function loadStore() {
  return requestCollectionSync("/api/products", []);
}

function mapLookup(entityKey, idKey, labelKey) {
  return Object.fromEntries(listMasterData(entityKey).map((item) => [item[idKey], item[labelKey]]));
}

function enrichProduct(product) {
  const categoryMap = mapLookup("categories", "id", "fullPath");
  const collectionMap = mapLookup("collections", "id", "name");
  const posCategoryMap = mapLookup("pos-categories", "id", "name");
  const supplierMap = Object.fromEntries(listSuppliers().map((item) => [item.id, item.company]));
  const liveStock = Number(product?.stock || 0);
  const totalStock = Number(product?.totalStock ?? liveStock);

  return {
    ...product,
    stock: liveStock,
    totalStock,
    categoryLabel: categoryMap[product.categoryId] || "-",
    collectionLabel: collectionMap[product.collectionId] || "-",
    posCategoryLabel: posCategoryMap[product.posCategoryId] || "-",
    supplierLabel: supplierMap[product.supplierId] || "-",
    priceDisplay: formatMoney(product.salePrice, product.saleCurrency),
    costDisplay: formatMoney(product.cost, product.costCurrency),
    stockDisplay: String(totalStock),
    soldQuantity: 0,
  };
}

function enrichProductsWithLookups(products, lookups) {
  const {
    categories = [],
    collections = [],
    posCategories = [],
    suppliers = [],
  } = lookups || {};

  const categoryMap = Object.fromEntries(categories.map((item) => [item.id, item.fullPath]));
  const collectionMap = Object.fromEntries(collections.map((item) => [item.id, item.name]));
  const posCategoryMap = Object.fromEntries(posCategories.map((item) => [item.id, item.name]));
  const supplierMap = Object.fromEntries(suppliers.map((item) => [item.id, item.company]));

  return products.map((product) => {
    const liveStock = Number(product?.stock || 0);
    const totalStock = Number(product?.totalStock ?? liveStock);
    return {
      ...product,
      stock: liveStock,
      totalStock,
      categoryLabel: categoryMap[product.categoryId] || "-",
      collectionLabel: collectionMap[product.collectionId] || "-",
      posCategoryLabel: posCategoryMap[product.posCategoryId] || "-",
      supplierLabel: supplierMap[product.supplierId] || "-",
      priceDisplay: formatMoney(product.salePrice, product.saleCurrency),
      costDisplay: formatMoney(product.cost, product.costCurrency),
      stockDisplay: String(totalStock),
      soldQuantity: Number(product.soldQuantity || 0),
      returnQuantity: Number(product.returnQuantity || 0),
    };
  });
}

function normalizeProduct(values, existingProduct) {
  return {
    id: existingProduct?.id || createId("prd"),
    code: values.code || "",
    name: values.name || "",
    salePrice: Number(values.salePrice || 0),
    saleCurrency: values.saleCurrency || "TRY",
    cost: Number(values.cost || 0),
    costCurrency: values.costCurrency || "TRY",
    categoryId: values.categoryId || null,
    collectionId: values.collectionId || null,
    posCategoryId: values.posCategoryId || null,
    supplierId: values.supplierId || null,
    barcode: values.barcode || "",
    supplierCode: values.supplierCode || "",
    minStock: Number(values.minStock || 0),
    supplierLeadTime: Number(values.supplierLeadTime || 0),
    stock: existingProduct?.stock ?? Number(values.stock || 0),
    productType: values.productType || "kendi",
    salesTax: values.salesTax || "%20",
    image: values.image || "/products/baroque-necklace.svg",
    isForSale: Boolean(values.isForSale),
    isForPurchase: Boolean(values.isForPurchase),
    useInPos: Boolean(values.useInPos),
    trackInventory: Boolean(values.trackInventory),
    status: values.status || "Aktif",
    workflowStatus: values.workflowStatus || existingProduct?.workflowStatus || "Taslak",
    createdBy: values.createdBy || existingProduct?.createdBy || null,
    notes: values.notes || "",
    features: (values.features || [])
      .filter((item) => item && (item.name || item.value))
      .map((item, index) => ({
        id: item.id || `${existingProduct?.id || "prd"}-feat-${index + 1}`,
        name: item.name || "",
        value: item.value || "",
      })),
    createdAt: existingProduct?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

export function listProducts() {
  return loadStore().map((product) => enrichProduct(product));
}

export async function listProductsFresh({ slim = false } = {}) {
  const productsUrl = slim ? "/api/products?slim=true" : "/api/products";
  const [products, categories, collections, posCategories, suppliers] = await Promise.all([
    requestCollection(productsUrl, []),
    requestCollection("/api/master-data/categories", []),
    requestCollection("/api/master-data/collections", []),
    requestCollection("/api/master-data/pos-categories", []),
    requestCollection("/api/suppliers", []),
  ]);

  return enrichProductsWithLookups(products, {
    categories,
    collections,
    posCategories,
    suppliers,
  });
}

export function listProductsBySupplier(supplierId) {
  return loadStore()
    .filter((item) => item.supplierId === supplierId)
    .map((product) => enrichProduct(product));
}

export function getProductById(productId) {
  const product = loadStore().find((item) => item.id === productId);
  return product ? enrichProduct(product) : null;
}

export async function getProductByIdFresh(productId) {
  const data = await requestJson("GET", `/api/products/${encodeURIComponent(productId)}`);
  return data?.item || null;
}

// Sadece ham slim veri — enrichment yok. Editor/navigasyon için kullanılır.
export async function listProductsRawFresh() {
  return requestCollection("/api/products?slim=true", []);
}

// Kanban görünümü için id→image haritası — catalog modunda yalnızca görsel alanı kullanılır.
// Slim listeden bağımsız, tek seferlik çekilir.
export async function listProductImagesFresh() {
  const rows = await requestCollection("/api/products?catalog=true", []);
  return Object.fromEntries(rows.map((row) => [row.id, row.image || ""]));
}

// Catalog modu: slim + image dahil (teslimat editörü gibi görsel gerektiren yerler için).
export async function listProductsCatalogFresh() {
  return requestCollection("/api/products?catalog=true", []);
}

export function generateProductCodeForSupplier(supplierId, currentProductId) {
  const supplier = listSuppliers().find((item) => item.id === supplierId);
  const shortCode = String(supplier?.shortCode || "").trim().toUpperCase();
  if (!shortCode) {
    return "";
  }

  const supplierProductCount = loadStore().filter((item) => item.supplierId === supplierId && item.id !== currentProductId).length;
  return `${shortCode}${String(supplierProductCount + 1).padStart(4, "0")}`;
}

export function createProduct(values) {
  return enrichProduct(mutateResourceSync("POST", "/api/products", values));
}

export function updateProduct(productId, values) {
  return enrichProduct(mutateResourceSync("PUT", `/api/products/${encodeURIComponent(productId)}`, values));
}

// Async versiyonlar — sync enrichProduct zincirini (138 istek) atlar
export async function createProductAsync(values) {
  const data = await requestJson("POST", "/api/products", values);
  return data?.item || null;
}

export async function updateProductAsync(productId, values) {
  const data = await requestJson("PUT", `/api/products/${encodeURIComponent(productId)}`, values);
  return data?.item || null;
}

export function deleteProduct(productId) {
  const response = requestJsonSync("DELETE", `/api/products/${encodeURIComponent(productId)}`);
  if (!response.ok) {
    throw new Error(response.message || "Urun silinemedi.");
  }
}

export function importProducts(rows) {
  const currentStore = loadStore();
  const storeByCode = new Map(currentStore.map((item) => [item.code, item]));

  rows.forEach((row) => {
    if (!row.code) {
      return;
    }

    const existingProduct = storeByCode.get(row.code);
    const normalized = normalizeProduct(row, existingProduct);
    storeByCode.set(row.code, normalized);
  });

  const nextStore = Array.from(storeByCode.values());
  nextStore.forEach((record) => {
    const existing = currentStore.find((item) => item.id === record.id);
    if (existing) {
      mutateResourceSync("PUT", `/api/products/${encodeURIComponent(record.id)}`, record);
    } else {
      mutateResourceSync("POST", "/api/products", record);
    }
  });
  return loadStore().map((product) => enrichProduct(product));
}

export async function listProductStockLocationsFresh(productId) {
  return requestCollection(`/api/products/${encodeURIComponent(productId)}/stock-locations`, []);
}
