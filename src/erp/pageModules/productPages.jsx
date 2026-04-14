import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Card, Col, Descriptions, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Radio, Row, Segmented, Select, Space, Switch, Table, Tabs, Tag, Typography, message } from "antd";
import { AppstoreOutlined, BarsOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, FilterOutlined, LeftOutlined, PlusOutlined, RightOutlined, SearchOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import { listMasterDataFresh } from "../masterData";
import { createProduct, deleteProduct, importProducts, listProductsFresh, updateProduct } from "../productsData";
import { listSuppliersFresh } from "../suppliersData";
import { getSystemParametersFresh } from "../systemParameters";

const { Title, Text } = Typography;

function downloadWorkbook(rows, sheetName, fileName) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

function openDetailFromRow(setSelected, setOpen, record) {
  setSelected(record);
  setOpen(true);
}

function preventRowClick(event) {
  event.stopPropagation();
}

export function ProductListPage() {
  const navigate = useNavigate();
  const SAVED_FILTERS_KEY = "sibella.erp.productFilters.v1";
  const [viewMode, setViewMode] = React.useState("liste");
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState(null);
  const [products, setProducts] = React.useState([]);
  const [tableLoading, setTableLoading] = React.useState(true);
  const [categoryOptions, setCategoryOptions] = React.useState([{ value: "all", label: "Tumu" }]);
  const [collectionOptions, setCollectionOptions] = React.useState([{ value: "all", label: "Tumu" }]);
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
  const statusOptions = ["Tumu", "Aktif", "Pasif"].map((value) => ({ value, label: value }));

  const refreshProducts = React.useCallback(async () => {
    setTableLoading(true);
    try {
      const [productRows, categoryRows, collectionRows] = await Promise.all([
        listProductsFresh(),
        listMasterDataFresh("categories"),
        listMasterDataFresh("collections"),
      ]);

      setProducts(productRows);
      setCategoryOptions([
        { value: "all", label: "Tumu" },
        ...categoryRows.map((item) => ({ value: item.id, label: item.fullPath })),
      ]);
      setCollectionOptions([
        { value: "all", label: "Tumu" },
        ...collectionRows.map((item) => ({ value: item.id, label: item.name })),
      ]);
    } catch (error) {
      message.error(error?.message || "Urun listesi yuklenemedi.");
    } finally {
      setTableLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshProducts();

    const handleFocus = () => {
      void refreshProducts();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshProducts();
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
    void refreshProducts();
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

  const handleDownloadTemplate = async () => {
    const header = ["code", "name", "salePrice", "saleCurrency", "cost", "costCurrency", "categoryId", "collectionId", "posCategoryId", "supplierId", "barcode", "supplierCode", "minStock", "supplierLeadTime", "productType", "status", "image", "salesTax", "notes"];
    const example = ["SBL-100", "Ornek Urun", "1250", "TRY", "450", "TRY", "cat-001", "col-001", "poscat-001", "sup-001", "868000001000", "TED-001", "2", "7", "kendi", "Aktif", "/products/baroque-necklace.svg", "%20", "Ornek not"];
    try {
      const [posCategories, suppliers] = await Promise.all([
        listMasterDataFresh("pos-categories"),
        listSuppliersFresh(),
      ]);

      const categoryRows = [
        ["categoryId", "categoryName"],
        ...categoryOptions
          .filter((item) => item.value !== "all")
          .map((item) => [item.value, item.label]),
      ];

      const collectionRows = [
        ["collectionId", "collectionName"],
        ...collectionOptions
          .filter((item) => item.value !== "all")
          .map((item) => [item.value, item.label]),
      ];

      const posCategoryRows = [
        ["posCategoryId", "posCategoryName"],
        ...posCategories.map((item) => [item.id, item.name || item.id]),
      ];

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
    } catch (error) {
      message.error(error?.message || "Sablon indirilirken hata olustu.");
    }
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
      await refreshProducts();
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
      <div className="erp-page-intro erp-page-intro-mobile-products erp-page-intro-product-mobile-only">
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Ürünlerim</Title>
          <Text type="secondary">Yalnızca size ait ürün kayıtlarını görüntüleyebilirsiniz.</Text>
        </div>
        <Space wrap className="erp-page-intro-actions">
          <Button onClick={() => void refreshProducts()}>Yenile</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
        </Space>
      </div>

      <div className="erp-page-intro erp-page-intro-desktop-only">
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

      <Card bordered={false} className="erp-list-toolbar-card erp-mobile-hide">
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
            loading={tableLoading}
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
  const [pageLoading, setPageLoading] = React.useState(false);
  const [imageModalOpen, setImageModalOpen] = React.useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = React.useState(false);
  const imageInputRef = React.useRef(null);
  const initialSupplierIdRef = React.useRef(null);
  const initialProductCodeRef = React.useRef("");
  const [systemParameters, setSystemParameters] = React.useState({ productCodeControlEnabled: true });
  const [productList, setProductList] = React.useState([]);
  const [categoryOptions, setCategoryOptions] = React.useState([]);
  const [collectionOptions, setCollectionOptions] = React.useState([]);
  const [posCategoryOptions, setPosCategoryOptions] = React.useState([]);
  const [supplierOptions, setSupplierOptions] = React.useState([]);
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

  React.useEffect(() => {
    let cancelled = false;
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

    const loadEditorData = async () => {
      try {
        setPageLoading(true);
        const [
          nextSystemParameters,
          products,
          categories,
          collections,
          posCategories,
          suppliers,
        ] = await Promise.all([
          getSystemParametersFresh(),
          listProductsFresh(),
          listMasterDataFresh("categories"),
          listMasterDataFresh("collections"),
          listMasterDataFresh("pos-categories"),
          listSuppliersFresh(),
        ]);

        if (cancelled) {
          return;
        }

        setSystemParameters(nextSystemParameters);
        setProductList(products);
        setCategoryOptions(categories.map((item) => ({ value: item.id, label: item.fullPath })));
        setCollectionOptions(collections.map((item) => ({ value: item.id, label: item.name })));
        setPosCategoryOptions(posCategories.map((item) => ({ value: item.id, label: item.name })));
        setSupplierOptions(suppliers.map((item) => ({
          value: item.id,
          label: item.company,
          shortCode: item.shortCode,
        })));

        if (!isEditMode) {
          initialSupplierIdRef.current = null;
          initialProductCodeRef.current = "";
          form.setFieldsValue(baseValues);
          return;
        }

        const product = products.find((item) => item.id === productId);
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
      } catch (error) {
        if (!cancelled) {
          message.error(error?.message || "Urun ekrani verileri alinamadi.");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadEditorData();

    return () => {
      cancelled = true;
    };
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

    const supplier = supplierOptions.find((item) => item.value === watchedSupplierId);
    const shortCode = String(supplier?.shortCode || "").trim().toUpperCase();
    if (!shortCode) {
      form.setFieldValue("code", "");
      return;
    }

    const supplierProductCount = productList.filter((item) => item.supplierId === watchedSupplierId && item.id !== productId).length;
    const nextCode = `${shortCode}${String(supplierProductCount + 1).padStart(4, "0")}`;
    form.setFieldValue("code", nextCode);
  }, [form, isEditMode, productId, productList, supplierOptions, systemParameters.productCodeControlEnabled, watchedSupplierId]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      if (systemParameters.productCodeControlEnabled) {
        const duplicateProduct = productList.find((item) => item.code === values.code && item.id !== productId);
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
                loading={pageLoading}
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

              <Card title="Fiyat Bilgileri" loading={pageLoading}>
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
            <Card title="Urun Karti" loading={pageLoading}>
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

