import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Descriptions, Drawer, Input, Select, Space, Table, Tag, Typography, message } from "antd";
import { DownloadOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { listProductsFresh } from "../productsData";
import { listStockMovementsFresh } from "../stockMovementsData";

const { Title, Text } = Typography;

function formatMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value) {
  const parsed = parseDate(value);
  if (!parsed) {
    return String(value || "-");
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function buildDetailPath(record) {
  switch (record.sourceModule) {
    case "purchase":
      return `/purchasing/entry/${record.sourceId}`;
    case "stock-entry":
      return `/stock/entry/${record.sourceId}`;
    case "delivery-list":
      return `/supplier/deliveries/${record.sourceId}`;
    case "store-shipment":
      return `/stores/shipments/${record.sourceId}`;
    case "pos-sale":
      return "/pos/sessions";
    default:
      return "";
  }
}

function buildSignedQuantity(record) {
  const delta = Number(record.stockDelta || 0);
  if (delta > 0) {
    return `+${delta}`;
  }
  if (delta < 0) {
    return String(delta);
  }
  return `${Number(record.quantity || 0)}`;
}

function openDetailFromRow(setSelected, setOpen, record) {
  setSelected(record);
  setOpen(true);
}

export function StockListPage() {
  const navigate = useNavigate();
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedMovement, setSelectedMovement] = React.useState(null);
  const [movements, setMovements] = React.useState([]);
  const [tableLoading, setTableLoading] = React.useState(true);
  const [filters, setFilters] = React.useState({
    search: "",
    movementType: undefined,
    productId: undefined,
    stockLocationId: undefined,
  });

  const refreshMovements = React.useCallback(async () => {
    setTableLoading(true);
    try {
      const [movementRows, products] = await Promise.all([
        listStockMovementsFresh(),
        listProductsFresh(),
      ]);

      const productMap = new Map(products.map((item) => [item.id, item]));
      setMovements(
        movementRows.map((item) => ({
          ...item,
          key: item.id,
          detailPath: buildDetailPath(item),
          productCode: item.productCode || productMap.get(item.productId)?.code || "-",
          productName: item.productName || productMap.get(item.productId)?.name || "-",
          unitAmountDisplay: formatMoney(item.unitAmount),
          totalAmountDisplay: formatMoney(item.totalAmount),
          quantitySignedDisplay: buildSignedQuantity(item),
        })),
      );
    } catch (error) {
      message.error(error?.message || "Stok hareketleri yuklenemedi.");
    } finally {
      setTableLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshMovements();
  }, [refreshMovements]);

  const movementTypeOptions = React.useMemo(
    () => [
      { value: "all", label: "Tumu" },
      ...Array.from(
        new Map(
          movements.map((item) => [item.movementType, item.movementTypeLabel || item.movementType]),
        ).entries(),
      ).map(([value, label]) => ({ value, label })),
    ],
    [movements],
  );

  const productOptions = React.useMemo(
    () => [
      { value: "all", label: "Tumu" },
      ...Array.from(
        new Map(
          movements
            .filter((item) => item.productId)
            .map((item) => [item.productId, `${item.productCode} - ${item.productName}`]),
        ).entries(),
      ).map(([value, label]) => ({ value, label })),
    ],
    [movements],
  );

  const stockLocationOptions = React.useMemo(
    () => [
      { value: "all", label: "Tumu" },
      ...Array.from(
        new Map(
          movements
            .filter((item) => item.stockLocationId)
            .map((item) => [item.stockLocationId, item.stockLocationName || "-"]),
        ).entries(),
      ).map(([value, label]) => ({ value, label })),
    ],
    [movements],
  );

  const filteredMovements = React.useMemo(
    () =>
      movements.filter((item) => {
        const normalizedSearch = String(filters.search || "").trim().toLowerCase();
        const matchesSearch =
          !normalizedSearch ||
          [
            item.documentNo,
            item.productCode,
            item.productName,
            item.partyName,
            item.note,
            item.movementTypeLabel,
            item.stockLocationName,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedSearch));
        const matchesMovementType =
          !filters.movementType || filters.movementType === "all" || item.movementType === filters.movementType;
        const matchesProduct =
          !filters.productId || filters.productId === "all" || item.productId === filters.productId;
        const matchesStockLocation =
          !filters.stockLocationId ||
          filters.stockLocationId === "all" ||
          item.stockLocationId === filters.stockLocationId;
        return matchesSearch && matchesMovementType && matchesProduct && matchesStockLocation;
      }),
    [filters, movements],
  );

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      movementType: undefined,
      productId: undefined,
      stockLocationId: undefined,
    });
  };

  const handleExport = () => {
    const header = [
      "Tarih",
      "Hareket Tipi",
      "Etki",
      "Belge No",
      "Stok Yeri",
      "Kaynak",
      "Urun",
      "Miktar",
      "Birim Tutar",
      "Toplam Tutar",
      "Not",
    ];
    const rows = filteredMovements.map((item) => [
      formatDateTime(item.documentDate || item.createdAt),
      item.movementTypeLabel || item.movementType,
      item.affectsStock ? "Stok Etkiler" : "Bilgi",
      item.documentNo || "-",
      item.stockLocationName || "-",
      item.partyName || item.sourceModule || "-",
      `${item.productCode} - ${item.productName}`,
      item.quantitySignedDisplay,
      item.unitAmountDisplay,
      item.totalAmountDisplay,
      item.note || "",
    ]);
    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stok-hareketleri.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const openDetailPath = (record) => {
    if (!record.detailPath) {
      message.info("Bu hareket tipi icin detay ekrani bulunmuyor.");
      return;
    }
    navigate(record.detailPath);
  };

  const columns = [
    {
      title: "Tarih",
      dataIndex: "documentDate",
      key: "documentDate",
      sorter: (a, b) =>
        (parseDate(a.documentDate || a.createdAt)?.getTime() || 0) -
        (parseDate(b.documentDate || b.createdAt)?.getTime() || 0),
      render: (_, record) => formatDateTime(record.documentDate || record.createdAt),
    },
    {
      title: "Hareket Tipi",
      dataIndex: "movementTypeLabel",
      key: "movementTypeLabel",
      render: (_, record) => (
        <Tag color={record.affectsStock ? (record.direction === "OUT" ? "volcano" : "green") : "gold"}>
          {record.movementTypeLabel || record.movementType}
        </Tag>
      ),
    },
    {
      title: "Belge No",
      dataIndex: "documentNo",
      key: "documentNo",
      render: (value, record) => (
        <button
          type="button"
          className="erp-link-button"
          onClick={(event) => {
            event.stopPropagation();
            openDetailPath(record);
          }}
        >
          {value || "-"}
        </button>
      ),
    },
    {
      title: "Stok Yeri",
      dataIndex: "stockLocationName",
      key: "stockLocationName",
      render: (value, record) => (
        <Space size={6}>
          <span>{value || "-"}</span>
          {record.isDefaultMain ? <Tag color="blue">Merkez</Tag> : null}
        </Space>
      ),
    },
    {
      title: "Urun",
      dataIndex: "productName",
      key: "productName",
      render: (_, record) => `${record.productCode} - ${record.productName}`,
    },
    {
      title: "Miktar",
      dataIndex: "quantitySignedDisplay",
      key: "quantitySignedDisplay",
      align: "right",
      render: (_, record) => (
        <Tag color={!record.affectsStock ? "default" : record.direction === "OUT" ? "volcano" : "blue"}>
          {record.affectsStock ? record.quantitySignedDisplay : String(Number(record.quantity || 0))}
        </Tag>
      ),
    },
    {
      title: "Etki",
      dataIndex: "affectsStock",
      key: "affectsStock",
      render: (value) => <Tag color={value ? "green" : "default"}>{value ? "Stok Etkiler" : "Bilgi"}</Tag>,
    },
    {
      title: "Kaynak",
      dataIndex: "partyName",
      key: "partyName",
      render: (value, record) => value || record.sourceModule || "-",
    },
    {
      title: "Toplam",
      dataIndex: "totalAmountDisplay",
      key: "totalAmountDisplay",
      align: "right",
    },
    {
      title: "Islemler",
      key: "actions",
      render: (_, record) => (
        <Button
          type="text"
          className="erp-icon-btn erp-icon-btn-edit"
          icon={<EditOutlined />}
          onClick={(event) => {
            event.stopPropagation();
            openDetailPath(record);
          }}
        />
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Stok Hareketleri</Title>
          <Text type="secondary">Tum fiili stok giris ve cikislari veritabanindaki hareket kayitlarindan listelenir.</Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/stock/entry")}>Stok Girisi</Button>
        </Space>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <Space wrap size={12} style={{ width: "100%", justifyContent: "space-between" }}>
          <Space wrap>
            <Input
              prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
              placeholder="Belge no, urun, kaynak ya da not ara"
              value={filters.search}
              onChange={(event) => handleFilterChange("search", event.target.value)}
              allowClear
              style={{ width: 320 }}
            />
            <Select
              value={filters.movementType}
              onChange={(value) => handleFilterChange("movementType", value)}
              options={movementTypeOptions}
              allowClear
              placeholder="Hareket tipi"
              style={{ width: 220 }}
            />
            <Select
              value={filters.productId}
              onChange={(value) => handleFilterChange("productId", value)}
              options={productOptions}
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Urun"
              style={{ width: 260 }}
            />
            <Select
              value={filters.stockLocationId}
              onChange={(value) => handleFilterChange("stockLocationId", value)}
              options={stockLocationOptions}
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Stok yeri"
              style={{ width: 220 }}
            />
          </Space>
          <Space>
            <Button onClick={handleResetFilters}>Temizle</Button>
            <Button icon={<ReloadOutlined />} onClick={() => void refreshMovements()}>Yenile</Button>
          </Space>
        </Space>
      </Card>

      <Card title="Tum Stok Hareketleri" className="erp-list-table-card">
        <Table
          loading={tableLoading}
          columns={columns}
          dataSource={filteredMovements}
          pagination={{
            showSizeChanger: true,
            pageSizeOptions: ["25", "50", "100"],
            defaultPageSize: 25,
          }}
          onRow={(record) => ({
            onClick: () => openDetailFromRow(setSelectedMovement, setDetailOpen, record),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
      </Card>

      <Drawer title="Stok Hareket Detayi" placement="right" width={500} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {selectedMovement ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Tarih">{formatDateTime(selectedMovement.documentDate || selectedMovement.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="Hareket Tipi">{selectedMovement.movementTypeLabel || selectedMovement.movementType}</Descriptions.Item>
            <Descriptions.Item label="Belge No">{selectedMovement.documentNo || "-"}</Descriptions.Item>
            <Descriptions.Item label="Stok Yeri">{selectedMovement.stockLocationName || "-"}</Descriptions.Item>
            <Descriptions.Item label="Urun">{selectedMovement.productCode} - {selectedMovement.productName}</Descriptions.Item>
            <Descriptions.Item label="Miktar">{selectedMovement.affectsStock ? selectedMovement.quantitySignedDisplay : String(Number(selectedMovement.quantity || 0))}</Descriptions.Item>
            <Descriptions.Item label="Stok Etkisi">{selectedMovement.affectsStock ? "Evet" : "Hayir"}</Descriptions.Item>
            <Descriptions.Item label="Kaynak">{selectedMovement.partyName || selectedMovement.sourceModule || "-"}</Descriptions.Item>
            <Descriptions.Item label="Birim Tutar">{selectedMovement.unitAmountDisplay}</Descriptions.Item>
            <Descriptions.Item label="Toplam Tutar">{selectedMovement.totalAmountDisplay}</Descriptions.Item>
            <Descriptions.Item label="Not">{selectedMovement.note || "-"}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </Space>
  );
}
