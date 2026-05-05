/* global process */
import express from "express";
import fs from "node:fs";
import path from "node:path";
import {
  handleForgotPasswordConfirm,
  handleForgotPasswordRequest,
  requireRole,
  handleLogin,
  handleLogout,
  handleSession,
  handleUsersCreate,
  handleUsersDelete,
  handleUsersList,
  handleUsersUpdate,
  migrateLegacyPasswords,
} from "./auth.js";
import {
  ensureBarcodeStandardsReady,
  ensureProductIndexes,
  handleMasterDataCreate,
  handleMasterDataList,
  handleMasterDataUpdate,
  handleProductsCreate,
  handleProductsDelete,
  handleProductsGet,
  handleProductsList,
  handleProductStockLocationBalances,
  handleProductsUpdate,
  handleSuppliersCreate,
  handleSuppliersDelete,
  handleSuppliersGet,
  handleSuppliersList,
  handleSuppliersUpdate,
} from "./catalog.js";
import { handleDashboardSummary } from "./dashboard.js";
import { ensureDatabaseReady, getDatabaseRuntimeInfo } from "./db.js";
import { ensureStockMovementsReady } from "./inventory.js";
import {
  handlePurchasesCreate,
  handlePurchasesList,
  handlePurchasesUpdate,
  handleStockEntriesCreate,
  handleStockEntriesList,
  handleStockEntriesUpdate,
} from "./operations.js";
import { handleConsolidatedEarningsSendNow, handleReportScheduleGet, handleReportSchedulePut, handleSupplierEarningsSendNow } from "./reportSettings.js";
import {
  handleContractsCreate,
  handleContractsDelete,
  handleContractsList,
  handleContractsUpdate,
  handleDeliveryLineCreate,
  handleDeliveryLineDelete,
  handleDeliveryListsComplete,
  handleDeliveryListsCreate,
  handleDeliveryListsDelete,
  handleDeliveryListsList,
  handleDeliveryListsUpdate,
  handlePosSalesCreate,
  handlePosSalesList,
  handlePosSessionsClose,
  handlePosSessionsCreate,
  handlePosSessionsList,
  handlePosReturnsList,
  handlePosReturnsCreate,
  ensureStockLocationInSessions,
  ensurePosReturnsReady,
} from "./portalApi.js";
import { ensureEarningsReady, handleEarningsRecordsList, handleEarningsRecordsUpsert } from "./earningsApi.js";
import { handleStockMovementsList } from "./stockMovementsApi.js";
import {
  handleStockLocationBalancesList,
  handleStockLocationsList,
  handleStoreShipmentsCreate,
  handleStoreShipmentsList,
  handleStoreShipmentsSend,
  handleStoreShipmentsUpdate,
  handleStoresCreate,
  handleStoresDelete,
  handleStoresList,
  handleStoresUpdate,
} from "./stores.js";
import {
  handleEmailDeliveryLogsList,
  handleEmailScenariosCreate,
  handleEmailScenariosDelete,
  handleEmailScenariosList,
  handleEmailScenariosUpdate,
  handleEmailTemplatesCreate,
  handleEmailTemplatesDelete,
  handleEmailTemplatesList,
  handleEmailTemplatesUpdate,
  handleSmtpSettingsGet,
  handleSmtpSettingsPut,
  handleSystemParametersGet,
  handleSystemParametersPut,
} from "./settingsApi.js";
import { handleSmtpTestEmail } from "./smtp.js";

const app = express();
const port = Number(process.env.API_PORT || 4001);
const assetStoragePath = path.resolve(String(process.env.ASSET_STORAGE_PATH || path.resolve(process.cwd(), "data/assets")).trim());

app.use(express.json({ limit: "25mb" }));
fs.mkdirSync(assetStoragePath, { recursive: true });
app.use("/api/assets", express.static(assetStoragePath, {
  fallthrough: false,
  maxAge: "30d",
  immutable: true,
}));

app.post("/api/assets/upload", (req, res) => {
  try {
    const { base64, filename } = req.body || {};
    if (!base64 || !filename) {
      return res.status(400).json({ ok: false, message: "base64 ve filename zorunludur." });
    }
    const match = base64.match(/^data:([a-zA-Z0-9+/]+\/[a-zA-Z0-9+/]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ ok: false, message: "Gecersiz base64 formati." });
    }
    const buffer = Buffer.from(match[2], "base64");
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const subdir = path.join(assetStoragePath, "uploads");
    fs.mkdirSync(subdir, { recursive: true });
    const filePath = path.join(subdir, safeFilename);
    fs.writeFileSync(filePath, buffer);
    return res.json({ ok: true, url: `/api/assets/uploads/${safeFilename}` });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error?.message || "Gorsel yuklenemedi." });
  }
});

void ensureDatabaseReady()
  .then(() => ensureStockMovementsReady())
  .then(() => ensureEarningsReady())
  .then(() => ensureStockLocationInSessions())
  .then(() => ensurePosReturnsReady())
  .then(() => ensureBarcodeStandardsReady())
  .then(() => ensureProductIndexes())
  .then(() => migrateLegacyPasswords())
  .catch((error) => {
    console.error("Database init / auth migration hatasi:", error?.message || error);
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
app.get("/api/users", requireRole("Yonetici"), handleUsersList);
app.post("/api/users", requireRole("Yonetici"), handleUsersCreate);
app.put("/api/users/:id", requireRole("Yonetici"), handleUsersUpdate);
app.delete("/api/users/:id", requireRole("Yonetici"), handleUsersDelete);
app.get("/api/dashboard/summary", requireRole("Yonetici", "Magaza", "Muhasebe"), handleDashboardSummary);
app.post("/api/settings/smtp/test", requireRole("Yonetici"), handleSmtpTestEmail);
app.get("/api/settings/system-parameters", requireRole("Yonetici"), handleSystemParametersGet);
app.put("/api/settings/system-parameters", requireRole("Yonetici"), handleSystemParametersPut);
app.get("/api/settings/smtp", requireRole("Yonetici"), handleSmtpSettingsGet);
app.put("/api/settings/smtp", requireRole("Yonetici"), handleSmtpSettingsPut);
app.get("/api/settings/email-templates", requireRole("Yonetici"), handleEmailTemplatesList);
app.post("/api/settings/email-templates", requireRole("Yonetici"), handleEmailTemplatesCreate);
app.put("/api/settings/email-templates/:id", requireRole("Yonetici"), handleEmailTemplatesUpdate);
app.delete("/api/settings/email-templates/:id", requireRole("Yonetici"), handleEmailTemplatesDelete);
app.get("/api/settings/email-scenarios", requireRole("Yonetici"), handleEmailScenariosList);
app.post("/api/settings/email-scenarios", requireRole("Yonetici"), handleEmailScenariosCreate);
app.put("/api/settings/email-scenarios/:id", requireRole("Yonetici"), handleEmailScenariosUpdate);
app.delete("/api/settings/email-scenarios/:id", requireRole("Yonetici"), handleEmailScenariosDelete);
app.get("/api/settings/email-delivery-logs", requireRole("Yonetici"), handleEmailDeliveryLogsList);
app.get("/api/reports/schedules/:reportKey", requireRole("Yonetici", "Muhasebe"), handleReportScheduleGet);
app.put("/api/reports/schedules/:reportKey", requireRole("Yonetici", "Muhasebe"), handleReportSchedulePut);
app.post("/api/reports/consolidated-earnings/send-now", requireRole("Yonetici", "Muhasebe"), handleConsolidatedEarningsSendNow);
app.post("/api/reports/supplier-earnings/send-now", requireRole("Yonetici", "Muhasebe"), handleSupplierEarningsSendNow);
app.get("/api/master-data/:entityKey", requireRole("Yonetici", "Magaza", "Muhasebe", "Tedarikci"), handleMasterDataList);
app.post("/api/master-data/:entityKey", requireRole("Yonetici"), handleMasterDataCreate);
app.put("/api/master-data/:entityKey/:id", requireRole("Yonetici"), handleMasterDataUpdate);
app.get("/api/suppliers", requireRole("Yonetici", "Muhasebe", "Tedarikci"), handleSuppliersList);
app.get("/api/suppliers/:id", requireRole("Yonetici", "Muhasebe", "Tedarikci"), handleSuppliersGet);
app.post("/api/suppliers", requireRole("Yonetici"), handleSuppliersCreate);
app.put("/api/suppliers/:id", requireRole("Yonetici"), handleSuppliersUpdate);
app.delete("/api/suppliers/:id", requireRole("Yonetici"), handleSuppliersDelete);
app.get("/api/products", requireRole("Yonetici", "Magaza", "Muhasebe", "Tedarikci"), handleProductsList);
app.get("/api/products/:id", requireRole("Yonetici", "Magaza", "Muhasebe", "Tedarikci"), handleProductsGet);
app.get("/api/products/:id/stock-locations", requireRole("Yonetici", "Magaza", "Muhasebe", "Tedarikci"), handleProductStockLocationBalances);
app.post("/api/products", requireRole("Yonetici", "Tedarikci"), handleProductsCreate);
app.put("/api/products/:id", requireRole("Yonetici", "Tedarikci"), handleProductsUpdate);
app.delete("/api/products/:id", requireRole("Yonetici"), handleProductsDelete);
app.get("/api/purchases", requireRole("Yonetici", "Muhasebe"), handlePurchasesList);
app.post("/api/purchases", requireRole("Yonetici", "Muhasebe"), handlePurchasesCreate);
app.put("/api/purchases/:id", requireRole("Yonetici", "Muhasebe"), handlePurchasesUpdate);
app.get("/api/stock-entries", requireRole("Yonetici", "Muhasebe", "Tedarikci"), handleStockEntriesList);
app.post("/api/stock-entries", requireRole("Yonetici", "Muhasebe"), handleStockEntriesCreate);
app.put("/api/stock-entries/:id", requireRole("Yonetici", "Muhasebe"), handleStockEntriesUpdate);
app.get("/api/stock-movements", requireRole("Yonetici", "Muhasebe", "Magaza"), handleStockMovementsList);
app.get("/api/supplier-earnings", requireRole("Yonetici", "Muhasebe", "Tedarikci"), handleEarningsRecordsList);
app.post("/api/supplier-earnings", requireRole("Yonetici", "Muhasebe"), handleEarningsRecordsUpsert);
app.get("/api/stock-locations", requireRole("Yonetici", "Muhasebe"), handleStockLocationsList);
app.get("/api/stock-locations/:id/balances", requireRole("Yonetici", "Muhasebe"), handleStockLocationBalancesList);
app.get("/api/contracts", requireRole("Yonetici", "Muhasebe", "Tedarikci"), handleContractsList);
app.post("/api/contracts", requireRole("Yonetici", "Muhasebe"), handleContractsCreate);
app.put("/api/contracts/:id", requireRole("Yonetici", "Muhasebe"), handleContractsUpdate);
app.delete("/api/contracts/:id", requireRole("Yonetici"), handleContractsDelete);
app.get("/api/pos-sessions", requireRole("Yonetici", "Magaza"), handlePosSessionsList);
app.post("/api/pos-sessions", requireRole("Yonetici", "Magaza"), handlePosSessionsCreate);
app.post("/api/pos-sessions/:id/close", requireRole("Yonetici", "Magaza"), handlePosSessionsClose);
app.get("/api/pos-sales", requireRole("Yonetici", "Magaza", "Tedarikci"), handlePosSalesList);
app.post("/api/pos-sales", requireRole("Yonetici", "Magaza"), handlePosSalesCreate);
app.get("/api/pos-returns", requireRole("Yonetici", "Magaza", "Muhasebe", "Tedarikci"), handlePosReturnsList);
app.post("/api/pos-returns", requireRole("Yonetici", "Magaza"), handlePosReturnsCreate);
app.get("/api/delivery-lists", requireRole("Yonetici", "Tedarikci"), handleDeliveryListsList);
app.post("/api/delivery-lists", requireRole("Yonetici", "Tedarikci"), handleDeliveryListsCreate);
app.put("/api/delivery-lists/:id", requireRole("Yonetici", "Tedarikci"), handleDeliveryListsUpdate);
app.post("/api/delivery-lists/:id/lines", requireRole("Yonetici", "Tedarikci"), handleDeliveryLineCreate);
app.delete("/api/delivery-lists/:id/lines/:lineId", requireRole("Yonetici", "Tedarikci"), handleDeliveryLineDelete);
app.delete("/api/delivery-lists/:id", requireRole("Yonetici", "Tedarikci"), handleDeliveryListsDelete);
app.post("/api/delivery-lists/:id/complete", requireRole("Yonetici"), handleDeliveryListsComplete);
app.get("/api/stores", requireRole("Yonetici", "Muhasebe"), handleStoresList);
app.post("/api/stores", requireRole("Yonetici", "Muhasebe"), handleStoresCreate);
app.put("/api/stores/:id", requireRole("Yonetici", "Muhasebe"), handleStoresUpdate);
app.delete("/api/stores/:id", requireRole("Yonetici", "Muhasebe"), handleStoresDelete);
app.get("/api/store-shipments", requireRole("Yonetici", "Muhasebe"), handleStoreShipmentsList);
app.post("/api/store-shipments", requireRole("Yonetici", "Muhasebe"), handleStoreShipmentsCreate);
app.put("/api/store-shipments/:id", requireRole("Yonetici", "Muhasebe"), handleStoreShipmentsUpdate);
app.post("/api/store-shipments/:id/send", requireRole("Yonetici", "Muhasebe"), handleStoreShipmentsSend);

app.listen(port, () => {
  console.log(`ERP DB API running on http://localhost:${port}`);
});
