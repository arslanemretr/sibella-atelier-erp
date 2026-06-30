import React, { Suspense, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout, Button, Avatar, Dropdown, Space, Spin, Tooltip } from "antd";
import { CloseOutlined, MenuFoldOutlined, MenuUnfoldOutlined, RobotOutlined, UserOutlined } from "@ant-design/icons";

const AiAssistantChat = React.lazy(() => import("../../erp/pageModules/aiAssistantPage"));
import { filterNavigationItems, mainMenuItems, supplierMainMenuItems } from "../../erp/navigation";
import { getAuthUser, logoutUser, onAuthChange } from "../../auth";
import { useBranding } from "../../erp/BrandingContext";

const { Header } = Layout;

const TopBar = ({ collapsed, setCollapsed, isTabletOrMobile }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [authUser, setAuthUser] = React.useState(() => getAuthUser());
  const { appName, logoSrc, mobileLogoSrc } = useBranding();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMounted, setAiMounted] = useState(false);

  React.useEffect(() => onAuthChange(() => setAuthUser(getAuthUser())), []);

  const canUseAssistant = authUser?.role === "Yonetici";

  const visibleMenuItems = authUser?.role === "Tedarikci"
    ? supplierMainMenuItems
    : filterNavigationItems(mainMenuItems, authUser?.role, authUser?.permissions);

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
      { key: "logout", label: "Cikis Yap" },
    ],
    onClick: async ({ key }) => {
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
        <div className="erp-topbar-mobile-brand" aria-label={appName}>
          <img src={mobileLogoSrc} alt={appName} className="erp-topbar-mobile-logo" />
        </div>
      ) : null}

      <Space size={isTabletOrMobile ? "middle" : "large"} className="erp-topbar-right">
        {canUseAssistant ? (
          <Tooltip title="AI Asistan">
            <Button
              type={aiOpen ? "primary" : "text"}
              aria-label="AI Asistan"
              icon={<RobotOutlined style={{ fontSize: 20 }} />}
              onClick={() => setAiOpen((v) => { if (!v) setAiMounted(true); return !v; })}
            />
          </Tooltip>
        ) : null}
        <Dropdown menu={userMenu} placement="bottomRight">
          <Space style={{ cursor: "pointer" }} className="erp-topbar-user">
            <Avatar icon={<UserOutlined />} />
            {!isTabletOrMobile ? <span style={{ fontWeight: 600, color: "#262626" }}>{authUser?.fullName || "Kullanici"}</span> : null}
          </Space>
        </Dropdown>
      </Space>

      {canUseAssistant && aiMounted ? (
        <div
          className="erp-ai-panel"
          style={{
            position: "fixed",
            zIndex: 1001,
            background: "#fff",
            display: aiOpen ? "flex" : "none",
            flexDirection: "column",
            overflow: "hidden",
            border: "1px solid #ececec",
            borderRadius: isTabletOrMobile ? 14 : 16,
            boxShadow: "0 14px 44px rgba(0,0,0,.20)",
            ...(isTabletOrMobile
              ? { left: 8, right: 8, top: 64, bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 8px)" }
              : { right: 20, bottom: 20, width: 400, height: "min(640px, 82vh)" }),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: "1px solid #f0f0f0",
              flex: "0 0 auto",
            }}
          >
            <Space size={8}>
              <RobotOutlined style={{ fontSize: 18 }} />
              <span style={{ fontWeight: 600 }}>AI Asistan</span>
            </Space>
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setAiOpen(false)} aria-label="Kapat" />
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}><Spin /></div>}>
              <AiAssistantChat />
            </Suspense>
          </div>
        </div>
      ) : null}
    </Header>
  );
};

export default TopBar;
