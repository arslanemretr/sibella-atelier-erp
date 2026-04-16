import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout, Button, Avatar, Dropdown, Space } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined, BellOutlined, UserOutlined } from "@ant-design/icons";
import { filterNavigationItems, mainMenuItems, supplierMainMenuItems } from "../../erp/navigation";
import { getAuthUser, logoutUser, onAuthChange } from "../../auth";
import logo from "../../assets/logo.png";
import mobileLogo from "../../assets/logo-mobile.png";

const { Header } = Layout;

const TopBar = ({ collapsed, setCollapsed, isTabletOrMobile }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [authUser, setAuthUser] = React.useState(() => getAuthUser());

  React.useEffect(() => onAuthChange(() => setAuthUser(getAuthUser())), []);

  const visibleMenuItems = authUser?.role === "Tedarikci"
    ? supplierMainMenuItems
    : filterNavigationItems(mainMenuItems, authUser?.role);

  const activeMainMenu = useMemo(
    () =>
      visibleMenuItems.find((item) =>
        item.key.startsWith("/")
          ? location.pathname === item.key || location.pathname.startsWith(`${item.key}/`)
          : item.children?.some((child) => location.pathname === child.key || location.pathname.startsWith(`${child.key}/`)),
      )?.key,
    [location.pathname, visibleMenuItems],
  );

  const activeMainMenuLabel = useMemo(() => {
    for (const item of visibleMenuItems) {
      if (item.key === activeMainMenu) {
        return item.label;
      }

      const activeChild = item.children?.find((child) => child.key === activeMainMenu);
      if (activeChild) {
        return activeChild.label;
      }
    }

    return authUser?.role === "Tedarikci" ? "Tedarikci Portali" : "ERP";
  }, [activeMainMenu, authUser?.role, visibleMenuItems]);

  const userMenu = {
    items: [
      { key: "profile", label: "Kullanici Tercihleri" },
      { key: "logout", label: "Cikis Yap" },
    ],
    onClick: async ({ key }) => {
      if (key === "profile") {
        navigate(authUser?.role === "Tedarikci" ? "/supplier/dashboard" : "/settings/users");
      }
      if (key === "logout") {
        await logoutUser();
        navigate("/login", { replace: true });
      }
    },
  };

  return (
    <Header
      className="erp-topbar"
      style={{
        padding: isTabletOrMobile ? "0 12px 0 0" : "0 20px 0 0",
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 1px 4px rgba(0,21,41,.06)",
        zIndex: 9,
        gap: 16,
      }}
    >
      <Space size={8} style={{ paddingLeft: isTabletOrMobile ? 4 : 8 }} className="erp-topbar-left">
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setCollapsed(!collapsed)}
          style={{ fontSize: 16, width: 56, height: 56 }}
        />
        {isTabletOrMobile ? (
          <div className="erp-topbar-mobile-title">{activeMainMenuLabel}</div>
        ) : (
          <Space size={8} wrap className="erp-topbar-nav">
            {visibleMenuItems.map((item) => {
              if (!item.children) {
                return (
                  <Button
                    key={item.key}
                    type={activeMainMenu === item.key ? "primary" : "text"}
                    onClick={() => navigate(item.key)}
                  >
                    {item.label}
                  </Button>
                );
              }

              return (
                <Dropdown
                  key={item.key}
                  menu={{
                    items: item.children.map((child) => ({ key: child.key, label: child.label })),
                    onClick: ({ key }) => navigate(key),
                  }}
                  trigger={["click"]}
                >
                  <Button type={activeMainMenu === item.key ? "primary" : "text"}>
                    {item.label}
                  </Button>
                </Dropdown>
              );
            })}
          </Space>
        )}
      </Space>

      {isTabletOrMobile ? (
        <div className="erp-topbar-mobile-brand" aria-label="Sibella Atelier">
          <img src={mobileLogo || logo} alt="Sibella Atelier" className="erp-topbar-mobile-logo" />
        </div>
      ) : null}

      <Space size={isTabletOrMobile ? "middle" : "large"} className="erp-topbar-right">
        <BellOutlined style={{ fontSize: 18, color: "#595959" }} />
        <Dropdown menu={userMenu} placement="bottomRight">
          <Space style={{ cursor: "pointer" }} className="erp-topbar-user">
            <Avatar icon={<UserOutlined />} />
            {!isTabletOrMobile ? <span style={{ fontWeight: 600, color: "#262626" }}>{authUser?.fullName || "Kullanici"}</span> : null}
          </Space>
        </Dropdown>
      </Space>
    </Header>
  );
};

export default TopBar;
