/* global process */
import express from "express";
import {
  handleForgotPasswordConfirm,
  handleForgotPasswordRequest,
  requireRole,
  handleLogin,
  handleLogout,
  handleSession,
  migrateLegacyPasswords,
  requireAuth,
} from "./auth.js";
import { handleDashboardSummary } from "./dashboard.js";
import { getDatabaseRuntimeInfo, getStoreValue, listStoreKeys, setStoreValue } from "./db.js";
import { handleSmtpTestEmail } from "./smtp.js";

const app = express();
const port = Number(process.env.API_PORT || 4001);

app.use(express.json({ limit: "25mb" }));

void migrateLegacyPasswords().catch((error) => {
  console.error("Legacy password migration hatasi:", error?.message || error);
});

app.get("/api/health", (_req, res) => {
  const runtime = getDatabaseRuntimeInfo();
  res.json({
    ok: true,
    service: "erp-db-api",
    date: new Date().toISOString(),
    db: runtime,
  });
});

app.post("/api/auth/login", handleLogin);
app.get("/api/auth/session", handleSession);
app.post("/api/auth/logout", handleLogout);
app.post("/api/auth/forgot-password/request", handleForgotPasswordRequest);
app.post("/api/auth/forgot-password/confirm", handleForgotPasswordConfirm);
app.get("/api/dashboard/summary", requireRole("Yonetici", "Magaza", "Muhasebe"), handleDashboardSummary);
app.post("/api/settings/smtp/test", requireRole("Yonetici"), handleSmtpTestEmail);

app.use("/api/store", requireAuth);

app.get("/api/store", async (_req, res) => {
  res.json({
    items: await listStoreKeys(),
  });
});

app.get("/api/store/:key", async (req, res) => {
  const record = await getStoreValue(req.params.key);
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

app.put("/api/store/:key", async (req, res) => {
  const { value } = req.body || {};
  if (typeof value === "undefined") {
    return res.status(400).json({
      ok: false,
      message: "value zorunludur.",
    });
  }

  const saved = await setStoreValue(req.params.key, value);
  return res.json({
    ok: true,
    ...saved,
  });
});

app.listen(port, () => {
  console.log(`ERP DB API running on http://localhost:${port}`);
});
