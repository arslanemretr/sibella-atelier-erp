import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Descriptions, Drawer, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { DeleteOutlined, DownloadOutlined, EditOutlined, FilterOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { listMasterDataFresh } from "../masterData";
import { listProductsFresh } from "../productsData";
import { listPurchasesFresh } from "../purchasesData";
import { listStockEntriesFresh } from "../stockEntriesData";
import { listSuppliersFresh } from "../suppliersData";

const { Title, Text } = Typography;

function openDetailFromRow(setSelected, setOpen, record) {
  setSelected(record);
  setOpen(true);
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
  return buildStockMovementsFromData({
    purchases: listPurchases(),
    stockEntries: listStockEntries(),
  });
}

function buildStockMovementsFromData({ purchases = [], stockEntries = [] }) {
  const purchaseMovements = purchases.flatMap((purchase) =>
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

  const stockEntryMovements = stockEntries.flatMap((entry) =>
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
  const [movements, setMovements] = React.useState([]);
  const [tableLoading, setTableLoading] = React.useState(true);
  const [productOptions, setProductOptions] = React.useState([{ value: "all", label: "Tumu" }]);
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
  const refreshMovements = React.useCallback(async () => {
    setTableLoading(true);
    try {
      const [products, suppliers, procurementTypes, paymentTerms] = await Promise.all([
        listProductsFresh(),
        listSuppliersFresh(),
        listMasterDataFresh("procurement-types"),
        listMasterDataFresh("payment-terms"),
      ]);
      const [purchases, stockEntries] = await Promise.all([
        listPurchasesFresh({ suppliers, procurementTypes, paymentTerms, products }),
        listStockEntriesFresh({ suppliers, products }),
      ]);
      setMovements(buildStockMovementsFromData({ purchases, stockEntries }));
      setProductOptions([{ value: "all", label: "Tumu" }, ...products.map((item) => ({
        value: item.id,
        label: `${item.code} - ${item.name}`,
      }))]);
    } catch (error) {
      message.error(error?.message || "Stok hareketleri yuklenemedi.");
    } finally {
      setTableLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshMovements();
  }, [refreshMovements]);
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
            <Button icon={<ReloadOutlined />} onClick={() => { void refreshMovements(); message.success("Stok hareketleri yenilendi."); }}>Yenile</Button>
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
          loading={tableLoading}
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

