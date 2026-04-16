import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { ensureDatabaseReady, sqlExec, sqlMany, sqlOne } from "../server/db.js";
import { syncMainBalanceWithProductStock } from "../server/inventory.js";

const SHOPIFY_STORE_DOMAIN = String(process.env.SHOPIFY_STORE_DOMAIN || "").trim();
const SHOPIFY_STOREFRONT_ACCESS_TOKEN = String(process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || "").trim();
const SHOPIFY_API_VERSION = String(process.env.SHOPIFY_API_VERSION || "2026-04").trim();
const SHOPIFY_IMPORT_PAGE_SIZE = Math.min(Math.max(Number(process.env.SHOPIFY_IMPORT_PAGE_SIZE || 50), 1), 250);
const SHOPIFY_IMPORT_MAX_ITEMS = Math.max(Number(process.env.SHOPIFY_IMPORT_MAX_ITEMS || 0), 0);
const SHOPIFY_IMPORT_DRY_RUN = ["1", "true", "yes", "on"].includes(String(process.env.SHOPIFY_IMPORT_DRY_RUN || "").toLowerCase());
const SHOPIFY_IMAGE_DIR = path.resolve(process.cwd(), "public/products/shopify");
const DEFAULT_PRODUCT_IMAGE = "/products/baroque-necklace.svg";
const DEFAULT_COLLECTION_NAME = "Yaz 2026";
const CATEGORY_PATHS_BY_PRODUCT_TYPE = {
  "Kolye": ["Urunler / Marka / Kolye"],
  "Küpe": ["Urunler / Marka / Küpe", "Urunler / Marka / Kupe"],
  "Bileklik": ["Urunler / Marka / Bileklik"],
  "Yüzük": ["Urunler / Marka / Yüzük"],
  "Hal Hal": ["Urunler / Marka / Hal Hal"],
};

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function assertConfig() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL zorunludur.");
  }
  if (!SHOPIFY_STORE_DOMAIN) {
    throw new Error("SHOPIFY_STORE_DOMAIN zorunludur.");
  }
  if (!SHOPIFY_STOREFRONT_ACCESS_TOKEN) {
    throw new Error("SHOPIFY_STOREFRONT_ACCESS_TOKEN zorunludur.");
  }
}

function extractShopifyNumericId(gid) {
  const match = String(gid || "").match(/\/(\d+)$/);
  return match?.[1] || "";
}

function buildProductCode(gid, handle, sku) {
  if (String(sku || "").trim()) {
    return String(sku).trim().toUpperCase();
  }

  const numericId = extractShopifyNumericId(gid);
  if (numericId) {
    return `SHP-${numericId}`;
  }

  const normalizedHandle = String(handle || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();

  return normalizedHandle ? `SHP-${normalizedHandle}` : `SHP-${Date.now()}`;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractFileExtensionFromUrl(imageUrl) {
  try {
    const parsedUrl = new URL(imageUrl);
    const ext = path.extname(parsedUrl.pathname || "").toLowerCase();
    if (ext && ext.length <= 10) {
      return ext;
    }
  } catch {
    // ignore invalid urls
  }

  return "";
}

function extractFileExtensionFromContentType(contentType) {
  const normalized = String(contentType || "").toLowerCase();
  if (normalized.includes("image/jpeg")) return ".jpg";
  if (normalized.includes("image/png")) return ".png";
  if (normalized.includes("image/webp")) return ".webp";
  if (normalized.includes("image/gif")) return ".gif";
  if (normalized.includes("image/svg+xml")) return ".svg";
  return "";
}

async function downloadShopifyImage(product) {
  const imageUrl = String(product?.featuredImage?.url || "").trim();
  if (!imageUrl) {
    return null;
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Shopify gorseli indirilemedi: ${response.status}`);
  }

  const productSlug = slugify(product?.title) || slugify(product?.handle) || "shopify-product";
  const numericId = extractShopifyNumericId(product?.id) || slugify(product?.handle) || crypto.randomUUID();
  const extension = extractFileExtensionFromContentType(response.headers.get("content-type")) || extractFileExtensionFromUrl(imageUrl) || ".jpg";
  const fileName = `${productSlug}-${numericId}${extension}`;
  const diskPath = path.join(SHOPIFY_IMAGE_DIR, fileName);
  const buffer = Buffer.from(await response.arrayBuffer());

  await fs.mkdir(SHOPIFY_IMAGE_DIR, { recursive: true });
  await fs.writeFile(diskPath, buffer);

  return `/products/shopify/${fileName}`;
}

async function fetchShopifyProductsPage(cursor = null) {
  const query = `
    query GetProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
          node {
            id
            handle
            title
            description
            productType
            featuredImage {
              url
              altText
            }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            variants(first: 1) {
              edges {
                node {
                  sku
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_ACCESS_TOKEN,
    },
    body: JSON.stringify({
      query,
      variables: {
        first: SHOPIFY_IMPORT_PAGE_SIZE,
        after: cursor,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Shopify istegi basarisiz oldu: ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.errors?.length) {
    throw new Error(payload.errors.map((item) => item.message).join(" | "));
  }

  return payload?.data?.products || {
    pageInfo: {
      hasNextPage: false,
      endCursor: null,
    },
    edges: [],
  };
}

async function fetchAllShopifyProducts() {
  const items = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage && (!SHOPIFY_IMPORT_MAX_ITEMS || items.length < SHOPIFY_IMPORT_MAX_ITEMS)) {
    const page = await fetchShopifyProductsPage(cursor);
    const nextItems = (page.edges || []).map((edge) => edge.node).filter(Boolean);

    if (SHOPIFY_IMPORT_MAX_ITEMS) {
      const remaining = Math.max(SHOPIFY_IMPORT_MAX_ITEMS - items.length, 0);
      items.push(...nextItems.slice(0, remaining));
    } else {
      items.push(...nextItems);
    }

    hasNextPage = Boolean(page.pageInfo?.hasNextPage);
    cursor = page.pageInfo?.endCursor || null;
  }

  return items;
}

async function loadImportReferences() {
  const categoryPaths = [...new Set(Object.values(CATEGORY_PATHS_BY_PRODUCT_TYPE).flat())];
  const [categoryRows, collectionRow] = await Promise.all([
    sqlMany(
      `
        SELECT id, full_path
        FROM categories
        WHERE full_path = ANY($1)
      `,
      [categoryPaths],
    ),
    sqlOne("SELECT id, name FROM collections WHERE name = $1 LIMIT 1", [DEFAULT_COLLECTION_NAME]),
  ]);

  return {
    categoryIdByPath: new Map(categoryRows.map((row) => [String(row.full_path || ""), row.id])),
    collectionId: collectionRow?.id || null,
  };
}

function resolveCategoryId(productType, references) {
  const candidates = CATEGORY_PATHS_BY_PRODUCT_TYPE[String(productType || "").trim()] || [];
  for (const pathLabel of candidates) {
    const categoryId = references.categoryIdByPath.get(pathLabel);
    if (categoryId) {
      return categoryId;
    }
  }
  return null;
}

function mapShopifyProductToRecord(product, existingRecord, localImagePath, references) {
  const salePrice = Number(product?.priceRange?.minVariantPrice?.amount || 0);
  const saleCurrency = String(product?.priceRange?.minVariantPrice?.currencyCode || "TRY").trim() || "TRY";
  const sku = product?.variants?.edges?.[0]?.node?.sku || "";
  const code = existingRecord?.code || buildProductCode(product.id, product.handle, sku);
  const createdAt = existingRecord?.created_at || nowIso();
  const categoryId = resolveCategoryId(product?.productType, references);

  return {
    id: existingRecord?.id || createId("prd"),
    code,
    name: String(product?.title || "").trim(),
    salePrice,
    saleCurrency,
    cost: Number(existingRecord?.cost || 0),
    costCurrency: existingRecord?.cost_currency || saleCurrency,
    categoryId: categoryId || existingRecord?.category_id || null,
    collectionId: references.collectionId || existingRecord?.collection_id || null,
    posCategoryId: existingRecord?.pos_category_id || null,
    supplierId: existingRecord?.supplier_id || null,
    barcode: existingRecord?.barcode || "",
    supplierCode: existingRecord?.supplier_code || String(product?.handle || "").trim(),
    minStock: Number(existingRecord?.min_stock || 0),
    supplierLeadTime: Number(existingRecord?.supplier_lead_time || 0),
    stock: Number(existingRecord?.stock || 0),
    productType: existingRecord?.product_type || "kendi",
    salesTax: existingRecord?.sales_tax || "%20",
    image: localImagePath || existingRecord?.image || DEFAULT_PRODUCT_IMAGE,
    isForSale: existingRecord?.is_for_sale ?? true,
    isForPurchase: existingRecord?.is_for_purchase ?? true,
    useInPos: existingRecord?.use_in_pos ?? true,
    trackInventory: existingRecord?.track_inventory ?? false,
    status: existingRecord?.status || "Aktif",
    workflowStatus: existingRecord?.workflow_status || "Onaylandi",
    shopifyProductGid: product.id,
    createdBy: existingRecord?.created_by || null,
    notes: String(product?.description || existingRecord?.notes || "").trim(),
    createdAt,
    updatedAt: nowIso(),
  };
}

async function findExistingProductByShopifyGid(shopifyProductGid) {
  return sqlOne(
    `
      SELECT *
      FROM products
      WHERE shopify_product_gid = $1
      LIMIT 1
    `,
    [shopifyProductGid],
  );
}

async function upsertProduct(record) {
  const existingByShopify = await findExistingProductByShopifyGid(record.shopifyProductGid);

  if (!existingByShopify) {
    await sqlExec(
      `
        INSERT INTO products (
          id, code, name, sale_price, sale_currency, cost, cost_currency, category_id, collection_id,
          pos_category_id, supplier_id, barcode, supplier_code, min_stock, supplier_lead_time, stock,
          product_type, sales_tax, image, is_for_sale, is_for_purchase, use_in_pos, track_inventory,
          status, workflow_status, shopify_product_gid, created_by, notes, created_at, updated_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29::timestamptz,$30::timestamptz
        )
      `,
      [
        record.id,
        record.code,
        record.name,
        record.salePrice,
        record.saleCurrency,
        record.cost,
        record.costCurrency,
        record.categoryId,
        record.collectionId,
        record.posCategoryId,
        record.supplierId,
        record.barcode,
        record.supplierCode,
        record.minStock,
        record.supplierLeadTime,
        record.stock,
        record.productType,
        record.salesTax,
        record.image,
        record.isForSale,
        record.isForPurchase,
        record.useInPos,
        record.trackInventory,
        record.status,
        record.workflowStatus,
        record.shopifyProductGid,
        record.createdBy,
        record.notes,
        record.createdAt,
        record.updatedAt,
      ],
    );
    await syncMainBalanceWithProductStock(record.id);
    return "created";
  }

  await sqlExec(
    `
      UPDATE products
      SET
        code = $2,
        name = $3,
        sale_price = $4,
        sale_currency = $5,
        cost = $6,
        cost_currency = $7,
        category_id = $8,
        collection_id = $9,
        pos_category_id = $10,
        supplier_id = $11,
        barcode = $12,
        supplier_code = $13,
        min_stock = $14,
        supplier_lead_time = $15,
        stock = $16,
        product_type = $17,
        sales_tax = $18,
        image = $19,
        is_for_sale = $20,
        is_for_purchase = $21,
        use_in_pos = $22,
        track_inventory = $23,
        status = $24,
        workflow_status = $25,
        shopify_product_gid = $26,
        created_by = $27,
        notes = $28,
        updated_at = $29::timestamptz
      WHERE id = $1
    `,
    [
      existingByShopify.id,
      record.code,
      record.name,
      record.salePrice,
      record.saleCurrency,
      record.cost,
      record.costCurrency,
      record.categoryId,
      record.collectionId,
      record.posCategoryId,
      record.supplierId,
      record.barcode,
      record.supplierCode,
      record.minStock,
      record.supplierLeadTime,
      record.stock,
      record.productType,
      record.salesTax,
      record.image,
      record.isForSale,
      record.isForPurchase,
      record.useInPos,
      record.trackInventory,
      record.status,
      record.workflowStatus,
      record.shopifyProductGid,
      record.createdBy,
      record.notes,
      record.updatedAt,
    ],
  );
  await syncMainBalanceWithProductStock(existingByShopify.id);
  return "updated";
}

async function main() {
  assertConfig();
  await ensureDatabaseReady();

  const references = await loadImportReferences();
  const shopifyProducts = await fetchAllShopifyProducts();
  let createdCount = 0;
  let updatedCount = 0;

  for (const product of shopifyProducts) {
    const existingRecord = await findExistingProductByShopifyGid(product.id);
    const localImagePath = SHOPIFY_IMPORT_DRY_RUN
      ? (existingRecord?.image || DEFAULT_PRODUCT_IMAGE)
      : await downloadShopifyImage(product).catch(() => existingRecord?.image || DEFAULT_PRODUCT_IMAGE);
    const record = mapShopifyProductToRecord(product, existingRecord, localImagePath, references);

    if (SHOPIFY_IMPORT_DRY_RUN) {
      if (existingRecord) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }
      continue;
    }

    const action = await upsertProduct(record);
    if (action === "created") {
      createdCount += 1;
    } else if (action === "updated") {
      updatedCount += 1;
    }
  }

  const totalRows = await sqlOne("SELECT COUNT(*)::int AS count FROM products");
  console.log(JSON.stringify({
    ok: true,
    dryRun: SHOPIFY_IMPORT_DRY_RUN,
    fetched: shopifyProducts.length,
    created: createdCount,
    updated: updatedCount,
    totalProductsInDb: Number(totalRows?.count || 0),
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
