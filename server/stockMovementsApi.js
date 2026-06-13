import { listStockMovementRows } from "./inventory.js";

export async function handleStockMovementsList(_req, res) {
  try {
    return res.json({ ok: true, items: await listStockMovementRows() });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error?.message || "Stok hareketleri alinamadi." });
  }
}
