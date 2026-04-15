import React from "react";
import { Drawer, Layout, Menu } from "antd";
import {
  Boxes,
  ClipboardList,
  FolderTree,
  HandCoins,
  Layers3,
  LayoutDashboard,
  Mail,
  MonitorSmartphone,
  Package,
  PackagePlus,
  ScanLine,
  Settings2,
  ShieldUser,
  Truck,
  Users,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { sidebarGroups, supplierSidebarGroups } from "../../erp/navigation";
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
  pos: menuIcon(MonitorSmartphone),
  "pos-group": menuIcon(MonitorSmartphone),
  "/pos/sessions": menuIcon(ClipboardList),
  "/pos/store": menuIcon(MonitorSmartphone),
  purchasing: menuIcon(HandCoins),
  "purchasing-group": menuIcon(HandCoins),
  "/purchasing/suppliers": menuIcon(Truck),
  "/purchasing/suppliers/new": menuIcon(Users),
  "/purchasing/contracts": menuIcon(ClipboardList),
  stock: menuIcon(Package),
  "stock-group": menuIcon(Package),
  "/stock/entry": menuIcon(PackagePlus),
  "/stock/list": menuIcon(ClipboardList),
  "supplier-portal": menuIcon(ShieldUser),
  "supplier-portal-group": menuIcon(ShieldUser),
  "/supplier-portal/delivery-lists": menuIcon(Truck),
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
  "/settings/smtp": menuIcon(Mail),
  "/supplier/dashboard": menuIcon(LayoutDashboard),
  "/supplier/products": menuIcon(Package),
  "/supplier/earnings": menuIcon(HandCoins),
  "/supplier/deliveries/new": menuIcon(PackagePlus),
  "/supplier/deliveries": menuIcon(Truck),
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
  const items = withIcons(authUser?.role === "Tedarikci" ? supplierSidebarGroups : sidebarGroups);
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
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#f38b7a",
          fontWeight: 800,
          fontSize: collapsed ? 14 : 18,
          borderBottom: "1px solid #f0f0f0",
          background: "#fff",
          position: "sticky",
          top: 0,
          zIndex: 11,
        }}
      >
        {collapsed ? "S" : authUser?.role === "Tedarikci" ? (
          <div className="erp-sidebar-brand-multiline">
            <span>Sibella Atelier Design Store</span>
            <span>Tedarikçi Portalı</span>
          </div>
        ) : "Sibella Atelier"}
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
        width={280}
        maskClosable
        closable
        rootClassName="erp-sidebar-drawer"
        bodyStyle={{ padding: 0 }}
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
