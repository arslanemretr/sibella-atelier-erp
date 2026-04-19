import React from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Spin } from "antd";
import AppLayout from "./components/layout/AppLayout";
import { getAuthUser, hasAuthLoaded, isAuthenticated, onAuthChange, restoreAuthSession } from "./auth";
import { resetOperationalDataIfNeeded } from "./erp/resetOperationalData";
import LoginPage from "./erp/pageModules/loginPage";
import UserManagementPage from "./erp/pageModules/userManagementPage";

const DashboardPage = React.lazy(() => import("./erp/pageModules/dashboardPages").then((module) => ({ default: module.DashboardPage })));
const SupplierDashboardPage = React.lazy(() => import("./erp/pageModules/dashboardPages").then((module) => ({ default: module.SupplierDashboardPage })));
const ProductListPage = React.lazy(() => import("./erp/pageModules/productPages").then((module) => ({ default: module.ProductListPage })));
const ProductEditorPage = React.lazy(() => import("./erp/pageModules/productPages").then((module) => ({ default: module.ProductEditorPage })));
const SettingsDefinitionPage = React.lazy(() => import("./erp/pageModules/settingsPages").then((module) => ({ default: module.SettingsDefinitionPage })));
const BarcodeStandardsPage = React.lazy(() => import("./erp/pageModules/settingsPages").then((module) => ({ default: module.BarcodeStandardsPage })));
const ParametersPage = React.lazy(() => import("./erp/pageModules/settingsPages").then((module) => ({ default: module.ParametersPage })));
const SmtpSettingsPage = React.lazy(() => import("./erp/pageModules/settingsPages").then((module) => ({ default: module.SmtpSettingsPage })));
const StockListPage = React.lazy(() => import("./erp/pageModules/stockListPage").then((module) => ({ default: module.StockListPage })));
const StockLocationListPage = React.lazy(() => import("./erp/pageModules/stockLocationPages").then((module) => ({ default: module.StockLocationListPage })));
const StockEntryListPage = React.lazy(() => import("./erp/pageModules/stockEntryPages").then((module) => ({ default: module.StockEntryListPage })));
const StockEntryEditorPage = React.lazy(() => import("./erp/pageModules/stockEntryPages").then((module) => ({ default: module.StockEntryEditorPage })));
const SupplierListPage = React.lazy(() => import("./erp/pageModules/supplierPages").then((module) => ({ default: module.SupplierListPage })));
const SupplierEditorPage = React.lazy(() => import("./erp/pageModules/supplierPages").then((module) => ({ default: module.SupplierEditorPage })));
const SupplierEarningsManagementPage = React.lazy(() => import("./erp/pageModules/supplierPages").then((module) => ({ default: module.SupplierEarningsManagementPage })));
const StoreListPage = React.lazy(() => import("./erp/pageModules/storePages").then((module) => ({ default: module.StoreListPage })));
const StoreEditorPage = React.lazy(() => import("./erp/pageModules/storePages").then((module) => ({ default: module.StoreEditorPage })));
const StoreShipmentListPage = React.lazy(() => import("./erp/pageModules/storeShipmentPages").then((module) => ({ default: module.StoreShipmentListPage })));
const StoreShipmentEditorPage = React.lazy(() => import("./erp/pageModules/storeShipmentPages").then((module) => ({ default: module.StoreShipmentEditorPage })));
const PurchaseListPage = React.lazy(() => import("./erp/pageModules/purchasePages").then((module) => ({ default: module.PurchaseListPage })));
const PurchaseEditorPage = React.lazy(() => import("./erp/pageModules/purchasePages").then((module) => ({ default: module.PurchaseEditorPage })));
const PosSessionsPage = React.lazy(() => import("./erp/pageModules/posPages").then((module) => ({ default: module.PosSessionsPage })));
const PosScreenPage = React.lazy(() => import("./erp/pageModules/posPages").then((module) => ({ default: module.PosScreenPage })));
const PosOrdersPage = React.lazy(() => import("./erp/pageModules/posPages").then((module) => ({ default: module.PosOrdersPage })));
const PosReturnEditorPage = React.lazy(() => import("./erp/pageModules/posPages").then((module) => ({ default: module.PosReturnEditorPage })));
const PosReturnListPage = React.lazy(() => import("./erp/pageModules/posPages").then((module) => ({ default: module.PosReturnListPage })));
const ContractsPage = React.lazy(() => import("./erp/pageModules/contractPages").then((module) => ({ default: module.ContractsPage })));
const SupplierDeliveryListsPage = React.lazy(() => import("./erp/pageModules/supplierPortalPages").then((module) => ({ default: module.SupplierDeliveryListsPage })));
const SupplierPortalDeliveryEditorPage = React.lazy(() => import("./erp/pageModules/supplierPortalPages").then((module) => ({ default: module.SupplierPortalDeliveryEditorPage })));
const SupplierPortalDeliveryListPage = React.lazy(() => import("./erp/pageModules/supplierPortalPages").then((module) => ({ default: module.SupplierPortalDeliveryListPage })));
const SupplierPortalEarningsPage = React.lazy(() => import("./erp/pageModules/supplierPortalPages").then((module) => ({ default: module.SupplierPortalEarningsPage })));
const SupplierPortalProductEditorPage = React.lazy(() => import("./erp/pageModules/supplierPortalPages").then((module) => ({ default: module.SupplierPortalProductEditorPage })));
const SupplierPortalProductListPage = React.lazy(() => import("./erp/pageModules/supplierPortalPages").then((module) => ({ default: module.SupplierPortalProductListPage })));

function PageFallback() {
  return (
    <div className="erp-auth-loading">
      <Spin size="large" />
    </div>
  );
}

function withLazyPage(element) {
  return <React.Suspense fallback={<PageFallback />}>{element}</React.Suspense>;
}

function withRolePage(element, authUser, ...roles) {
  if (!roles.includes(authUser?.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return withLazyPage(element);
}

function ProtectedApp() {
  const location = useLocation();
  const [authenticated, setAuthenticated] = React.useState(() => isAuthenticated());
  const [authUser, setAuthUser] = React.useState(() => getAuthUser());
  const [authReady, setAuthReady] = React.useState(() => hasAuthLoaded());

  React.useEffect(() => {
    resetOperationalDataIfNeeded();
    let active = true;

    void restoreAuthSession().finally(() => {
      if (!active) {
        return;
      }
      setAuthenticated(isAuthenticated());
      setAuthUser(getAuthUser());
      setAuthReady(true);
    });

    const unsubscribe = onAuthChange(() => {
      if (!active) {
        return;
      }
      setAuthenticated(isAuthenticated());
      setAuthUser(getAuthUser());
      setAuthReady(hasAuthLoaded());
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (!authReady) {
    return (
      <div className="erp-auth-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const isSupplierUser = authUser?.role === "Tedarikci";

  const isSupplierPortalRoute =
    location.pathname === "/supplier" || location.pathname.startsWith("/supplier/");

  if (isSupplierUser && !isSupplierPortalRoute) {
    return <Navigate to="/supplier/dashboard" replace />;
  }

  if (!isSupplierUser && isSupplierPortalRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to={isSupplierUser ? "/supplier/dashboard" : "/dashboard"} replace />} />
        <Route path="/settings" element={<Navigate to="/settings/users" replace />} />
        <Route path="/dashboard" element={withLazyPage(<DashboardPage />)} />

        <Route path="/products/list" element={withLazyPage(<ProductListPage />)} />
        <Route path="/products/new" element={withLazyPage(<ProductEditorPage />)} />
        <Route path="/products/:productId" element={withLazyPage(<ProductEditorPage />)} />

        <Route path="/pos/sessions" element={withLazyPage(<PosSessionsPage />)} />
        <Route path="/pos/store" element={withLazyPage(<PosScreenPage />)} />
        <Route path="/pos/orders" element={withLazyPage(<PosOrdersPage />)} />
        <Route path="/pos/returns" element={withLazyPage(<PosReturnListPage />)} />
        <Route path="/pos/returns/new" element={withLazyPage(<PosReturnEditorPage />)} />

        <Route path="/purchasing/suppliers" element={withLazyPage(<SupplierListPage />)} />
        <Route path="/purchasing/suppliers/new" element={withLazyPage(<SupplierEditorPage />)} />
        <Route path="/purchasing/suppliers/:supplierId" element={withLazyPage(<SupplierEditorPage />)} />
        <Route path="/purchasing/list" element={withLazyPage(<PurchaseListPage />)} />
        <Route path="/purchasing/entry" element={withLazyPage(<PurchaseEditorPage />)} />
        <Route path="/purchasing/entry/:purchaseId" element={withLazyPage(<PurchaseEditorPage />)} />
        <Route path="/purchasing/contracts" element={withLazyPage(<ContractsPage />)} />

        <Route path="/stores/list" element={withRolePage(<StoreListPage />, authUser, "Yonetici", "Muhasebe")} />
        <Route path="/stores/new" element={withRolePage(<StoreEditorPage />, authUser, "Yonetici", "Muhasebe")} />
        <Route path="/stores/:storeId" element={withRolePage(<StoreEditorPage />, authUser, "Yonetici", "Muhasebe")} />
        <Route path="/stores/shipments" element={withRolePage(<StoreShipmentListPage />, authUser, "Yonetici", "Muhasebe")} />
        <Route path="/stores/shipments/new" element={withRolePage(<StoreShipmentEditorPage />, authUser, "Yonetici", "Muhasebe")} />
        <Route path="/stores/shipments/:shipmentId" element={withRolePage(<StoreShipmentEditorPage />, authUser, "Yonetici", "Muhasebe")} />

        <Route path="/stock/entry" element={withLazyPage(<StockEntryListPage />)} />
        <Route path="/stock/entry/new" element={withLazyPage(<StockEntryEditorPage />)} />
        <Route path="/stock/entry/:stockEntryId" element={withLazyPage(<StockEntryEditorPage />)} />
        <Route path="/stock/list" element={withLazyPage(<StockListPage />)} />
        <Route path="/stock/locations" element={withRolePage(<StockLocationListPage />, authUser, "Yonetici", "Muhasebe")} />
        <Route path="/supplier-portal/delivery-lists" element={withLazyPage(<SupplierDeliveryListsPage />)} />
        <Route path="/supplier-portal/delivery-lists/:deliveryId" element={withLazyPage(<SupplierPortalDeliveryEditorPage />)} />
        <Route path="/supplier-portal/earnings" element={withLazyPage(<SupplierEarningsManagementPage />)} />

        <Route path="/settings/users" element={<UserManagementPage />} />
        <Route path="/settings/categories" element={withLazyPage(<SettingsDefinitionPage entityKey="categories" />)} />
        <Route path="/settings/collections" element={withLazyPage(<SettingsDefinitionPage entityKey="collections" />)} />
        <Route path="/settings/pos-categories" element={withLazyPage(<SettingsDefinitionPage entityKey="pos-categories" />)} />
        <Route path="/settings/barcode-standards" element={withLazyPage(<BarcodeStandardsPage />)} />
        <Route path="/settings/procurement-types" element={withLazyPage(<SettingsDefinitionPage entityKey="procurement-types" />)} />
        <Route path="/settings/payment-terms" element={withLazyPage(<SettingsDefinitionPage entityKey="payment-terms" />)} />
        <Route path="/settings/parameters" element={withLazyPage(<ParametersPage />)} />
        <Route path="/settings/smtp" element={withLazyPage(<SmtpSettingsPage />)} />

        <Route path="/supplier/products" element={withLazyPage(<SupplierPortalProductListPage />)} />
        <Route path="/supplier/dashboard" element={withLazyPage(<SupplierDashboardPage />)} />
        <Route path="/supplier/earnings" element={withLazyPage(<SupplierPortalEarningsPage />)} />
        <Route path="/supplier/products/:productId" element={withLazyPage(<SupplierPortalProductEditorPage />)} />
        <Route path="/supplier/deliveries" element={withLazyPage(<SupplierPortalDeliveryListPage />)} />
        <Route path="/supplier/deliveries/new" element={withLazyPage(<SupplierPortalDeliveryEditorPage />)} />
        <Route path="/supplier/deliveries/:deliveryId" element={withLazyPage(<SupplierPortalDeliveryEditorPage />)} />
      </Routes>
    </AppLayout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedApp />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
