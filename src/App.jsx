import React from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import { getAuthUser, isAuthenticated, onAuthChange } from "./auth";
import {
  DashboardPage,
  PosScreenPage,
  PosSessionsPage,
  ProductEditorPage,
  ProductListPage,
  PurchaseEditorPage,
  PurchaseListPage,
  ParametersPage,
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

  React.useEffect(() => {
    resetOperationalDataIfNeeded();
    setAuthenticated(isAuthenticated());
    setAuthUser(getAuthUser());
    return onAuthChange(() => {
      setAuthenticated(isAuthenticated());
      setAuthUser(getAuthUser());
    });
  }, []);

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const isSupplierUser = authUser?.role === "Tedarikci";

  const isSupplierPortalRoute =
    location.pathname === "/supplier" || location.pathname.startsWith("/supplier/");

  if (isSupplierUser && !isSupplierPortalRoute) {
    return <Navigate to="/supplier/deliveries" replace />;
  }

  if (!isSupplierUser && isSupplierPortalRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to={isSupplierUser ? "/supplier/deliveries" : "/dashboard"} replace />} />
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
        <Route path="/purchasing/list" element={<PurchaseListPage />} />
        <Route path="/purchasing/entry" element={<PurchaseEditorPage />} />
        <Route path="/purchasing/entry/:purchaseId" element={<PurchaseEditorPage />} />

        <Route path="/stock/entry" element={<StockEntryListPage />} />
        <Route path="/stock/entry/new" element={<StockEntryEditorPage />} />
        <Route path="/stock/entry/:stockEntryId" element={<StockEntryEditorPage />} />
        <Route path="/stock/list" element={<StockListPage />} />
        <Route path="/supplier-portal/delivery-lists" element={<SupplierDeliveryListsPage />} />

        <Route path="/settings/users" element={<UserManagementPage />} />
        <Route path="/settings/categories" element={<SettingsDefinitionPage entityKey="categories" />} />
        <Route path="/settings/collections" element={<SettingsDefinitionPage entityKey="collections" />} />
        <Route path="/settings/pos-categories" element={<SettingsDefinitionPage entityKey="pos-categories" />} />
        <Route path="/settings/barcode-standards" element={<SettingsDefinitionPage entityKey="barcode-standards" />} />
        <Route path="/settings/procurement-types" element={<SettingsDefinitionPage entityKey="procurement-types" />} />
        <Route path="/settings/payment-terms" element={<SettingsDefinitionPage entityKey="payment-terms" />} />
        <Route path="/settings/parameters" element={<ParametersPage />} />

        <Route path="/supplier/products" element={<SupplierPortalProductListPage />} />
        <Route path="/supplier/products/new" element={<SupplierPortalProductEditorPage />} />
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
