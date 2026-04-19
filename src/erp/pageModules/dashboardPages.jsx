import React from "react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Col, DatePicker, Descriptions, Drawer, Empty, Row, Space, Statistic, Table, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { getAuthUser } from "../../auth";
import { fetchDashboardSummary } from "../dashboardApi";
import { listDeliveryListsBySupplierFresh, listDeliveryListsFresh } from "../deliveryListsData";
import { listProductsFresh } from "../productsData";
import { listSuppliersFresh } from "../suppliersData";

const { Title, Text } = Typography;

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

const deliveryStatusColorMap = {
  "Onay Bekleniyor": "gold",
  Onaylandi: "green",
  Tamamlandi: "blue",
  "Revizyon Istendi": "red",
};

export function DashboardPage() {
  const defaultDateRange = React.useMemo(() => {
    const end = dayjs();
    return [end.subtract(29, "day"), end];
  }, []);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedMovement, setSelectedMovement] = React.useState(null);
  const [metricDrawerOpen, setMetricDrawerOpen] = React.useState(false);
  const [selectedMetric, setSelectedMetric] = React.useState(null);
  const [dateRange, setDateRange] = React.useState(defaultDateRange);
  const [dashboardLoading, setDashboardLoading] = React.useState(false);
  const [dashboardError, setDashboardError] = React.useState("");
  const [dashboardSummary, setDashboardSummary] = React.useState({
    stats: [],
    movements: [],
    alerts: [],
    metricDetails: {},
    filters: null,
  });

  const refreshDashboard = React.useCallback(async (rangeOverride) => {
    const activeRange = rangeOverride || dateRange || defaultDateRange;
    try {
      setDashboardLoading(true);
      setDashboardError("");
      const payload = await fetchDashboardSummary({
        startDate: activeRange?.[0]?.format("YYYY-MM-DD"),
        endDate: activeRange?.[1]?.format("YYYY-MM-DD"),
      });
      setDashboardSummary(payload);
    } catch (error) {
      setDashboardError(error?.message || "Dashboard verileri alinamadi.");
    } finally {
      setDashboardLoading(false);
    }
  }, [dateRange, defaultDateRange]);

  React.useEffect(() => {
    void refreshDashboard(defaultDateRange);
  }, [refreshDashboard, defaultDateRange]);

  const stats = dashboardSummary.stats || [];
  const movements = dashboardSummary.movements || [];
  const alerts = dashboardSummary.alerts || [];

  const columns = [
    { title: "Modul", dataIndex: "module", key: "module", sorter: (a, b) => a.module.localeCompare(b.module, "tr") },
    { title: "Belge", dataIndex: "documentNo", key: "documentNo", sorter: (a, b) => a.documentNo.localeCompare(b.documentNo, "tr") },
    { title: "Aciklama", dataIndex: "description", key: "description", sorter: (a, b) => a.description.localeCompare(b.description, "tr") },
    { title: "Durum", dataIndex: "status", key: "status", render: (value) => <Tag color="blue">{value}</Tag> },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 6 }}>Dashboard</Title>
        <Text type="secondary">Satis, stok, satin alma ve magaza akislarinin genel ozeti.</Text>
      </div>

      <Card bordered={false}>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} md={12} xl={10}>
            <Text type="secondary">Tarih Araligi</Text>
            <DatePicker.RangePicker
              value={dateRange}
              allowClear={false}
              style={{ width: "100%", marginTop: 8 }}
              format="DD.MM.YYYY"
              onChange={(value) => {
                if (value?.[0] && value?.[1]) setDateRange(value);
              }}
            />
          </Col>
          <Col xs={24} md={12} xl={14}>
            <Space wrap style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button icon={<ReloadOutlined />} onClick={() => { setDateRange(defaultDateRange); void refreshDashboard(defaultDateRange); }}>
                Son 30 Gun
              </Button>
              <Button type="primary" loading={dashboardLoading} onClick={() => { void refreshDashboard(); }}>
                Ozeti Getir
              </Button>
            </Space>
          </Col>
        </Row>
        {dashboardSummary.filters ? (
          <Text type="secondary" style={{ display: "block", marginTop: 12 }}>
            Rapor araligi: {dashboardSummary.filters.startDate} - {dashboardSummary.filters.endDate}
          </Text>
        ) : null}
      </Card>

      {dashboardError ? (
        <Alert type="error" showIcon message="Dashboard yuklenemedi" description={dashboardError} />
      ) : null}

      {alerts.length > 0 ? (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {alerts.map((item) => (
            <Alert key={item.key} type={item.severity === "warning" ? "warning" : "info"} showIcon message={item.title} description={item.description} />
          ))}
        </Space>
      ) : null}

      <Row gutter={[16, 16]}>
        {stats.map((item) => (
          <Col xs={24} md={12} xl={8} xxl={4} key={item.title}>
            <Card bordered={false} className="erp-clickable-row" onClick={() => { setSelectedMetric(item.key); setMetricDrawerOpen(true); }}>
              <Statistic title={item.title} value={item.value} valueStyle={{ color: item.color, fontWeight: 700 }} />
              <Text type="secondary">Detayi gor</Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="Son Hareketler" extra={<Button type="primary" loading={dashboardLoading} onClick={() => { void refreshDashboard(); }}>Yenile</Button>}>
        <Table
          rowKey="key"
          pagination={false}
          columns={columns}
          dataSource={movements}
          locale={{ emptyText: "Henuz hareket bulunmuyor." }}
          onRow={(record) => ({ onClick: () => { setSelectedMovement(record); setDetailOpen(true); } })}
          rowClassName={() => "erp-clickable-row"}
        />
      </Card>

      <Drawer title="Hareket Detayi" placement="right" width={420} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {selectedMovement ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Modul">{selectedMovement.module}</Descriptions.Item>
            <Descriptions.Item label="Belge">{selectedMovement.documentNo}</Descriptions.Item>
            <Descriptions.Item label="Aciklama">{selectedMovement.description}</Descriptions.Item>
            <Descriptions.Item label="Durum">{selectedMovement.status}</Descriptions.Item>
            <Descriptions.Item label="Tutar">{selectedMovement.amount || "-"}</Descriptions.Item>
            <Descriptions.Item label="Tarih">{selectedMovement.date ? new Date(selectedMovement.date).toLocaleString("tr-TR") : "-"}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>

      <Drawer title={(dashboardSummary.metricDetails?.[selectedMetric]?.title) || "Kart Detayi"} placement="right" width={460} open={metricDrawerOpen} onClose={() => setMetricDrawerOpen(false)}>
        {(dashboardSummary.metricDetails?.[selectedMetric]?.items || []).length > 0 ? (
          <Descriptions column={1} size="small" bordered>
            {(dashboardSummary.metricDetails?.[selectedMetric]?.items || []).map((item, index) => (
              <Descriptions.Item key={`${selectedMetric}-${index}`} label={item.label}>
                <Space direction="vertical" size={2}>
                  <Text strong>{item.value}</Text>
                  {item.hint ? <Text type="secondary">{item.hint}</Text> : null}
                </Space>
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : (
          <Empty description="Bu kart icin gosterilecek detay bulunmuyor." />
        )}
      </Drawer>
    </Space>
  );
}

export function SupplierDashboardPage() {
  const navigate = useNavigate();
  const authUser = getAuthUser();
  const [supplier, setSupplier] = React.useState(null);
  const [products, setProducts] = React.useState([]);
  const [deliveries, setDeliveries] = React.useState([]);
  const [pageLoading, setPageLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const loadDashboard = async () => {
      try {
        setPageLoading(true);
        const [suppliers, nextProducts, allDeliveries] = await Promise.all([
          listSuppliersFresh(),
          listProductsFresh(),
          authUser?.supplierId ? listDeliveryListsBySupplierFresh(authUser.supplierId) : listDeliveryListsFresh(),
        ]);
        if (cancelled) return;

        const normalizedAuthEmail = String(authUser?.email || "").trim().toLowerCase();
        const normalizedAuthName = String(authUser?.fullName || "").trim().toLowerCase();
        const resolvedSupplier =
          suppliers.find((item) => item.id === authUser?.supplierId) ||
          suppliers.find((item) => normalizedAuthEmail && String(item.email || "").trim().toLowerCase() === normalizedAuthEmail) ||
          suppliers.find((item) => normalizedAuthName && String(item.contact || "").trim().toLowerCase() === normalizedAuthName) ||
          null;
        const resolvedSupplierId = resolvedSupplier?.id || authUser?.supplierId || null;

        setSupplier(resolvedSupplier);
        setProducts(resolvedSupplierId ? nextProducts.filter((item) => item.supplierId === resolvedSupplierId) : []);
        setDeliveries(resolvedSupplierId ? allDeliveries.filter((item) => item.supplierId === resolvedSupplierId) : []);
      } catch {
        if (!cancelled) { setSupplier(null); setProducts([]); setDeliveries([]); }
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    };
    void loadDashboard();
    return () => { cancelled = true; };
  }, [authUser?.email, authUser?.fullName, authUser?.supplierId]);

  const totalStockQty = React.useMemo(() => products.reduce((sum, p) => sum + Number(p.stock || 0), 0), [products]);
  const totalStockValue = React.useMemo(() => products.reduce((sum, p) => sum + Number(p.stock || 0) * Number(p.salePrice || 0), 0), [products]);
  const totalProductVariety = React.useMemo(() => new Set(products.map((p) => String(p.code || "").trim()).filter(Boolean)).size, [products]);
  const outOfStockCount = React.useMemo(() => products.filter((p) => Number(p.stock || 0) === 0).length, [products]);
  const waitingDeliveries = React.useMemo(() => deliveries.filter((d) => d.status === "Onay Bekleniyor").length, [deliveries]);
  const totalDeliveries = deliveries.length;
  const supplierVisual = supplier?.logo || supplier?.image || supplier?.photo || supplier?.avatar || "";

  const metrics = [
    { title: "Toplam Ürün Çeşidi", value: totalProductVariety, description: "Tanımlanmış Toplam Ürün Sayısıdır", accentClass: "erp-metric-accent-coral", onClick: () => navigate("/supplier/products") },
    { title: "Toplam Stok Adet", value: totalStockQty, description: "Stokta olan toplam ürün sayısı", accentClass: "erp-metric-accent-amber", onClick: () => navigate("/supplier/products", { state: { dashboardFilter: "in-stock" } }) },
    { title: "Toplam Stok Değeri", value: formatDashboardMoney(totalStockValue), description: "Stokta olan ürünlerin toplam değeri", accentClass: "erp-metric-accent-green", onClick: () => navigate("/supplier/products", { state: { dashboardFilter: "in-stock" } }) },
    { title: "Stok Biten Ürünler", value: outOfStockCount, description: "Stok sayısı 0 olan ürün sayısı", accentClass: "erp-metric-accent-red", onClick: () => navigate("/supplier/products", { state: { dashboardFilter: "out-of-stock" } }) },
    { title: "Onay Bekleyen Teslimat", value: waitingDeliveries, description: "Onay bekleyen teslimat kayıtları", accentClass: "erp-metric-accent-gold", onClick: () => navigate("/supplier/deliveries", { state: { dashboardFilter: "pending-approval" } }) },
    { title: "Toplam Teslimatlar", value: totalDeliveries, description: "Tüm teslimat kayıtları", accentClass: "erp-metric-accent-blue", onClick: () => navigate("/supplier/deliveries") },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 6 }}>Dashboard</Title>
        <Text type="secondary">Tedarikci hesabinizdaki urun, stok ve teslimat ozetini buradan takip edebilirsiniz.</Text>
      </div>

      <Row gutter={[16, 16]}>
        {metrics.map((metric) => (
          <Col xs={24} sm={12} xl={8} xxl={4} key={metric.title}>
            <Card bordered={false} className={`erp-metric-card ${metric.accentClass || ""}`} loading={pageLoading} hoverable onClick={metric.onClick}>
              <Statistic title={<span className="erp-metric-title">{metric.title}</span>} value={metric.value} />
              <Text type="secondary" className="erp-metric-description">{metric.description}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <Card title="Firma Bilgileri" bordered={false} loading={pageLoading} className="erp-card-logo-divider">
            <div className="erp-supplier-info-card">
              <div className="erp-supplier-info-main">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Firma">{supplier?.company || "-"}</Descriptions.Item>
                  <Descriptions.Item label="Yetkili">{supplier?.contact || authUser?.fullName || "-"}</Descriptions.Item>
                  <Descriptions.Item label="E-posta">{supplier?.email || authUser?.email || "-"}</Descriptions.Item>
                  <Descriptions.Item label="Telefon">{supplier?.phone || "-"}</Descriptions.Item>
                  <Descriptions.Item label="Sehir">{supplier?.city || "-"}</Descriptions.Item>
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
          </Card>
        </Col>
        <Col xs={24} xl={14}>
          <Card title="Son Teslimatlar" bordered={false} loading={pageLoading} className="erp-card-logo-divider">
            <Table
              rowKey="id"
              pagination={false}
              size="small"
              dataSource={deliveries.slice(0, 5)}
              locale={{ emptyText: "Henuz teslimat kaydiniz bulunmuyor." }}
              columns={[
                { title: "Teslimat No", dataIndex: "deliveryNo", key: "deliveryNo" },
                { title: "Sevk Tarihi", dataIndex: "date", key: "date", render: (value) => formatDisplayDate(value) },
                { title: "Teslim Alinan Tarih", dataIndex: "inventoryPostedAt", key: "inventoryPostedAt", render: (value) => formatDisplayDate(value) },
                { title: "Kalem", dataIndex: "lineCount", key: "lineCount", width: 90 },
                { title: "Durum", dataIndex: "status", key: "status", render: (value) => <Tag color={deliveryStatusColorMap[value] || "default"}>{value || "Taslak"}</Tag> },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
