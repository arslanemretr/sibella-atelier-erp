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
// productType: "kendi" | "konsinye" | null (tümü)
export async function listProductsRawFresh({ productType } = {}) {
  const url = productType
    ? `/api/products?slim=true&productType=${encodeURIComponent(productType)}`
    : "/api/products?slim=true";
  return requestCollection(url, []);
}

// Kanban görünümü için id→image haritası — catalog modunda yalnızca görsel alanı kullanılır.
// Slim listeden bağımsız, tek seferlik çekilir.
export async function listProductImagesFresh() {
  const rows = await requestCollection("/api/products?catalog=true", []);
  return Object.fromEntries(rows.map((row) => [row.id, row.image || ""]));
}

// Catalog modu: slim + image dahil (teslimat editörü gibi görsel gerektiren yerler için).
// productType: "kendi" | "konsinye" | null (tümü)
export async function listProductsCatalogFresh({ productType } = {}) {
  const url = productType
    ? `/api/products?catalog=true&productType=${encodeURIComponent(productType)}`
    : "/api/products?catalog=true";
  return requestCollection(url, []);
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

// SBSE sayacindan sonraki urun kodunu getirir (artirmaz — sadece onizleme)
export async function getNextProductCodeFresh() {
  try {
    const payload = await requestJson("GET", "/api/products/next-code");
    return payload || null;
  } catch {
    return null;
  }
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

// Iki fiyatli yapi — fiyat revizyonu + gecmis + toplu fiyat
// payload: { merkezPrice?, storePrice?, source?, referenceId? }
export async function updateProductPrice(productId, payload) {
  const data = await requestJson("PATCH", `/api/products/${encodeURIComponent(productId)}/price`, payload);
  return data?.item || null;
}

export async function listProductPriceHistoryFresh(params = {}) {
  const query = new URLSearchParams();
  if (params.productId) query.set("productId", params.productId);
  if (params.type) query.set("type", params.type);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  const qs = query.toString();
  return requestCollection(`/api/products/price-history${qs ? `?${qs}` : ""}`, []);
}

// payload: { productIds:[], mode:'percent'|'fixed', target:'merkez'|'magaza'|'ikisi', value }
export async function bulkUpdateProductPrices(payload) {
  const data = await requestJson("POST", "/api/products/prices/bulk", payload);
  return data || { ok: false };
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
