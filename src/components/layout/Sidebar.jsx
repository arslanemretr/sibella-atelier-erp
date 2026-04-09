import React from "react";
import { Drawer, Layout, Menu } from "antd";
import { AppstoreOutlined, SettingOutlined, ShoppingCartOutlined, ShopOutlined, TableOutlined, UserOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { sidebarGroups, supplierSidebarGroups } from "../../erp/navigation";
import { getAuthUser, onAuthChange } from "../../auth";

const { Sider } = Layout;

const iconMap = {
  Dashboard: <AppstoreOutlined />,
  Urunler: <ShopOutlined />,
  Pos: <TableOutlined />,
  Satinalma: <ShoppingCartOutlined />,
  Stok: <ShopOutlined />,
  "Tedarikci Portal": <UserOutlined />,
  Ayarlar: <SettingOutlined />,
  Kullanici: <UserOutlined />,
};

function withIcons(items) {
  return items.map((item) => ({
    ...item,
    icon: iconMap[item.label] || item.icon,
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
          height: 64,
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
        {collapsed ? "S" : authUser?.role === "Tedarikci" ? "Sibella Atelier Portal" : "Sibella Atelier"}
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
