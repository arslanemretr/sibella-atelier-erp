/* global process */
import express from "express";
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
  handleMasterDataCreate,
  handleMasterDataList,
  handleMasterDataUpdate,
  handleProductsCreate,
  handleProductsDelete,
  handleProductsList,
  handleProductStockLocationBalances,
  handleProductsUpdate,
  handleSuppliersCreate,
  handleSuppliersDelete,
  handleSuppliersList,
  handleSuppliersUpdate,
} from "./catalog.js";
import { handleDashboardSummary } from "./dashboard.js";
import { ensureDatabaseReady, getDatabaseRuntimeInfo } from "./db.js";
import {
  handlePurchasesCreate,
  handlePurchasesList,
  handlePurchasesUpdate,
  handleStockEntriesCreate,
  handleStockEntriesList,
  handleStockEntriesUpdate,
} from "./operations.js";
import {
  handleContractsCreate,
  handleContractsDelete,
  handleContractsList,
  handleContractsUpdate,
  handleDeliveryListsComplete,
  handleDeliveryListsCreate,
  handleDeliveryListsList,
  handleDeliveryListsUpdate,
  handlePosSalesCreate,
  handlePosSalesList,
  handlePosSessionsClose,
  handlePosSessionsCreate,
  handlePosSessionsList,
} from "./portalApi.js";
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
  handleSmtpSettingsGet,
  handleSmtpSettingsPut,
  handleSystemParametersGet,
  handleSystemParametersPut,
} from "./settingsApi.js";
import { handleSmtpTestEmail } from "./smtp.js";

const app = express();
const port = Number(process.env.API_PORT || 4001);

app.use(express.json({ limit: "25mb" }));

void ensureDatabaseReady()
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
app.get("/api/master-data/:entityKey", requireRole("Yonetici", "Magaza", "Muhasebe", "Tedarikci"), handleMasterDataList);
app.post("/api/master-data/:entityKey", requireRole("Yonetici"), handleMasterDataCreate);
app.put("/api/master-data/:entityKey/:id", requireRole("Yonetici"), handleMasterDataUpdate);
app.get("/api/suppliers", requireRole("Yonetici", "Muhasebe", "Tedarikci"), handleSuppliersList);
app.post("/api/suppliers", requireRole("Yonetici"), handleSuppliersCreate);
app.put("/api/suppliers/:id", requireRole("Yonetici"), handleSuppliersUpdate);
app.delete("/api/suppliers/:id", requireRole("Yonetici"), handleSuppliersDelete);
app.get("/api/products", requireRole("Yonetici", "Magaza", "Muhasebe", "Tedarikci"), handleProductsList);
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
app.get("/api/delivery-lists", requireRole("Yonetici", "Tedarikci"), handleDeliveryListsList);
app.post("/api/delivery-lists", requireRole("Yonetici", "Tedarikci"), handleDeliveryListsCreate);
app.put("/api/delivery-lists/:id", requireRole("Yonetici", "Tedarikci"), handleDeliveryListsUpdate);
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
