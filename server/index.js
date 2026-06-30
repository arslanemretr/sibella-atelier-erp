/* global process */
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { auditMiddleware, cleanupOldAuditLogs, ensureAuditLogTable, handleAuditLogAnalytics, handleAuditLogsList, handlePageViewLog } from "./auditLog.js";
import {
  ensureRolesTable,
  handleForgotPasswordConfirm,
  handleForgotPasswordRequest,
  handleRolesCreate,
  handleRolesDelete,
  handleRolesList,
  handleRolesUpdate,
  requireRole,
  handleLogin,
  handleLogout,
  handleSession,
  handleUsersCreate,
  handleUsersDelete,
  handleUsersList,
  handleUsersUpdate,
  handleOnlineUsers,
  migrateLegacyPasswords,
} from "./auth.js";
import {
  ensureBarcodeStandardsReady,
  ensureProductIndexes,
  ensureProductPricingSchema,
  handleMasterDataCreate,
  handleMasterDataList,
  handleMasterDataUpdate,
  handleProductsCreate,
  handleProductsBatchCreate,
  handleProductImage,
  handleProductPriceUpdate,
  handleProductPriceHistory,
  handleProductsBulkPrice,
  handleProductsDelete,
  handleProductsGet,
  handleProductsList,
  handleProductStockLocationBalances,
  handleProductsUpdate,
  handleNextProductCode,
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
  handleStockEntriesGet,
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
  handleDeliveryListsGet,
  handleDeliveryListsList,
  handleDeliveryListsUpdate,
  handlePosSalesCreate,
  handlePosSalesList,
  handlePosSalesTagsUpdate,
  handlePosSessionsClose,
  handlePosSessionsCreate,
  handlePosSessionsList,
  handlePosReturnsList,
  handlePosReturnsCreate,
  ensureDeliveryIndexes,
  ensureStockLocationInSessions,
  ensurePosReturnsReady,
  ensurePosSalesIndexes,
} from "./portalApi.js";
import { ensureEarningsReady, handleEarningsRecordsList, handleEarningsRecordsUpsert } from "./earningsApi.js";
import { startEarningsCron } from "./earningsCron.js";
import { handleStockLocationCorrect } from "./inventory.js";
import { handleStockMovementsList } from "./stockMovementsApi.js";
import {
  handleStockLocationBalancesList,
  handleStockLocationsList,
  handleStoreShipmentsCreate,
  handleStoreShipmentsList,
  handleStoreShipmentsGet,
  handleStoreShipmentsSend,
  handleStoreShipmentEmail,
  handleStoreShipmentsUpdate,
  handleStoresCreate,
  handleStoresDelete,
  handleStoresList,
  handleStoresUpdate,
} from "./stores.js";
import { handleAiBuildPrompt, handleAiChat, handleAiExecuteAction, handleAiExecuteWrite, handleAiPrepareWrite, handleAiTestKey } from "./aiAssistant.js";
import { ensureAiSettingsReady, handleAiSettingsGet, handleAiSettingsPut } from "./aiSettings.js";
import {
  ensureStoreInvoicesReady,
  handleStoreInvoicesCreate,
  handleStoreInvoicesDelete,
  handleStoreInvoicesGet,
  handleStoreInvoicesList,
  handleStoreInvoicesNextNo,
  handleStoreInvoicesUpdate,
  handleStoreInvoicePayment,
  handleStoreInvoicePaymentRevert,
} from "./storeInvoicesApi.js";
import {
  ensureStoreSalesReady,
  handleStoreSalesList,
  handleStoreSalesGet,
  handleStoreSalesNextNo,
  handleStoreSalesCreate,
  handleStoreSalesUpdate,
  handleStoreSalesDelete,
} from "./storeSalesApi.js";
import { handleConsolidatedSalesReport } from "./consolidatedSalesReport.js";
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
  handleBrandingGet,
  handleBrandingPut,
  ensureBrandingReady,
} from "./settingsApi.js";
import { handleSmtpTestEmail } from "./smtp.js";

const app = express();
const port = Number(process.env.API_PORT || 4001);
const assetStoragePath = path.resolve(String(process.env.ASSET_STORAGE_PATH || path.resolve(process.cwd(), "data/assets")).trim());

app.use(express.json({ limit: "25mb" }));
app.use(auditMiddleware);
fs.mkdirSync(assetStoragePath, { recursive: true });

// Upload route statik middleware'den ONCE tanimlanmali —
// express.static fallthrough:false POST isteklerini 405 ile keser.
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

app.use("/api/assets", express.static(assetStoragePath, {
  fallthrough: false,
  maxAge: "30d",
  immutable: true,
}));

void ensureDatabaseReady()
  .then(() => ensureAuditLogTable())
  .then(() => cleanupOldAuditLogs())
  .then(() => ensureStockMovementsReady())
  .then(() => ensureEarningsReady())
  .then(() => ensureStockLocationInSessions())
  .then(() => ensurePosReturnsReady())
  .then(() => ensureBarcodeStandardsReady())
  .then(() => ensureProductIndexes())
  .then(() => ensureProductPricingSchema())
  .then(() => ensureDeliveryIndexes())
  .then(() => ensurePosSalesIndexes())
  .then(() => ensureRolesTable())
  .then(() => ensureBrandingReady())
  .then(() => migrateLegacyPasswords())
  .then(() => ensureStoreInvoicesReady())
  .then(() => ensureStoreSalesReady())
  .then(() => ensureAiSettingsReady())
  .then(() => { startEarningsCron(); })
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

app.get("/api/audit-logs", requireRole("Yonetici"), handleAuditLogsList);
app.get("/api/audit-logs/analytics", requireRole("Yonetici"), handleAuditLogAnalytics);
app.post("/api/audit-logs/page-view", requireRole("Yonetici", "Magaza", "Muhasebe", "Kasiyer", "Tedarikci"), handlePageViewLog);
app.post("/api/auth/login", handleLogin);
app.get("/api/auth/session", handleSession);
app.post("/api/auth/logout", handleLogout);
app.post("/api/auth/forgot-password/request", handleForgotPasswordRequest);
app.post("/api/auth/forgot-password/confirm", handleForgotPasswordConfirm);
app.get("/api/users/online", requireRole("Yonetici"), handleOnlineUsers);
app.get("/api/users", requireRole("Yonetici"), handleUsersList);
app.post("/api/users", requireRole("Yonetici"), handleUsersCreate);
app.put("/api/users/:id", requireRole("Yonetici"), handleUsersUpdate);
app.delete("/api/users/:id", requireRole("Yonetici"), handleUsersDelete);
app.get("/api/roles", requireRole("Yonetici"), handleRolesList);
app.post("/api/roles", requireRole("Yonetici"), handleRolesCreate);
app.put("/api/roles/:id", requireRole("Yonetici"), handleRolesUpdate);
app.delete("/api/roles/:id", requireRole("Yonetici"), handleRolesDelete);
app.get("/api/dashboard/summary", requireRole("Yonetici", "Magaza", "Muhasebe"), handleDashboardSummary);
app.post("/api/settings/smtp/test", requireRole("Yonetici"), handleSmtpTestEmail);
app.get("/api/settings/system-parameters", requireRole("Yonetici"), handleSystemParametersGet);
app.put("/api/settings/system-parameters", requireRole("Yonetici"), handleSystemParametersPut);
app.get("/api/settings/smtp", requireRole("Yonetici"), handleSmtpSettingsGet);
app.put("/api/settings/smtp", requireRole("Yonetici"), handleSmtpSettingsPut);
app.get("/api/settings/branding", handleBrandingGet);
app.put("/api/settings/branding", requireRole("Yonetici"), handleBrandingPut);
app.get("/api/settings/email-templates", requireRole("Yonetici"), handleEmailTemplatesList);
app.post("/api/settings/email-templates", requireRole("Yonetici"), handleEmailTemplatesCreate);
app.put("/api/settings/email-templates/:id", requireRole("Yonetici"), handleEmailTemplatesUpdate);
app.delete("/api/settings/email-templates/:id", requireRole("Yonetici"), handleEmailTemplatesDelete);
app.get("/api/settings/email-scenarios", requireRole("Yonetici"), handleEmailScenariosList);
app.post("/api/settings/email-scenarios", requireRole("Yonetici"), handleEmailScenariosCreate);
app.put("/api/settings/email-scenarios/:id", requireRole("Yonetici"), handleEmailScenariosUpdate);
app.delete("/api/settings/email-scenarios/:id", requireRole("Yonetici"), handleEmailScenariosDelete);
app.get("/api/settings/email-delivery-logs", requireRole("Yonetici"), handleEmailDeliveryLogsList);
app.get("/api/reports/consolidated-sales", requireRole("Yonetici", "Muhasebe"), handleConsolidatedSalesReport);
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
app.get("/api/products/next-code", requireRole("Yonetici", "Magaza", "Muhasebe", "Tedarikci"), handleNextProductCode);
app.get("/api/products/price-history", requireRole("Yonetici"), handleProductPriceHistory);
app.get("/api/products/:id", requireRole("Yonetici", "Magaza", "Muhasebe", "Tedarikci"), handleProductsGet);
app.get("/api/products/:id/stock-locations", requireRole("Yonetici", "Magaza", "Muhasebe", "Tedarikci"), handleProductStockLocationBalances);
app.get("/api/products/:id/image", requireRole("Yonetici", "Magaza", "Muhasebe", "Tedarikci"), handleProductImage);
app.post("/api/products", requireRole("Yonetici", "Tedarikci"), handleProductsCreate);
app.post("/api/products/batch", requireRole("Yonetici", "Tedarikci"), handleProductsBatchCreate);
app.post("/api/products/prices/bulk", requireRole("Yonetici"), handleProductsBulkPrice);
app.patch("/api/products/:id/price", requireRole("Yonetici", "Muhasebe", "Tedarikci"), handleProductPriceUpdate);
app.put("/api/products/:id", requireRole("Yonetici", "Tedarikci"), handleProductsUpdate);
app.delete("/api/products/:id", requireRole("Yonetici"), handleProductsDelete);
app.get("/api/purchases", requireRole("Yonetici", "Muhasebe"), handlePurchasesList);
app.post("/api/purchases", requireRole("Yonetici", "Muhasebe"), handlePurchasesCreate);
app.put("/api/purchases/:id", requireRole("Yonetici", "Muhasebe"), handlePurchasesUpdate);
app.get("/api/stock-entries", requireRole("Yonetici", "Muhasebe", "Tedarikci"), handleStockEntriesList);
app.get("/api/stock-entries/:id", requireRole("Yonetici", "Muhasebe", "Tedarikci"), handleStockEntriesGet);
app.post("/api/stock-entries", requireRole("Yonetici", "Muhasebe"), handleStockEntriesCreate);
app.put("/api/stock-entries/:id", requireRole("Yonetici", "Muhasebe"), handleStockEntriesUpdate);
app.get("/api/stock-movements", requireRole("Yonetici", "Muhasebe", "Magaza"), handleStockMovementsList);
app.get("/api/supplier-earnings", requireRole("Yonetici", "Muhasebe", "Tedarikci"), handleEarningsRecordsList);
app.post("/api/supplier-earnings", requireRole("Yonetici", "Muhasebe"), handleEarningsRecordsUpsert);
app.get("/api/stock-locations", requireRole("Yonetici", "Muhasebe"), handleStockLocationsList);
app.get("/api/stock-locations/:id/balances", requireRole("Yonetici", "Muhasebe"), handleStockLocationBalancesList);
app.post("/api/stock-locations/:id/correct", requireRole("Yonetici", "Muhasebe"), handleStockLocationCorrect);
app.get("/api/contracts", requireRole("Yonetici", "Muhasebe", "Tedarikci"), handleContractsList);
app.post("/api/contracts", requireRole("Yonetici", "Muhasebe"), handleContractsCreate);
app.put("/api/contracts/:id", requireRole("Yonetici", "Muhasebe"), handleContractsUpdate);
app.delete("/api/contracts/:id", requireRole("Yonetici"), handleContractsDelete);
app.get("/api/pos-sessions", requireRole("Yonetici", "Magaza"), handlePosSessionsList);
app.post("/api/pos-sessions", requireRole("Yonetici", "Magaza"), handlePosSessionsCreate);
app.post("/api/pos-sessions/:id/close", requireRole("Yonetici", "Magaza"), handlePosSessionsClose);
app.get("/api/pos-sales", requireRole("Yonetici", "Magaza", "Tedarikci"), handlePosSalesList);
app.post("/api/pos-sales", requireRole("Yonetici", "Magaza"), handlePosSalesCreate);
app.put("/api/pos-sales/:id/tags", requireRole("Yonetici", "Magaza"), handlePosSalesTagsUpdate);
app.get("/api/pos-returns", requireRole("Yonetici", "Magaza", "Muhasebe", "Tedarikci"), handlePosReturnsList);
app.post("/api/pos-returns", requireRole("Yonetici", "Magaza"), handlePosReturnsCreate);
app.get("/api/delivery-lists", requireRole("Yonetici", "Tedarikci"), handleDeliveryListsList);
app.post("/api/delivery-lists", requireRole("Yonetici", "Tedarikci"), handleDeliveryListsCreate);
app.get("/api/delivery-lists/:id", requireRole("Yonetici", "Tedarikci"), handleDeliveryListsGet);
app.put("/api/delivery-lists/:id", requireRole("Yonetici", "Tedarikci"), handleDeliveryListsUpdate);
app.post("/api/delivery-lists/:id/lines", requireRole("Yonetici", "Tedarikci"), handleDeliveryLineCreate);
app.delete("/api/delivery-lists/:id/lines/:lineId", requireRole("Yonetici", "Tedarikci"), handleDeliveryLineDelete);
app.delete("/api/delivery-lists/:id", requireRole("Yonetici", "Tedarikci"), handleDeliveryListsDelete);
app.post("/api/delivery-lists/:id/complete", requireRole("Yonetici"), handleDeliveryListsComplete);
app.get("/api/store-invoices/next-no", requireRole("Yonetici", "Muhasebe"), handleStoreInvoicesNextNo);
app.get("/api/store-invoices", requireRole("Yonetici", "Muhasebe"), handleStoreInvoicesList);
app.get("/api/store-invoices/:id", requireRole("Yonetici", "Muhasebe"), handleStoreInvoicesGet);
app.post("/api/store-invoices", requireRole("Yonetici", "Muhasebe"), handleStoreInvoicesCreate);
app.put("/api/store-invoices/:id", requireRole("Yonetici", "Muhasebe"), handleStoreInvoicesUpdate);
app.put("/api/store-invoices/:id/payment", requireRole("Yonetici", "Muhasebe"), handleStoreInvoicePayment);
app.put("/api/store-invoices/:id/payment-revert", requireRole("Yonetici", "Muhasebe"), handleStoreInvoicePaymentRevert);
app.delete("/api/store-invoices/:id", requireRole("Yonetici", "Muhasebe"), handleStoreInvoicesDelete);

app.get("/api/store-sales/next-no", requireRole("Yonetici", "Muhasebe", "Magaza"), handleStoreSalesNextNo);
app.get("/api/store-sales", requireRole("Yonetici", "Muhasebe", "Magaza"), handleStoreSalesList);
app.get("/api/store-sales/:id", requireRole("Yonetici", "Muhasebe", "Magaza"), handleStoreSalesGet);
app.post("/api/store-sales", requireRole("Yonetici", "Muhasebe", "Magaza"), handleStoreSalesCreate);
app.put("/api/store-sales/:id", requireRole("Yonetici", "Muhasebe", "Magaza"), handleStoreSalesUpdate);
app.delete("/api/store-sales/:id", requireRole("Yonetici", "Muhasebe"), handleStoreSalesDelete);
app.get("/api/stores", requireRole("Yonetici", "Muhasebe"), handleStoresList);
app.post("/api/stores", requireRole("Yonetici", "Muhasebe"), handleStoresCreate);
app.put("/api/stores/:id", requireRole("Yonetici", "Muhasebe"), handleStoresUpdate);
app.delete("/api/stores/:id", requireRole("Yonetici", "Muhasebe"), handleStoresDelete);
app.get("/api/store-shipments", requireRole("Yonetici", "Muhasebe"), handleStoreShipmentsList);
app.get("/api/store-shipments/:id", requireRole("Yonetici", "Muhasebe"), handleStoreShipmentsGet);
app.post("/api/store-shipments", requireRole("Yonetici", "Muhasebe"), handleStoreShipmentsCreate);
app.put("/api/store-shipments/:id", requireRole("Yonetici", "Muhasebe"), handleStoreShipmentsUpdate);
app.post("/api/store-shipments/:id/send", requireRole("Yonetici", "Muhasebe"), handleStoreShipmentsSend);
app.post("/api/store-shipments/:id/email", requireRole("Yonetici", "Muhasebe"), handleStoreShipmentEmail);

// AI Asistan (manuel test asamasi) - yalnizca Yonetici
app.post("/api/ai/build-prompt", requireRole("Yonetici"), handleAiBuildPrompt);
app.post("/api/ai/execute-action", requireRole("Yonetici"), handleAiExecuteAction);
app.post("/api/ai/prepare-write", requireRole("Yonetici"), handleAiPrepareWrite);
app.post("/api/ai/execute-write", requireRole("Yonetici"), handleAiExecuteWrite);
app.post("/api/ai/chat", requireRole("Yonetici"), handleAiChat);
app.get("/api/ai/settings", requireRole("Yonetici"), handleAiSettingsGet);
app.put("/api/ai/settings", requireRole("Yonetici"), handleAiSettingsPut);
app.post("/api/ai/test-key", requireRole("Yonetici"), handleAiTestKey);

app.listen(port, () => {
  console.log(`ERP DB API running on http://localhost:${port}`);
});
