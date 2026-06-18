import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Drawer, Input } from "antd";
import {
  AppstoreOutlined, BarChartOutlined, CarOutlined, DesktopOutlined, DownloadOutlined,
  ExclamationCircleOutlined, FileTextOutlined, HomeOutlined, InboxOutlined, PieChartOutlined,
  PlusOutlined, RightOutlined, RollbackOutlined, SearchOutlined, SendOutlined, ShoppingOutlined,
  SwapOutlined, TagOutlined, TeamOutlined, UnorderedListOutlined, WalletOutlined,
} from "@ant-design/icons";
import { getAuthUser } from "../../auth";
import { sidebarGroups, supplierSidebarGroups, filterNavigationItems } from "../../erp/navigation";

const TINTS = [
  { bg: "#fde9e4", fg: "#e8674e" }, { bg: "#fdeee9", fg: "#e8835e" },
  { bg: "#e3f5f0", fg: "#1f9d8a" }, { bg: "#fdf3e3", fg: "#e7a93b" },
  { bg: "#f1edfb", fg: "#7c54d4" }, { bg: "#eaf0fb", fg: "#3f72d8" },
];

const ITEM_ICONS = {
  "/products/list": <UnorderedListOutlined />,
  "/products/new": <PlusOutlined />,
  "/products/price-history": <TagOutlined />,
  "/pos/sessions": <FileTextOutlined />,
  "/pos/store": <DesktopOutlined />,
  "/pos/orders": <UnorderedListOutlined />,
  "/pos/returns": <RollbackOutlined />,
  "/stock/entry": <DownloadOutlined />,
  "/stock/list": <SwapOutlined />,
  "/stock/locations": <InboxOutlined />,
  "/purchasing/suppliers": <CarOutlined />,
  "/purchasing/suppliers/new": <TeamOutlined />,
  "/supplier/reports/sales": <BarChartOutlined />,
  "/supplier/reports/stock": <PieChartOutlined />,
};
const itemIcon = (key) => ITEM_ICONS[key] || <AppstoreOutlined />;

const QUICK = {
  "products-group": [
    { label: "Düşük Stoklar", desc: "kritik seviyedeki ürünler", route: "/products/list", icon: <ExclamationCircleOutlined />, tint: { bg: "#fde9e4", fg: "#e8674e" } },
    { label: "Fiyat Değişiklikleri", desc: "son fiyat güncellemeleri", route: "/products/price-history", icon: <TagOutlined />, tint: { bg: "#e3f5f0", fg: "#1f9d8a" } },
  ],
};

function buildTabs(isSupplier, groups) {
  if (isSupplier) {
    const reportsGroup = groups.find((g) => (g.label || "").toUpperCase().includes("RAPOR"));
    return [
      { key: "s-dashboard", label: "Anasayfa", icon: <HomeOutlined />, route: "/supplier/dashboard" },
      { key: "s-products", label: "Ürünler", icon: <ShoppingOutlined />, route: "/supplier/products" },
      { key: "s-deliveries", label: "Teslimat", icon: <SendOutlined />, route: "/supplier/deliveries" },
      { key: "s-earnings", label: "Hakediş", icon: <WalletOutlined />, route: "/supplier/earnings" },
      { key: "s-reports", label: "Rapor", icon: <BarChartOutlined />, sheet: { title: "Raporlar", items: reportsGroup?.children || [] } },
    ];
  }
  const top = groups.flatMap((g) => g.children || []);
  const g = (k) => top.find((t) => t.key === k);
  return [
    { key: "ana", label: "Ana", icon: <HomeOutlined />, route: "/dashboard" },
    { key: "products-group", label: "Ürünler", icon: <ShoppingOutlined />, sheet: { title: "Ürünler", items: g("products-group")?.children || [], quick: QUICK["products-group"] } },
    { key: "pos-group", label: "POS", icon: <DesktopOutlined />, sheet: { title: "POS", items: g("pos-group")?.children || [] } },
    { key: "gonderi", label: "Gönderi", icon: <SendOutlined />, route: "/stores/shipments" },
    { key: "reports-group", label: "Rapor", icon: <BarChartOutlined />, sheet: { title: "Raporlar", items: g("reports-group")?.children || [] } },
  ];
}

export default function MobileTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = getAuthUser();
  const [openKey, setOpenKey] = React.useState(null);

  const isSupplier = authUser?.role === "Tedarikci";
  const groups = isSupplier ? supplierSidebarGroups : filterNavigationItems(sidebarGroups, authUser?.role, authUser?.permissions);
  const tabs = React.useMemo(() => buildTabs(isSupplier, groups), [isSupplier, groups]);

  const activeKey = React.useMemo(() => {
    const p = location.pathname;
    for (const t of tabs) {
      if (t.route) { if (p === t.route || p.startsWith(`${t.route}/`)) return t.key; }
      else if (t.sheet) { if ((t.sheet.items || []).some((c) => p === c.key || p.startsWith(`${c.key}/`))) return t.key; }
    }
    return null;
  }, [location.pathname, tabs]);

  const onTab = (t) => {
    if (t.route) { navigate(t.route); setOpenKey(null); }
    else setOpenKey(t.key);
  };

  const activeSheet = openKey ? tabs.find((t) => t.key === openKey)?.sheet : null;

  return (
    <>
      <nav className="erp-tabbar">
        {tabs.map((t) => (
          <button key={t.key} type="button" className={`erp-tab${activeKey === t.key ? " active" : ""}`} onClick={() => onTab(t)}>
            <span className="erp-tab-ico">{t.icon}</span>
            <span className="erp-tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <Drawer
        placement="bottom"
        open={!!activeSheet}
        onClose={() => setOpenKey(null)}
        height="auto"
        zIndex={1100}
        title={activeSheet?.title}
        styles={{
          body: { padding: "4px 16px calc(28px + env(safe-area-inset-bottom, 0px))", maxHeight: "72vh", overflowY: "auto" },
          content: { borderTopLeftRadius: 22, borderTopRightRadius: 22 },
          header: { borderBottom: "none", paddingBottom: 4 },
        }}
      >
        <Input
          size="large"
          prefix={<SearchOutlined style={{ color: "#98a2b3" }} />}
          placeholder="Ara"
          style={{ borderRadius: 12, marginBottom: 14 }}
          readOnly
          onClick={() => { const first = activeSheet?.items?.[0]; if (first) { navigate(first.key); setOpenKey(null); } }}
        />

        <div className="erp-sheet-section">İŞLEMLER</div>
        {(activeSheet?.items || []).map((c, i) => (
          <button key={c.key} type="button" className="erp-sheet-item" onClick={() => { navigate(c.key); setOpenKey(null); }}>
            <span className="erp-sheet-chip" style={{ background: TINTS[i % TINTS.length].bg, color: TINTS[i % TINTS.length].fg }}>{itemIcon(c.key)}</span>
            <span style={{ flex: 1, textAlign: "left", fontWeight: 500 }}>{c.label}</span>
            <RightOutlined style={{ color: "#c2c8d0", fontSize: 12 }} />
          </button>
        ))}

        {activeSheet?.quick?.length ? <div className="erp-sheet-section" style={{ marginTop: 14 }}>HIZLI ERİŞİM</div> : null}
        {(activeSheet?.quick || []).map((q, i) => (
          <button key={i} type="button" className="erp-sheet-quick" onClick={() => { navigate(q.route); setOpenKey(null); }}>
            <span className="erp-sheet-chip" style={{ background: q.tint.bg, color: q.tint.fg }}>{q.icon}</span>
            <span style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontWeight: 600 }}>{q.label}</div>
              <div style={{ fontSize: 12, color: "#98a2b3" }}>{q.desc}</div>
            </span>
            <RightOutlined style={{ color: "#c2c8d0", fontSize: 12 }} />
          </button>
        ))}
      </Drawer>
    </>
  );
}
