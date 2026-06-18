import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Grid, Select, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import {
  AppstoreOutlined, BarChartOutlined, ControlOutlined, EditOutlined, ExclamationCircleOutlined,
  PlusCircleOutlined, PrinterOutlined, RightOutlined, RiseOutlined, ShoppingOutlined,
  DownloadOutlined, AppstoreAddOutlined, ShopOutlined, FileTextOutlined,
} from "@ant-design/icons";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchDashboardSummary } from "../dashboardApi";
import { listStoresFresh } from "../storesData";
import { listPosSessionsFresh } from "../posData";

const { Title, Text } = Typography;

const ACCENT = "#e8674e";
const DONUT_COLORS = ["#e8674e", "#1f9d8a", "#e7a93b", "#3f72d8", "#9aa3b2"];

function money(v) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 }).format(Number(v || 0));
}

const PERIODS = {
  bugun: { label: "Bugün", range: () => [dayjs().startOf("day"), dayjs()] },
  hafta: { label: "Bu Hafta", range: () => [dayjs().startOf("week"), dayjs()] },
  ay: { label: "Bu Ay", range: () => [dayjs().startOf("month"), dayjs()] },
  son30: { label: "Son 30 Gün", range: () => [dayjs().subtract(29, "day"), dayjs()] },
};

function KpiCard({ title, value, hint, icon, tint }) {
  return (
    <Card bordered={false} className="erp-kpi-card" styles={{ body: { padding: 18 } }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <Text style={{ color: "#697586", fontSize: 13 }}>{title}</Text>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6, color: "#1f2733", whiteSpace: "nowrap" }}>{value}</div>
          {hint ? <div style={{ marginTop: 10, fontSize: 12, color: "#98a2b3" }}>{hint}</div> : null}
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: tint.bg, color: tint.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{icon}</div>
      </div>
    </Card>
  );
}

export function OperationsCenterPage() {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;

  const [period, setPeriod] = React.useState("son30");
  const [storeId, setStoreId] = React.useState();

  // TanStack Query pilotu: tek queryKey ['dashboard', period].
  // API fonksiyonlarina dokunulmaz; donem degisince key degisir, otomatik yenilenir.
  const { data: bundle, isLoading, isFetching, error } = useQuery({
    queryKey: ["dashboard", period],
    queryFn: async () => {
      const range = PERIODS[period].range();
      const [summary, storeRows, sessionRows] = await Promise.all([
        fetchDashboardSummary({ startDate: range[0].format("YYYY-MM-DD"), endDate: range[1].format("YYYY-MM-DD") }),
        listStoresFresh(),
        listPosSessionsFresh(),
      ]);
      return { summary, storeRows, sessionRows };
    },
  });

  React.useEffect(() => {
    if (error) message.error(error?.message || "Operasyon merkezi yuklenemedi.");
  }, [error]);

  const data = bundle?.summary || null;
  const stores = bundle?.storeRows || [];
  const sessions = bundle?.sessionRows || [];
  const loading = isLoading || isFetching;

  const stats = data?.stats || {};
  const dailySales = data?.dailySales || [];
  const topProducts = (data?.topProducts || []).slice(0, 5);
  const recentSales = data?.recentSales || [];
  const netCiro = Number(stats.totalSalesAmount || 0) - Number(stats.totalReturnAmount || 0);

  const openSessions = sessions.filter((s) => s.status === "Açık");
  const posDailyCiro = openSessions.reduce((sum, s) => sum + Number(s.totalSales || 0), 0);
  const lastSync = openSessions[0]?.updatedAt || openSessions[0]?.openedAt;

  const donutData = topProducts.map((p) => ({ name: p.name || p.code, value: Number(p.totalQty || 0) }));
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0) || 1;

  const quickActions = [
    { label: "Yeni Ürün Ekle", icon: <PlusCircleOutlined />, onClick: () => navigate("/products/new") },
    { label: "Stok Girişi", icon: <DownloadOutlined />, onClick: () => navigate("/stock/entry") },
    { label: "Fiyat Güncelle", icon: <EditOutlined />, onClick: () => navigate("/products/price-history") },
    { label: "Etiket Yazdır", icon: <PrinterOutlined />, onClick: () => navigate("/products/list") },
    { label: "Toplu İşlemler", icon: <AppstoreAddOutlined />, onClick: () => navigate("/products/price-history") },
  ];

  const periodLabel = PERIODS[period].label.toLowerCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Title level={3} style={{ margin: 0 }}>Operasyon Merkezi</Title>

      {/* Filtre cubugu */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Select
          value={period}
          onChange={(v) => setPeriod(v)}
          style={{ minWidth: 150 }}
          options={Object.entries(PERIODS).map(([value, p]) => ({ value, label: p.label }))}
        />
        <Select
          placeholder="Tüm Mağazalar"
          allowClear
          value={storeId}
          onChange={setStoreId}
          style={{ minWidth: 180 }}
          options={stores.map((s) => ({ value: s.id, label: s.name }))}
          suffixIcon={<ShopOutlined />}
        />
        <Tooltip title="Yakında">
          <Button icon={<ControlOutlined />} style={{ marginLeft: "auto" }}>Paneli Yapılandır</Button>
        </Tooltip>
      </div>

      {/* KPI kartlari */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 16 }}>
        <KpiCard title="Net Ciro" value={money(netCiro)} hint={`İade düşülmüş · ${periodLabel}`} icon={<RiseOutlined />} tint={{ bg: "#fde9e4", fg: ACCENT }} />
        <KpiCard title="Satış Adedi" value={Number(stats.totalSalesCount || 0)} hint={`${Number(stats.totalSalesQty || 0)} ürün satıldı`} icon={<ShoppingOutlined />} tint={{ bg: "#e3f5f0", fg: "#1f9d8a" }} />
        <KpiCard title="Düşük Stok" value={Number(stats.lowStockCount || 0)} hint="min. stok altında" icon={<ExclamationCircleOutlined />} tint={{ bg: "#fdf3e3", fg: "#e7a93b" }} />
        <KpiCard title="Aktif Ürün" value={Number(stats.activeProductCount || 0)} hint="katalogda aktif" icon={<AppstoreOutlined />} tint={{ bg: "#e7f6ee", fg: "#1f9d66" }} />
      </div>

      {/* Grafik + donut + hizli islemler */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1.2fr 0.9fr", gap: 16 }}>
        <Card bordered={false} title="Günlük Ciro Grafiği" styles={{ body: { padding: 12 } }}>
          <div style={{ height: 230 }}>
            {dailySales.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#98a2b3" }}>Veri yok</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailySales} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ocFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tickFormatter={(v) => String(v).slice(5)} tick={{ fontSize: 11, fill: "#98a2b3" }} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}K`} tick={{ fontSize: 11, fill: "#98a2b3" }} width={40} />
                  <RTooltip formatter={(v) => money(v)} labelFormatter={(l) => l} />
                  <Area type="monotone" dataKey="amount" stroke={ACCENT} strokeWidth={2.5} fill="url(#ocFill)" name="Ciro" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card bordered={false} title="En Çok Satan Ürünler" styles={{ body: { padding: 12 } }}>
          {donutData.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#98a2b3" }}>Veri yok</div> : (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 150, height: 170, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
                      {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                    </Pie>
                    <RTooltip formatter={(v) => `${v} adet`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {donutData.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
                    <Text strong>%{Math.round((d.value / donutTotal) * 100)}</Text>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card bordered={false} title="Hızlı İşlemler" styles={{ body: { padding: 10 } }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {quickActions.map((a) => (
              <button key={a.label} type="button" className="erp-quick-action" onClick={a.onClick}>
                <span style={{ color: ACCENT, display: "flex" }}>{a.icon}</span>
                <span style={{ flex: 1, textAlign: "left" }}>{a.label}</span>
                <RightOutlined style={{ fontSize: 12, color: "#c2c8d0" }} />
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Son islemler + POS durumu */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.7fr 0.9fr", gap: 16 }}>
        <Card bordered={false} title="Son İşlemler" styles={{ body: { padding: 0 } }}>
          <Table
            size="middle"
            rowKey={(r) => r.id || r.receiptNo}
            loading={loading}
            pagination={false}
            scroll={{ x: "max-content" }}
            dataSource={recentSales.slice(0, 6)}
            locale={{ emptyText: "Bu dönemde işlem yok." }}
            onRow={() => ({ onClick: () => navigate("/pos/orders"), style: { cursor: "pointer" } })}
            columns={[
              { title: "Tarih", dataIndex: "soldAt", key: "soldAt", width: 150, render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v ? dayjs(v).format("DD.MM.YYYY HH:mm") : "-"}</Text> },
              { title: "İşlem", key: "islem", width: 110, render: () => <Space size={6}><ShoppingOutlined style={{ color: ACCENT }} />Satış</Space> },
              { title: "Detay", dataIndex: "receiptNo", key: "receiptNo", render: (v, r) => <span>{v}{r.customerName ? <Text type="secondary"> · {r.customerName}</Text> : null}</span> },
              { title: "Tutar", dataIndex: "grandTotal", key: "grandTotal", align: "right", width: 120, render: (v) => <Text strong>{money(v)}</Text> },
              { title: "Durum", key: "durum", width: 120, render: () => <Tag color="success">Tamamlandı</Tag> },
            ]}
          />
        </Card>

        <Card bordered={false} title="POS Durumu" styles={{ body: { padding: 18 } }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Text type="secondary">Aktif Terminaller</Text>
              <Text strong>{openSessions.length} / {sessions.length || openSessions.length}</Text>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Text type="secondary">Günlük Ciro</Text>
              <Text strong>{money(posDailyCiro)}</Text>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Text type="secondary">Son Senkronizasyon</Text>
              <div style={{ textAlign: "right" }}>
                <Text strong style={{ display: "block" }}>{lastSync ? dayjs(lastSync).format("HH:mm") : "-"}</Text>
                <Text style={{ fontSize: 12, color: openSessions.length ? "#1f9d66" : "#98a2b3" }}>● {openSessions.length ? "Aktif" : "Kapalı"}</Text>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
