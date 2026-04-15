import React from "react";
import dayjs from "dayjs";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Alert, AutoComplete, Avatar, Button, Card, Col, DatePicker, Descriptions, Drawer, Dropdown, Empty, Form, Input, InputNumber, Modal, Popconfirm, Radio, Row, Segmented, Select, Space, Statistic, Switch, Table, Tabs, Tag, Tooltip, Typography, message } from "antd";
import { AppstoreOutlined, BarsOutlined, BarcodeOutlined, CheckOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined, FilterOutlined, InboxOutlined, LeftOutlined, MenuOutlined, PlusCircleOutlined, PlusOutlined, ReloadOutlined, RightOutlined, SearchOutlined, UserOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import { getAuthUser } from "../auth";
import { createContract, deleteContract, listContracts, listContractsFresh, updateContract } from "./contractsData";
import { fetchDashboardSummary } from "./dashboardApi";
import { completeDeliveryReceipt, createDeliveryList, createDeliveryPdf, getDeliveryListById, getNextDeliveryNoPreview, getNextDeliveryNoPreviewFresh, listDeliveryLists, listDeliveryListsBySupplier, listDeliveryListsBySupplierFresh, listDeliveryListsFresh, updateDeliveryList } from "./deliveryListsData";
import { createMasterData, listMasterData, listMasterDataFresh, masterDataDefinitions, updateMasterData } from "./masterData";
import { buildPosProductCatalog, buildPosProductCatalogFresh, closePosSession, createPosSale, createPosSession, findProductByBarcode, getOpenPosSessions, getOpenPosSessionsFresh, listPosSales, listPosSalesFresh, listPosSessions, listPosSessionsFresh } from "./posData";
import { createProduct, deleteProduct, importProducts, listProducts, listProductsBySupplier, listProductsFresh, updateProduct } from "./productsData";
import { createPurchase, getPurchaseById, listPurchases, listPurchasesFresh, updatePurchase } from "./purchasesData";
import { createStockEntry, getStockEntryById, listStockEntries, listStockEntriesFresh, updateStockEntry } from "./stockEntriesData";
import { createSupplier, deleteSupplier, getSupplierById, listSuppliers, listSuppliersFresh, updateSupplier } from "./suppliersData";
import { getSmtpSettings, getSmtpSettingsFresh, updateSmtpSettings } from "./smtpSettings";
import { getSystemParameters, getSystemParametersFresh, updateSystemParameters } from "./systemParameters";

const { Title, Text } = Typography;

function downloadWorkbook(rows, sheetName, fileName) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

function normalizeFilters(filters) {
  return filters.map((filter) =>
    typeof filter === "string"
      ? {
          key: filter,
          label: filter,
          type: filter.toLowerCase().includes("arama") ? "search" : "select",
          placeholder: `${filter} seciniz veya yaziniz`,
          options:
            filter.toLowerCase().includes("kategori")
              ? ["Tum Kategoriler", "Kolye", "Kupe", "Bileklik", "Yuzuk"]
              : filter.toLowerCase().includes("koleksiyon")
                ? ["Tum Koleksiyonlar", "Atelier Core", "Yaz 2026", "Nazar Serisi"]
                : filter.toLowerCase().includes("stok tipi")
                  ? ["Tum Tipler", "Konsinye", "Direkt", "Uretim"]
                  : filter.toLowerCase().includes("tedarik tipi")
                    ? ["Tum Tipler", "Konsinye", "Direkt Alim"]
                    : filter.toLowerCase().includes("odeme")
                      ? ["Tum Kosullar", "Pesin", "15 Gun Vade", "30 Gun Vade"]
                      : ["Tum Secenekler"],
        }
      : filter,
  );
}

function FilterToolbar({ filters }) {
  const normalizedFilters = normalizeFilters(filters);

  return (
    <Card bordered={false} className="erp-filter-card">
      <div className="erp-filter-header">
        <div>
          <Space size={8}>
            <FilterOutlined style={{ color: "#d86d5b" }} />
            <Text strong>Sorgulama ve Filtreler</Text>
          </Space>
          <div className="erp-filter-subtitle">Listeyi hizli daraltin, kaydedin ve tekrar kullanin.</div>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />}>Temizle</Button>
          <Button type="primary" ghost>Filtreyi Kaydet</Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} style={{ marginTop: 4 }}>
        {normalizedFilters.map((filter) => (
          <Col xs={24} md={12} xl={filter.wide ? 12 : 6} key={filter.key || filter.label}>
            <Form.Item label={filter.label} style={{ marginBottom: 0 }}>
              {filter.type === "search" ? (
                <Input
                  prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
                  placeholder={filter.placeholder || `${filter.label} ara`}
                  allowClear
                  size="large"
                />
              ) : null}
              {filter.type === "date" ? (
                <DatePicker
                  style={{ width: "100%" }}
                  placeholder={filter.placeholder || `${filter.label} seciniz`}
                  size="large"
                />
              ) : null}
              {(!filter.type || filter.type === "select") ? (
                <Select
                  size="large"
                  placeholder={filter.placeholder || `${filter.label} seciniz`}
                  options={(filter.options || []).map((option) => ({ value: option, label: option }))}
                />
              ) : null}
            </Form.Item>
          </Col>
        ))}
      </Row>
    </Card>
  );
}

function openDetailFromRow(setSelected, setOpen, record) {
  setSelected(record);
  setOpen(true);
}

function preventRowClick(event) {
  event.stopPropagation();
}

function buildRowDetailItems(columns, record) {
  return columns.map((column, index) => ({
    key: `${column}-${index}`,
    label: column,
    children: record?.[`col${index}`],
  }));
}

function formatDashboardMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDisplayDate(value) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
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

  const openMetricDetail = (metricKey) => {
    setSelectedMetric(metricKey);
    setMetricDrawerOpen(true);
  };

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
                if (value?.[0] && value?.[1]) {
                  setDateRange(value);
                }
              }}
            />
          </Col>
          <Col xs={24} md={12} xl={14}>
            <Space wrap style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setDateRange(defaultDateRange);
                  void refreshDashboard(defaultDateRange);
                }}
              >
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
        <Alert
          type="error"
          showIcon
          message="Dashboard yuklenemedi"
          description={dashboardError}
        />
      ) : null}

      {alerts.length > 0 ? (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {alerts.map((item) => (
            <Alert
              key={item.key}
              type={item.severity === "warning" ? "warning" : "info"}
              showIcon
              message={item.title}
              description={item.description}
            />
          ))}
        </Space>
      ) : null}

      <Row gutter={[16, 16]}>
        {stats.map((item) => (
          <Col xs={24} md={12} xl={8} xxl={4} key={item.title}>
            <Card bordered={false} className="erp-clickable-row" onClick={() => openMetricDetail(item.key)}>
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
          onRow={(record) => ({
            onClick: () => openDetailFromRow(setSelectedMovement, setDetailOpen, record),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
      </Card>

      <Drawer
        title="Hareket Detayi"
        placement="right"
        width={420}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      >
        {selectedMovement ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Modul">{selectedMovement.module}</Descriptions.Item>
            <Descriptions.Item label="Belge">{selectedMovement.documentNo}</Descriptions.Item>
            <Descriptions.Item label="Aciklama">{selectedMovement.description}</Descriptions.Item>
            <Descriptions.Item label="Durum">{selectedMovement.status}</Descriptions.Item>
            <Descriptions.Item label="Tutar">{selectedMovement.amount || "-"}</Descriptions.Item>
            <Descriptions.Item label="Tarih">
              {selectedMovement.date ? new Date(selectedMovement.date).toLocaleString("tr-TR") : "-"}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>

      <Drawer
        title={(dashboardSummary.metricDetails?.[selectedMetric]?.title) || "Kart Detayi"}
        placement="right"
        width={460}
        open={metricDrawerOpen}
        onClose={() => setMetricDrawerOpen(false)}
      >
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

export function TableListPage({ title, description, columns, rows, filters = [], actionLabel = "Yeni" }) {
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState(null);

  const mappedColumns = columns.map((column, index) => ({
    title: column,
    dataIndex: `col${index}`,
    key: `col${index}`,
    sorter: (a, b) => String(a[`col${index}`] ?? "").localeCompare(String(b[`col${index}`] ?? ""), "tr"),
    render:
      index === 0
        ? (value) => <span className="erp-link-cell">{value}</span>
        : undefined,
  }));
  mappedColumns.push({
    title: "Islemler",
    key: "actions",
    render: () => (
      <Space size={8}>
        <Button type="text" className="erp-icon-btn erp-icon-btn-edit" icon={<EditOutlined />} onClick={preventRowClick} />
        <Button type="text" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} onClick={preventRowClick} />
      </Space>
    ),
  });
  const dataSource = rows.map((row, index) => {
    const item = { key: `${title}-${index}` };
    row.forEach((cell, cellIndex) => {
      item[`col${cellIndex}`] = cell;
    });
    return item;
  });

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>{title}</Title>
          <Text type="secondary">{description}</Text>
        </div>
      </div>

      {filters.length > 0 ? (
        <Card bordered={false} className="erp-list-toolbar-card">
          <div className="erp-list-toolbar">
            <Space wrap>
              <Button type="primary" icon={<PlusOutlined />}>{actionLabel}</Button>
              <Button icon={<SearchOutlined />}>Ara</Button>
              <Button icon={<DeleteOutlined />}>Temizle</Button>
              <Button icon={<ReloadOutlined />}>Yenile</Button>
              <Button icon={<DownloadOutlined />}>Excel'e Aktar</Button>
            </Space>

            <div className="erp-list-toolbar-filters">
              {normalizeFilters(filters).slice(0, 4).map((filter) => (
                <Form.Item key={filter.key || filter.label} label={filter.label} style={{ marginBottom: 0 }}>
                  {filter.type === "search" ? (
                    <Input
                      prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
                      placeholder={filter.placeholder || `${filter.label} ara`}
                      allowClear
                    />
                  ) : filter.type === "date" ? (
                    <DatePicker style={{ width: "100%" }} placeholder={filter.placeholder || `${filter.label} seciniz`} />
                  ) : (
                    <Select
                      placeholder={filter.placeholder || "Tumu"}
                      options={(filter.options || []).map((option) => ({ value: option, label: option }))}
                    />
                  )}
                </Form.Item>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      <Card title={title} className="erp-list-table-card">
        <Table
          columns={mappedColumns}
          dataSource={dataSource}
          pagination={false}
          onRow={(record) => ({
            onClick: () => {
              openDetailFromRow(setSelectedRow, setDetailOpen, record);
            },
          })}
          rowClassName={() => "erp-clickable-row"}
        />
        <div className="erp-table-footer">
          <Space>
            <span>Sayfa Boyutu:</span>
            <Select
              defaultValue="100"
              size="small"
              style={{ width: 84 }}
              options={["25", "50", "100"].map((value) => ({ value, label: value }))}
            />
          </Space>
          <Space size={18}>
            <span>1 - {rows.length} / {rows.length}</span>
            <span>Sayfa 1 / 1</span>
          </Space>
        </div>
      </Card>

      <Drawer
        title={`${title} Detayi`}
        placement="right"
        width={420}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      >
        {selectedRow ? (
          <Descriptions column={1} size="small" bordered>
            {buildRowDetailItems(columns, selectedRow).map((item) => (
              <Descriptions.Item key={item.key} label={item.label}>
                {item.children}
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : null}
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
        if (cancelled) {
          return;
        }

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
        if (!cancelled) {
          setSupplier(null);
          setProducts([]);
          setDeliveries([]);
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [authUser?.email, authUser?.fullName, authUser?.supplierId]);

  const totalStockQty = React.useMemo(
    () => products.reduce((sum, product) => sum + Number(product.stock || 0), 0),
    [products],
  );
  const totalStockValue = React.useMemo(
    () => products.reduce((sum, product) => sum + (Number(product.stock || 0) * Number(product.cost || 0)), 0),
    [products],
  );
  const totalProductVariety = React.useMemo(
    () => new Set(products.map((product) => String(product.code || "").trim()).filter(Boolean)).size,
    [products],
  );
  const outOfStockCount = React.useMemo(
    () => products.filter((product) => Number(product.stock || 0) === 0).length,
    [products],
  );
  const waitingDeliveries = React.useMemo(
    () => deliveries.filter((delivery) => delivery.status === "Onay Bekleniyor").length,
    [deliveries],
  );
  const totalDeliveries = deliveries.length;
  const supplierVisual = supplier?.logo || supplier?.image || supplier?.photo || supplier?.avatar || "";

  const metrics = [
    {
      title: "Toplam Ürün Çeşidi",
      value: totalProductVariety,
      description: "Tanımlanmış Toplam Ürün Sayısıdır",
      accentClass: "erp-metric-accent-coral",
      onClick: () => navigate("/supplier/products"),
    },
    {
      title: "Toplam Stok Adet",
      value: totalStockQty,
      description: "Stokta olan toplam ürün sayısı",
      accentClass: "erp-metric-accent-amber",
      onClick: () => navigate("/supplier/products", { state: { dashboardFilter: "in-stock" } }),
    },
    {
      title: "Toplam Stok Değeri",
      value: formatDashboardMoney(totalStockValue),
      description: "Stokta olan ürünlerin toplam değeri",
      accentClass: "erp-metric-accent-green",
      onClick: () => navigate("/supplier/products", { state: { dashboardFilter: "in-stock" } }),
    },
    {
      title: "Stok Biten Ürünler",
      value: outOfStockCount,
      description: "Stok sayısı 0 olan ürün sayısı",
      accentClass: "erp-metric-accent-red",
      onClick: () => navigate("/supplier/products", { state: { dashboardFilter: "out-of-stock" } }),
    },
    {
      title: "Onay Bekleyen Teslimat",
      value: waitingDeliveries,
      description: "Onay bekleyen teslimat kayıtları",
      accentClass: "erp-metric-accent-gold",
      onClick: () => navigate("/supplier/deliveries", { state: { dashboardFilter: "pending-approval" } }),
    },
    {
      title: "Toplam Teslimatlar",
      value: totalDeliveries,
      description: "Tüm teslimat kayıtları",
      accentClass: "erp-metric-accent-blue",
      onClick: () => navigate("/supplier/deliveries"),
    },
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
            <Card
              bordered={false}
              className={`erp-metric-card ${metric.accentClass || ""}`}
              loading={pageLoading}
              hoverable
              onClick={metric.onClick}
            >
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
                  <Avatar size={96} className="erp-supplier-info-avatar">
                    {supplier?.initials || (supplier?.company || "TP").split(" ").map((part) => part[0] || "").slice(0, 2).join("").toUpperCase()}
                  </Avatar>
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
                {
                  title: "Sevk Tarihi",
                  dataIndex: "date",
                  key: "date",
                  render: (value) => formatDisplayDate(value),
                },
                {
                  title: "Teslim Alinan Tarih",
                  dataIndex: "inventoryPostedAt",
                  key: "inventoryPostedAt",
                  render: (value) => formatDisplayDate(value),
                },
                { title: "Kalem", dataIndex: "lineCount", key: "lineCount", width: 90 },
                {
                  title: "Durum",
                  dataIndex: "status",
                  key: "status",
                  render: (value) => <Tag color={deliveryStatusColorMap[value] || "default"}>{value || "Taslak"}</Tag>,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

