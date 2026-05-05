import { listMasterData } from "./masterData";
import { listSuppliers } from "./suppliersData";
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

function formatMoney(value, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function seedProducts() {
  return [
    {
      id: "prd-001",
      code: "SBL-001",
      name: "Mercan Damla Kolye",
      salePrice: 2400,
      saleCurrency: "TRY",
      cost: 620,
      costCurrency: "TRY",
      categoryId: "cat-001",
      collectionId: "col-002",
      posCategoryId: "poscat-001",
      supplierId: "sup-001",
      barcode: "868000000001",
      supplierCode: "MINA-MDK-001",
      minStock: 2,
      supplierLeadTime: 7,
      stock: 12,
      productType: "kendi",
      salesTax: "%20",
      image: "/products/baroque-necklace.svg",
      isForSale: true,
      isForPurchase: true,
      useInPos: true,
      trackInventory: true,
      status: "Aktif",
      notes: "Showroom vitrini icin oncelikli urun.",
      features: [
        { id: "feat-001", name: "Tas", value: "Mercan" },
        { id: "feat-002", name: "Renk", value: "Somon" },
      ],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "prd-002",
      code: "SBL-002",
      name: "Sedef Kupe",
      salePrice: 1150,
      saleCurrency: "TRY",
      cost: 290,
      costCurrency: "TRY",
      categoryId: "cat-002",
      collectionId: "col-001",
      posCategoryId: "poscat-002",
      supplierId: "sup-002",
      barcode: "868000000002",
      supplierCode: "ANKA-SDF-015",
      minStock: 3,
      supplierLeadTime: 10,
      stock: 8,
      productType: "kendi",
      salesTax: "%20",
      image: "/products/coral-earrings.svg",
      isForSale: true,
      isForPurchase: true,
      useInPos: true,
      trackInventory: true,
      status: "Aktif",
      notes: "",
      features: [{ id: "feat-003", name: "Materyal", value: "Sedef" }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "prd-003",
      code: "SBL-003",
      name: "Nazar Bileklik",
      salePrice: 950,
      saleCurrency: "TRY",
      cost: 240,
      costCurrency: "TRY",
      categoryId: "cat-002",
      collectionId: "col-002",
      posCategoryId: "poscat-001",
      supplierId: "sup-003",
      barcode: "868000000003",
      supplierCode: "KNSY-NZR-027",
      minStock: 4,
      supplierLeadTime: 5,
      stock: 15,
      productType: "konsinye",
      salesTax: "%20",
      image: "/products/pearl-bracelet.svg",
      isForSale: true,
      isForPurchase: true,
      useInPos: true,
      trackInventory: true,
      status: "Aktif",
      notes: "",
      features: [{ id: "feat-004", name: "Tema", value: "Nazar" }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "prd-004",
      code: "SBL-004",
      name: "Ametist Yuzuk",
      salePrice: 1650,
      saleCurrency: "TRY",
      cost: 480,
      costCurrency: "TRY",
      categoryId: "cat-002",
      collectionId: "col-001",
      posCategoryId: "poscat-002",
      supplierId: "sup-002",
      barcode: "868000000004",
      supplierCode: "ATEL-AME-042",
      minStock: 1,
      supplierLeadTime: 12,
      stock: 4,
      productType: "kendi",
      salesTax: "%20",
      image: "/products/amethyst-ring.svg",
      isForSale: true,
      isForPurchase: true,
      useInPos: true,
      trackInventory: true,
      status: "Aktif",
      notes: "",
      features: [{ id: "feat-005", name: "Tas", value: "Ametist" }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "prd-005",
      code: "SBL-005",
      name: "Akik Kolye",
      salePrice: 1980,
      saleCurrency: "TRY",
      cost: 530,
      costCurrency: "TRY",
      categoryId: "cat-001",
      collectionId: "col-002",
      posCategoryId: "poscat-001",
      supplierId: "sup-004",
      barcode: "868000000005",
      supplierCode: "KNSY-AKI-008",
      minStock: 2,
      supplierLeadTime: 8,
      stock: 6,
      productType: "konsinye",
      salesTax: "%20",
      image: "/products/agate-necklace.svg",
      isForSale: true,
      isForPurchase: true,
      useInPos: true,
      trackInventory: true,
      status: "Aktif",
      notes: "",
      features: [{ id: "feat-006", name: "Tas", value: "Akik" }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "prd-006",
      code: "SBL-006",
      name: "Luna Set",
      salePrice: 3250,
      saleCurrency: "TRY",
      cost: 1120,
      costCurrency: "TRY",
      categoryId: "cat-001",
      collectionId: "col-001",
      posCategoryId: "poscat-001",
      supplierId: "sup-001",
      barcode: "868000000006",
      supplierCode: "LUNA-SET-003",
      minStock: 1,
      supplierLeadTime: 14,
      stock: 3,
      productType: "kendi",
      salesTax: "%20",
      image: "/products/luna-set.svg",
      isForSale: true,
      isForPurchase: true,
      useInPos: true,
      trackInventory: true,
      status: "Aktif",
      notes: "Set urunu, vitrinde birlikte sergilenir.",
      features: [{ id: "feat-007", name: "Parca", value: "3'lu set" }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];
}

function loadStore() {
  return requestCollectionSync("/api/products", seedProducts());
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

export async function listProductsFresh() {
  const [products, categories, collections, posCategories, suppliers] = await Promise.all([
    requestCollection("/api/products", seedProducts()),
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
