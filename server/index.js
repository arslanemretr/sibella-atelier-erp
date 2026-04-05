/* global process */
import express from "express";
import { getStoreValue, listStoreKeys, setStoreValue } from "./db.js";

const app = express();
const port = Number(process.env.API_PORT || 4001);

app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "erp-db-api",
    date: new Date().toISOString(),
  });
});

app.get("/api/store", (_req, res) => {
  res.json({
    items: listStoreKeys(),
  });
});

app.get("/api/store/:key", (req, res) => {
  const record = getStoreValue(req.params.key);
  if (!record) {
    return res.status(404).json({
      ok: false,
      message: "Store kaydi bulunamadi.",
    });
  }

  return res.json({
    ok: true,
    key: req.params.key,
    ...record,
  });
});

app.put("/api/store/:key", (req, res) => {
  const { value } = req.body || {};
  if (typeof value === "undefined") {
    return res.status(400).json({
      ok: false,
      message: "value zorunludur.",
    });
  }

  const saved = setStoreValue(req.params.key, value);
  return res.json({
    ok: true,
    ...saved,
  });
});

app.listen(port, () => {
  console.log(`ERP DB API running on http://localhost:${port}`);
});
