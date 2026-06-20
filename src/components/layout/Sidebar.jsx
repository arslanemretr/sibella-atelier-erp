import React from "react";
import { Drawer, Layout, Menu } from "antd";
import {
  Activity,
  BarChart2,
  Boxes,
  BookOpen,
  FileText,
  ClipboardList,
  FolderTree,
  HandCoins,
  Layers3,
  LayoutDashboard,
  Mail,
  MonitorSmartphone,
  Package,
  PackagePlus,
  PackageSearch,
  Palette,
  ScanLine,
  Settings2,
  ShieldUser,
  Store,
  ShoppingCart,
  Tags,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { useBranding } from "../../erp/BrandingContext";
import { useLocation, useNavigate } from "react-router-dom";
import { filterNavigationItems, sidebarGroups, supplierSidebarGroups } from "../../erp/navigation";
import { getAuthUser, onAuthChange } from "../../auth";

const { Sider } = Layout;

function menuIcon(IconComponent) {
  return <IconComponent size={16} strokeWidth={2} />;
}

const iconMap = {
  "/dashboard": menuIcon(LayoutDashboard),
  products: menuIcon(Boxes),
  "products-group": menuIcon(Boxes),
  "/products/list": menuIcon(Package),
  "/products/new": menuIcon(PackagePlus),
  "/products/price-history": menuIcon(Tags),
  pos: menuIcon(MonitorSmartphone),
  "pos-group": menuIcon(MonitorSmartphone),
  "/pos/sessions": menuIcon(ClipboardList),
  "/pos/store": menuIcon(MonitorSmartphone),
  "/pos/orders": menuIcon(ClipboardList),
  "/pos/returns": menuIcon(Package),
  purchasing: menuIcon(HandCoins),
  "purchasing-group": menuIcon(HandCoins),
  "/purchasing/suppliers": menuIcon(Truck),
  "/purchasing/suppliers/new": menuIcon(Users),
  "/purchasing/contracts": menuIcon(ClipboardList),
  stores: menuIcon(Store),
  "stores-group": menuIcon(Store),
  "/stores/list": menuIcon(Store),
  "/stores/new": menuIcon(Users),
  "/stores/shipments": menuIcon(Truck),
  "/stores/shipments/new": menuIcon(PackagePlus),
  "store-sales":       menuIcon(FileText),
  "store-sales-group": menuIcon(FileText),
  "/stores/sales":     menuIcon(ShoppingCart),
  "/stores/invoices":  menuIcon(FileText),
  "/stores/cari":      menuIcon(BookOpen),
  stock: menuIcon(Package),
  "stock-group": menuIcon(Package),
  "/stock/entry": menuIcon(PackagePlus),
  "/stock/list": menuIcon(ClipboardList),
  "/stock/locations": menuIcon(Warehouse),
  "supplier-portal": menuIcon(ShieldUser),
  "supplier-portal-group": menuIcon(ShieldUser),
  "/supplier-portal/delivery-lists": menuIcon(Truck),
  "/supplier-portal/earnings": menuIcon(HandCoins),
  reports: menuIcon(ClipboardList),
  "reports-group": menuIcon(ClipboardList),
  "/reports/sales": menuIcon(TrendingUp),
  "/reports/stock": menuIcon(PackageSearch),
  "/reports/activity": menuIcon(BarChart2),
  "/reports/store-invoices": menuIcon(FileText),
  "/reports/consolidated-sales": menuIcon(TrendingUp),
  "/reports/consolidated-earnings": menuIcon(HandCoins),
  "/reports/supplier-earnings": menuIcon(HandCoins),
  settings: menuIcon(Settings2),
  "settings-group": menuIcon(Settings2),
  "/settings/users": menuIcon(Users),
  "/settings/categories": menuIcon(FolderTree),
  "/settings/collections": menuIcon(Layers3),
  "/settings/pos-categories": menuIcon(Boxes),
  "/settings/barcode-standards": menuIcon(ScanLine),
  "/settings/procurement-types": menuIcon(HandCoins),
  "/settings/payment-terms": menuIcon(ClipboardList),
  "/settings/parameters": menuIcon(Settings2),
  "/settings/mail-management": menuIcon(Mail),
  "/settings/smtp": menuIcon(Mail),
  "/settings/branding": menuIcon(Palette),
  "/settings/audit-log": menuIcon(Activity),
  "/supplier/dashboard": menuIcon(LayoutDashboard),
  "/supplier/products": menuIcon(Package),
  "/supplier/earnings": menuIcon(HandCoins),
  "/supplier/deliveries/new": menuIcon(PackagePlus),
  "/supplier/deliveries": menuIcon(Truck),
  "/supplier/reports/sales": menuIcon(TrendingUp),
  "/supplier/reports/stock": menuIcon(PackageSearch),
};

function withIcons(items) {
  return items.map((item) => ({
    ...item,
    icon: iconMap[item.key] || iconMap[item.label] || item.icon,
    children: item.children ? withIcons(item.children) : undefined,
  }));
}

const Sidebar = ({ collapsed, setCollapsed, isTabletOrMobile }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [authUser, setAuthUser] = React.useState(() => getAuthUser());
  React.useEffect(() => onAuthChange(() => setAuthUser(getAuthUser())), []);
  const { appName, logoSrc, mobileLogoSrc } = useBranding();
  const items = withIcons(
    authUser?.role === "Tedarikci"
      ? supplierSidebarGroups
      : filterNavigationItems(sidebarGroups, authUser?.role, authUser?.permissions),
  );
  const selectedKey = React.useMemo(() => {
    const allRoutes = [];
    const collect = (nodes) => {
      nodes.forEach((item) => {
        if (typeof item.key === "string" && item.key.startsWith("/")) {
          allRoutes.push(item.key);
        }
        if (item.children) {
          collect(item.children);
        }
      });
    };

    collect(items);
    return allRoutes.find((route) => location.pathname === route || location.pathname.startsWith(`${route}/`)) || location.pathname;
  }, [items, location.pathname]);

  React.useEffect(() => {
    if (isTabletOrMobile) {
      setCollapsed(true);
    }
  }, [isTabletOrMobile, location.pathname, setCollapsed]);

  const sidebarContent = (
    <div
      className="erp-rail-bg"
      style={{
        minHeight: "100%",
        background: "linear-gradient(180deg, #ef7a5f 0%, #e8674e 48%, #d2543c 100%)",
      }}
    >
      <div
        className="erp-rail-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 11,
          height: 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isTabletOrMobile ? (
          <button
            type="button"
            aria-label="Kapat"
            onClick={() => setCollapsed(true)}
            style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              border: "none", background: "transparent", cursor: "pointer", color: "#fff6f1",
              display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 6,
            }}
          >
            <X size={22} strokeWidth={2.2} />
          </button>
        ) : null}
        <div className="erp-rail-logo">
          {collapsed ? (
            <img src={mobileLogoSrc} alt={appName} style={{ height: 26, maxWidth: 38, objectFit: "contain" }} />
          ) : authUser?.role === "Tedarikci" ? (
            <div className="erp-sidebar-brand-multiline">
              <img src={logoSrc} alt={appName} style={{ height: 34, maxWidth: 150, objectFit: "contain" }} />
              <span style={{ fontSize: 10, color: "#9a5a4c", marginTop: 1 }}>Tedarikci Portali</span>
            </div>
          ) : (
            <img src={logoSrc} alt={appName} style={{ height: 40, maxWidth: 168, objectFit: "contain" }} />
          )}
        </div>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={items}
        onClick={({ key }) => {
          if (String(key).startsWith("/")) {
            navigate(key);
            if (isTabletOrMobile) {
              setCollapsed(true);
            }
          }
        }}
        style={{ borderRight: 0, padding: "12px 8px 32px" }}
      />
    </div>
  );

  if (isTabletOrMobile) {
    return (
      <Drawer
        placement="left"
        open={!collapsed}
        onClose={() => setCollapsed(true)}
        maskClosable
        closable={false}
        zIndex={1100}
        rootClassName="erp-sidebar-drawer"
        styles={{
          content: { background: "linear-gradient(180deg, #ef7a5f 0%, #e8674e 48%, #d2543c 100%)" },
          body: { padding: 0, background: "transparent" },
          header: { display: "none" },
          wrapper: { width: 252 },
        }}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  return (
    <Sider
      className="erp-sidebar erp-rail"
      trigger={null}
      collapsible
      collapsed={collapsed}
      collapsedWidth={isTabletOrMobile ? 0 : 72}
      theme="light"
      width={244}
      breakpoint="lg"
      style={{
        boxShadow: "2px 0 18px rgba(210, 84, 60, 0.25)",
        zIndex: isTabletOrMobile ? 1003 : 10,
        height: "100vh",
        overflow: "auto",
        position: isTabletOrMobile ? "fixed" : "sticky",
        insetInlineStart: 0,
        top: 0,
        bottom: 0,
      }}
    >
      {sidebarContent}
    </Sider>
  );
};

export default Sidebar;
