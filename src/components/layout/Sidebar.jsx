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
  return <IconComponent size={18} strokeWidth={2.1} />;
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

// Üst düzey grupların sabit renkleri (görsele göre); diğer öğeler anahtardan
// türetilen stabil bir paletten renk alır → renkli ikon kutucuğu görünümü.
const GROUP_TINT = {
  "/dashboard": "#5b8def",
  products: "#f5455c", "products-group": "#f5455c",
  pos: "#3b82f6", "pos-group": "#3b82f6",
  purchasing: "#fb923c", "purchasing-group": "#fb923c",
  stores: "#22c55e", "stores-group": "#22c55e",
  stock: "#8b5cf6", "stock-group": "#8b5cf6",
  "supplier-portal": "#06b6d4", "supplier-portal-group": "#06b6d4",
  reports: "#f59e0b", "reports-group": "#f59e0b",
  settings: "#94a3b8", "settings-group": "#94a3b8",
  "/supplier/dashboard": "#5b8def",
};
const TINT_PALETTE = ["#5b8def", "#f5455c", "#8b5cf6", "#22c55e", "#fb923c", "#06b6d4", "#f59e0b", "#ec4899", "#14b8a6", "#6366f1"];
function tintFor(key) {
  if (GROUP_TINT[key]) return GROUP_TINT[key];
  const s = String(key || "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TINT_PALETTE[h % TINT_PALETTE.length];
}
function tile(iconEl, bg) {
  if (!iconEl) return undefined;
  return <span className="erp-nav-tile" style={{ background: bg }}>{iconEl}</span>;
}

function withIcons(items) {
  return items.map((item) => ({
    ...item,
    icon: tile(iconMap[item.key] || iconMap[item.label] || item.icon, tintFor(item.key)),
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
    <>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 11,
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#f38b7a",
          fontWeight: 800,
          fontSize: collapsed ? 14 : 18,
          borderBottom: "1px solid #f0f0f0",
          background: "#fff",
        }}
      >
        {isTabletOrMobile ? (
          <button
            type="button"
            aria-label="Kapat"
            onClick={() => setCollapsed(true)}
            style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              border: "none", background: "transparent", cursor: "pointer", color: "#1f2430",
              display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 6,
            }}
          >
            <X size={22} strokeWidth={2.2} />
          </button>
        ) : null}
        {collapsed ? (
          <img src={mobileLogoSrc} alt={appName} style={{ height: 32, maxWidth: 40, objectFit: "contain" }} />
        ) : authUser?.role === "Tedarikci" ? (
          <div className="erp-sidebar-brand-multiline">
            <img src={logoSrc} alt={appName} style={{ height: 32, maxWidth: 120, objectFit: "contain" }} />
            <span style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Tedarikci Portali</span>
          </div>
        ) : (
          <img src={logoSrc} alt={appName} style={{ height: 36, maxWidth: 140, objectFit: "contain" }} />
        )}
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
    </>
  );

  if (isTabletOrMobile) {
    return (
      <Drawer
        placement="left"
        open={!collapsed}
        onClose={() => setCollapsed(true)}
        maskClosable
        closable={false}
        rootClassName="erp-sidebar-drawer"
        styles={{ body: { padding: 0 }, header: { display: "none" }, wrapper: { width: 288 } }}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  return (
    <Sider
      className="erp-sidebar"
      trigger={null}
      collapsible
      collapsed={collapsed}
      collapsedWidth={isTabletOrMobile ? 0 : 80}
      theme="light"
      width={280}
      breakpoint="lg"
      style={{
        boxShadow: "2px 0 12px rgba(15, 23, 42, 0.06)",
        zIndex: isTabletOrMobile ? 1003 : 10,
        height: "100vh",
        overflow: "auto",
        borderRight: "1px solid #f0f0f0",
        position: isTabletOrMobile ? "fixed" : "sticky",
        insetInlineStart: 0,
        top: 0,
        bottom: 0,
        background: "#fff",
      }}
    >
      {sidebarContent}
    </Sider>
  );
};

export default Sidebar;
