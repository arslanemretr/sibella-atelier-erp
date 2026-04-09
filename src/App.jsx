import React from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Spin } from "antd";
import AppLayout from "./components/layout/AppLayout";
import { getAuthUser, hasAuthLoaded, isAuthenticated, onAuthChange, restoreAuthSession } from "./auth";
import {
  DashboardPage,
  ContractsPage,
  SupplierDashboardPage,
  PosScreenPage,
  PosSessionsPage,
  ProductEditorPage,
  ProductListPage,
  ParametersPage,
  SmtpSettingsPage,
  SettingsDefinitionPage,
  StockEntryListPage,
  StockEntryEditorPage,
  StockListPage,
  SupplierDeliveryListsPage,
  SupplierPortalDeliveryEditorPage,
  SupplierPortalDeliveryListPage,
  SupplierPortalProductEditorPage,
  SupplierPortalProductListPage,
  SupplierEditorPage,
  SupplierListPage,
} from "./erp/pages";
import { resetOperationalDataIfNeeded } from "./erp/resetOperationalData";
import LoginPage from "./pages/LoginPage";
import UserManagementPage from "./pages/UserManagementPage";

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
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/products/list" element={<ProductListPage />} />
        <Route path="/products/new" element={<ProductEditorPage />} />
        <Route path="/products/:productId" element={<ProductEditorPage />} />

        <Route path="/pos/sessions" element={<PosSessionsPage />} />
        <Route path="/pos/store" element={<PosScreenPage />} />

        <Route path="/purchasing/suppliers" element={<SupplierListPage />} />
        <Route path="/purchasing/suppliers/new" element={<SupplierEditorPage />} />
        <Route path="/purchasing/suppliers/:supplierId" element={<SupplierEditorPage />} />
        <Route path="/purchasing/contracts" element={<ContractsPage />} />

        <Route path="/stock/entry" element={<StockEntryListPage />} />
        <Route path="/stock/entry/new" element={<StockEntryEditorPage />} />
        <Route path="/stock/entry/:stockEntryId" element={<StockEntryEditorPage />} />
        <Route path="/stock/list" element={<StockListPage />} />
        <Route path="/supplier-portal/delivery-lists" element={<SupplierDeliveryListsPage />} />
        <Route path="/supplier-portal/delivery-lists/:deliveryId" element={<SupplierPortalDeliveryEditorPage />} />

        <Route path="/settings/users" element={<UserManagementPage />} />
        <Route path="/settings/categories" element={<SettingsDefinitionPage entityKey="categories" />} />
        <Route path="/settings/collections" element={<SettingsDefinitionPage entityKey="collections" />} />
        <Route path="/settings/pos-categories" element={<SettingsDefinitionPage entityKey="pos-categories" />} />
        <Route path="/settings/barcode-standards" element={<SettingsDefinitionPage entityKey="barcode-standards" />} />
        <Route path="/settings/procurement-types" element={<SettingsDefinitionPage entityKey="procurement-types" />} />
        <Route path="/settings/payment-terms" element={<SettingsDefinitionPage entityKey="payment-terms" />} />
        <Route path="/settings/parameters" element={<ParametersPage />} />
        <Route path="/settings/smtp" element={<SmtpSettingsPage />} />

        <Route path="/supplier/products" element={<SupplierPortalProductListPage />} />
        <Route path="/supplier/dashboard" element={<SupplierDashboardPage />} />
        <Route path="/supplier/products/:productId" element={<SupplierPortalProductEditorPage />} />
        <Route path="/supplier/deliveries" element={<SupplierPortalDeliveryListPage />} />
        <Route path="/supplier/deliveries/new" element={<SupplierPortalDeliveryEditorPage />} />
        <Route path="/supplier/deliveries/:deliveryId" element={<SupplierPortalDeliveryEditorPage />} />
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
