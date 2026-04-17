import { listStockMovementRows } from "./inventory.js";

export async function handleStockMovementsList(_req, res) {
  return res.json({
    ok: true,
    items: await listStockMovementRows(),
  });
}
