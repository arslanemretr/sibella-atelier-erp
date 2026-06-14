import React from "react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Grid,
  Input,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  BarChartOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getAuthUser } from "../../auth";
import { listContractsFresh } from "../contractsData";
import { fetchDashboardSummary } from "../dashboardApi";
import { listDeliveryListsBySupplierFresh, listDeliveryListsFresh } from "../deliveryListsData";
import { listEarningsRecordsFresh } from "../earningsData";
import { buildAdminEarningsList, formatMoney as formatEarningsMoney, EARNINGS_STATUS_META } from "../earningsReportUtils";
import { listPosSalesFresh, listPosReturnsFresh } from "../posData";
import { listProductsRawFresh } from "../productsData";
import { getSupplierByIdFresh, listSuppliersFresh } from "../suppliersData";

const { Title, Text } = Typography;

function formatMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatMoneyFull(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

function KpiCard({ title, value, description, icon, color, onClick, loading }) {
  return (
    <Card
      bordered={false}
      hoverable={Boolean(onClick)}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default", height: "100%" }}
      styles={{ body: { padding: "20px 24px" } }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>{title}</Text>
          <div style={{ fontSize: 26, fontWeight: 700, color: color || "#1677ff", marginTop: 4, lineHeight: 1.2 }}>
            {loading ? "—" : value}
          </div>
          {description ? (
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: "block" }}>{description}</Text>
          ) : null}
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 10, display: "flex",
          alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 12,
          background: color ? `${color}18` : "#1677ff18",
          color: color || "#1677ff", fontSize: 20,
        }}>
          {icon}
        </div>
      </div>
      {onClick ? (
        <div style={{ marginTop: 12, borderTop: "1px solid #f0f0f0", paddingTop: 10 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Detay görüntüle <ArrowRightOutlined style={{ fontSize: 10 }} />
          </Text>
        </div>
      ) : null}
    </Card>
  );
}

function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 8, padding: "10px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ color: "#1f9d66" }}>{formatMoneyFull(payload[0]?.value)}</div>
      {payload[1] ? <div style={{ color: "#1677ff", fontSize: 12 }}>{payload[1].value} işlem</div> : null}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const defaultDateRange = React.useMemo(() => {
    const end = dayjs();
    return [end.subtract(29, "day"), end];
  }, []);

  const [dateRange, setDateRange] = React.useState(defaultDateRange);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [data, setData] = React.useState(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerKey, setDrawerKey] = React.useState(null);

  const refresh = React.useCallback(async (rangeOverride) => {
    const range = rangeOverride || dateRange;
    try {
      setLoading(true);
      setError("");
      const payload = await fetchDashboardSummary({
        startDate: range?.[0]?.format("YYYY-MM-DD"),
        endDate: range?.[1]?.format("YYYY-MM-DD"),
      });
      setData(payload);
    } catch (err) {
      setError(err?.message || "Dashboard verileri alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  React.useEffect(() => {
    void refresh(defaultDateRange);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const stats = data?.stats || {};
  const dailySales = data?.dailySales || [];
  const topProducts = data?.topProducts || [];
  const recentSales = data?.recentSales || [];
  const lowStockProducts = data?.lowStockProducts || [];
  const recentPurchases = data?.recentPurchases || [];
  const alerts = data?.alerts || [];

  const maxTopQty = topProducts[0]?.totalQty || 1;

  function openDrawer(key) {
    setDrawerKey(key);
    setDrawerOpen(true);
  }

  const drawerContent = {
    "low-stock": {
      title: "Düşük Stok Ürünleri",
      render: () => (
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={lowStockProducts}
          locale={{ emptyText: "Düşük stok uyarısı yok." }}
          columns={[
            { title: "Kod", dataIndex: "code", key: "code", width: 100,
              sorter: (a, b) => String(a.code || "").localeCompare(String(b.code || ""), "tr") },
            { title: "Ürün Adı", dataIndex: "name", key: "name", width: 180,
              sorter: (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "tr") },
            { title: "Stok", dataIndex: "stock", key: "stock", width: 70, align: "right",
              sorter: (a, b) => Number(a.stock || 0) - Number(b.stock || 0),
              render: (v) => <span style={{ color: v <= 0 ? "#cf1322" : "#d46b08", fontWeight: 600 }}>{v}</span> },
            { title: "Min.", dataIndex: "minStock", key: "minStock", width: 60, align: "right",
              sorter: (a, b) => Number(a.minStock || 0) - Number(b.minStock || 0) },
          ]}
        />
      ),
    },
    "open-pos": {
      title: "Açık POS Oturumları",
      render: () => (
        <Descriptions column={1} size="small" bordered>
          {(data?.metricDetails?.["open-pos"]?.items || []).map((item, i) => (
            <Descriptions.Item key={i} label={item.label}>
              <Space vertical size={2}>
                <Text strong>{item.value}</Text>
                {item.hint ? <Text type="secondary">{item.hint}</Text> : null}
              </Space>
            </Descriptions.Item>
          ))}
        </Descriptions>
      ),
    },
    suppliers: {
      title: "Aktif Tedarikçiler",
      render: () => (
        <Descriptions column={1} size="small" bordered>
          {(data?.metricDetails?.suppliers?.items || []).map((item, i) => (
            <Descriptions.Item key={i} label={item.label}>
              <Space vertical size={2}>
                <Text strong>{item.value}</Text>
                {item.hint ? <Text type="secondary">{item.hint}</Text> : null}
              </Space>
            </Descriptions.Item>
          ))}
        </Descriptions>
      ),
    },
    "top-products": {
      title: "En Çok Satan Ürünler",
      render: () => (
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={topProducts}
          locale={{ emptyText: "Bu dönemde satış yok." }}
          columns={[
            { title: "Kod", dataIndex: "code", key: "code", width: 90,
              sorter: (a, b) => String(a.code || "").localeCompare(String(b.code || ""), "tr") },
            { title: "Ürün Adı", dataIndex: "name", key: "name", width: 180,
              sorter: (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "tr") },
            { title: "Adet", dataIndex: "totalQty", key: "totalQty", width: 70, align: "right",
              sorter: (a, b) => Number(a.totalQty || 0) - Number(b.totalQty || 0),
              render: (v) => <b>{v}</b> },
            { title: "Tutar", dataIndex: "totalAmount", key: "totalAmount", width: 110, align: "right",
              sorter: (a, b) => Number(a.totalAmount || 0) - Number(b.totalAmount || 0),
              render: (v) => formatMoney(v) },
          ]}
        />
      ),
    },
    "recent-purchases": {
      title: "Dönem Satın Almalar",
      render: () => (
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={recentPurchases}
          locale={{ emptyText: "Bu dönemde satın alma yok." }}
          columns={[
            { title: "Belge No", dataIndex: "documentNo", key: "documentNo", width: 140,
              sorter: (a, b) => String(a.documentNo || "").localeCompare(String(b.documentNo || ""), "tr") },
            { title: "Tedarikçi", dataIndex: "supplierName", key: "supplierName", width: 160,
              sorter: (a, b) => String(a.supplierName || "").localeCompare(String(b.supplierName || ""), "tr") },
            { title: "Kalem", dataIndex: "lineCount", key: "lineCount", width: 60, align: "right",
              sorter: (a, b) => Number(a.lineCount || 0) - Number(b.lineCount || 0) },
            { title: "Tutar", dataIndex: "totalAmount", key: "totalAmount", width: 110, align: "right",
              sorter: (a, b) => Number(a.totalAmount || 0) - Number(b.totalAmount || 0),
              render: (v) => formatMoney(v) },
          ]}
        />
      ),
    },
  };

  return (
    <Space vertical size={20} style={{ width: "100%" }}>

      {/* Başlık + Filtre */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={3} style={{ marginBottom: 2 }}>Dashboard</Title>
        </div>
        {isMobile ? (
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <Input
              type="date"
              value={dateRange?.[0]?.format("YYYY-MM-DD") || ""}
              onChange={(e) => { if (e.target.value) setDateRange([dayjs(e.target.value), dateRange?.[1] || dayjs()]); }}
              style={{ flex: 1, minWidth: 0 }}
            />
            <Input
              type="date"
              value={dateRange?.[1]?.format("YYYY-MM-DD") || ""}
              onChange={(e) => { if (e.target.value) setDateRange([dateRange?.[0] || dayjs().subtract(29, "day"), dayjs(e.target.value)]); }}
              style={{ flex: 1, minWidth: 0 }}
            />
            <Button type="primary" loading={loading} icon={<ReloadOutlined />} onClick={() => void refresh()} style={{ flexShrink: 0 }} />
          </div>
        ) : (
          <Space wrap>
            <DatePicker.RangePicker
              value={dateRange}
              allowClear={false}
              format="DD.MM.YYYY"
              onChange={(v) => { if (v?.[0] && v?.[1]) setDateRange(v); }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => { setDateRange(defaultDateRange); void refresh(defaultDateRange); }}>
              Son 30 Gün
            </Button>
            <Button type="primary" loading={loading} onClick={() => void refresh()}>
              Getir
            </Button>
          </Space>
        )}
      </div>

      {/* Hızlı Erişim */}
      <Card bordered={false} styles={{ body: { padding: isMobile ? 10 : "12px 20px" } }}>
        {isMobile ? (
          <Row gutter={[8, 8]}>
            {[
              { icon: <ThunderboltOutlined />, label: "POS", to: "/pos/store" },
              { icon: <PlusOutlined />, label: "Ürün", to: "/products/new" },
              { icon: <AppstoreOutlined />, label: "Stok", to: "/stock/entry/new" },
              { icon: <ShoppingCartOutlined />, label: "Alım", to: "/purchasing/entry" },
              { icon: <BarChartOutlined />, label: "Satış", to: "/pos/orders" },
            ].map((q) => (
              <Col span={8} key={q.to}>
                <Button block icon={q.icon} onClick={() => navigate(q.to)} style={{ height: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, fontSize: 12, padding: 4 }}>
                  {q.label}
                </Button>
              </Col>
            ))}
          </Row>
        ) : (
          <Space wrap>
            <Text type="secondary" style={{ fontSize: 13 }}>Hızlı Erişim:</Text>
            <Button icon={<ThunderboltOutlined />} onClick={() => navigate("/pos/store")}>POS Ekranı</Button>
            <Button icon={<PlusOutlined />} onClick={() => navigate("/products/new")}>Ürün Ekle</Button>
            <Button icon={<AppstoreOutlined />} onClick={() => navigate("/stock/entry/new")}>Stok Girişi</Button>
            <Button icon={<ShoppingCartOutlined />} onClick={() => navigate("/purchasing/entry")}>Satın Alma</Button>
            <Button icon={<BarChartOutlined />} onClick={() => navigate("/pos/orders")}>Satış Listesi</Button>
          </Space>
        )}
      </Card>

      {/* Hata */}
      {error ? <Alert type="error" showIcon message="Dashboard yüklenemedi" description={error} /> : null}

      {/* KPI Kartları — Satış */}
      <div>
        <Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
          DÖNEM SATIŞ
        </Text>
        <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
          <Col xs={12} sm={12} xl={6}>
            <KpiCard
              loading={loading}
              title="Dönem Ciro"
              value={formatMoney(stats.totalSalesAmount)}
              description={`${data?.filters?.startDate || ""} – ${data?.filters?.endDate || ""}`}
              icon={<DollarOutlined />}
              color="#1f9d66"
              onClick={() => navigate("/pos/orders")}
            />
          </Col>
          <Col xs={12} sm={12} xl={6}>
            <KpiCard
              loading={loading}
              title="Satış İşlemi"
              value={stats.totalSalesCount ?? "—"}
              description="Kesilen fiş sayısı"
              icon={<ShoppingOutlined />}
              color="#1677ff"
              onClick={() => navigate("/pos/orders")}
            />
          </Col>
          <Col xs={12} sm={12} xl={6}>
            <KpiCard
              loading={loading}
              title="Satılan Ürün Adedi"
              value={stats.totalSalesQty ?? "—"}
              description="Toplam satış adeti"
              icon={<AppstoreOutlined />}
              color="#7c3aed"
              onClick={() => navigate("/pos/orders")}
            />
          </Col>
          <Col xs={12} sm={12} xl={6}>
            <KpiCard
              loading={loading}
              title="İade Tutarı"
              value={formatMoney(stats.totalReturnAmount)}
              description={`${stats.totalReturnCount ?? 0} iade işlemi`}
              icon={<RollbackOutlined />}
              color="#cf1322"
              onClick={() => navigate("/pos/returns")}
            />
          </Col>
        </Row>
      </div>

      {/* KPI Kartları — Operasyon */}
      <div>
        <Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
          OPERASYON
        </Text>
        <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
          <Col xs={12} sm={12} xl={6}>
            <KpiCard
              loading={loading}
              title="Aktif Ürün"
              value={stats.activeProductCount ?? "—"}
              description="Katalogdaki aktif ürünler"
              icon={<AppstoreOutlined />}
              color="#0f766e"
              onClick={() => navigate("/products/list")}
            />
          </Col>
          <Col xs={12} sm={12} xl={6}>
            <KpiCard
              loading={loading}
              title="Aktif Tedarikçi"
              value={stats.supplierCount ?? "—"}
              description="Kayıtlı tedarikçi sayısı"
              icon={<TeamOutlined />}
              color="#1d4ed8"
              onClick={() => openDrawer("suppliers")}
            />
          </Col>
          <Col xs={12} sm={12} xl={6}>
            <KpiCard
              loading={loading}
              title="Düşük Stok"
              value={stats.lowStockCount ?? "—"}
              description="Min. stok altındaki ürünler"
              icon={<ExclamationCircleOutlined />}
              color={stats.lowStockCount > 0 ? "#d46b08" : "#0f766e"}
              onClick={stats.lowStockCount > 0 ? () => openDrawer("low-stock") : null}
            />
          </Col>
          <Col xs={12} sm={12} xl={6}>
            <KpiCard
              loading={loading}
              title="Satın Alma Kaydı"
              value={stats.purchaseCount ?? "—"}
              description="Dönem satın alma sayısı"
              icon={<ShoppingCartOutlined />}
              color="#c2410c"
              onClick={() => openDrawer("recent-purchases")}
            />
          </Col>
        </Row>
      </div>

      {/* Grafik + En Çok Satanlar */}
      <Row gutter={[16, 16]}>
        {/* Günlük Satış Grafiği */}
        <Col xs={24} xl={16}>
          <Card
            bordered={false}
            title={
              <Space>
                <BarChartOutlined />
                Günlük Satış Grafiği
              </Space>
            }
            styles={{ body: { paddingTop: 8 } }}
          >
            {dailySales.length === 0 ? (
              <Empty description="Bu dönemde satış verisi yok." style={{ padding: "32px 0" }} />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dailySales} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => {
                      if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                      return String(v);
                    }}
                  />
                  <RechartsTooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="amount" fill="#1f9d66" radius={[4, 4, 0, 0]} name="Ciro" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        {/* En Çok Satan Ürünler */}
        <Col xs={24} xl={8}>
          <Card
            bordered={false}
            title={
              <Space>
                <ShoppingOutlined />
                En Çok Satan Ürünler
              </Space>
            }
            extra={
              <Button type="link" size="small" onClick={() => openDrawer("top-products")}>
                Tümü
              </Button>
            }
            styles={{ body: { paddingTop: 8 } }}
          >
            {topProducts.length === 0 ? (
              <Empty description="Bu dönemde satış yok." style={{ padding: "24px 0" }} />
            ) : (
              <Space vertical style={{ width: "100%" }} size={12}>
                {topProducts.slice(0, 6).map((product, index) => (
                  <div key={product.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ fontSize: 13 }} ellipsis>
                        <span style={{ color: "#999", marginRight: 6, fontSize: 11 }}>#{index + 1}</span>
                        {product.name || product.code}
                      </Text>
                      <Text strong style={{ fontSize: 13, marginLeft: 8, flexShrink: 0 }}>
                        {product.totalQty} adet
                      </Text>
                    </div>
                    <div style={{ height: 6, background: "#f5f5f5", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round((product.totalQty / maxTopQty) * 100)}%`,
                          background: index === 0 ? "#1f9d66" : index === 1 ? "#1677ff" : index === 2 ? "#7c3aed" : "#64748b",
                          borderRadius: 3,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {/* Son Satışlar + Düşük Stok */}
      <Row gutter={[16, 16]}>
        {/* Son Satışlar */}
        <Col xs={24} xl={14}>
          <Card
            bordered={false}
            title={
              <Space>
                <ShoppingOutlined />
                Son Satışlar
              </Space>
            }
            extra={
              <Button type="link" size="small" icon={<ArrowRightOutlined />} onClick={() => navigate("/pos/orders")}>
                Tümünü Gör
              </Button>
            }
          >
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: "max-content" }}
              dataSource={recentSales}
              locale={{ emptyText: "Bu dönemde satış kaydı yok." }}
              onRow={(r) => ({ onClick: () => navigate("/pos/orders"), style: { cursor: "pointer" } })}
              columns={[
                { title: "Fiş No", dataIndex: "receiptNo", key: "receiptNo", width: 90,
                  sorter: (a, b) => String(a.receiptNo || "").localeCompare(String(b.receiptNo || ""), "tr") },
                { title: "Müşteri", dataIndex: "customerName", key: "customerName", width: 150, ellipsis: true,
                  sorter: (a, b) => String(a.customerName || "").localeCompare(String(b.customerName || ""), "tr") },
                { title: "Ödeme", dataIndex: "paymentMethod", key: "paymentMethod", width: 90,
                  sorter: (a, b) => String(a.paymentMethod || "").localeCompare(String(b.paymentMethod || ""), "tr"),
                  render: (v) => <Tag>{v}</Tag> },
                { title: "Tutar", dataIndex: "grandTotal", key: "grandTotal", width: 110, align: "right",
                  sorter: (a, b) => Number(a.grandTotal || 0) - Number(b.grandTotal || 0),
                  render: (v) => <Text strong style={{ color: "#1f9d66" }}>{formatMoney(v)}</Text> },
                { title: "Tarih", dataIndex: "soldAt", key: "soldAt", width: 120,
                  sorter: (a, b) => String(a.soldAt || "").localeCompare(String(b.soldAt || "")),
                  render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{formatDateTime(v)}</Text> },
              ]}
            />
          </Card>
        </Col>

        {/* Düşük Stok */}
        <Col xs={24} xl={10}>
          <Card
            bordered={false}
            title={
              <Space>
                <ExclamationCircleOutlined style={{ color: lowStockProducts.length > 0 ? "#d46b08" : undefined }} />
                Düşük Stok Uyarıları
                {lowStockProducts.length > 0 ? (
                  <Badge count={lowStockProducts.length} color="#d46b08" />
                ) : null}
              </Space>
            }
            extra={
              lowStockProducts.length > 0 ? (
                <Button type="link" size="small" icon={<ArrowRightOutlined />} onClick={() => navigate("/products/list")}>
                  Ürünlere Git
                </Button>
              ) : null
            }
          >
            {lowStockProducts.length === 0 ? (
              <Empty description="Düşük stok uyarısı yok." style={{ padding: "24px 0" }} />
            ) : (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ x: "max-content" }}
                dataSource={lowStockProducts.slice(0, 8)}
                locale={{ emptyText: "Düşük stok yok." }}
                onRow={(r) => ({ onClick: () => navigate(`/products/${r.id}`), style: { cursor: "pointer" } })}
                columns={[
                  { title: "Kod", dataIndex: "code", key: "code", width: 90,
                    sorter: (a, b) => String(a.code || "").localeCompare(String(b.code || ""), "tr"),
                    render: (v) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
                  { title: "Ürün", dataIndex: "name", key: "name", width: 160, ellipsis: true,
                    sorter: (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "tr") },
                  { title: "Stok / Min", key: "stockMin", width: 90, align: "right",
                    sorter: (a, b) => Number(a.stock || 0) - Number(b.stock || 0),
                    render: (_, r) => (
                      <span style={{ color: r.stock <= 0 ? "#cf1322" : "#d46b08", fontWeight: 600, fontSize: 13 }}>
                        {r.stock} / {r.minStock}
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Detay Drawer */}
      <Drawer
        title={drawerContent[drawerKey]?.title || "Detay"}
        placement="right"
        width={520}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {drawerKey && drawerContent[drawerKey] ? drawerContent[drawerKey].render() : <Empty />}
      </Drawer>
    </Space>
  );
}

/* ------------------------------------------------------------------ */
/*  Tedarikçi Dashboard (değiştirilmedi)                               */
/* ------------------------------------------------------------------ */

const deliveryStatusColorMap = {
  "Onay Bekleniyor": "gold",
  Onaylandi: "green",
  Tamamlandi: "blue",
  "Revizyon Istendi": "red",
};

function formatDashboardMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDisplayDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}

export function SupplierDashboardPage() {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const authUser = getAuthUser();
  const [supplier, setSupplier] = React.useState(null);
  const [products, setProducts] = React.useState([]);
  const [allProducts, setAllProducts] = React.useState([]);
  const [deliveries, setDeliveries] = React.useState([]);
  const [sales, setSales] = React.useState([]);
  const [returns, setReturns] = React.useState([]);
  const [contracts, setContracts] = React.useState([]);
  const [earningsRecords, setEarningsRecords] = React.useState([]);
  const [pageLoading, setPageLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const loadDashboard = async () => {
      try {
        setPageLoading(true);
        const [suppliers, nextProducts, allDeliveries, nextSales, nextReturns, nextContracts, nextEarningsRecords] = await Promise.all([
          listSuppliersFresh({ slim: true }),
          listProductsRawFresh(),
          authUser?.supplierId ? listDeliveryListsBySupplierFresh(authUser.supplierId) : listDeliveryListsFresh({ slim: true }),
          listPosSalesFresh(),
          listPosReturnsFresh(),
          listContractsFresh(),
          listEarningsRecordsFresh(),
        ]);
        if (cancelled) return;

        const normalizedAuthEmail = String(authUser?.email || "").trim().toLowerCase();
        const normalizedAuthName = String(authUser?.fullName || "").trim().toLowerCase();
        const slimSupplier =
          suppliers.find((item) => item.id === authUser?.supplierId) ||
          suppliers.find((item) => normalizedAuthEmail && String(item.email || "").trim().toLowerCase() === normalizedAuthEmail) ||
          suppliers.find((item) => normalizedAuthName && String(item.contact || "").trim().toLowerCase() === normalizedAuthName) ||
          null;
        const resolvedSupplierId = slimSupplier?.id || authUser?.supplierId || null;

        // Logo için tam veriyi çek (slim modda base64 logo kırpılır)
        const fullSupplier = resolvedSupplierId ? await getSupplierByIdFresh(resolvedSupplierId) : null;
        if (cancelled) return;

        setSupplier(fullSupplier || slimSupplier);
        setAllProducts(nextProducts);
        setProducts(resolvedSupplierId ? nextProducts.filter((item) => item.supplierId === resolvedSupplierId) : []);
        setDeliveries(resolvedSupplierId ? allDeliveries.filter((item) => item.supplierId === resolvedSupplierId) : []);
        setSales(nextSales || []);
        setReturns(nextReturns || []);
        setContracts(nextContracts || []);
        setEarningsRecords(nextEarningsRecords || []);
      } catch {
        if (!cancelled) { setSupplier(null); setProducts([]); setAllProducts([]); setDeliveries([]); }
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    };
    void loadDashboard();
    return () => { cancelled = true; };
  }, [authUser?.email, authUser?.fullName, authUser?.supplierId]);

  const totalStockQty = React.useMemo(() => products.reduce((sum, p) => sum + Number(p.stock || 0), 0), [products]);
  const totalProductVariety = React.useMemo(() => new Set(products.map((p) => String(p.code || "").trim()).filter(Boolean)).size, [products]);
  const outOfStockCount = React.useMemo(() => products.filter((p) => Number(p.stock || 0) === 0).length, [products]);
  const waitingDeliveries = React.useMemo(() => deliveries.filter((d) => d.status === "Onay Bekleniyor").length, [deliveries]);
  const supplierVisual = supplier?.logo || supplier?.image || supplier?.photo || supplier?.avatar || "";

  const earningsSummaries = React.useMemo(() => {
    if (!supplier?.id) return [];
    const rows = buildAdminEarningsList({
      suppliers: [supplier],
      products: allProducts,
      sales,
      returns,
      contracts,
      earningsRecords,
    });
    return rows.filter((r) => r.supplierId === supplier.id);
  }, [supplier, allProducts, sales, returns, contracts, earningsRecords]);

  const metrics = [
    { title: "Toplam Ürün Çeşidi", value: totalProductVariety, description: "Tanımlanmış Toplam Ürün Sayısıdır", accentClass: "erp-metric-accent-coral", onClick: () => navigate("/supplier/products") },
    { title: "Toplam Stok Adet", value: totalStockQty, description: "Stokta olan toplam ürün sayısı", accentClass: "erp-metric-accent-amber", onClick: () => navigate("/supplier/products", { state: { dashboardFilter: "in-stock" } }) },
    { title: "Stok Biten Ürünler", value: outOfStockCount, description: "Stok sayısı 0 olan ürün sayısı", accentClass: "erp-metric-accent-red", onClick: () => navigate("/supplier/products", { state: { dashboardFilter: "out-of-stock" } }) },
    { title: "Onay Bekleyen Teslimat", value: waitingDeliveries, description: "Onay bekleyen teslimat kayıtları", accentClass: "erp-metric-accent-gold", onClick: () => navigate("/supplier/deliveries", { state: { dashboardFilter: "pending-approval" } }) },
  ];

  return (
    <Space vertical size={20} style={{ width: "100%" }}>
      <Title level={3} style={{ margin: 0 }}>Dashboard</Title>
      {!isMobile ? (
        <Text type="secondary" style={{ marginTop: -12 }}>Tedarikçi hesabınızdaki ürün, stok ve teslimat özetini buradan takip edebilirsiniz.</Text>
      ) : null}

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} lg={10}>
          <Card
            bordered={false}
            loading={pageLoading}
            className="erp-card-logo-divider"
            style={{ height: "100%" }}
            styles={isMobile ? { body: { padding: 0, overflow: "hidden" } } : undefined}
          >
            {isMobile ? (
              <div>
                {/* Logo öne çıkan profil başlığı */}
                <div style={{ background: "linear-gradient(135deg, #f38b7a 0%, #d86d5b 100%)", padding: "24px 16px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 120, height: 120, borderRadius: "50%", background: "#fff", padding: 6, boxShadow: "0 4px 14px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {supplierVisual ? (
                      <img src={supplierVisual} alt={supplier?.company || "Tedarikci logosu"} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 700, color: "#d86d5b" }}>
                        {supplier?.initials || (supplier?.company || "TP").split(" ").map((part) => part[0] || "").slice(0, 2).join("").toUpperCase()}
                      </div>
                    )}
                  </div>
                  <Text strong style={{ fontSize: 18, textAlign: "center", color: "#fff" }}>{supplier?.company || "-"}</Text>
                </div>
                <div style={{ padding: 16 }}>
                  <Descriptions column={1} size="small" style={{ width: "100%" }}>
                    <Descriptions.Item label="Yetkili">{supplier?.contact || authUser?.fullName || "-"}</Descriptions.Item>
                    <Descriptions.Item label="E-posta">{supplier?.email || authUser?.email || "-"}</Descriptions.Item>
                    <Descriptions.Item label="Telefon">{supplier?.phone || "-"}</Descriptions.Item>
                    <Descriptions.Item label="Şehir">{supplier?.city || "-"}</Descriptions.Item>
                  </Descriptions>
                </div>
              </div>
            ) : (
            <div className="erp-supplier-info-card">
              <div className="erp-supplier-info-main">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Firma">{supplier?.company || "-"}</Descriptions.Item>
                  <Descriptions.Item label="Yetkili">{supplier?.contact || authUser?.fullName || "-"}</Descriptions.Item>
                  <Descriptions.Item label="E-posta">{supplier?.email || authUser?.email || "-"}</Descriptions.Item>
                  <Descriptions.Item label="Telefon">{supplier?.phone || "-"}</Descriptions.Item>
                  <Descriptions.Item label="Şehir">{supplier?.city || "-"}</Descriptions.Item>
                </Descriptions>
              </div>
              <div className="erp-supplier-info-visual">
                {supplierVisual ? (
                  <img src={supplierVisual} alt={supplier?.company || "Tedarikci logosu"} className="erp-supplier-info-image" />
                ) : (
                  <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, color: "#888" }}>
                    {supplier?.initials || (supplier?.company || "TP").split(" ").map((part) => part[0] || "").slice(0, 2).join("").toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Row gutter={[16, 16]}>
            {metrics.map((metric) => (
              <Col xs={12} key={metric.title}>
                <Card bordered={false} className={`erp-metric-card ${metric.accentClass || ""}`} loading={pageLoading} hoverable onClick={metric.onClick}>
                  <Statistic title={<span className="erp-metric-title">{metric.title}</span>} value={metric.value} />
                </Card>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="Son Teslimatlar" bordered={false} loading={pageLoading} className="erp-card-logo-divider" styles={isMobile ? { body: { padding: 12 } } : undefined}>
            {isMobile ? (
              deliveries.length === 0 ? (
                <Text type="secondary">Henüz teslimat kaydınız bulunmuyor.</Text>
              ) : (
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  {deliveries.slice(0, 5).map((d) => (
                    <div key={d.id} onClick={() => navigate(`/supplier/deliveries/${d.id}`)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 10, border: "1px solid #f0f0f0", cursor: "pointer" }}>
                      <div>
                        <Text strong style={{ display: "block", fontSize: 14 }}>{d.deliveryNo}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{formatDisplayDate(d.date)} · {d.lineCount} kalem</Text>
                      </div>
                      <Tag color={deliveryStatusColorMap[d.status] || "default"} style={{ marginInlineEnd: 0 }}>{d.status || "Taslak"}</Tag>
                    </div>
                  ))}
                </Space>
              )
            ) : (
            <Table
              rowKey="id"
              pagination={false}
              size="small"
              dataSource={deliveries.slice(0, 5)}
              locale={{ emptyText: "Henüz teslimat kaydınız bulunmuyor." }}
              columns={[
                { title: "Teslimat No", dataIndex: "deliveryNo", key: "deliveryNo", width: 140,
                  sorter: (a, b) => String(a.deliveryNo || "").localeCompare(String(b.deliveryNo || ""), "tr") },
                { title: "Sevk Tarihi", dataIndex: "date", key: "date", width: 120,
                  sorter: (a, b) => String(a.date || "").localeCompare(String(b.date || "")),
                  render: (v) => formatDisplayDate(v) },
                { title: "Kalem", dataIndex: "lineCount", key: "lineCount", width: 70,
                  sorter: (a, b) => Number(a.lineCount || 0) - Number(b.lineCount || 0) },
                { title: "Durum", dataIndex: "status", key: "status", width: 130,
                  sorter: (a, b) => String(a.status || "").localeCompare(String(b.status || ""), "tr"),
                  render: (v) => <Tag color={deliveryStatusColorMap[v] || "default"}>{v || "Taslak"}</Tag> },
              ]}
            />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Hakediş Özeti" bordered={false} loading={pageLoading} className="erp-card-logo-divider" styles={isMobile ? { body: { padding: 12 } } : undefined}>
            {isMobile ? (
              earningsSummaries.length === 0 ? (
                <Text type="secondary">Henüz hakedişe konu satış bulunmuyor.</Text>
              ) : (
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  {earningsSummaries.map((e) => (
                    <div key={e.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 10, border: "1px solid #f0f0f0" }}>
                      <div>
                        <Text strong style={{ display: "block", fontSize: 14 }}>{e.periodLabel}</Text>
                        <Text strong style={{ color: "#d86d5b", fontSize: 13 }}>{formatEarningsMoney(e.earningsTotal)}</Text>
                      </div>
                      <Tag color={EARNINGS_STATUS_META[e.status]?.color || "default"} style={{ marginInlineEnd: 0 }}>{e.status}</Tag>
                    </div>
                  ))}
                </Space>
              )
            ) : (
            <Table
              rowKey="key"
              pagination={false}
              size="small"
              dataSource={earningsSummaries}
              locale={{ emptyText: "Henüz hakedişe konu satış bulunmuyor." }}
              columns={[
                { title: "Dönem", dataIndex: "periodLabel", key: "periodLabel", width: 130,
                  sorter: (a, b) => String(a.periodKey || "").localeCompare(String(b.periodKey || "")) },
                { title: "Toplam Hakediş", dataIndex: "earningsTotal", key: "earningsTotal", width: 140, align: "right",
                  sorter: (a, b) => Number(a.earningsTotal || 0) - Number(b.earningsTotal || 0),
                  render: (v) => formatEarningsMoney(v) },
                { title: "Durum", dataIndex: "status", key: "status", width: 150,
                  sorter: (a, b) => String(a.status || "").localeCompare(String(b.status || ""), "tr"),
                  render: (v) => <Tag color={EARNINGS_STATUS_META[v]?.color || "default"}>{v}</Tag> },
              ]}
            />
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
