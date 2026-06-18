import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Drawer, Input } from "antd";
import {
  AppstoreOutlined, BarChartOutlined, CarOutlined, DesktopOutlined, DownloadOutlined,
  ExclamationCircleOutlined, FileTextOutlined, HomeOutlined, InboxOutlined, PlusOutlined,
  RightOutlined, RollbackOutlined, SearchOutlined, ShoppingOutlined, SwapOutlined,
  TagOutlined, TeamOutlined, UnorderedListOutlined,
} from "@ant-design/icons";
import { getAuthUser } from "../../auth";
import { sidebarGroups, filterNavigationItems } from "../../erp/navigation";

const TABS = [
  { key: "ana", label: "Ana", icon: <HomeOutlined />, route: "/dashboard" },
  { key: "products-group", label: "Ürünler", icon: <ShoppingOutlined /> },
  { key: "pos-group", label: "POS", icon: <DesktopOutlined /> },
  { key: "stock-group", label: "Stok", icon: <InboxOutlined /> },
  { key: "reports-group", label: "Rapor", icon: <BarChartOutlined /> },
];

const TINTS = [
  { bg: "#fde9e4", fg: "#e8674e" },
  { bg: "#fdeee9", fg: "#e8835e" },
  { bg: "#e3f5f0", fg: "#1f9d8a" },
  { bg: "#fdf3e3", fg: "#e7a93b" },
  { bg: "#f1edfb", fg: "#7c54d4" },
  { bg: "#eaf0fb", fg: "#3f72d8" },
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
};
const itemIcon = (key) => ITEM_ICONS[key] || <AppstoreOutlined />;

// Bolume ozel hizli erisim kartlari
const QUICK = {
  "products-group": [
    { label: "Düşük Stoklar", desc: "kritik seviyedeki ürünler", route: "/products/list", icon: <ExclamationCircleOutlined />, tint: { bg: "#fde9e4", fg: "#e8674e" } },
    { label: "Fiyat Değişiklikleri", desc: "son fiyat güncellemeleri", route: "/products/price-history", icon: <TagOutlined />, tint: { bg: "#e3f5f0", fg: "#1f9d8a" } },
  ],
};

export default function MobileTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = getAuthUser();
  const [sheet, setSheet] = React.useState(null);

  const groups = filterNavigationItems(sidebarGroups, authUser?.role, authUser?.permissions);
  const topItems = React.useMemo(() => groups.flatMap((g) => g.children || []), [groups]);
  const groupFor = (key) => topItems.find((t) => t.key === key);

  const activeTab = React.useMemo(() => {
    const p = location.pathname;
    if (p === "/dashboard" || p.startsWith("/dashboard/")) return "ana";
    for (const t of TABS) {
      if (t.key === "ana") continue;
      const g = groupFor(t.key);
      if (g?.children?.some((c) => p === c.key || p.startsWith(`${c.key}/`))) return t.key;
    }
    return null;
  }, [location.pathname]); // eslint-disable-line

  const onTab = (t) => {
    if (t.route) { navigate(t.route); setSheet(null); }
    else setSheet(t.key);
  };

  const sheetGroup = sheet ? groupFor(sheet) : null;
  const quick = sheet ? (QUICK[sheet] || []) : [];

  return (
    <>
      <nav className="erp-tabbar">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`erp-tab${activeTab === t.key ? " active" : ""}`} onClick={() => onTab(t)}>
            <span className="erp-tab-ico">{t.icon}</span>
            <span className="erp-tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <Drawer
        placement="bottom"
        open={!!sheet}
        onClose={() => setSheet(null)}
        height="auto"
        title={sheetGroup?.label}
        styles={{ body: { padding: "4px 16px 28px" }, content: { borderTopLeftRadius: 22, borderTopRightRadius: 22 }, header: { borderBottom: "none", paddingBottom: 4 } }}
      >
        <Input
          size="large"
          prefix={<SearchOutlined style={{ color: "#98a2b3" }} />}
          placeholder="Ara"
          style={{ borderRadius: 12, marginBottom: 14 }}
          readOnly
          onClick={() => { const first = sheetGroup?.children?.[0]; if (first) { navigate(first.key); setSheet(null); } }}
        />

        <div className="erp-sheet-section">İŞLEMLER</div>
        {(sheetGroup?.children || []).map((c, i) => (
          <button key={c.key} type="button" className="erp-sheet-item" onClick={() => { navigate(c.key); setSheet(null); }}>
            <span className="erp-sheet-chip" style={{ background: TINTS[i % TINTS.length].bg, color: TINTS[i % TINTS.length].fg }}>{itemIcon(c.key)}</span>
            <span style={{ flex: 1, textAlign: "left", fontWeight: 500 }}>{c.label}</span>
            <RightOutlined style={{ color: "#c2c8d0", fontSize: 12 }} />
          </button>
        ))}

        {quick.length ? <div className="erp-sheet-section" style={{ marginTop: 14 }}>HIZLI ERİŞİM</div> : null}
        {quick.map((q, i) => (
          <button key={i} type="button" className="erp-sheet-quick" onClick={() => { navigate(q.route); setSheet(null); }}>
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
