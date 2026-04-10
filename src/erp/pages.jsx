import React from "react";
import dayjs from "dayjs";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Alert, AutoComplete, Avatar, Button, Card, Col, DatePicker, Descriptions, Drawer, Dropdown, Empty, Form, Input, InputNumber, Modal, Popconfirm, Radio, Row, Segmented, Select, Space, Statistic, Switch, Table, Tabs, Tag, Tooltip, Typography, message } from "antd";
import { AppstoreOutlined, BarsOutlined, BarcodeOutlined, CheckOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined, FilterOutlined, InboxOutlined, LeftOutlined, MenuOutlined, PlusCircleOutlined, PlusOutlined, ReloadOutlined, RightOutlined, SearchOutlined, UserOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import { getAuthUser } from "../auth";
import { createContract, deleteContract, listContracts, updateContract } from "./contractsData";
import { fetchDashboardSummary } from "./dashboardApi";
import { completeDeliveryReceipt, createDeliveryList, createDeliveryPdf, getDeliveryListById, getNextDeliveryNoPreview, listDeliveryLists, listDeliveryListsBySupplier, updateDeliveryList } from "./deliveryListsData";
import { createMasterData, listMasterData, masterDataDefinitions, updateMasterData } from "./masterData";
import { buildPosProductCatalog, closePosSession, createPosSale, createPosSession, findProductByBarcode, getOpenPosSessions, listPosSales, listPosSessions } from "./posData";
import { createProduct, deleteProduct, generateProductCodeForSupplier, getProductById, importProducts, listProducts, listProductsBySupplier, updateProduct } from "./productsData";
import { createPurchase, getPurchaseById, listPurchases, updatePurchase } from "./purchasesData";
import { createStockEntry, getStockEntryById, listStockEntries, updateStockEntry } from "./stockEntriesData";
import { createSupplier, deleteSupplier, getSupplierById, listSuppliers, updateSupplier } from "./suppliersData";
import { getSmtpSettings, updateSmtpSettings } from "./smtpSettings";
import { getSystemParameters, updateSystemParameters } from "./systemParameters";

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

export function ProductListPage() {
  const navigate = useNavigate();
  const SAVED_FILTERS_KEY = "sibella.erp.productFilters.v1";
  const [viewMode, setViewMode] = React.useState("liste");
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState(null);
  const [products, setProducts] = React.useState(() => listProducts());
  const [filters, setFilters] = React.useState({
    search: "",
    categoryId: undefined,
    collectionId: undefined,
    status: undefined,
  });
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [savedFilterName, setSavedFilterName] = React.useState("");
  const [savedFilters, setSavedFilters] = React.useState(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      return JSON.parse(window.localStorage.getItem(SAVED_FILTERS_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [selectedImportFile, setSelectedImportFile] = React.useState(null);
  const [importing, setImporting] = React.useState(false);
  const [importTestResult, setImportTestResult] = React.useState(null);

  const categoryOptions = [{ value: "all", label: "Tumu" }, ...listMasterData("categories").map((item) => ({
    value: item.id,
    label: item.fullPath,
  }))];
  const collectionOptions = [{ value: "all", label: "Tumu" }, ...listMasterData("collections").map((item) => ({
    value: item.id,
    label: item.name,
  }))];
  const statusOptions = ["Tumu", "Aktif", "Pasif"].map((value) => ({ value, label: value }));

  const refreshProducts = React.useCallback(() => {
    setProducts(listProducts());
  }, []);

  React.useEffect(() => {
    refreshProducts();

    const handleFocus = () => {
      refreshProducts();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshProducts();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshProducts]);

  const persistSavedFilters = (nextSavedFilters) => {
    setSavedFilters(nextSavedFilters);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(nextSavedFilters));
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      categoryId: undefined,
      collectionId: undefined,
      status: undefined,
    });
  };

  const handleDelete = (productId) => {
    deleteProduct(productId);
    refreshProducts();
    message.success("Urun silindi.");
  };

  const handleExport = () => {
    const header = ["Urun Kodu", "Urun Adi", "Satis Fiyati", "Maliyet", "Kategori", "Koleksiyon", "Stok", "Durum"];
    const rows = filteredProducts.map((item) => [
      item.code,
      item.name,
      item.priceDisplay,
      item.costDisplay,
      item.categoryLabel,
      item.collectionLabel,
      item.stockDisplay,
      item.status,
    ]);
    downloadWorkbook([header, ...rows], "Urunler", "urun-listesi.xlsx");
    message.success("Excel dosyasi indirildi.");
  };

  const handleDownloadTemplate = () => {
    const header = ["code", "name", "salePrice", "saleCurrency", "cost", "costCurrency", "categoryId", "collectionId", "posCategoryId", "supplierId", "barcode", "supplierCode", "minStock", "supplierLeadTime", "productType", "status", "image", "salesTax", "notes"];
    const example = ["SBL-100", "Ornek Urun", "1250", "TRY", "450", "TRY", "cat-001", "col-001", "poscat-001", "sup-001", "868000001000", "TED-001", "2", "7", "kendi", "Aktif", "/products/baroque-necklace.svg", "%20", "Ornek not"];

    const categoryRows = [
      ["categoryId", "categoryName"],
      ...listMasterData("categories").map((item) => [item.id, item.fullPath || item.level1 || item.id]),
    ];

    const collectionRows = [
      ["collectionId", "collectionName"],
      ...listMasterData("collections").map((item) => [item.id, item.name || item.id]),
    ];

    const posCategoryRows = [
      ["posCategoryId", "posCategoryName"],
      ...listMasterData("pos-categories").map((item) => [item.id, item.name || item.id]),
    ];

    const suppliers = listSuppliers();
    const supplierRows = [
      ["supplierId", "supplierName", "supplierShortCode"],
      ...suppliers.map((item) => [item.id, item.company || item.id, item.shortCode || ""]),
    ];

    const supplierCodeRows = [
      ["supplierId", "supplierName", "supplierCodeExample", "description"],
      ...suppliers.map((item) => [
        item.id,
        item.company || item.id,
        item.shortCode || `${String(item.id || "SUP").toUpperCase()}-001`,
        "Tedarikci urun kodu / firma ic kodu",
      ]),
    ];

    const productTypeRows = [
      ["productType", "productTypeName"],
      ["kendi", "Kendi Uretim"],
      ["tedarik", "Tedarik Edilen"],
      ["konsinye", "Konsinye"],
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([header, example]), "UrunSablon");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(categoryRows), "categoryId");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(collectionRows), "collectionId");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(posCategoryRows), "posCategoryId");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(supplierRows), "supplierId");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(supplierCodeRows), "supplierCode");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(productTypeRows), "productType");
    XLSX.writeFile(workbook, "urun-import-sablonu.xlsx");
    message.success("Urun sablonu indirildi.");
  };

  const handleSaveFilterPreset = () => {
    if (!savedFilterName.trim()) {
      message.warning("Filtre adini girin.");
      return;
    }

    const nextSavedFilters = [
      { name: savedFilterName.trim(), filters },
      ...savedFilters.filter((item) => item.name !== savedFilterName.trim()),
    ];
    persistSavedFilters(nextSavedFilters);
    setSavedFilterName("");
    message.success("Filtre kaydedildi.");
  };

  const applySavedFilter = (savedFilter) => {
    setFilters(savedFilter.filters);
    setFilterModalOpen(false);
    message.success(`${savedFilter.name} filtresi uygulandi.`);
  };

  const handleImportFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setSelectedImportFile(file);
    setImportTestResult(null);
  };

  const handleImportTest = async () => {
    if (!selectedImportFile) {
      message.warning("Lutfen bir Excel dosyasi secin.");
      return;
    }

    try {
      const buffer = await selectedImportFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
      const [headerRow = [], ...dataRows] = rows;
      const headers = headerRow.map((item) => String(item).trim());
      const nonEmptyRows = dataRows.filter((row) => row.some((cell) => String(cell ?? "").trim()));

      const requiredHeaders = ["code", "name", "salePrice", "cost"];
      const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

      const testSummary = {
        fileName: selectedImportFile.name,
        headerCount: headers.length,
        rowCount: nonEmptyRows.length,
        missingHeaders,
      };
      setImportTestResult(testSummary);

      if (missingHeaders.length > 0) {
        message.warning(`Test tamamlandi. Eksik basliklar: ${missingHeaders.join(", ")}`);
      } else {
        message.success(`Test tamamlandi. ${nonEmptyRows.length} satir ice aktarima uygun gorunuyor.`);
      }
    } catch {
      setImportTestResult(null);
      message.error("Dosya test edilirken hata olustu.");
    }
  };

  const handleImport = async () => {
    if (!selectedImportFile) {
      message.warning("Lutfen bir Excel dosyasi secin.");
      return;
    }

    try {
      setImporting(true);
      const buffer = await selectedImportFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
      const [headerRow, ...dataRows] = rows;
      if (!headerRow?.length) {
        message.error("Dosya bos gorunuyor.");
        return;
      }

      const headers = headerRow.map((item) => String(item).trim());
      const importedRows = dataRows
        .filter((row) => row.some((cell) => String(cell ?? "").trim()))
        .map((values) => {
        const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
        return {
          ...row,
          salePrice: Number(row.salePrice || 0),
          cost: Number(row.cost || 0),
          minStock: Number(row.minStock || 0),
          supplierLeadTime: Number(row.supplierLeadTime || 0),
        };
      });

      importProducts(importedRows);
      refreshProducts();
      setImportModalOpen(false);
      setSelectedImportFile(null);
      message.success(`${importedRows.length} urun ice aktarildi.`);
    } catch {
      message.error("Dosya okunurken hata olustu.");
    } finally {
      setImporting(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      [product.code, product.name, product.barcode, product.categoryLabel, product.collectionLabel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    const matchesCategory = !filters.categoryId || filters.categoryId === "all" || product.categoryId === filters.categoryId;
    const matchesCollection = !filters.collectionId || filters.collectionId === "all" || product.collectionId === filters.collectionId;
    const matchesStatus = !filters.status || filters.status === "Tumu" || product.status === filters.status;

    return matchesSearch && matchesCategory && matchesCollection && matchesStatus;
  });

  const columns = [
    {
      title: "Urun Kodu",
      dataIndex: "code",
      key: "code",
      sorter: (a, b) => a.code.localeCompare(b.code, "tr"),
      render: (value, record) => (
        <button
          type="button"
          className="erp-link-button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/products/${record.id}`);
          }}
        >
          {value}
        </button>
      ),
    },
    { title: "Urun Adi", dataIndex: "name", key: "name", sorter: (a, b) => a.name.localeCompare(b.name, "tr") },
    { title: "Satis Fiyati", dataIndex: "priceDisplay", key: "priceDisplay", sorter: (a, b) => a.salePrice - b.salePrice },
    { title: "Maliyet", dataIndex: "costDisplay", key: "costDisplay", sorter: (a, b) => a.cost - b.cost },
    { title: "Kategori", dataIndex: "categoryLabel", key: "categoryLabel", sorter: (a, b) => a.categoryLabel.localeCompare(b.categoryLabel, "tr") },
    { title: "Koleksiyon", dataIndex: "collectionLabel", key: "collectionLabel", sorter: (a, b) => a.collectionLabel.localeCompare(b.collectionLabel, "tr") },
    { title: "Stok", dataIndex: "stock", key: "stock", sorter: (a, b) => a.stock - b.stock, render: (value) => <Tag color="blue">{value}</Tag> },
    { title: "Durum", dataIndex: "status", key: "status", sorter: (a, b) => a.status.localeCompare(b.status, "tr"), render: (value) => <Tag color={value === "Aktif" ? "green" : "default"}>{value}</Tag> },
    {
      title: "Islemler",
      key: "actions",
      render: (_, record) => (
        <Space size={8}>
          <Button
            type="text"
            className="erp-icon-btn erp-icon-btn-edit"
            icon={<EditOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/products/${record.id}`);
            }}
          />
          <Popconfirm
            title="Urun silinsin mi?"
            okText="Sil"
            cancelText="Vazgec"
            onConfirm={() => handleDelete(record.id)}
          >
            <span onClick={preventRowClick}>
              <Button type="text" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} />
            </span>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Urun Listesi</Title>
          <Text type="secondary">Tum urunler kategori, koleksiyon, stok ve gorsel bilgileri ile listelenir.</Text>
        </div>
        <Space>
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: "kanban", icon: <AppstoreOutlined />, label: "Kanban" },
              { value: "liste", icon: <BarsOutlined />, label: "Liste" },
            ]}
          />
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/products/new")}>Urun Ekle</Button>
        </Space>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar erp-product-toolbar-single">
          <Space wrap className="erp-product-toolbar-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/products/new")}>Yeni Urun</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
            <Button onClick={() => setImportModalOpen(true)}>Excel'den Aktar</Button>
          </Space>

          <div className="erp-product-toolbar-search">
            <Input
              prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
              placeholder="Urun Kodu"
              value={filters.search}
              onChange={(event) => handleFilterChange("search", event.target.value)}
              allowClear
            />
            <Button icon={<FilterOutlined />} onClick={() => setFilterModalOpen(true)} />
          </div>
        </div>
      </Card>

      {viewMode === "liste" ? (
        <Card title="Tum Urunler" className="erp-list-table-card">
          <Table
            columns={columns}
            dataSource={filteredProducts.map((product) => ({ key: product.id, ...product }))}
            pagination={false}
            onRow={(record) => ({
              onClick: () => {
                openDetailFromRow(setSelectedProduct, setDetailOpen, record);
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
              <span>1 - {filteredProducts.length} / {filteredProducts.length}</span>
              <span>Sayfa 1 / 1</span>
            </Space>
          </div>
        </Card>
      ) : (
        <Card title="Kanban Gorunumu">
          <Row gutter={[16, 16]}>
            {filteredProducts.map((product) => (
              <Col xs={24} sm={12} xl={6} key={product.id}>
                <Card
                  hoverable
                  className="erp-product-kanban-card"
                  bodyStyle={{ padding: 14 }}
                  onClick={() => openDetailFromRow(setSelectedProduct, setDetailOpen, product)}
                >
                  <div className="erp-product-kanban-row">
                    <div className="erp-product-kanban-content">
                      <Text strong className="erp-product-kanban-title">
                        * {product.code}-{product.name}
                      </Text>
                      <Text type="secondary" className="erp-product-kanban-code">
                        [{product.code}]
                      </Text>
                      <Text className="erp-product-kanban-line">Fiyat: {product.priceDisplay}</Text>
                      <Text className="erp-product-kanban-line">Kategori: {product.categoryLabel.split(" / ").slice(-2, -1)[0] || product.categoryLabel}</Text>
                    </div>
                    <div className="erp-product-kanban-thumb">
                      <img src={product.image} alt={product.name} className="erp-product-image-small" />
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Drawer
        title="Urun Detayi"
        placement="right"
        width={420}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      >
        {selectedProduct ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Urun Kodu">{selectedProduct.code}</Descriptions.Item>
            <Descriptions.Item label="Urun Adi">{selectedProduct.name}</Descriptions.Item>
            <Descriptions.Item label="Satis Fiyati">{selectedProduct.priceDisplay}</Descriptions.Item>
            <Descriptions.Item label="Maliyet">{selectedProduct.costDisplay}</Descriptions.Item>
            <Descriptions.Item label="Kategori">{selectedProduct.categoryLabel}</Descriptions.Item>
            <Descriptions.Item label="Koleksiyon">{selectedProduct.collectionLabel}</Descriptions.Item>
            <Descriptions.Item label="Stok">{selectedProduct.stock}</Descriptions.Item>
            <Descriptions.Item label="Barkod">{selectedProduct.barcode || "-"}</Descriptions.Item>
            <Descriptions.Item label="Durum">{selectedProduct.status}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>

      <Modal
        title="Gelismis Filtreler"
        open={filterModalOpen}
        onCancel={() => setFilterModalOpen(false)}
        footer={null}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={[12, 12]}>
            <Col span={24}>
              <Form.Item label="Kategori">
                <Select
                  placeholder="Tumu"
                  value={filters.categoryId}
                  onChange={(value) => handleFilterChange("categoryId", value)}
                  options={categoryOptions}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Koleksiyon">
                <Select
                  placeholder="Tumu"
                  value={filters.collectionId}
                  onChange={(value) => handleFilterChange("collectionId", value)}
                  options={collectionOptions}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Durum">
                <Select
                  placeholder="Tumu"
                  value={filters.status}
                  onChange={(value) => handleFilterChange("status", value)}
                  options={statusOptions}
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" title="Filtreyi Kaydet">
            <Space.Compact style={{ width: "100%" }}>
              <Input value={savedFilterName} onChange={(event) => setSavedFilterName(event.target.value)} placeholder="Filtre adi" />
              <Button type="primary" onClick={handleSaveFilterPreset}>Kaydet</Button>
            </Space.Compact>
          </Card>

          <Card size="small" title="Kayitli Filtreler">
            <Space wrap>
              {savedFilters.length === 0 ? <Text type="secondary">Henuz kayitli filtre yok.</Text> : null}
              {savedFilters.map((item) => (
                <Button key={item.name} onClick={() => applySavedFilter(item)}>{item.name}</Button>
              ))}
            </Space>
          </Card>

          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Button onClick={handleResetFilters}>Filtreleri Temizle</Button>
            <Button type="primary" onClick={() => setFilterModalOpen(false)}>Uygula</Button>
          </Space>
        </Space>
      </Modal>

      <Modal
        title="Excel'den Aktar"
        open={importModalOpen}
        onCancel={() => {
          setImportModalOpen(false);
          setImportTestResult(null);
        }}
        footer={null}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Text type="secondary">Excel formatinda dosya secin veya once sablonu indirin.</Text>
          <input type="file" accept=".xlsx,.xls" onChange={handleImportFileChange} />
          {importTestResult ? (
            <Alert
              type={importTestResult.missingHeaders.length > 0 ? "warning" : "success"}
              showIcon
              message="Dosya Test Sonucu"
              description={(
                <Space direction="vertical" size={2}>
                  <Text>Dosya: <Text strong>{importTestResult.fileName}</Text></Text>
                  <Text>Baslik Sayisi: <Text strong>{importTestResult.headerCount}</Text></Text>
                  <Text>Veri Satiri: <Text strong>{importTestResult.rowCount}</Text></Text>
                  {importTestResult.missingHeaders.length > 0 ? (
                    <Text>Eksik Baslik: <Text strong>{importTestResult.missingHeaders.join(", ")}</Text></Text>
                  ) : (
                    <Text>Tum kritik basliklar mevcut.</Text>
                  )}
                </Space>
              )}
            />
          ) : null}
          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Button onClick={handleDownloadTemplate}>Sablon Indir</Button>
            <Space>
              <Button onClick={handleImportTest}>Test Et</Button>
              <Button type="primary" onClick={handleImport} loading={importing}>Iceri Aktar</Button>
            </Space>
          </Space>
        </Space>
      </Modal>
    </Space>
  );
}

export function ProductEditorPage() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const isEditMode = Boolean(productId);
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [imageModalOpen, setImageModalOpen] = React.useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = React.useState(false);
  const imageInputRef = React.useRef(null);
  const initialSupplierIdRef = React.useRef(null);
  const initialProductCodeRef = React.useRef("");
  const [systemParameters] = React.useState(() => getSystemParameters());
  const productList = listProducts();
  const productIndex = productList.findIndex((item) => item.id === productId);
  const previousProduct = productIndex > 0 ? productList[productIndex - 1] : null;
  const nextProduct = productIndex >= 0 && productIndex < productList.length - 1 ? productList[productIndex + 1] : null;
  const imagePath = Form.useWatch("image", form) || "/products/baroque-necklace.svg";
  const currentStock = Form.useWatch("stock", form) ?? 0;
  const watchedSupplierId = Form.useWatch("supplierId", form);
  const currencyOptions = ["TRY", "USD", "EUR"].map((value) => ({ value, label: value }));
  const quickImages = [
    "/products/baroque-necklace.svg",
    "/products/coral-earrings.svg",
    "/products/pearl-bracelet.svg",
    "/products/amethyst-ring.svg",
    "/products/agate-necklace.svg",
    "/products/luna-set.svg",
  ];

  const categoryOptions = listMasterData("categories").map((item) => ({
    value: item.id,
    label: item.fullPath,
  }));
  const collectionOptions = listMasterData("collections").map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const posCategoryOptions = listMasterData("pos-categories").map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const supplierOptions = listSuppliers().map((item) => ({
    value: item.id,
    label: item.company,
  }));

  React.useEffect(() => {
    const baseValues = {
      image: "/products/baroque-necklace.svg",
      productType: "kendi",
      salePrice: 0,
      saleCurrency: "TRY",
      cost: 0,
      costCurrency: "TRY",
      salesTax: "%20",
      supplierId: undefined,
      supplierCode: "",
      minStock: 0,
      supplierLeadTime: 0,
      stock: 0,
      isForSale: true,
      isForPurchase: true,
      useInPos: true,
      trackInventory: true,
      status: "Aktif",
      features: [{ name: "", value: "" }],
    };

    if (!isEditMode) {
      initialSupplierIdRef.current = null;
      initialProductCodeRef.current = "";
      form.setFieldsValue(baseValues);
      return;
    }

    const product = getProductById(productId);
    if (!product) {
      message.error("Urun kaydi bulunamadi.");
      navigate("/products/list");
      return;
    }

    form.setFieldsValue({
      ...baseValues,
      ...product,
      features: product.features?.length ? product.features : baseValues.features,
    });
    initialSupplierIdRef.current = product.supplierId || null;
    initialProductCodeRef.current = product.code || "";
  }, [form, isEditMode, navigate, productId]);

  React.useEffect(() => {
    if (!systemParameters.productCodeControlEnabled) {
      return;
    }

    if (!watchedSupplierId) {
      if (!isEditMode) {
        form.setFieldValue("code", "");
      }
      return;
    }

    if (isEditMode && watchedSupplierId === initialSupplierIdRef.current) {
      form.setFieldValue("code", initialProductCodeRef.current);
      return;
    }

    const nextCode = generateProductCodeForSupplier(watchedSupplierId, productId);
    form.setFieldValue("code", nextCode);
  }, [form, isEditMode, productId, systemParameters.productCodeControlEnabled, watchedSupplierId]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      if (systemParameters.productCodeControlEnabled) {
        const duplicateProduct = listProducts().find((item) => item.code === values.code && item.id !== productId);
        if (duplicateProduct) {
          message.error("Bu urun kodu zaten kullaniliyor.");
          return;
        }
      }
      const savedProduct = isEditMode ? updateProduct(productId, values) : createProduct(values);
      message.success(isEditMode ? "Urun guncellendi." : "Urun kaydedildi.");
      navigate(`/products/${savedProduct.id}`);
    } catch {
      // form validation handles errors
    } finally {
      setLoading(false);
    }
  };

  const handleImagePickerClick = () => {
    imageInputRef.current?.click();
  };

  const handleImageFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      message.error("Lutfen gecerli bir gorsel dosyasi secin.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        form.setFieldValue("image", reader.result);
        setImageModalOpen(false);
        message.success("Urun gorseli secildi.");
      }
    };
    reader.onerror = () => {
      message.error("Gorsel okunurken hata olustu.");
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const priceInputAddon = (
    <Form.Item name="saleCurrency" noStyle>
      <Select style={{ width: 90 }} options={currencyOptions} />
    </Form.Item>
  );

  const costInputAddon = (
    <Form.Item name="costCurrency" noStyle>
      <Select style={{ width: 90 }} options={currencyOptions} />
    </Form.Item>
  );

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>{isEditMode ? "Urun Duzenle" : "Urun Ekle"}</Title>
          <Text type="secondary">Urun kartina ait genel bilgiler, fiyat ve stok ayarlari burada girilir.</Text>
        </div>
        <Space>
          {isEditMode ? (
            <Space.Compact>
              <Button icon={<LeftOutlined />} disabled={!previousProduct} onClick={() => previousProduct && navigate(`/products/${previousProduct.id}`)}>
                Onceki
              </Button>
              <Button icon={<RightOutlined />} iconPosition="end" disabled={!nextProduct} onClick={() => nextProduct && navigate(`/products/${nextProduct.id}`)}>
                Sonraki
              </Button>
            </Space.Compact>
          ) : null}
          <Button onClick={() => navigate("/products/list")}>Listeye Don</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>Kaydet</Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageFileChange}
        />
        <Row gutter={[20, 20]}>
          <Col xs={24} xl={8}>
            <Space direction="vertical" size={20} style={{ width: "100%" }}>
              <Card
                title="Urun Gorseli"
                extra={(
                  <Space size={8}>
                    <Button onClick={handleImagePickerClick}>{isEditMode ? "Gorsel Degistir" : "Gorsel Ekle"}</Button>
                    <Button type="text" onClick={() => setImageModalOpen(true)}>Hazir Gorseller</Button>
                  </Space>
                )}
              >
                <div
                  className="erp-product-preview"
                  onClick={() => setImagePreviewOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setImagePreviewOpen(true);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <img src={imagePath} alt="Urun gorseli" className="erp-product-image-large" />
                </div>
                <Form.Item name="image" hidden rules={[{ required: true, message: "Gorsel zorunludur." }]}>
                  <Input />
                </Form.Item>
              </Card>

              <Card title="Fiyat Bilgileri">
                <Row gutter={[16, 16]}>
                  <Col xs={24}>
                    <Form.Item name="salePrice" label="Satis Fiyati">
                      <InputNumber style={{ width: "100%" }} min={0} placeholder="0,00" addonAfter={priceInputAddon} />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item name="cost" label="Maliyet">
                      <InputNumber style={{ width: "100%" }} min={0} placeholder="0,00" addonAfter={costInputAddon} />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item name="salesTax" label="Satis Vergisi">
                      <Input placeholder="%20" />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item name="productType" label="Urun Tipi">
                      <Radio.Group
                        options={[
                          { label: "Kendi Uretim", value: "kendi" },
                          { label: "Konsinye", value: "konsinye" },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Space>
          </Col>

          <Col xs={24} xl={16}>
            <Card title="Urun Karti">
              <Tabs
                defaultActiveKey="general"
                items={[
                  {
                    key: "general",
                    label: "Genel Bilgiler",
                    children: (
                      <Row gutter={[16, 16]}>
                        <Col xs={24} md={12}>
                          <Form.Item name="supplierId" label="Tedarik Edilen Firma" rules={[{ required: true, message: "Tedarik edilen firma seciniz." }]}>
                            <Select
                              options={supplierOptions}
                              placeholder="Tedarikci seciniz"
                              showSearch
                              optionFilterProp="label"
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}><Form.Item name="supplierCode" label="Tedarik Kodu"><Input placeholder="TED-001" /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item name="name" label="Urun Adi" rules={[{ required: true, message: "Urun adi zorunludur." }]}><Input placeholder="Mercan Damla Kolye" /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item name="code" label="Urun Kodu" rules={[{ required: true, message: "Urun kodu zorunludur." }]}><Input placeholder="SOLE0004" readOnly={systemParameters.productCodeControlEnabled} /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item name="categoryId" label="Kategori" rules={[{ required: true, message: "Kategori seciniz." }]}><Select options={categoryOptions} placeholder="Kategori seciniz" /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item name="collectionId" label="Koleksiyon" rules={[{ required: true, message: "Koleksiyon seciniz." }]}><Select options={collectionOptions} placeholder="Koleksiyon seciniz" /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item name="posCategoryId" label="POS Kategorisi"><Select options={posCategoryOptions} placeholder="POS kategorisi seciniz" /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item name="barcode" label="Barkod"><Input placeholder="868..." /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item name="status" label="Durum"><Select options={["Aktif", "Pasif"].map((value) => ({ value, label: value }))} /></Form.Item></Col>
                      </Row>
                    ),
                  },
                  {
                    key: "purchase",
                    label: "Satınalma",
                    children: (
                      <Row gutter={[16, 16]}>
                        <Col xs={24} md={12}>
                          <Form.Item name="supplierId" label="Tedarikçi">
                            <Select
                              options={supplierOptions}
                              placeholder="Tedarikçi seçiniz"
                              showSearch
                              optionFilterProp="label"
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="supplierCode" label="Tedarikçi Kodu">
                            <Input placeholder="TED-001" />
                          </Form.Item>
                        </Col>
                      </Row>
                    ),
                  },
                  {
                    key: "pricing",
                    label: "Fiyat",
                    children: (
                      <Row gutter={[16, 16]}>
                        <Col xs={24} md={12}>
                          <Form.Item name="salePrice" label="Satis Fiyati">
                            <InputNumber style={{ width: "100%" }} min={0} placeholder="0,00" addonAfter={priceInputAddon} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="cost" label="Maliyet">
                            <InputNumber style={{ width: "100%" }} min={0} placeholder="0,00" addonAfter={costInputAddon} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="salesTax" label="Satis Vergisi">
                            <Input placeholder="%20" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="productType" label="Urun Tipi">
                            <Radio.Group
                              options={[
                                { label: "Kendi Uretim", value: "kendi" },
                                { label: "Konsinye", value: "konsinye" },
                              ]}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    ),
                  },
                  {
                    key: "stock",
                    label: "Stok",
                    children: (
                      <Row gutter={[16, 16]}>
                        <Col xs={24} md={12}><Form.Item name="minStock" label="Minimum Stok"><InputNumber style={{ width: "100%" }} min={0} placeholder="0" /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item name="supplierLeadTime" label="Tedarik Suresi (Gun)"><InputNumber style={{ width: "100%" }} min={0} placeholder="0" /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item name="trackInventory" label="Stok Takibi" valuePropName="checked"><Switch /></Form.Item></Col>
                        <Col xs={24} md={12}>
                          <Card size="small" className="erp-readonly-card">
                            <Text type="secondary">Mevcut Stok</Text>
                            <Title level={4} style={{ margin: "8px 0 0" }}>{currentStock}</Title>
                            <Text type="secondary">Stok giris ve satis hareketlerinden otomatik gelir.</Text>
                          </Card>
                        </Col>
                      </Row>
                    ),
                  },
                  {
                    key: "modules",
                    label: "Moduller",
                    children: (
                      <Row gutter={[16, 16]}>
                        <Col xs={24} md={8}><Form.Item name="isForSale" label="Satisa Acik" valuePropName="checked"><Switch /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item name="isForPurchase" label="Satinalmaya Acik" valuePropName="checked"><Switch /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item name="useInPos" label="POS'ta Kullan" valuePropName="checked"><Switch /></Form.Item></Col>
                      </Row>
                    ),
                  },
                ].filter((item) => item.key !== "purchase" && item.key !== "pricing")}
              />
            </Card>

            <Space direction="vertical" size={20} style={{ width: "100%", marginTop: 20 }}>
              <Form.List name="features">
                {(fields, { add, remove }) => (
                  <Card title="Ozellikler" extra={<Button icon={<PlusOutlined />} onClick={() => add({ name: "", value: "" })}>Ozellik Ekle</Button>}>
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                      {fields.map((field) => (
                        <Row gutter={[12, 12]} key={field.key}>
                          <Col xs={24} md={10}>
                            <Form.Item name={[field.name, "name"]}>
                              <Input placeholder="Ozellik adi" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={10}>
                            <Form.Item name={[field.name, "value"]}>
                              <Input placeholder="Deger" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={4}>
                            <Button block onClick={() => remove(field.name)}>Sil</Button>
                          </Col>
                        </Row>
                      ))}
                    </Space>
                  </Card>
                )}
              </Form.List>

              <Card title="Ic Notlar">
                <Form.Item name="notes">
                  <Input.TextArea rows={5} placeholder="Urunle ilgili dahili notlar" />
                </Form.Item>
              </Card>
            </Space>
          </Col>
        </Row>
      </Form>

      <Modal
        title="Urun Gorseli Sec"
        open={imageModalOpen}
        onCancel={() => setImageModalOpen(false)}
        footer={null}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Text type="secondary">Hazir gorsellerden birini secin, dosyadan yukleyin veya gorsel yolunu degistirin.</Text>
          <Button onClick={handleImagePickerClick}>Dosyadan Gorsel Sec</Button>
          <div className="erp-image-picker-grid">
            {quickImages.map((image) => (
              <button
                type="button"
                key={image}
                className="erp-image-picker-button"
                onClick={() => {
                  form.setFieldValue("image", image);
                  setImageModalOpen(false);
                }}
              >
                <img src={image} alt={image} className="erp-image-picker-thumb" />
              </button>
            ))}
          </div>
          <div>
            <Text strong style={{ display: "block", marginBottom: 8 }}>Ozel Gorsel Yolu</Text>
            <Input value={imagePath} onChange={(event) => form.setFieldValue("image", event.target.value)} placeholder="/products/baroque-necklace.svg" />
          </div>
          <Space style={{ justifyContent: "flex-end", width: "100%" }}>
            <Button onClick={() => setImageModalOpen(false)}>Kapat</Button>
            <Button type="primary" onClick={() => setImageModalOpen(false)}>Uygula</Button>
          </Space>
        </Space>
      </Modal>

      <Modal
        title="Urun Gorsel Onizleme"
        open={imagePreviewOpen}
        footer={null}
        onCancel={() => setImagePreviewOpen(false)}
        width={720}
      >
        <div className="erp-product-preview erp-product-preview-modal">
          <img src={imagePath} alt="Urun gorseli buyuk onizleme" className="erp-product-image-zoom" />
        </div>
      </Modal>
    </Space>
  );
}

export function SupplierDashboardPage() {
  const authUser = getAuthUser();
  const supplierId = authUser?.supplierId || null;
  const supplier = React.useMemo(() => getSupplierById(supplierId), [supplierId]);
  const products = React.useMemo(() => (supplierId ? listProductsBySupplier(supplierId) : []), [supplierId]);
  const deliveries = React.useMemo(() => (supplierId ? listDeliveryListsBySupplier(supplierId) : []), [supplierId]);

  const totalStockQty = React.useMemo(
    () => products.reduce((sum, product) => sum + Number(product.stock || 0), 0),
    [products],
  );
  const totalStockValue = React.useMemo(
    () => products.reduce((sum, product) => sum + (Number(product.stock || 0) * Number(product.cost || 0)), 0),
    [products],
  );
  const waitingDeliveries = React.useMemo(
    () => deliveries.filter((delivery) => delivery.status === "Onay Bekleniyor").length,
    [deliveries],
  );

  const metrics = [
    { title: "Toplam Urun", value: products.length },
    { title: "Toplam Stok", value: totalStockQty },
    { title: "Toplam Stok Degeri", value: formatDashboardMoney(totalStockValue) },
    { title: "Onay Bekleyen Teslimat", value: waitingDeliveries },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 6 }}>Dashboard</Title>
        <Text type="secondary">Tedarikci hesabinizdaki urun, stok ve teslimat ozetini buradan takip edebilirsiniz.</Text>
      </div>

      <Row gutter={[16, 16]}>
        {metrics.map((metric) => (
          <Col xs={24} sm={12} xl={6} key={metric.title}>
            <Card bordered={false} className="erp-metric-card">
              <Statistic title={metric.title} value={metric.value} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <Card title="Firma Bilgileri" bordered={false}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Firma">{supplier?.company || "-"}</Descriptions.Item>
              <Descriptions.Item label="Yetkili">{supplier?.contact || authUser?.fullName || "-"}</Descriptions.Item>
              <Descriptions.Item label="E-posta">{supplier?.email || authUser?.email || "-"}</Descriptions.Item>
              <Descriptions.Item label="Telefon">{supplier?.phone || "-"}</Descriptions.Item>
              <Descriptions.Item label="Sehir">{supplier?.city || "-"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} xl={14}>
          <Card title="Son Teslimatlar" bordered={false}>
            <Table
              rowKey="id"
              pagination={false}
              size="small"
              dataSource={deliveries.slice(0, 5)}
              locale={{ emptyText: "Henuz teslimat kaydiniz bulunmuyor." }}
              columns={[
                { title: "Teslimat No", dataIndex: "deliveryNo", key: "deliveryNo" },
                { title: "Tarih", dataIndex: "date", key: "date" },
                { title: "Kalem", dataIndex: "lineCount", key: "lineCount", width: 90 },
                {
                  title: "Durum",
                  dataIndex: "status",
                  key: "status",
                  render: (value) => <Tag color={value === "Onay Bekleniyor" ? "gold" : value === "Onaylandi" ? "green" : "default"}>{value || "Taslak"}</Tag>,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

export function SupplierListPage() {
  const navigate = useNavigate();
  const SAVED_FILTERS_KEY = "sibella.erp.supplierFilters.v1";
  const [viewMode, setViewMode] = React.useState("liste");
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedSupplier, setSelectedSupplier] = React.useState(null);
  const [suppliers, setSuppliers] = React.useState(() => listSuppliers());
  const [filters, setFilters] = React.useState({
    search: "",
    procurementTypeId: undefined,
    paymentTermId: undefined,
    status: undefined,
  });
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [savedFilterName, setSavedFilterName] = React.useState("");
  const [savedFilters, setSavedFilters] = React.useState(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      return JSON.parse(window.localStorage.getItem(SAVED_FILTERS_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const procurementOptions = [{ value: "all", label: "Tumu" }, ...listMasterData("procurement-types").map((item) => ({
    value: item.id,
    label: item.name,
  }))];
  const paymentOptions = [{ value: "all", label: "Tumu" }, ...listMasterData("payment-terms").map((item) => ({
    value: item.id,
    label: item.name,
  }))];
  const statusOptions = ["Tumu", "Aktif", "Pasif"].map((value) => ({ value, label: value }));

  const refreshSuppliers = () => {
    setSuppliers(listSuppliers());
  };

  const persistSavedFilters = (nextSavedFilters) => {
    setSavedFilters(nextSavedFilters);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(nextSavedFilters));
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      procurementTypeId: undefined,
      paymentTermId: undefined,
      status: undefined,
    });
  };

  const handleDelete = (supplierId) => {
    deleteSupplier(supplierId);
    refreshSuppliers();
    message.success("Tedarikci silindi.");
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      [supplier.company, supplier.contact, supplier.email, supplier.phone, supplier.city]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    const matchesProcurement = !filters.procurementTypeId || filters.procurementTypeId === "all" || supplier.procurementTypeId === filters.procurementTypeId;
    const matchesPayment = !filters.paymentTermId || filters.paymentTermId === "all" || supplier.paymentTermId === filters.paymentTermId;
    const matchesStatus = !filters.status || filters.status === "Tumu" || supplier.status === filters.status;

    return matchesSearch && matchesProcurement && matchesPayment && matchesStatus;
  });

  const handleExport = () => {
    const header = ["Kisa Kod", "Firma", "Yetkili", "Tedarik Tipi", "Odeme Kosulu", "E-posta", "Telefon", "Sehir", "Durum"];
    const rows = filteredSuppliers.map((item) => [
      item.shortCode || "",
      item.company,
      item.contact,
      item.procurementTypeLabel,
      item.paymentTermLabel,
      item.email,
      item.phone,
      item.city,
      item.status,
    ]);
    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tedarikci-listesi.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveFilterPreset = () => {
    if (!savedFilterName.trim()) {
      message.warning("Filtre adini girin.");
      return;
    }

    const nextSavedFilters = [
      { name: savedFilterName.trim(), filters },
      ...savedFilters.filter((item) => item.name !== savedFilterName.trim()),
    ];
    persistSavedFilters(nextSavedFilters);
    setSavedFilterName("");
    message.success("Filtre kaydedildi.");
  };

  const applySavedFilter = (savedFilter) => {
    setFilters(savedFilter.filters);
    setFilterModalOpen(false);
    message.success(`${savedFilter.name} filtresi uygulandi.`);
  };

  const columns = [
    {
      title: "Firma",
      dataIndex: "company",
      key: "company",
      sorter: (a, b) => a.company.localeCompare(b.company, "tr"),
      render: (value, record) => (
        <button
          type="button"
          className="erp-link-button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/purchasing/suppliers/${record.id}`);
          }}
        >
          {value}
        </button>
      ),
    },
    { title: "Yetkili", dataIndex: "contact", key: "contact", sorter: (a, b) => a.contact.localeCompare(b.contact, "tr") },
    { title: "Tedarik Tipi", dataIndex: "procurementTypeLabel", key: "procurementTypeLabel", sorter: (a, b) => a.procurementTypeLabel.localeCompare(b.procurementTypeLabel, "tr") },
    { title: "Odeme Kosulu", dataIndex: "paymentTermLabel", key: "paymentTermLabel", sorter: (a, b) => a.paymentTermLabel.localeCompare(b.paymentTermLabel, "tr") },
    { title: "E-posta", dataIndex: "email", key: "email", sorter: (a, b) => a.email.localeCompare(b.email, "tr") },
    { title: "Telefon", dataIndex: "phone", key: "phone", sorter: (a, b) => a.phone.localeCompare(b.phone, "tr") },
    { title: "Durum", dataIndex: "status", key: "status", sorter: (a, b) => a.status.localeCompare(b.status, "tr"), render: (value) => <Tag color={value === "Aktif" ? "green" : "default"}>{value}</Tag> },
    {
      title: "Islemler",
      key: "actions",
      render: (_, record) => (
        <Space size={8}>
          <Button
            type="text"
            className="erp-icon-btn erp-icon-btn-edit"
            icon={<EditOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/purchasing/suppliers/${record.id}`);
            }}
          />
          <Popconfirm title="Tedarikci silinsin mi?" okText="Sil" cancelText="Vazgec" onConfirm={() => handleDelete(record.id)}>
            <span onClick={preventRowClick}>
              <Button type="text" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} />
            </span>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Tedarikci Listesi</Title>
          <Text type="secondary">Tedarikciler tedarik tipi, odeme kosulu ve iletisim bilgileri ile izlenir.</Text>
        </div>
        <Space>
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: "kanban", icon: <AppstoreOutlined />, label: "Kanban" },
              { value: "liste", icon: <BarsOutlined />, label: "Liste" },
            ]}
          />
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/purchasing/suppliers/new")}>Tedarikci Ekle</Button>
        </Space>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar erp-product-toolbar-single">
          <Space wrap className="erp-product-toolbar-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/purchasing/suppliers/new")}>Yeni Tedarikci</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          </Space>

          <div className="erp-product-toolbar-search">
            <Input
              prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
              placeholder="Firma"
              value={filters.search}
              onChange={(event) => handleFilterChange("search", event.target.value)}
              allowClear
            />
            <Button icon={<FilterOutlined />} onClick={() => setFilterModalOpen(true)} />
          </div>
        </div>
      </Card>

      {viewMode === "liste" ? (
        <Card title="Tum Tedarikciler" className="erp-list-table-card">
          <Table
            columns={columns}
            dataSource={filteredSuppliers.map((supplier) => ({ key: supplier.id, ...supplier }))}
            pagination={false}
            onRow={(record) => ({
              onClick: () => openDetailFromRow(setSelectedSupplier, setDetailOpen, record),
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
              <span>1 - {filteredSuppliers.length} / {filteredSuppliers.length}</span>
              <span>Sayfa 1 / 1</span>
            </Space>
          </div>
        </Card>
      ) : (
        <Card title="Kanban Gorunumu">
          <Row gutter={[16, 16]}>
            {filteredSuppliers.map((supplier) => (
              <Col xs={24} sm={12} xl={6} key={supplier.id}>
                <Card hoverable className="erp-product-kanban-card" bodyStyle={{ padding: 14 }} onClick={() => openDetailFromRow(setSelectedSupplier, setDetailOpen, supplier)}>
                  <div className="erp-supplier-kanban">
                    <div className="erp-supplier-avatar">{supplier.initials}</div>
                    <div className="erp-product-kanban-content">
                      <Text strong className="erp-product-kanban-title">{supplier.company}</Text>
                      <Text type="secondary" className="erp-product-kanban-code">{supplier.contact}</Text>
                      <Text className="erp-product-kanban-line">{supplier.procurementTypeLabel}</Text>
                      <Text className="erp-product-kanban-line">{supplier.paymentTermLabel}</Text>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Drawer title="Tedarikci Detayi" placement="right" width={420} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {selectedSupplier ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Kisa Kod">{selectedSupplier.shortCode || "-"}</Descriptions.Item>
            <Descriptions.Item label="Firma">{selectedSupplier.company}</Descriptions.Item>
            <Descriptions.Item label="Yetkili">{selectedSupplier.contact}</Descriptions.Item>
            <Descriptions.Item label="Tedarik Tipi">{selectedSupplier.procurementTypeLabel}</Descriptions.Item>
            <Descriptions.Item label="Odeme Kosulu">{selectedSupplier.paymentTermLabel}</Descriptions.Item>
            <Descriptions.Item label="E-posta">{selectedSupplier.email}</Descriptions.Item>
            <Descriptions.Item label="Telefon">{selectedSupplier.phone}</Descriptions.Item>
            <Descriptions.Item label="Sehir">{selectedSupplier.city || "-"}</Descriptions.Item>
            <Descriptions.Item label="Durum">{selectedSupplier.status}</Descriptions.Item>
            <Descriptions.Item label="Not">{selectedSupplier.note || "-"}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>

      <Modal title="Gelismis Filtreler" open={filterModalOpen} onCancel={() => setFilterModalOpen(false)} footer={null}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={[12, 12]}>
            <Col span={24}>
              <Form.Item label="Tedarik Tipi">
                <Select value={filters.procurementTypeId} onChange={(value) => handleFilterChange("procurementTypeId", value)} options={procurementOptions} allowClear />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Odeme Kosulu">
                <Select value={filters.paymentTermId} onChange={(value) => handleFilterChange("paymentTermId", value)} options={paymentOptions} allowClear />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Durum">
                <Select value={filters.status} onChange={(value) => handleFilterChange("status", value)} options={statusOptions} allowClear />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" title="Filtreyi Kaydet">
            <Space.Compact style={{ width: "100%" }}>
              <Input value={savedFilterName} onChange={(event) => setSavedFilterName(event.target.value)} placeholder="Filtre adi" />
              <Button type="primary" onClick={handleSaveFilterPreset}>Kaydet</Button>
            </Space.Compact>
          </Card>

          <Card size="small" title="Kayitli Filtreler">
            <Space wrap>
              {savedFilters.length === 0 ? <Text type="secondary">Henuz kayitli filtre yok.</Text> : null}
              {savedFilters.map((item) => (
                <Button key={item.name} onClick={() => applySavedFilter(item)}>{item.name}</Button>
              ))}
            </Space>
          </Card>

          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Button onClick={handleResetFilters}>Filtreleri Temizle</Button>
            <Button type="primary" onClick={() => setFilterModalOpen(false)}>Uygula</Button>
          </Space>
        </Space>
      </Modal>

    </Space>
  );
}

export function SupplierEditorPage() {
  const navigate = useNavigate();
  const { supplierId } = useParams();
  const isEditMode = Boolean(supplierId);
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const watchedCompany = Form.useWatch("company", form) || "Yeni Tedarikci";
  const watchedShortCode = Form.useWatch("shortCode", form) || "-";
  const watchedContact = Form.useWatch("contact", form) || "Yetkili kisi bilgisi";
  const watchedProcurementTypeId = Form.useWatch("procurementTypeId", form);
  const watchedPaymentTermId = Form.useWatch("paymentTermId", form);
  const watchedIban = Form.useWatch("iban", form) || "-";
  const watchedStatus = Form.useWatch("status", form) || "-";
  const watchedSupplierProducts = React.useMemo(
    () =>
      listProducts()
        .filter((item) => item.supplierId === supplierId)
        .map((item) => ({
          key: item.id,
          code: item.code,
          name: item.name,
          id: item.id,
        })),
    [supplierId],
  );

  const procurementOptions = listMasterData("procurement-types").map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const paymentOptions = listMasterData("payment-terms").map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const statusOptions = ["Aktif", "Pasif"].map((value) => ({ value, label: value }));

  React.useEffect(() => {
    const baseValues = {
      shortCode: "",
      company: "",
      contact: "",
      email: "",
      phone: "",
      city: "",
      iban: "",
      taxNumber: "",
      taxOffice: "",
      address: "",
      procurementTypeId: undefined,
      paymentTermId: undefined,
      status: "Aktif",
      note: "",
    };

    if (!isEditMode) {
      form.setFieldsValue(baseValues);
      return;
    }

    const supplier = getSupplierById(supplierId);
    if (!supplier) {
      message.error("Tedarikci kaydi bulunamadi.");
      navigate("/purchasing/suppliers");
      return;
    }

    form.setFieldsValue({ ...baseValues, ...supplier });
  }, [form, isEditMode, navigate, supplierId]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      const duplicateSupplier = listSuppliers().find((item) => item.email === values.email && item.id !== supplierId);
      if (values.email && duplicateSupplier) {
        message.error("Bu e-posta ile baska bir tedarikci kayitli.");
        return;
      }

      const savedSupplier = isEditMode ? updateSupplier(supplierId, values) : createSupplier(values);
      message.success(isEditMode ? "Tedarikci guncellendi." : "Tedarikci kaydedildi.");
      navigate(`/purchasing/suppliers/${savedSupplier.id}`);
    } catch {
      // form validation handles error display
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>{isEditMode ? "Tedarikci Duzenle" : "Tedarikci Ekle"}</Title>
          <Text type="secondary">Tedarikci kartina ait temel bilgiler, tedarik tipi ve odeme kosulu burada yonetilir.</Text>
        </div>
        <Space>
          <Button onClick={() => navigate("/purchasing/suppliers")}>Listeye Don</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>Kaydet</Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <Row gutter={[20, 20]}>
          <Col xs={24} xl={8}>
            <Space direction="vertical" size={20} style={{ width: "100%" }}>
              <Card title="Tedarikci Ozet">
                <Space direction="vertical" size={14} style={{ width: "100%" }}>
                  <div className="erp-supplier-summary">
                    <div className="erp-supplier-avatar erp-supplier-avatar-large">
                      {(watchedCompany || "TD")
                        .split(" ")
                        .slice(0, 2)
                        .map((part) => part[0] || "")
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div>
                      <Title level={5} style={{ margin: 0 }}>{watchedCompany}</Title>
                      <Text type="secondary">{watchedContact}</Text>
                    </div>
                  </div>
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="Kisa Kod">{watchedShortCode}</Descriptions.Item>
                    <Descriptions.Item label="Tedarik Tipi">
                      {procurementOptions.find((item) => item.value === watchedProcurementTypeId)?.label || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Odeme Kosulu">
                      {paymentOptions.find((item) => item.value === watchedPaymentTermId)?.label || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="IBAN">{watchedIban}</Descriptions.Item>
                    <Descriptions.Item label="Durum">{watchedStatus}</Descriptions.Item>
                  </Descriptions>
                </Space>
              </Card>

              <Card title="Tedarikci Urunleri">
                <Table
                  size="small"
                  pagination={false}
                  locale={{ emptyText: "Bu tedarikci ile eslesen urun yok." }}
                  dataSource={watchedSupplierProducts}
                  columns={[
                    {
                      title: "Urun Kodu",
                      dataIndex: "code",
                      key: "code",
                      render: (value, record) => (
                        <button
                          type="button"
                          className="erp-link-button"
                          onClick={() => navigate(`/products/${record.id}`)}
                        >
                          {value}
                        </button>
                      ),
                    },
                    {
                      title: "Urun Adi",
                      dataIndex: "name",
                      key: "name",
                    },
                  ]}
                />
              </Card>
            </Space>
          </Col>

          <Col xs={24} xl={16}>
            <Space direction="vertical" size={20} style={{ width: "100%" }}>
              <Card title="Genel Bilgiler">
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}><Form.Item name="shortCode" label="Tedarikci Kisa Kod"><Input placeholder="MINA" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="company" label="Firma / Kisi Adi" rules={[{ required: true, message: "Firma adi zorunludur." }]}><Input placeholder="Mina Aksesuar" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="contact" label="Yetkili Kisi" rules={[{ required: true, message: "Yetkili kisi zorunludur." }]}><Input placeholder="Mina Demir" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="email" label="E-posta" rules={[{ type: "email", message: "Gecerli e-posta girin." }]}><Input placeholder="ornek@tedarikci.com" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="phone" label="Telefon"><Input placeholder="0532..." /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="city" label="Sehir"><Input placeholder="Istanbul" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="status" label="Durum"><Select options={statusOptions} /></Form.Item></Col>
                </Row>
              </Card>

              <Card title="Vergi ve Banka Bilgileri">
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}><Form.Item name="iban" label="IBAN"><Input placeholder="TR..." /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="taxNumber" label="Vergi Kimlik No"><Input placeholder="1234567890" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="taxOffice" label="Vergi Dairesi"><Input placeholder="Beyoglu" /></Form.Item></Col>
                  <Col xs={24}><Form.Item name="address" label="Adres"><Input.TextArea rows={4} placeholder="Acik adres bilgisi" /></Form.Item></Col>
                </Row>
              </Card>

              <Card title="Tedarik Parametreleri">
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}><Form.Item name="procurementTypeId" label="Tedarik Tipi" rules={[{ required: true, message: "Tedarik tipi seciniz." }]}><Select options={procurementOptions} placeholder="Tedarik tipi seciniz" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="paymentTermId" label="Odeme Kosulu" rules={[{ required: true, message: "Odeme kosulu seciniz." }]}><Select options={paymentOptions} placeholder="Odeme kosulu seciniz" /></Form.Item></Col>
                </Row>
              </Card>

              <Card title="Notlar">
                <Form.Item name="note">
                  <Input.TextArea rows={5} placeholder="Tedarikci ile ilgili dahili notlar" />
                </Form.Item>
              </Card>
            </Space>
          </Col>
        </Row>
      </Form>
    </Space>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("PDF dosyasi okunamadi."));
    reader.readAsDataURL(file);
  });
}

export function ContractsPage() {
  const [records, setRecords] = React.useState(() => listContracts());
  const [modalOpen, setModalOpen] = React.useState(false);
  const [pdfModalOpen, setPdfModalOpen] = React.useState(false);
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [activePdf, setActivePdf] = React.useState(null);
  const [activeRecord, setActiveRecord] = React.useState(null);
  const [uploadedPdf, setUploadedPdf] = React.useState({ pdfName: "", pdfDataUrl: "" });
  const [filters, setFilters] = React.useState({
    search: "",
    supplierId: undefined,
  });
  const [form] = Form.useForm();

  const supplierOptions = listSuppliers()
    .filter((item) => item.status !== "Pasif")
    .map((item) => ({
      value: item.id,
      label: item.company,
    }));

  const refreshRecords = () => {
    setRecords(listContracts());
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      supplierId: undefined,
    });
  };

  const openCreateModal = () => {
    setActiveRecord(null);
    setUploadedPdf({ pdfName: "", pdfDataUrl: "" });
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (record) => {
    setActiveRecord(record);
    setUploadedPdf({
      pdfName: record.pdfName || "",
      pdfDataUrl: record.pdfDataUrl || "",
    });
    form.setFieldsValue({
      supplierId: record.supplierId,
      startDate: record.startDate ? dayjs(record.startDate) : null,
      endDate: record.endDate ? dayjs(record.endDate) : null,
      commissionRate: Number(record.commissionRate || 0),
    });
    setModalOpen(true);
  };

  const handlePdfFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      message.error("Lutfen PDF dosyasi secin.");
      event.target.value = "";
      return;
    }

    try {
      const pdfDataUrl = await readFileAsDataUrl(file);
      setUploadedPdf({
        pdfName: file.name,
        pdfDataUrl,
      });
      message.success("PDF yuklendi.");
    } catch {
      message.error("PDF okunurken hata olustu.");
    } finally {
      event.target.value = "";
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();
      const startDate = values.startDate?.format("YYYY-MM-DD");
      const endDate = values.endDate?.format("YYYY-MM-DD");

      if (startDate && endDate && dayjs(endDate).isBefore(dayjs(startDate), "day")) {
        message.error("Bitis tarihi baslangic tarihinden once olamaz.");
        return;
      }

      if (!uploadedPdf.pdfDataUrl) {
        message.error("Lutfen sozlesme PDF dosyasini yukleyin.");
        return;
      }

      const payload = {
        supplierId: values.supplierId,
        startDate,
        endDate,
        commissionRate: Number(values.commissionRate || 0),
        pdfName: uploadedPdf.pdfName,
        pdfDataUrl: uploadedPdf.pdfDataUrl,
      };

      if (activeRecord?.id) {
        updateContract(activeRecord.id, payload);
        message.success("Sozlesme guncellendi.");
      } else {
        createContract(payload);
        message.success("Sozlesme kaydedildi.");
      }

      setModalOpen(false);
      form.resetFields();
      setUploadedPdf({ pdfName: "", pdfDataUrl: "" });
      setActiveRecord(null);
      refreshRecords();
    } catch {
      // form validation handles error display
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (recordId) => {
    deleteContract(recordId);
    refreshRecords();
    message.success("Sozlesme silindi.");
  };

  const filteredRecords = records.filter((record) => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      [record.supplierName, record.pdfName, record.startDate, record.endDate]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    const matchesSupplier = !filters.supplierId || filters.supplierId === "all" || record.supplierId === filters.supplierId;
    return matchesSearch && matchesSupplier;
  });

  const handleExport = () => {
    const header = ["Firma", "Baslangic", "Bitis", "Komisyon (%)", "PDF"];
    const rows = filteredRecords.map((item) => [
      item.supplierName || "",
      item.startDate || "",
      item.endDate || "",
      Number(item.commissionRate || 0).toFixed(2),
      item.pdfName || "",
    ]);
    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sozlesmeler.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      title: "Firma",
      dataIndex: "supplierName",
      key: "supplierName",
      sorter: (a, b) => String(a.supplierName || "").localeCompare(String(b.supplierName || ""), "tr"),
    },
    {
      title: "Baslangic",
      dataIndex: "startDate",
      key: "startDate",
      sorter: (a, b) => String(a.startDate || "").localeCompare(String(b.startDate || ""), "tr"),
      render: (value) => (value ? dayjs(value).format("DD.MM.YYYY") : "-"),
    },
    {
      title: "Bitis",
      dataIndex: "endDate",
      key: "endDate",
      sorter: (a, b) => String(a.endDate || "").localeCompare(String(b.endDate || ""), "tr"),
      render: (value) => (value ? dayjs(value).format("DD.MM.YYYY") : "-"),
    },
    {
      title: "Komisyon (%)",
      dataIndex: "commissionRate",
      key: "commissionRate",
      sorter: (a, b) => Number(a.commissionRate || 0) - Number(b.commissionRate || 0),
      render: (value) => `${Number(value || 0).toFixed(2)}%`,
    },
    {
      title: "PDF",
      dataIndex: "pdfName",
      key: "pdfName",
      render: (_, record) =>
        record.pdfDataUrl ? (
          <Space>
            <Text>{record.pdfName || "Sozlesme.pdf"}</Text>
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                setActivePdf(record);
                setPdfModalOpen(true);
              }}
            >
              Ac
            </Button>
          </Space>
        ) : (
          "-"
        ),
    },
    {
      title: "Islemler",
      key: "actions",
      render: (_, record) => (
        <Space size={8}>
          <Button
            type="text"
            className="erp-icon-btn erp-icon-btn-edit"
            icon={<EditOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              openEditModal(record);
            }}
          />
          <Popconfirm title="Sozlesme silinsin mi?" okText="Sil" cancelText="Vazgec" onConfirm={() => handleDelete(record.id)}>
            <span onClick={preventRowClick}>
              <Button type="text" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} />
            </span>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Sozlesmeler</Title>
          <Text type="secondary">Konsinye urun alim sozlesmeleri firma, tarih araligi ve komisyon orani ile takip edilir.</Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>Sozlesme Ekle</Button>
        </Space>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar erp-product-toolbar-single">
          <Space wrap className="erp-product-toolbar-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>Yeni Sozlesme</Button>
            <Button icon={<ReloadOutlined />} onClick={() => { refreshRecords(); message.success("Sozlesmeler yenilendi."); }}>Yenile</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          </Space>

          <div className="erp-product-toolbar-search">
            <Input
              prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
              placeholder="Firma"
              value={filters.search}
              onChange={(event) => handleFilterChange("search", event.target.value)}
              allowClear
            />
            <Button icon={<FilterOutlined />} onClick={() => setFilterModalOpen(true)} />
          </div>
        </div>
      </Card>

      <Card title="Tum Sozlesmeler" className="erp-list-table-card">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredRecords}
          pagination={false}
          locale={{ emptyText: "Henuz sozlesme kaydi bulunmuyor." }}
          onRow={(record) => ({
            onClick: () => openEditModal(record),
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
            <span>1 - {filteredRecords.length} / {filteredRecords.length}</span>
            <span>Sayfa 1 / 1</span>
          </Space>
        </div>
      </Card>

      <Modal title="Gelismis Filtreler" open={filterModalOpen} onCancel={() => setFilterModalOpen(false)} footer={null}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={[12, 12]}>
            <Col span={24}>
              <Form.Item label="Firma">
                <Select
                  value={filters.supplierId}
                  onChange={(value) => handleFilterChange("supplierId", value)}
                  options={[{ value: "all", label: "Tumu" }, ...supplierOptions]}
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Button onClick={handleResetFilters}>Filtreleri Temizle</Button>
            <Button type="primary" onClick={() => setFilterModalOpen(false)}>Uygula</Button>
          </Space>
        </Space>
      </Modal>

      <Modal
        title={activeRecord ? "Sozlesme Duzenle" : "Yeni Sozlesme"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setActiveRecord(null);
          setUploadedPdf({ pdfName: "", pdfDataUrl: "" });
        }}
        onOk={handleSubmit}
        okText={activeRecord ? "Guncelle" : "Kaydet"}
        cancelText="Vazgec"
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="supplierId"
            label="Ilgili Firma"
            rules={[{ required: true, message: "Firma secin." }]}
          >
            <Select
              placeholder="Firma secin"
              options={supplierOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="startDate"
                label="Sozlesme Baslangic Tarihi"
                rules={[{ required: true, message: "Baslangic tarihi secin." }]}
              >
                <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endDate"
                label="Sozlesme Bitis Tarihi"
                rules={[{ required: true, message: "Bitis tarihi secin." }]}
              >
                <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="commissionRate"
            label="Komisyon Orani (%)"
            rules={[{ required: true, message: "Komisyon orani girin." }]}
          >
            <InputNumber style={{ width: "100%" }} min={0} max={100} step={0.01} precision={2} />
          </Form.Item>
          <Form.Item label="Sozlesme PDF Yukleme" required>
            <Space direction="vertical" size={6} style={{ width: "100%" }}>
              <input type="file" accept="application/pdf" onChange={handlePdfFileChange} />
              <Text type="secondary">
                {uploadedPdf.pdfName ? `Yuklenen dosya: ${uploadedPdf.pdfName}` : "PDF dosyasi secilmedi."}
              </Text>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={activePdf?.pdfName || "Sozlesme PDF"}
        open={pdfModalOpen}
        onCancel={() => setPdfModalOpen(false)}
        footer={null}
        width={960}
      >
        {activePdf?.pdfDataUrl ? (
          <object data={activePdf.pdfDataUrl} type="application/pdf" width="100%" height="640">
            <a href={activePdf.pdfDataUrl} target="_blank" rel="noreferrer">PDF dosyasini yeni sekmede ac</a>
          </object>
        ) : (
          <Text>PDF bulunamadi.</Text>
        )}
      </Modal>
    </Space>
  );
}

export function PurchaseListPage() {
  const navigate = useNavigate();
  const SAVED_FILTERS_KEY = "sibella.erp.purchaseFilters.v1";
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedPurchase, setSelectedPurchase] = React.useState(null);
  const [purchases, setPurchases] = React.useState(() => listPurchases());
  const [filters, setFilters] = React.useState({
    search: "",
    supplierId: undefined,
    procurementTypeId: undefined,
    paymentTermId: undefined,
  });
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [savedFilterName, setSavedFilterName] = React.useState("");
  const [savedFilters, setSavedFilters] = React.useState(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      return JSON.parse(window.localStorage.getItem(SAVED_FILTERS_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const supplierOptions = [{ value: "all", label: "Tumu" }, ...listSuppliers().map((item) => ({ value: item.id, label: item.company }))];
  const procurementOptions = [{ value: "all", label: "Tumu" }, ...listMasterData("procurement-types").map((item) => ({ value: item.id, label: item.name }))];
  const paymentOptions = [{ value: "all", label: "Tumu" }, ...listMasterData("payment-terms").map((item) => ({ value: item.id, label: item.name }))];

  const refreshPurchases = () => setPurchases(listPurchases());

  const persistSavedFilters = (nextSavedFilters) => {
    setSavedFilters(nextSavedFilters);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(nextSavedFilters));
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      supplierId: undefined,
      procurementTypeId: undefined,
      paymentTermId: undefined,
    });
  };

  const handleSaveFilterPreset = () => {
    if (!savedFilterName.trim()) {
      message.warning("Filtre adini girin.");
      return;
    }

    const nextSavedFilters = [
      { name: savedFilterName.trim(), filters },
      ...savedFilters.filter((item) => item.name !== savedFilterName.trim()),
    ];
    persistSavedFilters(nextSavedFilters);
    setSavedFilterName("");
    message.success("Filtre kaydedildi.");
  };

  const applySavedFilter = (savedFilter) => {
    setFilters(savedFilter.filters);
    setFilterModalOpen(false);
    message.success(`${savedFilter.name} filtresi uygulandi.`);
  };

  const filteredPurchases = purchases.filter((purchase) => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      [purchase.documentNo, purchase.supplierName, purchase.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    const matchesSupplier = !filters.supplierId || filters.supplierId === "all" || purchase.supplierId === filters.supplierId;
    const matchesProcurement = !filters.procurementTypeId || filters.procurementTypeId === "all" || purchase.procurementTypeId === filters.procurementTypeId;
    const matchesPayment = !filters.paymentTermId || filters.paymentTermId === "all" || purchase.paymentTermId === filters.paymentTermId;
    return matchesSearch && matchesSupplier && matchesProcurement && matchesPayment;
  });

  const handleExport = () => {
    const header = ["Belge No", "Tarih", "Tedarikci", "Tedarik Tipi", "Odeme Kosulu", "Kalem", "Toplam"];
    const rows = filteredPurchases.map((item) => [
      item.documentNo,
      item.date,
      item.supplierName,
      item.procurementTypeLabel,
      item.paymentTermLabel,
      item.lineCount,
      item.totalAmountDisplay,
    ]);
    const csvContent = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "satinalma-listesi.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      title: "Belge No",
      dataIndex: "documentNo",
      key: "documentNo",
      sorter: (a, b) => a.documentNo.localeCompare(b.documentNo, "tr"),
      render: (value, record) => (
        <button
          type="button"
          className="erp-link-button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/purchasing/entry/${record.id}`);
          }}
        >
          {value}
        </button>
      ),
    },
    { title: "Tarih", dataIndex: "date", key: "date", sorter: (a, b) => a.date.localeCompare(b.date, "tr") },
    { title: "Tedarikci", dataIndex: "supplierName", key: "supplierName", sorter: (a, b) => a.supplierName.localeCompare(b.supplierName, "tr") },
    { title: "Tedarik Tipi", dataIndex: "procurementTypeLabel", key: "procurementTypeLabel", sorter: (a, b) => a.procurementTypeLabel.localeCompare(b.procurementTypeLabel, "tr") },
    { title: "Odeme Kosulu", dataIndex: "paymentTermLabel", key: "paymentTermLabel", sorter: (a, b) => a.paymentTermLabel.localeCompare(b.paymentTermLabel, "tr") },
    { title: "Kalem", dataIndex: "lineCount", key: "lineCount", sorter: (a, b) => a.lineCount - b.lineCount },
    { title: "Toplam", dataIndex: "totalAmountDisplay", key: "totalAmountDisplay", sorter: (a, b) => a.totalAmount - b.totalAmount },
    {
      title: "Islemler",
      key: "actions",
      render: (_, record) => (
        <Space size={8}>
          <Button
            type="text"
            className="erp-icon-btn erp-icon-btn-edit"
            icon={<EditOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/purchasing/entry/${record.id}`);
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Satinalma Listesi</Title>
          <Text type="secondary">Gecmis satin alma kayitlari tedarikci, belge ve toplam tutar ile listelenir.</Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/purchasing/entry")}>Satinalma Giris</Button>
        </Space>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar erp-product-toolbar-single">
          <Space wrap className="erp-product-toolbar-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/purchasing/entry")}>Yeni Satinalma</Button>
            <Button icon={<SearchOutlined />} onClick={() => message.info(`${filteredPurchases.length} kayit listeleniyor.`)}>Ara</Button>
            <Button icon={<DeleteOutlined />} onClick={handleResetFilters}>Temizle</Button>
            <Button icon={<ReloadOutlined />} onClick={() => { refreshPurchases(); message.success("Satinalma listesi yenilendi."); }}>Yenile</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          </Space>
          <div className="erp-product-toolbar-search">
            <Input
              prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
              placeholder="Belge No"
              value={filters.search}
              onChange={(event) => handleFilterChange("search", event.target.value)}
              allowClear
            />
            <Button icon={<FilterOutlined />} onClick={() => setFilterModalOpen(true)} />
          </div>
        </div>
      </Card>

      <Card title="Tum Satinalma Kayitlari" className="erp-list-table-card">
        <Table
          columns={columns}
          dataSource={filteredPurchases.map((purchase) => ({ key: purchase.id, ...purchase }))}
          pagination={false}
          onRow={(record) => ({
            onClick: () => openDetailFromRow(setSelectedPurchase, setDetailOpen, record),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
        <div className="erp-table-footer">
          <Space>
            <span>Sayfa Boyutu:</span>
            <Select defaultValue="100" size="small" style={{ width: 84 }} options={["25", "50", "100"].map((value) => ({ value, label: value }))} />
          </Space>
          <Space size={18}>
            <span>1 - {filteredPurchases.length} / {filteredPurchases.length}</span>
            <span>Sayfa 1 / 1</span>
          </Space>
        </div>
      </Card>

      <Drawer title="Satinalma Detayi" placement="right" width={460} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {selectedPurchase ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Belge No">{selectedPurchase.documentNo}</Descriptions.Item>
              <Descriptions.Item label="Tarih">{selectedPurchase.date}</Descriptions.Item>
              <Descriptions.Item label="Tedarikci">{selectedPurchase.supplierName}</Descriptions.Item>
              <Descriptions.Item label="Tedarik Tipi">{selectedPurchase.procurementTypeLabel}</Descriptions.Item>
              <Descriptions.Item label="Odeme Kosulu">{selectedPurchase.paymentTermLabel}</Descriptions.Item>
              <Descriptions.Item label="Toplam">{selectedPurchase.totalAmountDisplay}</Descriptions.Item>
              <Descriptions.Item label="Aciklama">{selectedPurchase.description || "-"}</Descriptions.Item>
            </Descriptions>
            <Card size="small" title="Kalemler">
              <Table
                rowKey="id"
                pagination={false}
                columns={[
                  { title: "Urun", dataIndex: "productName", key: "productName" },
                  { title: "Miktar", dataIndex: "quantity", key: "quantity" },
                  { title: "Birim Fiyat", dataIndex: "unitPriceDisplay", key: "unitPriceDisplay" },
                  { title: "Not", dataIndex: "note", key: "note" },
                ]}
                dataSource={selectedPurchase.lines}
                size="small"
              />
            </Card>
          </Space>
        ) : null}
      </Drawer>

      <Modal title="Gelismis Filtreler" open={filterModalOpen} onCancel={() => setFilterModalOpen(false)} footer={null}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={[12, 12]}>
            <Col span={24}>
              <Form.Item label="Tedarikci">
                <Select value={filters.supplierId} onChange={(value) => handleFilterChange("supplierId", value)} options={supplierOptions} allowClear />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Tedarik Tipi">
                <Select value={filters.procurementTypeId} onChange={(value) => handleFilterChange("procurementTypeId", value)} options={procurementOptions} allowClear />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Odeme Kosulu">
                <Select value={filters.paymentTermId} onChange={(value) => handleFilterChange("paymentTermId", value)} options={paymentOptions} allowClear />
              </Form.Item>
            </Col>
          </Row>
          <Card size="small" title="Filtreyi Kaydet">
            <Space.Compact style={{ width: "100%" }}>
              <Input value={savedFilterName} onChange={(event) => setSavedFilterName(event.target.value)} placeholder="Filtre adi" />
              <Button type="primary" onClick={handleSaveFilterPreset}>Kaydet</Button>
            </Space.Compact>
          </Card>
          <Card size="small" title="Kayitli Filtreler">
            <Space wrap>
              {savedFilters.length === 0 ? <Text type="secondary">Henuz kayitli filtre yok.</Text> : null}
              {savedFilters.map((item) => (
                <Button key={item.name} onClick={() => applySavedFilter(item)}>{item.name}</Button>
              ))}
            </Space>
          </Card>
          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Button onClick={handleResetFilters}>Filtreleri Temizle</Button>
            <Button type="primary" onClick={() => setFilterModalOpen(false)}>Uygula</Button>
          </Space>
        </Space>
      </Modal>
    </Space>
  );
}

export function PurchaseEditorPage() {
  const navigate = useNavigate();
  const { purchaseId } = useParams();
  const isEditMode = Boolean(purchaseId);
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const supplierOptions = listSuppliers().map((item) => ({ value: item.id, label: item.company }));
  const procurementOptions = listMasterData("procurement-types").map((item) => ({ value: item.id, label: item.name }));
  const paymentOptions = listMasterData("payment-terms").map((item) => ({ value: item.id, label: item.name }));
  const productOptions = listProducts().map((item) => ({
    value: item.id,
    label: `${item.code} - ${item.name}`,
    searchText: `${item.code} ${item.name} ${item.categoryLabel}`.toLowerCase(),
  }));

  React.useEffect(() => {
    const baseValues = {
      documentNo: `SAT-${new Date().getFullYear()}-${String(listPurchases().length + 1).padStart(3, "0")}`,
      supplierId: undefined,
      date: new Date().toISOString().slice(0, 10),
      procurementTypeId: undefined,
      paymentTermId: undefined,
      description: "",
      lines: [{ productId: undefined, quantity: 1, unitPrice: 0, note: "" }],
    };

    if (!isEditMode) {
      form.setFieldsValue(baseValues);
      return;
    }

    const purchase = getPurchaseById(purchaseId);
    if (!purchase) {
      message.error("Satinalma kaydi bulunamadi.");
      navigate("/purchasing/list");
      return;
    }

    form.setFieldsValue({
      ...baseValues,
      ...purchase,
      lines: purchase.lines?.length ? purchase.lines : baseValues.lines,
    });
  }, [form, isEditMode, navigate, purchaseId]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      const savedPurchase = isEditMode ? updatePurchase(purchaseId, values) : createPurchase(values);
      message.success(isEditMode ? "Satinalma guncellendi." : "Satinalma kaydedildi.");
      navigate(`/purchasing/entry/${savedPurchase.id}`);
    } catch {
      // form validation handles errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>{isEditMode ? "Satinalma Duzenle" : "Satinalma Giris"}</Title>
          <Text type="secondary">Tedarikci, belge ve urun satirlari ile satin alma kaydi acilir.</Text>
        </div>
        <Space>
          <Button onClick={() => navigate("/purchasing/list")}>Listeye Don</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>Kaydet</Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <div className="erp-form-stack">
          <Card title="Genel Bilgiler">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}><Form.Item name="supplierId" label="Tedarikci" rules={[{ required: true, message: "Tedarikci seciniz." }]}><Select options={supplierOptions} showSearch optionFilterProp="label" placeholder="Tedarikci seciniz" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="date" label="Tarih" rules={[{ required: true, message: "Tarih zorunludur." }]}><Input type="date" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="documentNo" label="Belge No" rules={[{ required: true, message: "Belge no zorunludur." }]}><Input placeholder="SAT-2026-001" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="procurementTypeId" label="Tedarik Tipi"><Select options={procurementOptions} placeholder="Seciniz" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="paymentTermId" label="Odeme Kosulu"><Select options={paymentOptions} placeholder="Seciniz" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="description" label="Aciklama"><Input placeholder="Aciklama" /></Form.Item></Col>
            </Row>
          </Card>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <Card title="Satinalma Kalemleri" extra={<Button icon={<PlusOutlined />} onClick={() => add({ productId: undefined, quantity: 1, unitPrice: 0, note: "" })}>Satir Ekle</Button>}>
                <Table
                  rowKey="key"
                  pagination={false}
                  dataSource={fields.map((field) => ({ key: field.key, field }))}
                  columns={[
                    {
                      title: "Urun",
                      dataIndex: "product",
                      key: "product",
                      render: (_, record) => (
                        <Form.Item name={[record.field.name, "productId"]} rules={[{ required: true, message: "Urun seciniz." }]}>
                          <Select
                            showSearch
                            placeholder="Urun seciniz"
                            options={productOptions}
                            optionFilterProp="label"
                            filterOption={(input, option) => {
                              const label = String(option?.label || "").toLowerCase();
                              return label.includes(input.toLowerCase());
                            }}
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "Miktar",
                      key: "quantity",
                      render: (_, record) => (
                        <Form.Item name={[record.field.name, "quantity"]} rules={[{ required: true, message: "Miktar girin." }]}>
                          <InputNumber min={1} style={{ width: "100%" }} />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "Birim Fiyat",
                      key: "unitPrice",
                      render: (_, record) => (
                        <Form.Item name={[record.field.name, "unitPrice"]} rules={[{ required: true, message: "Birim fiyat girin." }]}>
                          <InputNumber min={0} style={{ width: "100%" }} />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "Not",
                      key: "note",
                      render: (_, record) => (
                        <Form.Item name={[record.field.name, "note"]}>
                          <Input placeholder="Satir notu" />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "Islemler",
                      key: "actions",
                      width: 110,
                      render: (_, record) => (
                        <Button type="text" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} onClick={() => remove(record.field.name)} />
                      ),
                    },
                  ]}
                />
              </Card>
            )}
          </Form.List>
        </div>
      </Form>
    </Space>
  );
}

function formatMovementMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function buildStockMovements() {
  const purchaseMovements = listPurchases().flatMap((purchase) =>
    (purchase.lines || []).map((line) => ({
      id: `mov-pur-${purchase.id}-${line.id}`,
      movementType: "SATINALMA",
      movementTypeLabel: "Satinalma Girisi",
      direction: "IN",
      date: purchase.date,
      documentNo: purchase.documentNo,
      partyName: purchase.supplierName || "-",
      productId: line.productId,
      productCode: line.productCode || "-",
      productName: line.productName || "-",
      quantity: Number(line.quantity || 0),
      quantitySigned: Number(line.quantity || 0),
      quantitySignedDisplay: `+${Number(line.quantity || 0)}`,
      unitAmount: Number(line.unitPrice || 0),
      unitAmountDisplay: line.unitPriceDisplay || formatMovementMoney(line.unitPrice),
      totalAmount: Number(line.lineTotal || 0),
      totalAmountDisplay: line.lineTotalDisplay || formatMovementMoney(line.lineTotal),
      note: line.note || purchase.description || "",
      detailPath: "",
      sourceModule: "purchase",
      sourceId: purchase.id,
    })),
  );

  const stockEntryMovements = listStockEntries().flatMap((entry) =>
    (entry.lines || []).map((line) => ({
      id: `mov-stk-${entry.id}-${line.id}`,
      movementType: entry.sourceType === "Sayim Duzeltme" ? "STOK_DUZELTME" : "STOK_GIRIS",
      movementTypeLabel: entry.sourceType === "Sayim Duzeltme" ? "Stok Duzeltme" : "Stok Girisi",
      direction: "IN",
      date: entry.date,
      documentNo: entry.documentNo,
      partyName: entry.sourcePartyName || entry.sourceType || "-",
      productId: line.productId,
      productCode: line.productCode || "-",
      productName: line.productName || "-",
      quantity: Number(line.quantity || 0),
      quantitySigned: Number(line.quantity || 0),
      quantitySignedDisplay: `+${Number(line.quantity || 0)}`,
      unitAmount: Number(line.unitCost || 0),
      unitAmountDisplay: line.unitCostDisplay || formatMovementMoney(line.unitCost),
      totalAmount: Number(line.lineTotal || 0),
      totalAmountDisplay: line.lineTotalDisplay || formatMovementMoney(line.lineTotal),
      note: line.note || entry.note || "",
      detailPath: `/stock/entry/${entry.id}`,
      sourceModule: "stock-entry",
      sourceId: entry.id,
    })),
  );

  return [...purchaseMovements, ...stockEntryMovements].sort((a, b) => {
    const dateCompare = String(b.date || "").localeCompare(String(a.date || ""), "tr");
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return String(b.documentNo || "").localeCompare(String(a.documentNo || ""), "tr");
  });
}

export function StockListPage() {
  const navigate = useNavigate();
  const SAVED_FILTERS_KEY = "sibella.erp.stockMovementFilters.v1";
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedMovement, setSelectedMovement] = React.useState(null);
  const [movements, setMovements] = React.useState(() => buildStockMovements());
  const [filters, setFilters] = React.useState({
    search: "",
    movementType: undefined,
    productId: undefined,
  });
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [savedFilterName, setSavedFilterName] = React.useState("");
  const [savedFilters, setSavedFilters] = React.useState(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      return JSON.parse(window.localStorage.getItem(SAVED_FILTERS_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const movementTypeOptions = [
    { value: "all", label: "Tumu" },
    { value: "SATINALMA", label: "Satinalma Girisi" },
    { value: "STOK_GIRIS", label: "Stok Girisi" },
    { value: "SATIS_CIKIS", label: "Satis Cikisi" },
    { value: "STOK_DUZELTME", label: "Stok Duzeltme" },
  ];
  const productOptions = [{ value: "all", label: "Tumu" }, ...listProducts().map((item) => ({
    value: item.id,
    label: `${item.code} - ${item.name}`,
  }))];

  const refreshMovements = () => setMovements(buildStockMovements());
  const openDetailPath = (detailPath) => {
    if (!detailPath) {
      message.info("Bu hareket tipi icin detay ekrani bulunmuyor.");
      return;
    }
    navigate(detailPath);
  };

  const persistSavedFilters = (nextSavedFilters) => {
    setSavedFilters(nextSavedFilters);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(nextSavedFilters));
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      movementType: undefined,
      productId: undefined,
    });
  };

  const handleSaveFilterPreset = () => {
    if (!savedFilterName.trim()) {
      message.warning("Filtre adini girin.");
      return;
    }

    const nextSavedFilters = [
      { name: savedFilterName.trim(), filters },
      ...savedFilters.filter((item) => item.name !== savedFilterName.trim()),
    ];
    persistSavedFilters(nextSavedFilters);
    setSavedFilterName("");
    message.success("Filtre kaydedildi.");
  };

  const applySavedFilter = (savedFilter) => {
    setFilters(savedFilter.filters);
    setFilterModalOpen(false);
    message.success(`${savedFilter.name} filtresi uygulandi.`);
  };

  const filteredMovements = movements.filter((item) => {
      const normalizedSearch = filters.search.trim().toLowerCase();
      const matchesSearch =
        !normalizedSearch ||
        [item.documentNo, item.partyName, item.productCode, item.productName, item.note, item.movementTypeLabel]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      const matchesMovementType = !filters.movementType || filters.movementType === "all" || item.movementType === filters.movementType;
      const matchesProduct = !filters.productId || filters.productId === "all" || item.productId === filters.productId;
      return matchesSearch && matchesMovementType && matchesProduct;
    });

  const handleExport = () => {
    const header = ["Tarih", "Hareket Tipi", "Belge No", "Kaynak", "Urun", "Miktar", "Birim Maliyet", "Toplam", "Not"];
    const rows = filteredMovements.map((item) => [
      item.date,
      item.movementTypeLabel,
      item.documentNo,
      item.partyName,
      `${item.productCode} - ${item.productName}`,
      item.quantitySignedDisplay,
      item.unitAmountDisplay,
      item.totalAmountDisplay,
      item.note,
    ]);
    const csvContent = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stok-hareketleri.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      title: "Tarih",
      dataIndex: "date",
      key: "date",
      sorter: (a, b) => a.date.localeCompare(b.date, "tr"),
    },
    {
      title: "Hareket Tipi",
      dataIndex: "movementTypeLabel",
      key: "movementTypeLabel",
      sorter: (a, b) => a.movementTypeLabel.localeCompare(b.movementTypeLabel, "tr"),
      render: (value, record) => {
        const color = record.direction === "IN" ? "green" : "red";
        return <Tag color={color}>{value}</Tag>;
      },
    },
    {
      title: "Belge No",
      dataIndex: "documentNo",
      key: "documentNo",
      sorter: (a, b) => a.documentNo.localeCompare(b.documentNo, "tr"),
      render: (value, record) => (
        <button
          type="button"
          className="erp-link-button"
          onClick={(event) => {
            event.stopPropagation();
            openDetailPath(record.detailPath);
          }}
        >
          {value}
        </button>
      ),
    },
    { title: "Kaynak", dataIndex: "partyName", key: "partyName", sorter: (a, b) => a.partyName.localeCompare(b.partyName, "tr") },
    {
      title: "Urun",
      dataIndex: "productName",
      key: "productName",
      sorter: (a, b) => a.productName.localeCompare(b.productName, "tr"),
      render: (value, record) => `${record.productCode} - ${value}`,
    },
    {
      title: "Miktar",
      dataIndex: "quantitySigned",
      key: "quantitySigned",
      sorter: (a, b) => a.quantitySigned - b.quantitySigned,
      render: (_, record) => <Tag color={record.direction === "IN" ? "blue" : "volcano"}>{record.quantitySignedDisplay}</Tag>,
    },
    { title: "Birim Maliyet", dataIndex: "unitAmountDisplay", key: "unitAmountDisplay", sorter: (a, b) => a.unitAmount - b.unitAmount },
    {
      title: "Toplam",
      dataIndex: "totalAmountDisplay",
      key: "totalAmountDisplay",
      sorter: (a, b) => a.totalAmount - b.totalAmount,
    },
    {
      title: "Islemler",
      key: "actions",
      render: (_, record) => (
        <Space size={8}>
          <Button
            type="text"
            className="erp-icon-btn erp-icon-btn-edit"
            icon={<EditOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              openDetailPath(record.detailPath);
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Stok Hareketleri</Title>
          <Text type="secondary">Satinalma girisleri, stok girisleri, satis cikislari ve duzeltme hareketleri tarih bazli listelenir.</Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/stock/entry")}>Stok Giris</Button>
        </Space>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar erp-product-toolbar-single">
          <Space wrap className="erp-product-toolbar-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/stock/entry")}>Yeni Stok Girisi</Button>
            <Button icon={<SearchOutlined />} onClick={() => message.info(`${filteredMovements.length} hareket listeleniyor.`)}>Ara</Button>
            <Button icon={<DeleteOutlined />} onClick={handleResetFilters}>Temizle</Button>
            <Button icon={<ReloadOutlined />} onClick={() => { refreshMovements(); message.success("Stok hareketleri yenilendi."); }}>Yenile</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          </Space>
          <div className="erp-product-toolbar-search">
            <Input
              prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
              placeholder="Belge No"
              value={filters.search}
              onChange={(event) => handleFilterChange("search", event.target.value)}
              allowClear
            />
            <Button icon={<FilterOutlined />} onClick={() => setFilterModalOpen(true)} />
          </div>
        </div>
      </Card>

      <Card title="Tum Stok Hareketleri" className="erp-list-table-card">
        <Table
          columns={columns}
          dataSource={filteredMovements.map((item) => ({ key: item.id, ...item }))}
          pagination={false}
          onRow={(record) => ({
            onClick: () => openDetailFromRow(setSelectedMovement, setDetailOpen, record),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
        <div className="erp-table-footer">
          <Space>
            <span>Sayfa Boyutu:</span>
            <Select defaultValue="100" size="small" style={{ width: 84 }} options={["25", "50", "100"].map((value) => ({ value, label: value }))} />
          </Space>
          <Space size={18}>
            <span>1 - {filteredMovements.length} / {filteredMovements.length}</span>
            <span>Sayfa 1 / 1</span>
          </Space>
        </div>
      </Card>

      <Drawer title="Stok Hareket Detayi" placement="right" width={460} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {selectedMovement ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Tarih">{selectedMovement.date}</Descriptions.Item>
            <Descriptions.Item label="Hareket Tipi">{selectedMovement.movementTypeLabel}</Descriptions.Item>
            <Descriptions.Item label="Belge No">{selectedMovement.documentNo}</Descriptions.Item>
            <Descriptions.Item label="Kaynak">{selectedMovement.partyName}</Descriptions.Item>
            <Descriptions.Item label="Urun">{selectedMovement.productCode} - {selectedMovement.productName}</Descriptions.Item>
            <Descriptions.Item label="Miktar">{selectedMovement.quantitySignedDisplay}</Descriptions.Item>
            <Descriptions.Item label="Birim Maliyet">{selectedMovement.unitAmountDisplay}</Descriptions.Item>
            <Descriptions.Item label="Toplam">{selectedMovement.totalAmountDisplay}</Descriptions.Item>
            <Descriptions.Item label="Not">{selectedMovement.note || "-"}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>

      <Modal title="Gelismis Filtreler" open={filterModalOpen} onCancel={() => setFilterModalOpen(false)} footer={null}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={[12, 12]}>
            <Col span={24}>
              <Form.Item label="Hareket Tipi">
                <Select value={filters.movementType} onChange={(value) => handleFilterChange("movementType", value)} options={movementTypeOptions} allowClear />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Urun">
                <Select
                  value={filters.productId}
                  onChange={(value) => handleFilterChange("productId", value)}
                  options={productOptions}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" title="Filtreyi Kaydet">
            <Space.Compact style={{ width: "100%" }}>
              <Input placeholder="Filtre adi" value={savedFilterName} onChange={(event) => setSavedFilterName(event.target.value)} />
              <Button type="primary" onClick={handleSaveFilterPreset}>Kaydet</Button>
            </Space.Compact>
          </Card>

          <Card size="small" title="Kayitli Filtreler">
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              {savedFilters.length === 0 ? <Text type="secondary">Kayitli filtre bulunmuyor.</Text> : null}
              {savedFilters.map((item) => (
                <Button key={item.name} block onClick={() => applySavedFilter(item)}>
                  {item.name}
                </Button>
              ))}
            </Space>
          </Card>
        </Space>
      </Modal>
    </Space>
  );
}

export function PosSessionsPage() {
  const navigate = useNavigate();
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedSession, setSelectedSession] = React.useState(null);
  const [sessions, setSessions] = React.useState(() => listPosSessions());
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [form] = Form.useForm();

  const refreshSessions = () => setSessions(listPosSessions());

  const handleCreateSession = async () => {
    try {
      const values = await form.validateFields();
      createPosSession(values);
      form.resetFields();
      setCreateModalOpen(false);
      refreshSessions();
      message.success("POS oturumu açıldı.");
    } catch {
      // validation handled by form
    }
  };

  const handleCloseSession = (sessionId) => {
    closePosSession(sessionId);
    refreshSessions();
    message.success("POS oturumu kapatıldı.");
  };

  const columns = [
    {
      title: "Oturum No",
      dataIndex: "sessionNo",
      key: "sessionNo",
      sorter: (a, b) => a.sessionNo.localeCompare(b.sessionNo, "tr"),
      render: (value, record) => (
        <button
          type="button"
          className="erp-link-button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/pos/store?session=${record.id}`);
          }}
        >
          {value}
        </button>
      ),
    },
    { title: "Kasa", dataIndex: "registerName", key: "registerName", sorter: (a, b) => a.registerName.localeCompare(b.registerName, "tr") },
    { title: "Kasiyer", dataIndex: "cashierName", key: "cashierName", sorter: (a, b) => a.cashierName.localeCompare(b.cashierName, "tr") },
    { title: "Açılış", dataIndex: "openedAt", key: "openedAt", sorter: (a, b) => a.openedAt.localeCompare(b.openedAt, "tr"), render: (value) => new Date(value).toLocaleString("tr-TR") },
    { title: "Açılış Bakiye", dataIndex: "openingBalanceDisplay", key: "openingBalanceDisplay", sorter: (a, b) => a.openingBalance - b.openingBalance },
    { title: "Satış", dataIndex: "totalSalesDisplay", key: "totalSalesDisplay", sorter: (a, b) => a.totalSales - b.totalSales },
    { title: "Fiş", dataIndex: "salesCount", key: "salesCount", sorter: (a, b) => a.salesCount - b.salesCount },
    { title: "Durum", dataIndex: "status", key: "status", sorter: (a, b) => a.status.localeCompare(b.status, "tr"), render: (value) => <Tag color={value === "Açık" ? "green" : "default"}>{value}</Tag> },
    {
      title: "İşlemler",
      key: "actions",
      render: (_, record) => (
        <Space size={8}>
          <Button
            type="text"
            className="erp-icon-btn erp-icon-btn-edit"
            icon={<EditOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/pos/store?session=${record.id}`);
            }}
          />
          {record.status === "Açık" ? (
            <Popconfirm title="Oturum kapatılsın mı?" okText="Kapat" cancelText="Vazgeç" onConfirm={() => handleCloseSession(record.id)}>
              <span onClick={preventRowClick}>
                <Button type="text" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} />
              </span>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>POS Oturumları</Title>
          <Text type="secondary">Açılan kasa oturumları, satış toplamları ve açık/kapalı durumları burada tutulur.</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { refreshSessions(); message.success("Oturumlar yenilendi."); }}>Yenile</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>Oturum Aç</Button>
        </Space>
      </div>

      <Card title="POS Oturum Listesi" className="erp-list-table-card">
        <Table
          columns={columns}
          dataSource={sessions.map((item) => ({ key: item.id, ...item }))}
          pagination={false}
          onRow={(record) => ({
            onClick: () => openDetailFromRow(setSelectedSession, setDetailOpen, record),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
        <div className="erp-table-footer">
          <Space>
            <span>Sayfa Boyutu:</span>
            <Select defaultValue="100" size="small" style={{ width: 84 }} options={["25", "50", "100"].map((value) => ({ value, label: value }))} />
          </Space>
          <Space size={18}>
            <span>1 - {sessions.length} / {sessions.length}</span>
            <span>Sayfa 1 / 1</span>
          </Space>
        </div>
      </Card>

      <Drawer title="Oturum Detayı" placement="right" width={520} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {selectedSession ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Oturum No">{selectedSession.sessionNo}</Descriptions.Item>
              <Descriptions.Item label="Kasa">{selectedSession.registerName}</Descriptions.Item>
              <Descriptions.Item label="Kasiyer">{selectedSession.cashierName}</Descriptions.Item>
              <Descriptions.Item label="Açılış">{new Date(selectedSession.openedAt).toLocaleString("tr-TR")}</Descriptions.Item>
              <Descriptions.Item label="Kapanış">{selectedSession.closedAt ? new Date(selectedSession.closedAt).toLocaleString("tr-TR") : "-"}</Descriptions.Item>
              <Descriptions.Item label="Açılış Bakiye">{selectedSession.openingBalanceDisplay}</Descriptions.Item>
              <Descriptions.Item label="Satış">{selectedSession.totalSalesDisplay}</Descriptions.Item>
              <Descriptions.Item label="Sipariş Adedi">{selectedSession.salesCount}</Descriptions.Item>
              <Descriptions.Item label="Durum">{selectedSession.status}</Descriptions.Item>
              <Descriptions.Item label="Not">{selectedSession.note || "-"}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Bu Oturuma Ait Siparişler">
              <Table
                rowKey="id"
                pagination={false}
                size="small"
                dataSource={listPosSales().filter((sale) => sale.sessionId === selectedSession.id)}
                columns={[
                  { title: "Fiş", dataIndex: "receiptNo", key: "receiptNo" },
                  { title: "Müşteri", dataIndex: "customerName", key: "customerName" },
                  { title: "Tarih", dataIndex: "soldAt", key: "soldAt", render: (value) => new Date(value).toLocaleString("tr-TR") },
                  { title: "Toplam", dataIndex: "grandTotalDisplay", key: "grandTotalDisplay" },
                ]}
              />
            </Card>
          </Space>
        ) : null}
      </Drawer>

      <Modal title="Yeni POS Oturumu" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={handleCreateSession} okText="Aç" cancelText="Vazgeç">
        <Form form={form} layout="vertical" initialValues={{ registerName: "Magaza Ana Kasa", cashierName: "Sibel Ersoy Arslan", openingBalance: 0 }}>
          <Row gutter={[12, 12]}>
            <Col span={24}>
              <Form.Item name="registerName" label="Kasa" rules={[{ required: true, message: "Kasa adı zorunludur." }]}>
                <Input placeholder="Magaza Ana Kasa" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="cashierName" label="Kasiyer" rules={[{ required: true, message: "Kasiyer adı zorunludur." }]}>
                <Input placeholder="Kasiyer adı" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="openingBalance" label="Açılış Bakiyesi">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="note" label="Not">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Space>
  );
}

export function PosScreenPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const DRAFT_STORAGE_KEY = "sibella.erp.posDraftOrders.v1";
  const [catalog, setCatalog] = React.useState(() => buildPosProductCatalog());
  const [sessions, setSessions] = React.useState(() => getOpenPosSessions());
  const [activeSessionId, setActiveSessionId] = React.useState(() => getOpenPosSessions()[0]?.id);
  const [orderDraftsBySession, setOrderDraftsBySession] = React.useState(() => {
    if (typeof window === "undefined") {
      return {};
    }

    try {
      return JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  });
  const [activeOrderIdBySession, setActiveOrderIdBySession] = React.useState({});
  const [search, setSearch] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState("all");
  const [paymentModalOpen, setPaymentModalOpen] = React.useState(false);
  const [openSessionModalOpen, setOpenSessionModalOpen] = React.useState(false);
  const [ordersDrawerOpen, setOrdersDrawerOpen] = React.useState(false);
  const [customerModalOpen, setCustomerModalOpen] = React.useState(false);
  const [noteModalOpen, setNoteModalOpen] = React.useState(false);
  const [discountModalOpen, setDiscountModalOpen] = React.useState(false);
  const [selectedCartLineId, setSelectedCartLineId] = React.useState(null);
  const [keypadMode, setKeypadMode] = React.useState("quantity");
  const [keypadInput, setKeypadInput] = React.useState("");
  const [sessionForm] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [customerForm] = Form.useForm();
  const [noteForm] = Form.useForm();
  const [discountForm] = Form.useForm();
  const [barcodeValue, setBarcodeValue] = React.useState("");

  const persistDraftOrders = React.useCallback((nextValue) => {
    setOrderDraftsBySession(nextValue);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(nextValue));
    }
  }, []);

  const buildEmptyOrder = React.useCallback((sessionId, index = 1) => ({
    id: `draft-${sessionId}-${Date.now()}-${index}`,
    title: `${1000 + index}`,
    customerName: "",
    note: "",
    discountType: "amount",
    discountValue: 0,
    lines: [],
    status: "open",
    closedAt: null,
  }), []);

  React.useEffect(() => {
    if (!activeSessionId && sessions.length) {
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  React.useEffect(() => {
    const sessionIdFromQuery = new URLSearchParams(location.search).get("session");
    if (sessionIdFromQuery) {
      setActiveSessionId(sessionIdFromQuery);
    }
  }, [location.search]);

  React.useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    const existingOrders = orderDraftsBySession[activeSessionId];
    if (!existingOrders || existingOrders.length === 0) {
      const firstOrder = buildEmptyOrder(activeSessionId);
      persistDraftOrders({
        ...orderDraftsBySession,
        [activeSessionId]: [firstOrder],
      });
      setActiveOrderIdBySession((prev) => ({
        ...prev,
        [activeSessionId]: prev[activeSessionId] || firstOrder.id,
      }));
      return;
    }

    setActiveOrderIdBySession((prev) => {
      const currentActiveId = prev[activeSessionId];
      const currentStillOpen = existingOrders.some((item) => item.id === currentActiveId && item.status === "open");
      const firstOpenOrder = existingOrders.find((item) => item.status === "open");

      return {
        ...prev,
        [activeSessionId]: currentStillOpen ? currentActiveId : firstOpenOrder?.id,
      };
    });
  }, [activeSessionId, buildEmptyOrder, orderDraftsBySession, persistDraftOrders]);

  const refreshPosContext = React.useCallback(() => {
    setCatalog(buildPosProductCatalog());
    const nextSessions = getOpenPosSessions();
    setSessions(nextSessions);
    setActiveSessionId((prev) => prev || nextSessions[0]?.id);
  }, []);

  const activeSession = sessions.find((item) => item.id === activeSessionId);
  const draftOrders = orderDraftsBySession[activeSessionId] || [];
  const openDraftOrders = draftOrders.filter((item) => item.status === "open");
  const closedDraftOrders = draftOrders.filter((item) => item.status === "closed");
  const activeOrderId = activeOrderIdBySession[activeSessionId];
  const activeOrder = openDraftOrders.find((item) => item.id === activeOrderId) || openDraftOrders[0];
  const activeOrderLines = activeOrder?.lines;
  const cart = activeOrderLines || [];
  const sessionOrders = listPosSales().filter((sale) => sale.sessionId === activeSessionId);
  const posCategoryOptions = [
    { id: "all", name: "Tümü", color: "#fee89a" },
    ...listMasterData("pos-categories")
      .filter((item) => item.status === "Aktif")
      .map((item, index) => ({
        id: item.id,
        name: item.name,
        color: ["#fac898", "#f99aa0", "#ffd59e", "#b9edbe", "#ffe68f", "#b9ddff"][index % 6],
      })),
  ];

  const filteredCatalog = catalog.filter((product) => {
    const matchesSearch =
      !search.trim() ||
      [product.name, product.code, product.barcode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search.trim().toLowerCase()));
    const matchesCategory = activeCategory === "all" || product.posCategoryId === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const calculateOrderTotals = React.useCallback((order) => {
    const grossTotal = (order?.lines || []).reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    const discountType = order?.discountType || "amount";
    const discountValue = Number(order?.discountValue || 0);
    const discountAmount = discountType === "percent" ? (grossTotal * discountValue) / 100 : discountValue;
    const normalizedDiscountAmount = Math.min(Math.max(discountAmount, 0), grossTotal);
    const grandTotal = Math.max(grossTotal - normalizedDiscountAmount, 0);
    const subtotal = grandTotal / 1.2;
    const tax = grandTotal - subtotal;

    return {
      grossTotal,
      discountAmount: normalizedDiscountAmount,
      subtotal,
      tax,
      grandTotal,
    };
  }, []);

  const orderTotals = calculateOrderTotals(activeOrder);
  const cartTax = orderTotals.tax;
  const cartGrandTotal = orderTotals.grandTotal;

  React.useEffect(() => {
    const currentCart = activeOrderLines || [];

    if (!currentCart.length) {
      setSelectedCartLineId(null);
      setKeypadInput("");
      return;
    }

    if (!selectedCartLineId || !currentCart.some((item) => item.productId === selectedCartLineId)) {
      setSelectedCartLineId(currentCart[0].productId);
      setKeypadInput("");
    }
  }, [activeOrderLines, selectedCartLineId]);

  const updateActiveOrder = (updater) => {
    if (!activeSessionId || !activeOrder) {
      return;
    }

    const nextOrders = draftOrders.map((order) => (
      order.id === activeOrder.id ? updater(order) : order
    ));
    persistDraftOrders({
      ...orderDraftsBySession,
      [activeSessionId]: nextOrders,
    });
  };

  const createDraftOrder = (sessionIdOverride) => {
    const normalizedSessionId =
      typeof sessionIdOverride === "string"
        ? sessionIdOverride
        : activeSessionId;
    const targetSessionId = normalizedSessionId || activeSessionId;
    const targetOrders = orderDraftsBySession[targetSessionId] || [];

    if (!targetSessionId) {
      message.warning("Önce bir oturum açın.");
      return;
    }

    const nextOrder = buildEmptyOrder(targetSessionId, targetOrders.length + 1);
    const nextOrders = [...targetOrders, nextOrder];
    persistDraftOrders({
      ...orderDraftsBySession,
      [targetSessionId]: nextOrders,
    });
    setActiveOrderIdBySession((prev) => ({
      ...prev,
      [targetSessionId]: nextOrder.id,
    }));
    setOrdersDrawerOpen(false);
    message.success(`Yeni siparis acildi: ${nextOrder.title}`);
  };

  const removeOrderDraft = (orderId) => {
    if (!activeSessionId) {
      return;
    }

    const remainingOrders = draftOrders.filter((item) => item.id !== orderId);
    const nextOrders = remainingOrders.length > 0 ? remainingOrders : [buildEmptyOrder(activeSessionId)];
    persistDraftOrders({
      ...orderDraftsBySession,
      [activeSessionId]: nextOrders,
    });
    setActiveOrderIdBySession((prev) => ({
      ...prev,
      [activeSessionId]: nextOrders[0].id,
    }));
  };

  const closeActiveOrder = () => {
    if (!activeOrder) {
      message.warning("Kapatilacak siparis bulunmuyor.");
      return;
    }

    const nextOpenOrder = draftOrders.find((item) => item.id !== activeOrder.id && item.status === "open");

    updateActiveOrder((order) => ({
      ...order,
      status: "closed",
      closedAt: new Date().toISOString(),
    }));

    setActiveOrderIdBySession((prev) => ({
      ...prev,
      [activeSessionId]: nextOpenOrder?.id,
    }));
    message.success("Siparis kapatildi.");
  };

  const reopenDraftOrder = (orderId) => {
    if (!activeSessionId) {
      return;
    }

    const nextOrders = draftOrders.map((order) =>
      order.id === orderId
        ? {
            ...order,
            status: "open",
            closedAt: null,
          }
        : order,
    );

    persistDraftOrders({
      ...orderDraftsBySession,
      [activeSessionId]: nextOrders,
    });
    setActiveOrderIdBySession((prev) => ({
      ...prev,
      [activeSessionId]: orderId,
    }));
    setOrdersDrawerOpen(false);
  };

  const getOrderDisplayTitle = (order) => {
    if (!order) {
      return "Yeni Siparis";
    }

    return order.customerName?.trim()
      ? `${order.title} - ${order.customerName}`
      : `${order.title} Yeni Siparis`;
  };

  const addProductToCart = (product) => {
    if (!product || product.quantityAvailable <= 0) {
      message.warning("Seçilen ürün için stok bulunmuyor.");
      return;
    }

    updateActiveOrder((order) => {
      const existing = order.lines.find((item) => item.productId === product.id);
      if (existing) {
        return {
          ...order,
          lines: order.lines.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                lineTotal: (item.quantity + 1) * item.unitPrice,
              }
            : item,
          ),
        };
      }

      return {
        ...order,
        lines: [
          ...order.lines,
          {
          productId: product.id,
          code: product.code,
          name: product.name,
          quantity: 1,
          unitPrice: Number(product.salePrice || 0),
          lineTotal: Number(product.salePrice || 0),
          },
        ],
      };
    });
  };

  const handleBarcodeSubmit = () => {
    const product = findProductByBarcode(barcodeValue);
    if (!product) {
      message.warning("Barkoda ait ürün bulunamadı.");
      return;
    }

    addProductToCart(product);
    setBarcodeValue("");
  };

  const updateCartQuantity = (productId, delta) => {
    updateActiveOrder((order) => ({
      ...order,
      lines: order.lines
        .map((item) => {
          if (item.productId !== productId) {
            return item;
          }

          const nextQuantity = item.quantity + delta;
          if (nextQuantity <= 0) {
            return null;
          }

          return {
            ...item,
            quantity: nextQuantity,
            lineTotal: nextQuantity * item.unitPrice,
          };
        })
        .filter(Boolean),
    }));
  };

  const updateCartLineValue = (productId, nextValue, mode = "quantity") => {
    updateActiveOrder((order) => ({
      ...order,
      lines: order.lines
        .map((item) => {
          if (item.productId !== productId) {
            return item;
          }

          if (mode === "price") {
            const unitPrice = Number(nextValue || 0);
            return {
              ...item,
              unitPrice,
              lineTotal: unitPrice * item.quantity,
            };
          }

          const quantity = Number(nextValue || 0);
          if (quantity <= 0) {
            return null;
          }

          return {
            ...item,
            quantity,
            lineTotal: quantity * item.unitPrice,
          };
        })
        .filter(Boolean),
    }));
  };

  const handleKeypadPress = (label) => {
    if (!selectedCartLineId && !["Miktar", "Fiyat", "%"].includes(label)) {
      message.warning("Once bir urun satiri secin.");
      return;
    }

    if (label === "Miktar") {
      setKeypadMode("quantity");
      setKeypadInput("");
      return;
    }

    if (label === "Fiyat") {
      setKeypadMode("price");
      setKeypadInput("");
      return;
    }

    if (label === "%") {
      if (activeOrder) {
        discountForm.setFieldsValue({
          discountType: activeOrder.discountType || "percent",
          discountValue: activeOrder.discountValue || 0,
        });
        setDiscountModalOpen(true);
      }
      return;
    }

    if (label === "⌫" || label === "âŒ«") {
      const nextInput = keypadInput.slice(0, -1);
      setKeypadInput(nextInput);
      if (!nextInput) {
        return;
      }
      updateCartLineValue(selectedCartLineId, nextInput.replace(",", "."), keypadMode);
      return;
    }

    if (label === "+/-") {
      const selectedLine = cart.find((item) => item.productId === selectedCartLineId);
      if (!selectedLine) {
        return;
      }
      if (keypadMode === "price") {
        const nextValue = selectedLine.unitPrice > 0 ? 0 : Number(selectedLine.unitPrice || 0);
        updateCartLineValue(selectedCartLineId, nextValue, "price");
        setKeypadInput(String(nextValue || ""));
      } else {
        updateCartQuantity(selectedCartLineId, selectedLine.quantity > 1 ? -1 : 1);
      }
      return;
    }

    const nextInput = `${keypadInput}${label === "," ? "." : label}`;
    setKeypadInput(nextInput);
    updateCartLineValue(selectedCartLineId, nextInput, keypadMode);
  };

  const handleCreateSession = async () => {
    try {
      const values = await sessionForm.validateFields();
      const created = createPosSession(values);
      setOpenSessionModalOpen(false);
      sessionForm.resetFields();
      refreshPosContext();
      setActiveSessionId(created.id);
      createDraftOrder(created.id);
      message.success("Yeni POS oturumu açıldı.");
    } catch {
      // validation handled by form
    }
  };

  const handlePayment = async () => {
    if (!activeSessionId) {
      message.warning("Önce açık bir POS oturumu seçin.");
      return;
    }

    if (!activeOrder || cart.length === 0) {
      message.warning("Sepette ürün bulunmuyor.");
      return;
    }

    try {
      const values = await paymentForm.validateFields();
      createPosSale({
        sessionId: activeSessionId,
        customerName: values.customerName || activeOrder.customerName,
        paymentMethod: values.paymentMethod,
        note: values.note || activeOrder.note,
        discountType: activeOrder.discountType,
        discountValue: activeOrder.discountValue,
        lines: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });
      setPaymentModalOpen(false);
      paymentForm.resetFields();
      const remainingOrders = draftOrders.filter((item) => item.id !== activeOrder.id);
      const fallbackOrder = buildEmptyOrder(activeSessionId, remainingOrders.length + 1);
      const nextOrders = remainingOrders.length > 0 ? remainingOrders : [fallbackOrder];
      persistDraftOrders({
        ...orderDraftsBySession,
        [activeSessionId]: nextOrders,
      });
      setActiveOrderIdBySession((prev) => ({
        ...prev,
        [activeSessionId]: nextOrders[0].id,
      }));
      refreshPosContext();
      message.success("Satış tamamlandı.");
    } catch (error) {
      if (error?.message) {
        message.error(error.message);
      }
    }
  };

  const openPaymentModal = () => {
    if (!activeOrder) {
      message.warning("Aktif sipariş bulunmuyor.");
      return;
    }

    paymentForm.setFieldsValue({
      customerName: activeOrder.customerName || "Magaza Musterisi",
      paymentMethod: "Nakit",
      note: activeOrder.note || "",
    });
    setPaymentModalOpen(true);
  };

  const actionMenu = {
    items: [
      { key: "sessions", label: "Oturumlara Git" },
      { key: "reload", label: "Verileri Yeniden Yükle" },
      { key: "open", label: "Yeni Oturum Aç" },
      { key: "products", label: "Ürün Oluştur" },
    ],
    onClick: ({ key }) => {
      if (key === "sessions") {
        navigate("/pos/sessions");
      }
      if (key === "reload") {
        refreshPosContext();
        message.success("POS verileri yenilendi.");
      }
      if (key === "open") {
        setOpenSessionModalOpen(true);
      }
      if (key === "products") {
        navigate("/products/new");
      }
    },
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {!activeSession ? (
        <Card className="erp-pos-opening-card" bordered={false}>
          <Space direction="vertical" size={18} style={{ width: "100%", textAlign: "center" }}>
            <div>
              <Title level={2} style={{ marginBottom: 6 }}>POS Oturumu Kapali</Title>
              <Text type="secondary">Kasa acilmadan urun satisina gecilmez. Oturum acilis ve kapanis tarihleri kayit altina alinir.</Text>
            </div>
            <div className="erp-pos-opening-meta">
              <div>
                <Text type="secondary">Bugun</Text>
                <Title level={4} style={{ margin: 0 }}>{new Date().toLocaleDateString("tr-TR")}</Title>
              </div>
              <div>
                <Text type="secondary">Saat</Text>
                <Title level={4} style={{ margin: 0 }}>{new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</Title>
              </div>
            </div>
            <Space wrap style={{ justifyContent: "center" }}>
              <Button type="primary" size="large" className="erp-pos-open-session-btn" onClick={() => setOpenSessionModalOpen(true)}>Kasayi Acin</Button>
              <Button size="large" onClick={() => navigate("/pos/sessions")}>Oturumlari Gor</Button>
            </Space>
          </Space>
        </Card>
      ) : null}

      {activeSession ? (
      <div className="erp-pos-shell">
        <div className="erp-pos-left">
          <div className="erp-pos-order-header">
            <div className="erp-pos-order-header-main">
              <Button type="primary" className="erp-pos-session-badge">
                {activeSession?.sessionNo?.replace("POS-", "") || "Oturum"}
              </Button>
              <Button type="primary" className="erp-pos-orders-title-btn">Kaydolun</Button>
              <Button className="erp-pos-orders-title-btn" onClick={() => setOrdersDrawerOpen(true)}>Siparisler</Button>
              <Button icon={<PlusCircleOutlined />} onClick={() => createDraftOrder()}>Yeni</Button>
            </div>
            <div className="erp-pos-session-tabs">
              {openDraftOrders.length > 0 ? openDraftOrders.map((order) => (
                <Button
                  key={order.id}
                  type={activeOrder?.id === order.id ? "primary" : "default"}
                  onClick={() => setActiveOrderIdBySession((prev) => ({ ...prev, [activeSessionId]: order.id }))}
                >
                  {order.title}
                </Button>
              )) : (
                <Button type="primary" onClick={() => setOpenSessionModalOpen(true)}>Siparis Aç</Button>
              )}
            </div>
          </div>

          <div className="erp-pos-order-list">
            {activeOrder ? (
              <div className="erp-pos-active-order-banner">
                <div className="erp-pos-active-order-banner-row">
                  <div>
                    <Text strong>{getOrderDisplayTitle(activeOrder)}</Text>
                    <Text type="secondary">{activeOrder.note || "Siparis acik, urun eklemeye hazir."}</Text>
                  </div>
                  <Space wrap>
                    <Button onClick={() => {
                      discountForm.setFieldsValue({
                        discountType: activeOrder.discountType || "amount",
                        discountValue: activeOrder.discountValue || 0,
                      });
                      setDiscountModalOpen(true);
                    }}
                    >
                      Indirim
                    </Button>
                    <Button onClick={closeActiveOrder}>Siparisi Kapat</Button>
                    <Popconfirm title="Siparis silinsin mi?" okText="Sil" cancelText="Vazgec" onConfirm={() => removeOrderDraft(activeOrder.id)}>
                      <Button danger>Siparisi Sil</Button>
                    </Popconfirm>
                  </Space>
                </div>
              </div>
            ) : null}
            {cart.length === 0 ? (
              <Empty description="Sepette ürün bulunmuyor" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              cart.map((item, index) => (
                <div
                  key={item.productId}
                  className={`erp-pos-order-item ${selectedCartLineId === item.productId ? "is-selected" : ""}`}
                  onClick={() => {
                    setSelectedCartLineId(item.productId);
                    setKeypadInput(String(keypadMode === "price" ? item.unitPrice : item.quantity));
                  }}
                >
                  <div className="erp-pos-order-item-head">
                    <span className="erp-pos-order-index">{index + 1}</span>
                    <Text>{item.code}-{item.name}</Text>
                  </div>
                  <div className="erp-pos-order-item-actions">
                    <Button size="small" onClick={() => updateCartQuantity(item.productId, -1)}>-</Button>
                    <Text strong>{item.quantity}</Text>
                    <Button size="small" onClick={() => updateCartQuantity(item.productId, 1)}>+</Button>
                    <Text strong>{formatMovementMoney(item.lineTotal)}</Text>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="erp-pos-summary">
            <div className="erp-pos-summary-row">
              <Text>Ara Toplam</Text>
              <Text strong>{formatMovementMoney(orderTotals.grossTotal)}</Text>
            </div>
            <div className="erp-pos-summary-row">
              <Text>Indirim</Text>
              <Text strong>{formatMovementMoney(orderTotals.discountAmount)}</Text>
            </div>
            <div className="erp-pos-summary-row">
              <Text>Vergiler</Text>
              <Text strong>{formatMovementMoney(cartTax)}</Text>
            </div>
            <div className="erp-pos-summary-row erp-pos-summary-total">
              <Text strong>Toplam</Text>
              <Text strong>{formatMovementMoney(cartGrandTotal)}</Text>
            </div>
          </div>

          <div className="erp-pos-bottom-actions">
            <Space className="erp-pos-mini-actions">
              <Button onClick={() => {
                customerForm.setFieldsValue({ customerName: activeOrder?.customerName || "" });
                setCustomerModalOpen(true);
              }}
              >
                Musteri
              </Button>
              <Button onClick={() => {
                noteForm.setFieldsValue({ note: activeOrder?.note || "" });
                setNoteModalOpen(true);
              }}
              >
                Not
              </Button>
            </Space>

            <div className="erp-pos-keypad-display">
              <Text type="secondary">
                {selectedCartLineId
                  ? `Secili satir: ${(cart.find((item) => item.productId === selectedCartLineId)?.name) || "-"}`
                  : "Secili satir yok"}
              </Text>
              <Text strong>{keypadMode === "price" ? "Fiyat" : "Miktar"}: {keypadInput || "-"}</Text>
            </div>

            <div className="erp-pos-keypad">
              {["1", "2", "3", "Miktar", "4", "5", "6", "%", "7", "8", "9", "Fiyat", "+/-", "0", ",", "?"].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleKeypadPress(label)}
                  className={`erp-pos-key ${(label === "Miktar" && keypadMode === "quantity") || (label === "Fiyat" && keypadMode === "price") ? "is-active" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <Button type="primary" size="large" className="erp-pos-pay-btn" onClick={openPaymentModal}>
              Odeme
            </Button>
          </div>
        </div>

        <div className="erp-pos-right">
          <div className="erp-pos-toolbar">
            <Input
              prefix={<SearchOutlined />}
              placeholder="Ürün ara..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="erp-pos-search"
            />
            <Input
              prefix={<BarcodeOutlined />}
              placeholder="Barkod"
              value={barcodeValue}
              onChange={(event) => setBarcodeValue(event.target.value)}
              onPressEnter={handleBarcodeSubmit}
              className="erp-pos-barcode"
            />
            <Avatar className="erp-pos-user-avatar" icon={<UserOutlined />} />
            <Dropdown menu={actionMenu} trigger={["click"]} placement="bottomRight">
              <Button icon={<MenuOutlined />} className="erp-pos-menu-btn" />
            </Dropdown>
          </div>

          <div className="erp-pos-category-row">
            {posCategoryOptions.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`erp-pos-category-chip ${activeCategory === category.id ? "is-selected" : ""}`}
                style={{ background: category.color }}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="erp-pos-product-grid">
            {filteredCatalog.map((product) => (
              <button key={product.id} type="button" className="erp-pos-product-card" onClick={() => addProductToCart(product)}>
                <div className="erp-pos-product-image-wrap">
                  <img src={product.imageUrl} alt={product.name} className="erp-pos-product-image" />
                </div>
                <div className="erp-pos-product-name">{product.code}-{product.name}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
      ) : null}
      <Modal title="Satışı Tamamla" open={paymentModalOpen} onCancel={() => setPaymentModalOpen(false)} onOk={handlePayment} okText="Satışı Kaydet" cancelText="Vazgeç">
        <Form form={paymentForm} layout="vertical" initialValues={{ customerName: activeOrder?.customerName || "Magaza Musterisi", paymentMethod: "Nakit", note: activeOrder?.note || "" }}>
          <Form.Item name="customerName" label="Müşteri">
            <Input />
          </Form.Item>
          <Form.Item name="paymentMethod" label="Ödeme Tipi" rules={[{ required: true, message: "Ödeme tipi seçin." }]}>
            <Select options={["Nakit", "Kart", "Havale"].map((item) => ({ value: item, label: item }))} />
          </Form.Item>
          <Form.Item name="note" label="Not">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Oturum">{activeSession?.sessionNo || "-"}</Descriptions.Item>
            <Descriptions.Item label="Ara Toplam">{formatMovementMoney(orderTotals.grossTotal)}</Descriptions.Item>
            <Descriptions.Item label="Indirim">{formatMovementMoney(orderTotals.discountAmount)}</Descriptions.Item>
            <Descriptions.Item label="Vergi">{formatMovementMoney(cartTax)}</Descriptions.Item>
            <Descriptions.Item label="Genel Toplam">{formatMovementMoney(cartGrandTotal)}</Descriptions.Item>
          </Descriptions>
        </Form>
      </Modal>

      <Modal title="Musteri Bilgisi" open={customerModalOpen} onCancel={() => setCustomerModalOpen(false)} onOk={async () => {
        const values = await customerForm.validateFields();
        updateActiveOrder((order) => ({ ...order, customerName: values.customerName || "" }));
        setCustomerModalOpen(false);
      }} okText="Kaydet" cancelText="Vazgeç">
        <Form form={customerForm} layout="vertical">
          <Form.Item name="customerName" label="Müşteri">
            <Input placeholder="Musteri adi" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Siparis Notu" open={noteModalOpen} onCancel={() => setNoteModalOpen(false)} onOk={async () => {
        const values = await noteForm.validateFields();
        updateActiveOrder((order) => ({ ...order, note: values.note || "" }));
        setNoteModalOpen(false);
      }} okText="Kaydet" cancelText="Vazgeç">
        <Form form={noteForm} layout="vertical">
          <Form.Item name="note" label="Not">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Siparise Ozel Indirim" open={discountModalOpen} onCancel={() => setDiscountModalOpen(false)} onOk={async () => {
        const values = await discountForm.validateFields();
        updateActiveOrder((order) => ({
          ...order,
          discountType: values.discountType,
          discountValue: Number(values.discountValue || 0),
        }));
        setDiscountModalOpen(false);
      }} okText="Uygula" cancelText="Vazgeç">
        <Form form={discountForm} layout="vertical" initialValues={{ discountType: "amount", discountValue: 0 }}>
          <Form.Item name="discountType" label="Indirim Tipi" rules={[{ required: true, message: "Indirim tipi secin." }]}>
            <Radio.Group
              options={[
                { label: "Tutar", value: "amount" },
                { label: "Yuzde", value: "percent" },
              ]}
            />
          </Form.Item>
          <Form.Item name="discountValue" label="Indirim Degeri">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Yeni POS Oturumu" open={openSessionModalOpen} onCancel={() => setOpenSessionModalOpen(false)} onOk={handleCreateSession} okText="Aç" cancelText="Vazgeç">
        <Form form={sessionForm} layout="vertical" initialValues={{ registerName: "Magaza Ana Kasa", cashierName: "Sibel Ersoy Arslan", openingBalance: 0 }}>
          <Form.Item name="registerName" label="Kasa" rules={[{ required: true, message: "Kasa adı zorunludur." }]}>
            <Input />
          </Form.Item>
          <Form.Item name="cashierName" label="Kasiyer" rules={[{ required: true, message: "Kasiyer adı zorunludur." }]}>
            <Input />
          </Form.Item>
          <Form.Item name="openingBalance" label="Açılış Bakiyesi">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="note" label="Not">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title="Siparisler" placement="right" width={620} open={ordersDrawerOpen} onClose={() => setOrdersDrawerOpen(false)}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Card size="small" title="Acik ve Kapali Siparisler">
            <Table
              rowKey="id"
              pagination={false}
              size="small"
              dataSource={[...openDraftOrders, ...closedDraftOrders]}
              locale={{ emptyText: "Oturuma ait siparis bulunmuyor." }}
              columns={[
                { title: "Siparis", dataIndex: "title", key: "title" },
                { title: "Durum", key: "status", render: (_, record) => record.status === "open" ? "Devam Ediyor" : "Kapali" },
                { title: "Musteri", dataIndex: "customerName", key: "customerName", render: (value) => value || "-" },
                { title: "Indirim", key: "discount", render: (_, record) => formatMovementMoney(calculateOrderTotals(record).discountAmount) },
                {
                  title: "Islemler",
                  key: "actions",
                  render: (_, record) => (
                    <Space size={8}>
                      <Button size="small" onClick={() => record.status === "open" ? setActiveOrderIdBySession((prev) => ({ ...prev, [activeSessionId]: record.id })) : reopenDraftOrder(record.id)}>{record.status === "open" ? "Yukle" : "Ac"}</Button>
                      <Popconfirm title="Siparis silinsin mi?" okText="Sil" cancelText="Vazgec" onConfirm={() => removeOrderDraft(record.id)}>
                        <Button size="small" danger>Sil</Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>

          <Card size="small" title="Tamamlanan Siparisler">
            <Table
              rowKey="id"
              pagination={false}
              size="small"
              dataSource={sessionOrders}
              columns={[
                { title: "Fis", dataIndex: "receiptNo", key: "receiptNo" },
                { title: "Musteri", dataIndex: "customerName", key: "customerName" },
                { title: "Tarih", dataIndex: "soldAt", key: "soldAt", render: (value) => new Date(value).toLocaleString("tr-TR") },
                { title: "Indirim", dataIndex: "discountAmountDisplay", key: "discountAmountDisplay" },
                { title: "Toplam", dataIndex: "grandTotalDisplay", key: "grandTotalDisplay" },
              ]}
            />
          </Card>
        </Space>
      </Drawer>
    </Space>
  );
}

export function StockEntryEditorPage() {
  const navigate = useNavigate();
  const { stockEntryId } = useParams();
  const isEditMode = Boolean(stockEntryId);
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const stockImportInputRef = React.useRef(null);
  const supplierOptions = listSuppliers().map((item) => ({ value: item.id, label: item.company }));
  const products = listProducts();
  const productOptions = products.map((item) => ({
    value: item.id,
    label: `${item.code} - ${item.name}`,
  }));
  const stockTypeOptions = ["Urun", "Hammadde", "Ambalaj"].map((value) => ({ value, label: value }));
  const sourceTypeOptions = ["Konsinye", "Uretim", "Sayim Duzeltme", "Depo Transferi"].map((value) => ({ value, label: value }));
  const statusOptions = ["Alim Planlandi", "Taslak", "Tamamlandi"].map((value) => ({ value, label: value }));

  React.useEffect(() => {
    const baseValues = {
      documentNo: `STK-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      sourcePartyId: undefined,
      date: new Date().toISOString().slice(0, 10),
      stockType: "Urun",
      sourceType: "Konsinye",
      status: "Taslak",
      note: "",
      lines: [{ productId: undefined, quantity: 1, unitCost: 0, note: "" }],
    };

    if (!isEditMode) {
      form.setFieldsValue(baseValues);
      return;
    }

    const stockEntry = getStockEntryById(stockEntryId);
    if (!stockEntry) {
      message.error("Stok giris kaydi bulunamadi.");
      navigate("/stock/entry");
      return;
    }

    form.setFieldsValue({
      ...baseValues,
      ...stockEntry,
      lines: stockEntry.lines?.length ? stockEntry.lines : baseValues.lines,
    });
  }, [form, isEditMode, navigate, stockEntryId]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      const savedEntry = isEditMode ? updateStockEntry(stockEntryId, values) : createStockEntry(values);
      message.success(isEditMode ? "Stok girisi guncellendi." : "Stok girisi kaydedildi.");
      navigate(`/stock/entry/${savedEntry.id}`);
    } catch {
      // validation handled by form
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadStockTemplate = () => {
    downloadWorkbook(
      [["productCode", "quantity"], ["SOLE0001", "5"]],
      "StokKalemleri",
      "stok-giris-sablonu.xlsx",
    );
    message.success("Stok giris sablonu indirildi.");
  };

  const handleStockImportClick = () => {
    stockImportInputRef.current?.click();
  };

  const handleStockImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
      const [headerRow, ...dataRows] = rows;

      if (!headerRow?.length) {
        message.error("Excel dosyasi bos gorunuyor.");
        return;
      }

      const headers = headerRow.map((item) => String(item).trim());
      const productCodeIndex = headers.findIndex((item) => item === "productCode");
      const quantityIndex = headers.findIndex((item) => item === "quantity");

      if (productCodeIndex === -1 || quantityIndex === -1) {
        message.error("Excel basliklari productCode ve quantity olmalidir.");
        return;
      }

      const productMap = new Map(products.map((item) => [String(item.code || "").trim().toUpperCase(), item]));
      const importedLines = [];
      const missingCodes = [];

      dataRows
        .filter((row) => row.some((cell) => String(cell ?? "").trim()))
        .forEach((row) => {
          const productCode = String(row[productCodeIndex] || "").trim().toUpperCase();
          const quantity = Number(row[quantityIndex] || 0);

          if (!productCode || quantity <= 0) {
            return;
          }

          const product = productMap.get(productCode);
          if (!product) {
            missingCodes.push(productCode);
            return;
          }

          importedLines.push({
            productId: product.id,
            quantity,
            unitCost: Number(product.cost || 0),
            note: "",
          });
        });

      if (!importedLines.length) {
        message.error(missingCodes.length ? `Urunler bulunamadi: ${missingCodes.join(", ")}` : "Aktarilacak gecerli satir bulunamadi.");
        return;
      }

      form.setFieldValue("lines", importedLines);

      if (missingCodes.length) {
        message.warning(`Bazi urun kodlari bulunamadi: ${missingCodes.join(", ")}`);
      } else {
        message.success(`${importedLines.length} stok kalemi excelden eklendi.`);
      }
    } catch {
      message.error("Excel dosyasi okunurken hata olustu.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>{isEditMode ? "Stok Girisi Duzenle" : "Stok Giris Ekrani"}</Title>
          <Text type="secondary">Ana kaydin genel bilgilerini ve ilgili urun kalemlerini bu sayfada yonetin.</Text>
        </div>
        <Space>
          <Button onClick={() => navigate("/stock/entry")}>Ana Kayitlara Don</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>Kaydet</Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <input
          ref={stockImportInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: "none" }}
          onChange={(event) => {
            void handleStockImportFileChange(event);
          }}
        />
        <div className="erp-form-stack">
          <Card title="Genel Bilgiler">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}><Form.Item name="sourcePartyId" label="Stok Teslim Eden"><Select options={supplierOptions} showSearch optionFilterProp="label" placeholder="Seciniz" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="date" label="Tarih" rules={[{ required: true, message: "Tarih zorunludur." }]}><Input type="date" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="documentNo" label="Belge No" rules={[{ required: true, message: "Belge no zorunludur." }]}><Input placeholder="STK-2026-001" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="stockType" label="Stok Cesidi"><Select options={stockTypeOptions} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="sourceType" label="Giris Kaynagi"><Select options={sourceTypeOptions} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="status" label="Durum"><Select options={statusOptions} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="note" label="Not"><Input placeholder="Aciklama" /></Form.Item></Col>
            </Row>
          </Card>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <Card
                title="Stok Kalemleri"
                extra={(
                  <Space wrap>
                    <Button onClick={handleDownloadStockTemplate}>Sablon Indir</Button>
                    <Button onClick={handleStockImportClick}>Excelden Aktar</Button>
                    <Button icon={<PlusOutlined />} onClick={() => add({ productId: undefined, quantity: 1, unitCost: 0, note: "" })}>Satir Ekle</Button>
                  </Space>
                )}
              >
                <Table
                  rowKey="key"
                  pagination={false}
                  dataSource={fields.map((field) => ({ key: field.key, field }))}
                  columns={[
                    {
                      title: "Urun",
                      key: "product",
                      render: (_, record) => (
                        <Form.Item name={[record.field.name, "productId"]} rules={[{ required: true, message: "Urun seciniz." }]}>
                          <Select
                            showSearch
                            placeholder="Urun seciniz"
                            options={productOptions}
                            optionFilterProp="label"
                            filterOption={(input, option) => String(option?.label || "").toLowerCase().includes(input.toLowerCase())}
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "Miktar",
                      key: "quantity",
                      render: (_, record) => (
                        <Form.Item name={[record.field.name, "quantity"]} rules={[{ required: true, message: "Miktar girin." }]}>
                          <InputNumber min={1} style={{ width: "100%" }} />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "Birim Maliyet",
                      key: "unitCost",
                      render: (_, record) => (
                        <Form.Item name={[record.field.name, "unitCost"]} rules={[{ required: true, message: "Birim maliyet girin." }]}>
                          <InputNumber min={0} style={{ width: "100%" }} />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "Not",
                      key: "note",
                      render: (_, record) => (
                        <Form.Item name={[record.field.name, "note"]}>
                          <Input placeholder="Satir notu" />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "Islemler",
                      key: "actions",
                      width: 110,
                      render: (_, record) => (
                        <Button type="text" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} onClick={() => remove(record.field.name)} />
                      ),
                    },
                  ]}
                />
              </Card>
            )}
          </Form.List>
        </div>
      </Form>
    </Space>
  );
}

export function ModuleFormPage({ title, description, topFields, lineTitle }) {
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedLine, setSelectedLine] = React.useState(null);
  const lineColumns = [
    { title: "Urun", dataIndex: "product", key: "product", sorter: (a, b) => a.product.localeCompare(b.product, "tr") },
    { title: "Miktar", dataIndex: "quantity", key: "quantity", sorter: (a, b) => String(a.quantity).localeCompare(String(b.quantity), "tr", { numeric: true }) },
    { title: "Birim Fiyat / Maliyet", dataIndex: "price", key: "price", sorter: (a, b) => String(a.price).localeCompare(String(b.price), "tr", { numeric: true }) },
    { title: "Tarih", dataIndex: "date", key: "date", sorter: (a, b) => a.date.localeCompare(b.date, "tr") },
    { title: "Not", dataIndex: "note", key: "note", sorter: (a, b) => a.note.localeCompare(b.note, "tr") },
  ];

  const lineData = [
    { key: 1, product: "Urun seciniz", quantity: "1", price: "0,00", date: "2026-04-04", note: "-" },
    { key: 2, product: "Urun seciniz", quantity: "1", price: "0,00", date: "2026-04-04", note: "-" },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>{title}</Title>
          <Text type="secondary">{description}</Text>
        </div>
        <Button type="primary">Kaydet</Button>
      </div>

      <Card title="Genel Bilgiler">
        <Row gutter={[16, 16]}>
          {topFields.map((field) => (
            <Col xs={24} md={12} xl={field === "Aciklama" || field === "Not" || field === "Adres" ? 24 : 8} key={field}>
              <Form.Item label={field} style={{ marginBottom: 0 }}>
                <Input placeholder={`${field} giriniz`} />
              </Form.Item>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title={lineTitle} extra={<Button icon={<PlusOutlined />}>Satir Ekle</Button>}>
        <Table
          pagination={false}
          columns={lineColumns}
          dataSource={lineData}
          onRow={(record) => ({
            onClick: () => openDetailFromRow(setSelectedLine, setDetailOpen, record),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
      </Card>

      <Drawer
        title={`${lineTitle} Detayi`}
        placement="right"
        width={420}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      >
        {selectedLine ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Urun">{selectedLine.product}</Descriptions.Item>
            <Descriptions.Item label="Miktar">{selectedLine.quantity}</Descriptions.Item>
            <Descriptions.Item label="Birim Fiyat / Maliyet">{selectedLine.price}</Descriptions.Item>
            <Descriptions.Item label="Tarih">{selectedLine.date}</Descriptions.Item>
            <Descriptions.Item label="Not">{selectedLine.note}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </Space>
  );
}

export function SettingsDefinitionPage({ entityKey }) {
  const activeConfig = masterDataDefinitions[entityKey];
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [records, setRecords] = React.useState(() => (activeConfig ? listMasterData(activeConfig.entityKey) : []));
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedRecord, setSelectedRecord] = React.useState(null);

  React.useEffect(() => {
    if (!activeConfig) {
      return;
    }

    setRecords(listMasterData(activeConfig.entityKey));
  }, [activeConfig]);

  if (!activeConfig) {
    return null;
  }

  const refreshRecords = () => {
    setRecords(listMasterData(activeConfig.entityKey));
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      createMasterData(activeConfig.entityKey, values);
      createForm.resetFields();
      createForm.setFieldsValue(activeConfig.emptyValues);
      refreshRecords();
      message.success("Kayit basariyla eklendi.");
    } catch {
      // validation handled by form
    }
  };

  const handleOpenEdit = (record, event) => {
    if (event) {
      event.stopPropagation();
    }

    setSelectedRecord(record);
    editForm.setFieldsValue(record);
    setDrawerOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedRecord) {
      return;
    }

    try {
      const values = await editForm.validateFields();
      updateMasterData(activeConfig.entityKey, selectedRecord.id, values);
      refreshRecords();
      setSelectedRecord((prev) => ({ ...prev, ...values }));
      setDrawerOpen(false);
      message.success("Kayit basariyla guncellendi.");
    } catch {
      // validation handled by form
    }
  };

  const tableColumns = activeConfig.columns.map((column) => ({
    title: column.label,
    dataIndex: column.key,
    key: column.key,
    sorter: (a, b) => String(a[column.key] ?? "").localeCompare(String(b[column.key] ?? ""), "tr", { numeric: true }),
    render: (value) =>
      column.key === "status" ? (
        <Tag color={value === "Aktif" ? "green" : "default"}>{value}</Tag>
      ) : column.key === activeConfig.columns[0].key ? (
        <span className="erp-link-cell">{value}</span>
      ) : (
        value || "-"
      ),
  }));

  tableColumns.push({
    title: "Islemler",
    key: "actions",
    width: 120,
    render: (_, record) => (
      <Space size={8}>
        <Button
          type="text"
          className="erp-icon-btn erp-icon-btn-edit"
          icon={<EditOutlined />}
          onClick={(event) => handleOpenEdit(record, event)}
        />
      </Space>
    ),
  });

  const renderField = (field) => {
    if (field.type === "number") {
      return <InputNumber style={{ width: "100%" }} min={0} />;
    }

    if (field.type === "textarea") {
      return <Input.TextArea rows={3} />;
    }

    if (field.type === "select") {
      return <Select options={(field.options || []).map((option) => ({ value: option, label: option }))} />;
    }

    return <Input placeholder={`${field.label} giriniz`} />;
  };

  const formColSpan = activeConfig.fields.length <= 3 ? 8 : 6;

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>{activeConfig.title}</Title>
          <Text type="secondary">{activeConfig.description}</Text>
        </div>
        <Button type="primary" onClick={handleCreate}>{activeConfig.createLabel}</Button>
      </div>

      <Card title="Tanim Formu" extra={<Tag color="blue">Kalici Kayit Acik</Tag>}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Text type="secondary">
            {activeConfig.relationText.join(" ")}
          </Text>

          <Form form={createForm} layout="vertical" initialValues={activeConfig.emptyValues}>
            <Row gutter={[16, 16]}>
              {activeConfig.fields.map((field) => (
                <Col xs={24} md={12} xl={formColSpan} key={field.name}>
                  <Form.Item
                    name={field.name}
                    label={field.label}
                    rules={field.required ? [{ required: true, message: `${field.label} zorunludur.` }] : []}
                  >
                    {renderField(field)}
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Form>
        </Space>
      </Card>

      <Card title="Tanim Listesi" className="erp-list-table-card">
        <Table
          rowKey="id"
          columns={tableColumns}
          dataSource={records}
          pagination={false}
          onRow={(record) => ({
            onClick: () => handleOpenEdit(record),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
        <div className="erp-table-footer">
          <Space>
            <span>Sayfa Boyutu:</span>
            <Select
              defaultValue="50"
              size="small"
              style={{ width: 84 }}
              options={["25", "50", "100"].map((value) => ({ value, label: value }))}
            />
          </Space>
          <Space size={18}>
            <span>1 - {records.length} / {records.length}</span>
            <span>Toplam {records.length} kayit</span>
          </Space>
        </div>
      </Card>

      <Drawer
        title={activeConfig.editTitle}
        placement="right"
        width={460}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={<Button type="primary" onClick={handleUpdate}>Guncelle</Button>}
      >
        {selectedRecord ? (
          <Space direction="vertical" size={18} style={{ width: "100%" }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Kayit No">{selectedRecord.id}</Descriptions.Item>
              <Descriptions.Item label="Olusturma Tarihi">{new Date(selectedRecord.createdAt).toLocaleString("tr-TR")}</Descriptions.Item>
              <Descriptions.Item label="Son Guncelleme">{new Date(selectedRecord.updatedAt).toLocaleString("tr-TR")}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Kayit Bilgileri">
              <Form form={editForm} layout="vertical">
                <Row gutter={[12, 12]}>
                  {activeConfig.fields.map((field) => (
                    <Col xs={24} key={field.name}>
                      <Form.Item
                        name={field.name}
                        label={field.label}
                        rules={field.required ? [{ required: true, message: `${field.label} zorunludur.` }] : []}
                      >
                        {renderField(field)}
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
              </Form>
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}

export function StockEntryListPage() {
  const navigate = useNavigate();
  const [createForm] = Form.useForm();
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedEntry, setSelectedEntry] = React.useState(null);
  const [entries, setEntries] = React.useState(() => listStockEntries());
  const [creating, setCreating] = React.useState(false);
  const [filters, setFilters] = React.useState({
    search: "",
    status: undefined,
    sourceType: undefined,
  });

  const supplierOptions = listSuppliers().map((item) => ({ value: item.id, label: item.company }));
  const createStatusOptions = ["Alim Planlandi", "Taslak", "Tamamlandi"].map((value) => ({ value, label: value }));
  const statusOptions = ["Tumu", "Alim Planlandi", "Taslak", "Tamamlandi"].map((value) => ({ value, label: value }));
  const stockTypeOptions = ["Urun", "Hammadde", "Ambalaj"].map((value) => ({ value, label: value }));
  const sourceTypeOptions = ["Tumu", "Konsinye", "Uretim", "Sayim Duzeltme", "Depo Transferi"].map((value) => ({ value, label: value }));
  const createSourceTypeOptions = ["Konsinye", "Uretim", "Sayim Duzeltme", "Depo Transferi"].map((value) => ({ value, label: value }));

  React.useEffect(() => {
    createForm.setFieldsValue({
      documentNo: `STK-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      sourcePartyId: undefined,
      date: new Date().toISOString().slice(0, 10),
      stockType: "Urun",
      sourceType: "Konsinye",
      status: "Taslak",
      note: "",
    });
  }, [createForm]);

  const refreshEntries = () => {
    setEntries(listStockEntries());
  };

  const handleCreateMainRecord = async () => {
    try {
      setCreating(true);
      const values = await createForm.validateFields();
      const savedEntry = createStockEntry({
        ...values,
        lines: [],
      });
      refreshEntries();
      message.success("Ana kayit olusturuldu. Kalem girisi ekranina yonlendiriliyorsunuz.");
      navigate(`/stock/entry/${savedEntry.id}`);
    } catch {
      // validation handled by form
    } finally {
      setCreating(false);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      [entry.documentNo, entry.sourcePartyName, entry.note, entry.stockType]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    const matchesStatus = !filters.status || filters.status === "Tumu" || entry.status === filters.status;
    const matchesSourceType = !filters.sourceType || filters.sourceType === "Tumu" || entry.sourceType === filters.sourceType;
    return matchesSearch && matchesStatus && matchesSourceType;
  });

  const columns = [
    {
      title: "Belge No",
      dataIndex: "documentNo",
      key: "documentNo",
      sorter: (a, b) => a.documentNo.localeCompare(b.documentNo, "tr"),
      render: (value, record) => (
        <button
          type="button"
          className="erp-link-button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/stock/entry/${record.id}`);
          }}
        >
          {value}
        </button>
      ),
    },
    { title: "Tarih", dataIndex: "date", key: "date", sorter: (a, b) => a.date.localeCompare(b.date, "tr") },
    { title: "Teslim Eden", dataIndex: "sourcePartyName", key: "sourcePartyName", sorter: (a, b) => a.sourcePartyName.localeCompare(b.sourcePartyName, "tr") },
    { title: "Kaynak", dataIndex: "sourceType", key: "sourceType", sorter: (a, b) => a.sourceType.localeCompare(b.sourceType, "tr") },
    { title: "Kalem", dataIndex: "lineCount", key: "lineCount", sorter: (a, b) => a.lineCount - b.lineCount },
    { title: "Toplam", dataIndex: "totalAmountDisplay", key: "totalAmountDisplay", sorter: (a, b) => a.totalAmount - b.totalAmount },
    {
      title: "Durum",
      dataIndex: "status",
      key: "status",
      sorter: (a, b) => String(a.status || "").localeCompare(String(b.status || ""), "tr"),
      render: (value) => <Tag color={value === "Tamamlandi" ? "green" : value === "Taslak" ? "gold" : "blue"}>{value || "-"}</Tag>,
    },
    {
      title: "Islemler",
      key: "actions",
      render: (_, record) => (
        <Space size={8}>
          <Button
            type="text"
            className="erp-icon-btn erp-icon-btn-edit"
            icon={<EditOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/stock/entry/${record.id}`);
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 6 }}>Stok Giris Ana Kayitlar</Title>
        <Text type="secondary">Stok giris ana kayitlari burada olusur. Kalemleri duzenlemek icin ana kayda girilir.</Text>
      </div>

      <Card
        title="Ana Kayit Bilgileri"
        extra={<Button type="primary" onClick={handleCreateMainRecord} loading={creating}>Kalem Girisine Gec</Button>}
      >
        <Form form={createForm} layout="vertical">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}><Form.Item name="sourcePartyId" label="Stok Teslim Eden"><Select options={supplierOptions} showSearch optionFilterProp="label" placeholder="Seciniz" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="date" label="Tarih" rules={[{ required: true, message: "Tarih zorunludur." }]}><Input type="date" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="documentNo" label="Belge No" rules={[{ required: true, message: "Belge no zorunludur." }]}><Input placeholder="STK-2026-001" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="stockType" label="Stok Cesidi"><Select options={stockTypeOptions} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="sourceType" label="Giris Kaynagi"><Select options={createSourceTypeOptions} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="status" label="Durum"><Select options={createStatusOptions} /></Form.Item></Col>
            <Col xs={24}><Form.Item name="note" label="Not"><Input placeholder="Aciklama" /></Form.Item></Col>
          </Row>
        </Form>
      </Card>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar">
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={refreshEntries}>Yenile</Button>
          </Space>

          <div className="erp-list-toolbar-filters">
            <Form.Item label="Belge / Tedarikci" style={{ marginBottom: 0 }}>
              <Input
                prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
                placeholder="Ara"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                allowClear
              />
            </Form.Item>
            <Form.Item label="Durum" style={{ marginBottom: 0 }}>
              <Select value={filters.status} onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))} options={statusOptions} allowClear />
            </Form.Item>
            <Form.Item label="Giris Kaynagi" style={{ marginBottom: 0 }}>
              <Select value={filters.sourceType} onChange={(value) => setFilters((prev) => ({ ...prev, sourceType: value }))} options={sourceTypeOptions} allowClear />
            </Form.Item>
          </div>
        </div>
      </Card>

      <Card title="Ana Kayit Listesi" className="erp-list-table-card">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredEntries}
          pagination={false}
          locale={{ emptyText: "Henuz stok giris ana kaydi bulunmuyor." }}
          onRow={(record) => ({
            onClick: () => openDetailFromRow(setSelectedEntry, setDetailOpen, record),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
        <div className="erp-table-footer">
          <Space>
            <span>Toplam Kayit:</span>
            <strong>{filteredEntries.length}</strong>
          </Space>
          <span>Kaydi acarak kalemleri yonetebilirsiniz.</span>
        </div>
      </Card>

      <Drawer title="Stok Giris Detayi" placement="right" width={420} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {selectedEntry ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Belge No">{selectedEntry.documentNo}</Descriptions.Item>
            <Descriptions.Item label="Tarih">{selectedEntry.date}</Descriptions.Item>
            <Descriptions.Item label="Teslim Eden">{selectedEntry.sourcePartyName}</Descriptions.Item>
            <Descriptions.Item label="Giris Kaynagi">{selectedEntry.sourceType}</Descriptions.Item>
            <Descriptions.Item label="Durum">{selectedEntry.status}</Descriptions.Item>
            <Descriptions.Item label="Kalem">{selectedEntry.lineCount}</Descriptions.Item>
            <Descriptions.Item label="Toplam">{selectedEntry.totalAmountDisplay}</Descriptions.Item>
            <Descriptions.Item label="Not">{selectedEntry.note || "-"}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </Space>
  );
}

export function SupplierPortalProductListPage() {
  const navigate = useNavigate();
  const authUser = getAuthUser();
  const supplierId = authUser?.supplierId || null;
  const [products, setProducts] = React.useState(() => (supplierId ? listProductsBySupplier(supplierId) : []));
  const [search, setSearch] = React.useState("");

  const refreshProducts = React.useCallback(() => {
    setProducts(supplierId ? listProductsBySupplier(supplierId) : []);
  }, [supplierId]);

  const filteredProducts = React.useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return products.filter((product) => {
      if (!normalizedSearch) {
        return true;
      }

      return [product.code, product.name, product.notes, product.workflowStatus]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
  }, [products, search]);

  const handleExport = () => {
    const header = ["Urun Kodu", "Urun Adi", "Aciklama", "Satis Fiyati", "Durum"];
    const rows = filteredProducts.map((item) => [
      item.code,
      item.name,
      item.notes || "",
      item.priceDisplay,
      item.workflowStatus || "Taslak",
    ]);
    downloadWorkbook([header, ...rows], "UrunListem", "tedarikci-urun-listesi.xlsx");
    message.success("Excel dosyasi indirildi.");
  };

  const columns = [
    {
      title: "Urun Kodu",
      dataIndex: "code",
      key: "code",
      sorter: (a, b) => a.code.localeCompare(b.code, "tr"),
      render: (value, record) => (
        <button
          type="button"
          className="erp-link-button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/supplier/products/${record.id}`);
          }}
        >
          {value}
        </button>
      ),
    },
    {
      title: "Urun Adi",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name, "tr"),
    },
    {
      title: "Satis Fiyati",
      dataIndex: "priceDisplay",
      key: "priceDisplay",
      sorter: (a, b) => a.salePrice - b.salePrice,
    },
    {
      title: "Durum",
      dataIndex: "workflowStatus",
      key: "workflowStatus",
      render: (value) => {
        const colorMap = {
          Taslak: "default",
          "Onaya Gonderildi": "gold",
          Onaylandi: "green",
          "Revizyon Istendi": "red",
        };
        return <Tag color={colorMap[value] || "blue"}>{value || "Taslak"}</Tag>;
      },
    },
    {
      title: "Islemler",
      key: "actions",
      render: (_, record) => (
        <Button type="text" className="erp-icon-btn erp-icon-btn-edit" icon={<EditOutlined />} onClick={() => navigate(`/supplier/products/${record.id}`)} />
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Urunlerim</Title>
          <Text type="secondary">Yalnizca size ait urun kayitlarini goruntuleyebilirsiniz.</Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={refreshProducts}>Yenile</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
        </Space>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar erp-product-toolbar-single">
          <Space wrap className="erp-product-toolbar-actions">
            <Button icon={<ReloadOutlined />} onClick={refreshProducts}>Yenile</Button>
          </Space>
          <div className="erp-product-toolbar-search">
            <Input
              prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
              placeholder="Urun kodu veya adi"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              allowClear
            />
          </div>
        </div>
      </Card>

      <Card title="Kayitlarim" className="erp-list-table-card">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredProducts}
          pagination={false}
          locale={{ emptyText: "Henuz urun kaydiniz bulunmuyor." }}
          onRow={(record) => ({
            onClick: () => navigate(`/supplier/products/${record.id}`),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
        <div className="erp-table-footer">
          <span>Toplam Kayit: {filteredProducts.length}</span>
          <span>Kaydi acarak ayrintilarini goruntuleyebilirsiniz.</span>
        </div>
      </Card>
    </Space>
  );
}

export function SupplierPortalProductEditorPage() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const authUser = getAuthUser();
  const supplierId = authUser?.supplierId || null;
  const [form] = Form.useForm();
  const [imagePreviewOpen, setImagePreviewOpen] = React.useState(false);
  const isEditMode = Boolean(productId);
  const categoryOptions = React.useMemo(
    () => listMasterData("categories").filter((item) => item.status === "Aktif").map((item) => ({ value: item.id, label: item.fullPath })),
    [],
  );
  const collectionOptions = React.useMemo(
    () => listMasterData("collections").filter((item) => item.status === "Aktif").map((item) => ({ value: item.id, label: item.name })),
    [],
  );
  const watchedImage = Form.useWatch("image", form) || "/products/baroque-necklace.svg";

  React.useEffect(() => {
    if (!supplierId) {
      message.error("Tedarikci eslesmesi bulunamadi.");
      navigate("/login", { replace: true });
      return;
    }

    if (!isEditMode) {
      navigate("/supplier/products", { replace: true });
      return;
    }

    const product = getProductById(productId);
    if (!product || product.supplierId !== supplierId) {
      message.error("Bu urun kaydina erisim yetkiniz yok.");
      navigate("/supplier/products", { replace: true });
      return;
    }

    form.setFieldsValue({
      ...product,
      supplierId,
    });
  }, [form, isEditMode, navigate, productId, supplierId]);

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Urun Karti</Title>
          <Text type="secondary">Bu ekranda sadece size ait urun kartini goruntuleyebilirsiniz.</Text>
        </div>
        <Space wrap>
          <Button onClick={() => navigate("/supplier/products")}>Listeye Don</Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <Row gutter={[20, 20]}>
          <Col xs={24} xl={8}>
            <Card title="Urun Gorseli">
              <div
                className="erp-product-preview"
                onClick={() => setImagePreviewOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setImagePreviewOpen(true);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <img src={watchedImage} alt="Urun gorseli" className="erp-product-image-large" />
              </div>
              <Form.Item name="image" hidden rules={[{ required: true, message: "Urun gorseli zorunludur." }]}>
                <Input />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} xl={16}>
            <Space direction="vertical" size={20} style={{ width: "100%" }}>
              <Card title="Urun Bilgileri" extra={<Tag color="blue">{form.getFieldValue("workflowStatus") || "Taslak"}</Tag>}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Form.Item name="supplierId" label="Tedarikci" rules={[{ required: true, message: "Tedarikci zorunludur." }]}>
                      <Select
                        disabled
                        options={listSuppliers().filter((item) => item.id === supplierId).map((item) => ({ value: item.id, label: item.company }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="code" label="Urun Kodu" rules={[{ required: true, message: "Urun kodu zorunludur." }]}>
                      <Input disabled />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="name" label="Urun Adi" rules={[{ required: true, message: "Urun adi zorunludur." }]}>
                      <Input disabled />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="salePrice"
                      label="Satis Fiyati"
                      rules={[
                        { required: true, message: "Satis fiyati zorunludur." },
                        { validator: (_, value) => Number(value || 0) > 0 ? Promise.resolve() : Promise.reject(new Error("Satis fiyati 0'dan buyuk olmali.")) },
                      ]}
                    >
                      <InputNumber style={{ width: "100%" }} min={0} addonAfter="TRY" disabled />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="categoryId" label="Kategori">
                      <Select options={categoryOptions} showSearch optionFilterProp="label" placeholder="Kategori seciniz" disabled />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="collectionId" label="Koleksiyon">
                      <Select options={collectionOptions} showSearch optionFilterProp="label" placeholder="Koleksiyon seciniz" disabled />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item name="notes" label="Urun Aciklamasi / Bilgilendirme">
                      <Input.TextArea rows={6} disabled />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              <Card title="Kayit Bilgisi">
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Form.Item name="workflowStatus" label="Kayit Durumu">
                      <Select
                        options={["Taslak", "Onaya Gonderildi", "Onaylandi", "Revizyon Istendi"].map((value) => ({ value, label: value }))}
                        disabled
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="status" label="Kart Durumu">
                      <Select options={["Aktif", "Pasif"].map((value) => ({ value, label: value }))} disabled />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Space>
          </Col>
        </Row>
      </Form>

      <Modal
        title="Urun Gorsel Onizleme"
        open={imagePreviewOpen}
        footer={null}
        onCancel={() => setImagePreviewOpen(false)}
        width={720}
      >
        <div className="erp-product-preview erp-product-preview-modal">
          <img src={watchedImage} alt="Urun gorseli buyuk onizleme" className="erp-product-image-zoom" />
        </div>
      </Modal>
    </Space>
  );
}

export function SupplierDeliveryListsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = React.useState({
    search: "",
    supplierId: undefined,
    status: undefined,
  });
  const supplierOptions = React.useMemo(
    () => [{ value: "all", label: "Tumu" }, ...listSuppliers().map((item) => ({ value: item.id, label: item.company }))],
    [],
  );
  const statusOptions = ["Tumu", "Taslak", "Onay Bekleniyor", "Onaylandi", "Tamamlandi", "Revizyon Istendi"].map((value) => ({
    value,
    label: value,
  }));
  const [records, setRecords] = React.useState(() => listDeliveryLists());

  const refreshRecords = () => {
    setRecords(listDeliveryLists());
  };

  const filteredRecords = React.useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesSearch =
        !normalizedSearch ||
        [record.deliveryNo, record.supplierName, record.contactName, record.trackingNo, record.note]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      const matchesSupplier =
        !filters.supplierId || filters.supplierId === "all" || record.supplierId === filters.supplierId;
      const matchesStatus =
        !filters.status ||
        filters.status === "Tumu" ||
        (record.status || "Taslak") === filters.status;

      return matchesSearch && matchesSupplier && matchesStatus;
    });
  }, [filters, records]);

  const handleStatusUpdate = async (recordId, status) => {
    const record = getDeliveryListById(recordId);
    if (!record) {
      return;
    }

    let updatedRecord = null;
    if (status === "Tamamlandi") {
      if ((record.status || "Taslak") !== "Onaylandi") {
        message.warning("Teslim alma islemi sadece onayli kayitlar icin yapilabilir.");
        return;
      }

      try {
        updatedRecord = completeDeliveryReceipt(recordId);
      } catch (error) {
        message.error(error?.message || "Teslimat stoğa aktarilirken hata olustu.");
        return;
      }
    } else {
      updatedRecord = updateDeliveryList(recordId, {
        ...record,
        status,
      });
      if (status === "Onaylandi") {
        await createDeliveryPdf(updatedRecord);
      }
    }

    refreshRecords();
    message.success(
      status === "Tamamlandi"
        ? "Teslimat tamamlandi ve stok hareketlerine aktarildi."
        : `Teslimat durumu "${status}" olarak guncellendi.`,
    );
  };

  const columns = [
    {
      title: "Teslimat No",
      dataIndex: "deliveryNo",
      key: "deliveryNo",
      sorter: (a, b) => a.deliveryNo.localeCompare(b.deliveryNo, "tr"),
      render: (value, record) => (
        <button
          type="button"
          className="erp-link-button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/supplier-portal/delivery-lists/${record.id}`);
          }}
        >
          {value}
        </button>
      ),
    },
    {
      title: "Tedarikci",
      dataIndex: "supplierName",
      key: "supplierName",
      sorter: (a, b) => a.supplierName.localeCompare(b.supplierName, "tr"),
    },
    {
      title: "Yetkili",
      dataIndex: "contactName",
      key: "contactName",
      sorter: (a, b) => a.contactName.localeCompare(b.contactName, "tr"),
    },
    {
      title: "Tarih",
      dataIndex: "date",
      key: "date",
      sorter: (a, b) => a.date.localeCompare(b.date, "tr"),
    },
    {
      title: "Kalem",
      dataIndex: "lineCount",
      key: "lineCount",
      sorter: (a, b) => a.lineCount - b.lineCount,
    },
    {
      title: "Toplam",
      dataIndex: "totalAmountDisplay",
      key: "totalAmountDisplay",
      sorter: (a, b) => a.totalAmount - b.totalAmount,
    },
    {
      title: "Teslimat Durumu",
      dataIndex: "status",
      key: "status",
      render: (value) => {
        const colorMap = {
          Taslak: "default",
          "Onay Bekleniyor": "gold",
          Onaylandi: "green",
          Tamamlandi: "blue",
          "Revizyon Istendi": "red",
        };
        return <Tag color={colorMap[value || "Taslak"] || "blue"}>{value || "Taslak"}</Tag>;
      },
    },
    {
      title: "Islemler",
      key: "actions",
      render: (_, record) => (
        <Space size={8}>
          <Tooltip title="Teslimat Formu">
            <Button type="text" className="erp-icon-btn" icon={<EyeOutlined />} onClick={(event) => { event.stopPropagation(); navigate(`/supplier-portal/delivery-lists/${record.id}`); }} />
          </Tooltip>
          <Tooltip title="Revizyon">
            <Button type="text" className="erp-icon-btn" icon={<EditOutlined />} onClick={(event) => { event.stopPropagation(); handleStatusUpdate(record.id, "Revizyon Istendi"); }} />
          </Tooltip>
          <Tooltip title="Onayla">
            <Button type="text" className="erp-icon-btn erp-icon-btn-edit" icon={<CheckOutlined />} onClick={(event) => { event.stopPropagation(); handleStatusUpdate(record.id, "Onaylandi"); }} />
          </Tooltip>
          <Tooltip title="Teslim Alindi">
            <Button
              type="text"
              className="erp-icon-btn"
              icon={<InboxOutlined />}
              disabled={(record.status || "Taslak") !== "Onaylandi" || Boolean(record.stockEntryId || record.inventoryPostedAt)}
              onClick={(event) => { event.stopPropagation(); handleStatusUpdate(record.id, "Tamamlandi"); }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 6 }}>Teslimat Listeleri</Title>
        <Text type="secondary">Tedarikciler tarafindan olusturulan teslimat listeleri burada izlenir, acilir ve durumlari guncellenir.</Text>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar">
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={refreshRecords}>Yenile</Button>
          </Space>

          <div className="erp-list-toolbar-filters">
            <Form.Item label="Teslimat / Tedarikci" style={{ marginBottom: 0 }}>
              <Input
                prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
                placeholder="Ara"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                allowClear
              />
            </Form.Item>
            <Form.Item label="Tedarikci" style={{ marginBottom: 0 }}>
              <Select
                value={filters.supplierId}
                onChange={(value) => setFilters((prev) => ({ ...prev, supplierId: value }))}
                options={supplierOptions}
                allowClear
              />
            </Form.Item>
            <Form.Item label="Durum" style={{ marginBottom: 0 }}>
              <Select
                value={filters.status}
                onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
                options={statusOptions}
                allowClear
              />
            </Form.Item>
          </div>
        </div>
      </Card>

      <Card title="Gelen Kayitlar" className="erp-list-table-card">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredRecords}
          pagination={false}
          locale={{ emptyText: "Tedarikci portalindan gelen kayit bulunmuyor." }}
          onRow={(record) => ({
            onClick: () => navigate(`/supplier-portal/delivery-lists/${record.id}`),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
        <div className="erp-table-footer">
          <span>Toplam Kayit: {filteredRecords.length}</span>
          <span>Satira tiklayarak teslimat formunu acabilirsiniz.</span>
        </div>
      </Card>
    </Space>
  );
}

export function SupplierPortalDeliveryListPage() {
  const navigate = useNavigate();
  const authUser = getAuthUser();
  const supplierId = authUser?.supplierId || null;
  const [records, setRecords] = React.useState(() => (supplierId ? listDeliveryListsBySupplier(supplierId) : []));
  const [search, setSearch] = React.useState("");
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedRecord, setSelectedRecord] = React.useState(null);

  const refreshRecords = React.useCallback(() => {
    setRecords(supplierId ? listDeliveryListsBySupplier(supplierId) : []);
  }, [supplierId]);

  const filteredRecords = React.useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return records.filter((record) => {
      if (!normalizedSearch) {
        return true;
      }

      return [record.deliveryNo, record.trackingNo, record.note, record.contactName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
  }, [records, search]);

  const columns = [
    {
      title: "Teslimat No",
      dataIndex: "deliveryNo",
      key: "deliveryNo",
      sorter: (a, b) => a.deliveryNo.localeCompare(b.deliveryNo, "tr"),
      render: (value, record) => (
        <button
          type="button"
          className="erp-link-button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/supplier/deliveries/${record.id}`);
          }}
        >
          {value}
        </button>
      ),
    },
    { title: "Tarih", dataIndex: "date", key: "date", sorter: (a, b) => a.date.localeCompare(b.date, "tr") },
    { title: "Yetkili", dataIndex: "contactName", key: "contactName", sorter: (a, b) => a.contactName.localeCompare(b.contactName, "tr") },
    { title: "Kalem", dataIndex: "lineCount", key: "lineCount", sorter: (a, b) => a.lineCount - b.lineCount },
    { title: "Toplam", dataIndex: "totalAmountDisplay", key: "totalAmountDisplay", sorter: (a, b) => a.totalAmount - b.totalAmount },
    {
      title: "Durum",
      dataIndex: "status",
      key: "status",
      render: (value) => {
        const colorMap = {
          Taslak: "default",
          "Onay Bekleniyor": "gold",
          Onaylandi: "green",
          Tamamlandi: "blue",
          "Revizyon Istendi": "red",
        };
        return <Tag color={colorMap[value || "Taslak"] || "blue"}>{value || "Taslak"}</Tag>;
      },
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Teslimat Listesi</Title>
          <Text type="secondary">Olusturdugunuz teslimatlar burada listelenir. Taslaklari duzenleyebilir ve gonderilen kayitlari izleyebilirsiniz.</Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={refreshRecords}>Yenile</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/supplier/deliveries/new")}>Teslimat Olustur</Button>
        </Space>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar erp-product-toolbar-single">
          <Space wrap className="erp-product-toolbar-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/supplier/deliveries/new")}>Yeni Teslimat</Button>
            <Button icon={<ReloadOutlined />} onClick={refreshRecords}>Yenile</Button>
          </Space>
          <div className="erp-product-toolbar-search">
            <Input
              prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
              placeholder="Teslimat no / kargo / not"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              allowClear
            />
          </div>
        </div>
      </Card>

      <Card title="Teslimatlarim" className="erp-list-table-card">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredRecords}
          pagination={false}
          locale={{ emptyText: "Henuz teslimat kaydiniz bulunmuyor." }}
          onRow={(record) => ({
            onClick: () => openDetailFromRow(setSelectedRecord, setDetailOpen, record),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
        <div className="erp-table-footer">
          <span>Toplam Kayit: {filteredRecords.length}</span>
          <span>Kaydi acarak duzenleyebilirsiniz.</span>
        </div>
      </Card>

      <Drawer title="Teslimat Detayi" placement="right" width={420} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {selectedRecord ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Teslimat No">{selectedRecord.deliveryNo}</Descriptions.Item>
            <Descriptions.Item label="Tedarikci">{selectedRecord.supplierName}</Descriptions.Item>
            <Descriptions.Item label="Yetkili">{selectedRecord.contactName}</Descriptions.Item>
            <Descriptions.Item label="Tarih">{selectedRecord.date}</Descriptions.Item>
            <Descriptions.Item label="Gonderim">{selectedRecord.shippingMethod || "-"}</Descriptions.Item>
            <Descriptions.Item label="Takip No">{selectedRecord.trackingNo || "-"}</Descriptions.Item>
            <Descriptions.Item label="Durum">{selectedRecord.status || "Taslak"}</Descriptions.Item>
            <Descriptions.Item label="Kalem">{selectedRecord.lineCount}</Descriptions.Item>
            <Descriptions.Item label="Not">{selectedRecord.note || "-"}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </Space>
  );
}

export function SupplierPortalDeliveryEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { deliveryId } = useParams();
  const authUser = getAuthUser();
  const isAdminView = location.pathname.startsWith("/supplier-portal/");
  const supplierId = authUser?.supplierId || null;
  const isEditMode = Boolean(deliveryId);
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [deliveryLines, setDeliveryLines] = React.useState([]);
  const [lineDraft, setLineDraft] = React.useState({
    productId: undefined,
    image: "",
    name: "",
    code: "",
    salePrice: 0,
    categoryId: undefined,
    categoryLabel: "",
    collectionId: undefined,
    collectionLabel: "",
    quantity: 1,
  });
  const [editIndex, setEditIndex] = React.useState(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editLine, setEditLine] = React.useState(null);
  const [promoteMode, setPromoteMode] = React.useState(false);
  const lineDraftInputRef = React.useRef(null);
  const editImageInputRef = React.useRef(null);
  const watchedLines = deliveryLines;
  const targetRecord = React.useMemo(() => (isEditMode ? getDeliveryListById(deliveryId) : null), [deliveryId, isEditMode]);
  const targetSupplierId = isAdminView ? (targetRecord?.supplierId || null) : supplierId;
  const supplier = React.useMemo(() => getSupplierById(targetSupplierId), [targetSupplierId]);
  const categoryOptions = React.useMemo(
    () => listMasterData("categories")
      .map((item) => ({ value: item.id, label: item.fullPath || item.level1 || item.id }))
      .sort((a, b) => a.label.localeCompare(b.label, "tr")),
    [],
  );
  const collectionOptions = React.useMemo(
    () => listMasterData("collections")
      .map((item) => ({ value: item.id, label: item.name || item.id }))
      .sort((a, b) => a.label.localeCompare(b.label, "tr")),
    [],
  );
  const categoryLabelMap = React.useMemo(
    () => Object.fromEntries(categoryOptions.map((item) => [item.value, item.label])),
    [categoryOptions],
  );
  const collectionLabelMap = React.useMemo(
    () => Object.fromEntries(collectionOptions.map((item) => [item.value, item.label])),
    [collectionOptions],
  );
  const productOptions = React.useMemo(
    () => listProductsBySupplier(targetSupplierId)
      .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      .map((item) => ({ value: item.id, label: `${item.name} - ${item.code}`, product: item })),
    [targetSupplierId],
  );
  const totalAmount = React.useMemo(
    () => watchedLines.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.salePrice || 0)), 0),
    [watchedLines],
  );
  const currentStatus = Form.useWatch("status", form) || "Taslak";
  const isDeliveryLocked = isAdminView || !["Taslak", "Revizyon Istendi"].includes(currentStatus);

  React.useEffect(() => {
    if (!isAdminView && !supplierId) {
      message.error("Tedarikci eslesmesi bulunamadi.");
      navigate("/login", { replace: true });
      return;
    }

    const baseValues = {
      supplierId: targetSupplierId,
      supplierName: supplier?.company || "",
      contactName: supplier?.contact || "",
      supplierEmail: supplier?.email || authUser?.email || "",
      date: new Date().toISOString().slice(0, 10),
      deliveryNo: getNextDeliveryNoPreview(targetSupplierId),
      shippingMethod: "Kargo",
      trackingNo: "",
      status: "Taslak",
      lines: [],
    };

    if (!isEditMode) {
      if (isAdminView) {
        navigate("/supplier-portal/delivery-lists", { replace: true });
        return;
      }
      form.setFieldsValue(baseValues);
      setDeliveryLines([]);
      return;
    }

    const deliveryRecord = getDeliveryListById(deliveryId);
    if (!deliveryRecord || (!isAdminView && deliveryRecord.supplierId !== supplierId)) {
      message.error("Bu teslimat kaydina erisim yetkiniz yok.");
      navigate(isAdminView ? "/supplier-portal/delivery-lists" : "/supplier/deliveries", { replace: true });
      return;
    }

    const loadedLines = deliveryRecord.lines || [];
    form.setFieldsValue({
      ...baseValues,
      ...deliveryRecord,
      lines: loadedLines,
    });
    setDeliveryLines(loadedLines);
  }, [authUser?.email, deliveryId, form, isAdminView, isEditMode, navigate, supplier?.company, supplier?.contact, supplier?.email, supplierId, targetSupplierId]);

  const resetLineDraft = React.useCallback(() => {
    setLineDraft({
      productId: undefined,
      image: "",
      name: "",
      code: "",
      salePrice: 0,
      categoryId: undefined,
      categoryLabel: "",
      collectionId: undefined,
      collectionLabel: "",
      quantity: 1,
    });
  }, []);

  const handleDraftProductSelect = (productId) => {
    if (isDeliveryLocked) {
      return;
    }
    const product = listProductsBySupplier(targetSupplierId).find((item) => item.id === productId) || getProductById(productId);
    if (!product) {
      return;
    }

    setLineDraft((current) => ({
      ...current,
      productId,
      image: product.image || "",
      name: product.name || "",
      code: product.code || "",
      salePrice: Number(product.salePrice || 0),
      categoryId: product.categoryId || undefined,
      categoryLabel: product.categoryLabel || categoryLabelMap[product.categoryId] || "",
      collectionId: product.collectionId || undefined,
      collectionLabel: product.collectionLabel || collectionLabelMap[product.collectionId] || "",
    }));
  };

  const handleDraftImageUpload = (file) => {
    if (isDeliveryLocked) {
      return;
    }
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      message.error("Gecerli bir gorsel secmelisiniz.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLineDraft((current) => ({ ...current, image: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddLine = () => {
    if (isDeliveryLocked) {
      return;
    }
    if (!lineDraft.image) {
      message.warning("Gorsel eklemelisin.");
      return;
    }

    if (!lineDraft.name || !lineDraft.code || !lineDraft.salePrice || !lineDraft.quantity) {
      message.warning("Urun adi, kod, birim fiyat ve teslim adedi zorunludur.");
      return;
    }

    const nextLines = [
      ...deliveryLines,
      {
        id: `line-${Date.now()}`,
        productId: lineDraft.productId || null,
        isNewProduct: !lineDraft.productId,
        image: lineDraft.image,
        name: lineDraft.name,
        code: lineDraft.code,
        salePrice: Number(lineDraft.salePrice),
        saleCurrency: "TRY",
        categoryId: lineDraft.categoryId || null,
        categoryLabel: lineDraft.categoryLabel || "",
        collectionId: lineDraft.collectionId || null,
        collectionLabel: lineDraft.collectionLabel || "",
        quantity: Number(lineDraft.quantity),
        description: "",
      },
    ];

    setDeliveryLines(nextLines);
    form.setFieldValue("lines", nextLines);
    resetLineDraft();
    message.success("Urun listeye eklendi.");
  };

  const handleDeleteLine = (index) => {
    if (isDeliveryLocked) {
      return;
    }
    const currentLines = [...deliveryLines];
    currentLines.splice(index, 1);
    setDeliveryLines(currentLines);
    form.setFieldValue("lines", currentLines);
  };

  const openEditDrawer = (index) => {
    if (isDeliveryLocked && !isAdminView) {
      return;
    }
    const target = watchedLines[index];
    if (!target) {
      return;
    }
    setEditIndex(index);
    setEditLine({ ...target });
    setPromoteMode(false);
    setEditOpen(true);
  };

  const openPromoteDrawer = (index) => {
    const target = watchedLines[index];
    if (!target) {
      return;
    }
    setEditIndex(index);
    setEditLine({ ...target });
    setPromoteMode(true);
    setEditOpen(true);
  };

  const handleEditImageUpload = (file) => {
    if (isDeliveryLocked) {
      return;
    }
    if (!file || !editLine) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      message.error("Gecerli bir gorsel secmelisiniz.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setEditLine((current) => ({ ...current, image: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEditLine = () => {
    if (isDeliveryLocked && !isAdminView) {
      return;
    }
    if (editIndex === null || !editLine) {
      return;
    }

    const currentLines = [...deliveryLines];
    currentLines[editIndex] = {
      ...currentLines[editIndex],
      ...editLine,
      salePrice: Number(editLine.salePrice || 0),
      quantity: Number(editLine.quantity || 0),
      categoryLabel: categoryLabelMap[editLine.categoryId] || editLine.categoryLabel || "",
      collectionLabel: collectionLabelMap[editLine.collectionId] || editLine.collectionLabel || "",
    };
    setDeliveryLines(currentLines);
    form.setFieldValue("lines", currentLines);
    setEditOpen(false);
    setEditIndex(null);
    setEditLine(null);
  };

  const handlePromoteLineToProduct = () => {
    if (!isAdminView || editIndex === null || !editLine || !targetSupplierId) {
      return;
    }
    if (!editLine.name || !editLine.code) {
      message.error("Urun adi ve urun kodu zorunludur.");
      return;
    }

    const duplicate = listProductsBySupplier(targetSupplierId).find((product) => product.code === editLine.code && product.id !== editLine.productId);
    if (duplicate) {
      message.error("Bu urun kodu daha once kullanilmis.");
      return;
    }

    const savedProduct = createProduct({
      supplierId: targetSupplierId,
      code: editLine.code,
      name: editLine.name,
      salePrice: editLine.salePrice,
      saleCurrency: editLine.saleCurrency || "TRY",
      cost: 0,
      costCurrency: "TRY",
      categoryId: editLine.categoryId || null,
      collectionId: editLine.collectionId || null,
      posCategoryId: null,
      barcode: "",
      supplierCode: editLine.code,
      minStock: 0,
      supplierLeadTime: 0,
      productType: "konsinye",
      salesTax: "%20",
      image: editLine.image,
      isForSale: true,
      isForPurchase: true,
      useInPos: true,
      trackInventory: true,
      status: "Aktif",
      workflowStatus: "Onaylandi",
      createdBy: authUser?.id || null,
      notes: editLine.description || "",
      features: [],
    });

    const currentLines = [...deliveryLines];
    currentLines[editIndex] = {
      ...currentLines[editIndex],
      ...editLine,
      productId: savedProduct.id,
      isNewProduct: false,
      code: savedProduct.code,
      name: savedProduct.name,
      categoryId: savedProduct.categoryId || editLine.categoryId || null,
      categoryLabel: savedProduct.categoryLabel || categoryLabelMap[editLine.categoryId] || editLine.categoryLabel || "",
      collectionId: savedProduct.collectionId || editLine.collectionId || null,
      collectionLabel: savedProduct.collectionLabel || collectionLabelMap[editLine.collectionId] || editLine.collectionLabel || "",
    };
    setDeliveryLines(currentLines);
    form.setFieldValue("lines", currentLines);
    updateDeliveryList(deliveryId, {
      ...form.getFieldsValue(),
      supplierId: targetSupplierId,
      supplierName: supplier?.company || "",
      contactName: supplier?.contact || "",
      supplierEmail: supplier?.email || "",
      createdBy: targetRecord?.createdBy || authUser?.id || null,
      status: form.getFieldValue("status") || targetRecord?.status || "Taslak",
      lines: currentLines,
    });
    setEditOpen(false);
    setEditIndex(null);
    setEditLine(null);
    setPromoteMode(false);
    message.success("Satir urun kartina donusturuldu.");
  };

  const validateBeforeAction = async () => {
    const values = await form.validateFields();
    if (!deliveryLines.length) {
      message.warning("Urun listesi bos olamaz.");
      return null;
    }
    return {
      ...values,
      lines: deliveryLines,
    };
  };

  const handleSave = async (status, shouldDownloadPdf = false) => {
    try {
      setLoading(true);
      const values = await validateBeforeAction();
      if (!values) {
        return;
      }

      const payload = {
        ...values,
        supplierId: targetSupplierId,
        supplierName: supplier?.company || "",
        contactName: supplier?.contact || "",
        supplierEmail: supplier?.email || authUser?.email || "",
        status,
        createdBy: authUser?.id || null,
      };

      const savedRecord = isEditMode ? updateDeliveryList(deliveryId, payload) : createDeliveryList(payload);
      if (shouldDownloadPdf || status === "Onay Bekleniyor") {
        await createDeliveryPdf(savedRecord);
      }
      message.success(status === "Onay Bekleniyor" ? "Teslimat onaya gonderildi." : "Teslimat kaydedildi.");
      navigate(isAdminView ? `/supplier-portal/delivery-lists/${savedRecord.id}` : `/supplier/deliveries/${savedRecord.id}`);
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      message.error(error?.message || "Teslimat kaydedilirken hata olustu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>{isAdminView ? "Teslimat Formu" : "Teslimat Olustur"}</Title>
          <Text type="secondary">{isAdminView ? "Tedarikciden gelen teslimat satirlarini inceleyin, yeni urun adaylarini urun kartina donusturun." : "Teslimat genel bilgilerini doldurun, urunleri ekleyin ve hazir oldugunda satin alma birimine gonderin."}</Text>
        </div>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => handleSave(form.getFieldValue("status") || "Taslak", true)} loading={loading}>
            PDF Olarak Indir
          </Button>
          {isAdminView ? (
            <Button onClick={() => navigate("/supplier-portal/delivery-lists")}>Listeye Don</Button>
          ) : (
            <>
              <Button onClick={() => handleSave("Taslak")} loading={loading} disabled={isDeliveryLocked}>
                Taslak Kaydet
              </Button>
              <Button type="primary" onClick={() => handleSave("Onay Bekleniyor")} loading={loading} disabled={isDeliveryLocked}>
                Onaya Gonder
              </Button>
            </>
          )}
        </Space>
      </div>

      {isDeliveryLocked ? (
        <Card
          size="small"
          style={{
            borderColor: "#ffe0b2",
            background: "#fff7e8",
          }}
        >
          <Text strong style={{ color: "#ad6800" }}>
            Bu teslimat su an onay surecindedir, duzenleme yapilamaz.
          </Text>
        </Card>
      ) : null}

      <Form form={form} layout="vertical">
        <Card title="Teslimat Genel Bilgiler">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12} xl={6}><Form.Item name="deliveryNo" label="Teslimat Kodu"><Input disabled /></Form.Item></Col>
            <Col xs={24} md={12} xl={6}><Form.Item name="supplierName" label="Firma"><Input disabled /></Form.Item></Col>
            <Col xs={24} md={12} xl={6}><Form.Item name="contactName" label="Yetkili Kisi"><Input disabled /></Form.Item></Col>
            <Col xs={24} md={12} xl={6}><Form.Item name="supplierEmail" label="E-posta"><Input disabled /></Form.Item></Col>
            <Col xs={24} md={12} xl={6}><Form.Item name="date" label="Tarih" rules={[{ required: true, message: "Tarih zorunludur." }]}><Input type="date" disabled={isDeliveryLocked} /></Form.Item></Col>
            <Col xs={24} md={12} xl={6}><Form.Item name="status" label="Durum"><Input disabled /></Form.Item></Col>
            <Col xs={24} md={12} xl={6}><Form.Item name="shippingMethod" label="Gonderim Sekli"><Select disabled={isDeliveryLocked} options={["Kargo", "Ambar", "Kurye", "Elden Teslim"].map((value) => ({ value, label: value }))} /></Form.Item></Col>
            <Col xs={24} md={12} xl={6}><Form.Item name="trackingNo" label="Takip Kodu"><Input placeholder="Takip kodu" disabled={isDeliveryLocked} /></Form.Item></Col>
          </Row>
        </Card>

        <Card title="Urun Listesi" bodyStyle={{ paddingTop: 16 }} style={{ marginTop: 12 }}>
          {!isAdminView ? (
          <Card size="small" title="Urun Ekleme" style={{ marginBottom: 12 }}>
            <Row gutter={[12, 12]} align="bottom">
              <Col xs={24} md={7}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Urun Adi</div>
                <AutoComplete
                  value={lineDraft.name}
                  options={productOptions.map((item) => ({ value: item.label, label: item.label, productId: item.value }))}
                  placeholder="Liste secin veya manuel urun adi yazin"
                  disabled={isDeliveryLocked}
                  filterOption={(inputValue, option) => (option?.value || "").toLowerCase().includes(inputValue.toLowerCase())}
                  onSelect={(_, option) => {
                    if (option?.productId) {
                      handleDraftProductSelect(option.productId);
                    }
                  }}
                  onChange={(value) => {
                    setLineDraft((current) => ({
                      ...current,
                      productId: undefined,
                      name: value,
                    }));
                  }}
                />
              </Col>
              <Col xs={24} md={3}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Urun Kodu</div>
                <Input disabled={isDeliveryLocked} value={lineDraft.code} onChange={(event) => setLineDraft((current) => ({ ...current, code: event.target.value }))} />
              </Col>
              <Col xs={24} md={4}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Satis Fiyati</div>
                <InputNumber disabled={isDeliveryLocked} style={{ width: "100%" }} min={0} value={lineDraft.salePrice} onChange={(value) => setLineDraft((current) => ({ ...current, salePrice: value || 0 }))} addonAfter="TRY" />
              </Col>
              <Col xs={24} md={5}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Kategori</div>
                <Select
                  disabled={isDeliveryLocked}
                  value={lineDraft.categoryId}
                  options={categoryOptions}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Kategori seciniz"
                  allowClear
                  onChange={(value) => setLineDraft((current) => ({
                    ...current,
                    categoryId: value,
                    categoryLabel: value ? categoryLabelMap[value] || "" : "",
                  }))}
                />
              </Col>
              <Col xs={24} md={3}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Teslim Adedi</div>
                <InputNumber disabled={isDeliveryLocked} style={{ width: "100%" }} min={1} value={lineDraft.quantity} onChange={(value) => setLineDraft((current) => ({ ...current, quantity: value || 1 }))} />
              </Col>
              <Col xs={24} md={5}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Gorsel</div>
                <Space.Compact style={{ width: "100%" }}>
                  <Button onClick={() => lineDraftInputRef.current?.click()} disabled={isDeliveryLocked}>Gorsel Sec</Button>
                  <Input value={lineDraft.image ? "Gorsel eklendi" : ""} placeholder="Gorsel gerekli" readOnly />
                </Space.Compact>
                <input
                  ref={lineDraftInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    handleDraftImageUpload(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </Col>
              <Col xs={24} md={2}>
                <Button type="primary" block onClick={handleAddLine} disabled={isDeliveryLocked} style={{ marginTop: 30 }}>
                  Ekle
                </Button>
              </Col>
            </Row>
          </Card>
          ) : null}

          <Table
            rowKey={(record, index) => record.id || `delivery-line-${index}`}
            pagination={false}
            dataSource={watchedLines.map((item, index) => ({ ...item, _rowIndex: index, totalAmount: Number(item.salePrice || 0) * Number(item.quantity || 0) }))}
            columns={[
              {
                title: "Gorsel",
                dataIndex: "image",
                key: "image",
                width: 90,
                render: (value) => <img src={value || "/products/baroque-necklace.svg"} alt="Urun" className="erp-delivery-line-image" />,
              },
              { title: "Urun Kodu", dataIndex: "code", key: "code", width: 140 },
              {
                title: "Urun Adi",
                dataIndex: "name",
                key: "name",
                render: (_, record) => (
                  <Space direction="vertical" size={0}>
                    <Text strong>{record.name}</Text>
                    <Text type="secondary">{record.categoryLabel || "-"}</Text>
                  </Space>
                ),
              },
              {
                title: "Satis Fiyati",
                dataIndex: "salePrice",
                key: "salePrice",
                width: 140,
                render: (value) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(value || 0)),
              },
              { title: "Teslim Adet", dataIndex: "quantity", key: "quantity", width: 110 },
              {
                title: "Toplam Tutar",
                dataIndex: "totalAmount",
                key: "totalAmount",
                width: 150,
                render: (value) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(value || 0)),
              },
              {
                title: "Islemler",
                key: "actions",
                width: isAdminView ? 260 : 150,
                render: (_, record) => (
                  <Space size={4}>
                    <Tooltip title="Duzenle">
                      <Button type="text" className="erp-icon-btn erp-icon-btn-edit" icon={<EditOutlined />} onClick={() => openEditDrawer(record._rowIndex)} disabled={isDeliveryLocked && !isAdminView} />
                    </Tooltip>
                    {isAdminView && record.isNewProduct && !record.productId ? (
                      <Tooltip title="Urun Olarak Ekle">
                        <Button type="text" className="erp-icon-btn" icon={<PlusCircleOutlined />} onClick={() => openPromoteDrawer(record._rowIndex)} />
                      </Tooltip>
                    ) : null}
                    {!isAdminView ? (
                      <Tooltip title="Sil">
                        <Button danger type="text" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} onClick={() => handleDeleteLine(record._rowIndex)} disabled={isDeliveryLocked} />
                      </Tooltip>
                    ) : null}
                  </Space>
                ),
              },
            ]}
            summary={() => (
              <Table.Summary>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={5}>
                    <Text strong>Alt Toplam</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5}>
                    <Text strong>{new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(totalAmount)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} />
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>
      </Form>

      <Drawer
        title="Teslimat Satiri Duzenle"
        placement="right"
        width={440}
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditIndex(null);
          setEditLine(null);
        }}
      >
        {editLine ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div className="erp-product-preview" style={{ minHeight: 220 }} onClick={() => (!isDeliveryLocked || isAdminView) && editImageInputRef.current?.click()} role="button" tabIndex={0}>
              <img src={editLine.image || "/products/baroque-necklace.svg"} alt="Urun gorseli" className="erp-product-image-large" />
            </div>
            <input
              ref={editImageInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(event) => {
                handleEditImageUpload(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <Button onClick={() => editImageInputRef.current?.click()} disabled={isDeliveryLocked && !isAdminView}>Gorsel Degistir</Button>
            <div>
              <Text strong>Urun Adi</Text>
              <Input disabled={isDeliveryLocked && !isAdminView} value={editLine.name} onChange={(event) => setEditLine((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div>
              <Text strong>Urun Kodu</Text>
              <Input disabled={isDeliveryLocked && !isAdminView} value={editLine.code} onChange={(event) => setEditLine((current) => ({ ...current, code: event.target.value }))} />
            </div>
            <Row gutter={12}>
              <Col span={12}>
                <Text strong>Kategori</Text>
                <Select
                  disabled={isDeliveryLocked && !isAdminView}
                  style={{ width: "100%" }}
                  value={editLine.categoryId}
                  options={categoryOptions}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Kategori seciniz"
                  allowClear
                  onChange={(value) => setEditLine((current) => ({
                    ...current,
                    categoryId: value,
                    categoryLabel: value ? categoryLabelMap[value] || "" : "",
                  }))}
                />
              </Col>
              <Col span={12}>
                <Text strong>Koleksiyon</Text>
                <Select
                  disabled={isDeliveryLocked && !isAdminView}
                  style={{ width: "100%" }}
                  value={editLine.collectionId}
                  options={collectionOptions}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Koleksiyon seciniz"
                  allowClear
                  onChange={(value) => setEditLine((current) => ({
                    ...current,
                    collectionId: value,
                    collectionLabel: value ? collectionLabelMap[value] || "" : "",
                  }))}
                />
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={12}>
                <Text strong>Satis Fiyati</Text>
                <InputNumber disabled={isDeliveryLocked && !isAdminView} style={{ width: "100%" }} min={0} value={editLine.salePrice} onChange={(value) => setEditLine((current) => ({ ...current, salePrice: value || 0 }))} addonAfter="TRY" />
              </Col>
              <Col span={12}>
                <Text strong>Teslim Adedi</Text>
                <InputNumber disabled={isDeliveryLocked && !isAdminView} style={{ width: "100%" }} min={1} value={editLine.quantity} onChange={(value) => setEditLine((current) => ({ ...current, quantity: value || 1 }))} />
              </Col>
            </Row>
            <div>
              <Text strong>Aciklama</Text>
              <Input.TextArea disabled={isDeliveryLocked && !isAdminView} rows={4} value={editLine.description} onChange={(event) => setEditLine((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <Space style={{ justifyContent: "flex-end", width: "100%" }}>
              <Button onClick={() => setEditOpen(false)}>Vazgec</Button>
              {isAdminView && promoteMode && editLine.isNewProduct && !editLine.productId ? (
                <Button type="primary" onClick={handlePromoteLineToProduct}>Urun Olarak Kaydet</Button>
              ) : (
                <Button type="primary" onClick={handleSaveEditLine} disabled={isDeliveryLocked && !isAdminView}>Guncelle</Button>
              )}
            </Space>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}

export function ParametersPage() {
  const [form] = Form.useForm();

  React.useEffect(() => {
    form.setFieldsValue(getSystemParameters());
  }, [form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      updateSystemParameters(values);
      message.success("Parametreler kaydedildi.");
    } catch {
      // validation handled by form
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Parametreler</Title>
          <Text type="secondary">Sistem genelinde kullanilan ac/kapat ve davranis parametreleri burada yonetilir.</Text>
        </div>
        <Button type="primary" onClick={handleSubmit}>Kaydet</Button>
      </div>

      <Card title="Genel Parametreler" extra={<Tag color="blue">Kalici Kayit Acik</Tag>}>
        <Form
          form={form}
          layout="vertical"
          initialValues={getSystemParameters()}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12} xl={8}>
              <Card size="small" title="Urun Kodu Kontrolu">
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Text type="secondary">
                    Aktifken urun kodu tedarikci kisa koduna gore otomatik uretilir ve tekrar kontrol edilir. Pasifken manuel girise izin verilir.
                  </Text>
                  <Form.Item name="productCodeControlEnabled" valuePropName="checked" style={{ marginBottom: 0 }}>
                    <Switch checkedChildren="Aktif" unCheckedChildren="Pasif" />
                  </Form.Item>
                </Space>
              </Card>
            </Col>
          </Row>
        </Form>
      </Card>
    </Space>
  );
}

export function SmtpSettingsPage() {
  const [smtpForm] = Form.useForm();
  const [testForm] = Form.useForm();
  const [testing, setTesting] = React.useState(false);

  React.useEffect(() => {
    smtpForm.setFieldsValue(getSmtpSettings());
  }, [smtpForm]);

  const handleSubmit = async () => {
    try {
      const smtpValues = await smtpForm.validateFields();
      updateSmtpSettings(smtpValues);
      message.success("SMTP ayarlari kaydedildi.");
    } catch {
      // validation handled by form
    }
  };

  const handleSendTestEmail = async () => {
    try {
      const values = await testForm.validateFields();
      setTesting(true);
      const response = await fetch("/api/settings/smtp/test", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: values.toEmail }),
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.message || "Test maili gonderilemedi.");
      }

      message.success(payload?.message || "Test maili gonderildi.");
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      message.error(error?.message || "Test maili gonderilemedi.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>SMTP ve E-posta</Title>
          <Text type="secondary">Sifre yenileme kodu gonderimi icin SMTP ayarlarinizi bu ekrandan yonetin.</Text>
        </div>
        <Button type="primary" onClick={handleSubmit}>Kaydet</Button>
      </div>

      <Card title="SMTP Ayarlari" extra={<Tag color="gold">Sifremi Unuttum Maili</Tag>}>
        <Form
          form={smtpForm}
          layout="vertical"
          initialValues={getSmtpSettings()}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12} xl={8}>
              <Card size="small" title="SMTP Durumu">
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Text type="secondary">
                    Aktif oldugunda sifre yenileme kodlari ekranda gosterilmek yerine e-posta ile gonderilir.
                  </Text>
                  <Form.Item name="enabled" valuePropName="checked" style={{ marginBottom: 0 }}>
                    <Switch checkedChildren="Aktif" unCheckedChildren="Pasif" />
                  </Form.Item>
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <Form.Item name="host" label="SMTP Host" rules={[{ required: true, message: "SMTP host zorunludur." }]}>
                <Input placeholder="smtp.gmail.com" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={4}>
              <Form.Item name="port" label="Port" rules={[{ required: true, message: "Port zorunludur." }]}>
                <InputNumber min={1} max={65535} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={4}>
              <Form.Item name="secure" label="Secure" valuePropName="checked">
                <Switch checkedChildren="SSL/TLS" unCheckedChildren="STARTTLS" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <Form.Item name="username" label="Kullanici" rules={[{ required: true, message: "SMTP kullanici zorunludur." }]}>
                <Input placeholder="ornek@alanadi.com" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <Form.Item name="password" label="Sifre / App Password" rules={[{ required: true, message: "SMTP sifresi zorunludur." }]}>
                <Input.Password />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <Form.Item name="fromName" label="Gonderen Adi">
                <Input placeholder="Sibella Atelier" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <Form.Item
                name="fromEmail"
                label="Gonderen E-posta"
                rules={[
                  { required: true, message: "Gonderen e-posta zorunludur." },
                  { type: "email", message: "Gecerli bir e-posta girin." },
                ]}
              >
                <Input placeholder="noreply@sibella.com" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card title="SMTP Testi" extra={<Tag color="green">Dogrulama</Tag>}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Text type="secondary">
            Once SMTP ayarlarini kaydedin, ardindan test e-posta adresi girerek test maili gonderin.
          </Text>
          <Form form={testForm} layout="vertical">
            <Row gutter={[12, 12]} align="bottom">
              <Col xs={24} md={16} xl={12}>
                <Form.Item
                  name="toEmail"
                  label="Test E-posta Adresi"
                  rules={[
                    { required: true, message: "Test e-posta adresi zorunludur." },
                    { type: "email", message: "Gecerli bir e-posta adresi girin." },
                  ]}
                >
                  <Input placeholder="ornek@alanadi.com" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8} xl={4}>
                <Button type="primary" block loading={testing} onClick={handleSendTestEmail}>
                  Test Maili Gonder
                </Button>
              </Col>
            </Row>
          </Form>
        </Space>
      </Card>
    </Space>
  );
}

