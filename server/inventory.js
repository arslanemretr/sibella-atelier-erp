import { sqlExec, sqlMany, sqlOne, withTransaction } from "./db.js";

export const MAIN_STOCK_LOCATION_NAME = "Şarköy Mağaza";

function nowIso() {
  return new Date().toISOString();
}

function createExecutor(tx) {
  if (!tx) {
    return {
      one: sqlOne,
      many: sqlMany,
      exec: sqlExec,
    };
  }

  return tx;
}

export async function getMainStockLocation(tx) {
  const executor = createExecutor(tx);
  return executor.one(
    `
      SELECT *
      FROM stock_locations
      WHERE is_default_main = TRUE
      ORDER BY created_at ASC NULLS LAST, id ASC
      LIMIT 1
    `,
  );
}

export async function syncMainBalanceWithProductStock(productId, tx) {
  const executor = createExecutor(tx);
  const mainLocation = await getMainStockLocation(executor);
  if (!mainLocation || !productId) {
    return null;
  }

  const product = await executor.one("SELECT id, stock FROM products WHERE id = $1", [productId]);
  if (!product) {
    return null;
  }

  await executor.exec(
    `
      INSERT INTO stock_location_balances (stock_location_id, product_id, quantity, updated_at)
      VALUES ($1, $2, $3, $4::timestamptz)
      ON CONFLICT (stock_location_id, product_id)
      DO UPDATE
      SET quantity = EXCLUDED.quantity,
          updated_at = EXCLUDED.updated_at
    `,
    [mainLocation.id, product.id, Number(product.stock || 0), nowIso()],
  );

  return {
    stockLocationId: mainLocation.id,
    productId: product.id,
    quantity: Number(product.stock || 0),
  };
}

export async function applyProductStockDelta(productId, delta, tx) {
  const executor = createExecutor(tx);
  const product = await executor.one(
    `
      UPDATE products
      SET stock = GREATEST(0, COALESCE(stock, 0) + $2),
          updated_at = $3::timestamptz
      WHERE id = $1
      RETURNING id, stock
    `,
    [productId, Number(delta || 0), nowIso()],
  );

  if (!product) {
    return null;
  }

  await syncMainBalanceWithProductStock(product.id, executor);
  return {
    productId: product.id,
    stock: Number(product.stock || 0),
  };
}

export async function assertProductStockAvailable(lines, tx) {
  const executor = createExecutor(tx);
  const quantitiesByProductId = new Map();

  (lines || []).forEach((line) => {
    if (!line?.productId) {
      return;
    }
    quantitiesByProductId.set(
      line.productId,
      Number(quantitiesByProductId.get(line.productId) || 0) + Number(line.quantity || 0),
    );
  });

  for (const [productId, requiredQuantity] of quantitiesByProductId.entries()) {
    const product = await executor.one("SELECT id, name, stock FROM products WHERE id = $1", [productId]);
    const available = Number(product?.stock || 0);
    if (!product || available < Number(requiredQuantity || 0)) {
      const productName = product?.name || "Urun";
      throw new Error(`${productName} icin yeterli merkez stok bulunmuyor.`);
    }
  }
}

export async function incrementStockLocationBalance(stockLocationId, productId, quantity, tx) {
  const executor = createExecutor(tx);
  await executor.exec(
    `
      INSERT INTO stock_location_balances (stock_location_id, product_id, quantity, updated_at)
      VALUES ($1, $2, $3, $4::timestamptz)
      ON CONFLICT (stock_location_id, product_id)
      DO UPDATE
      SET quantity = stock_location_balances.quantity + EXCLUDED.quantity,
          updated_at = EXCLUDED.updated_at
    `,
    [stockLocationId, productId, Number(quantity || 0), nowIso()],
  );
}

export async function listProductStockLocationBalances(productId) {
  const rows = await sqlMany(
    `
      SELECT
        slb.stock_location_id,
        sl.name AS stock_location_name,
        sl.is_default_main,
        sl.store_id,
        s.name AS store_name,
        slb.quantity,
        slb.updated_at
      FROM stock_location_balances slb
      INNER JOIN stock_locations sl ON sl.id = slb.stock_location_id
      LEFT JOIN stores s ON s.id = sl.store_id
      WHERE slb.product_id = $1 AND COALESCE(slb.quantity, 0) > 0
      ORDER BY sl.is_default_main DESC, sl.name ASC
    `,
    [productId],
  );

  return rows.map((row) => ({
    stockLocationId: row.stock_location_id,
    stockLocationName: row.stock_location_name || "",
    isDefaultMain: Boolean(row.is_default_main),
    storeId: row.store_id || null,
    storeName: row.store_name || "",
    quantity: Number(row.quantity || 0),
    updatedAt: row.updated_at || null,
  }));
}

export async function withInventoryTransaction(callback) {
  return withTransaction(callback);
}
