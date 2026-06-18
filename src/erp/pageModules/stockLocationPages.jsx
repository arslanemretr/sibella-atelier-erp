import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Grid, Input, InputNumber, Modal, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import { AimOutlined, ArrowLeftOutlined, SearchOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { correctStockLocation, listStockLocationBalancesFresh, listStockLocationsFresh } from "../stockLocationsData";

const { Title, Text } = Typography;

function money(v, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(Number(v || 0));
}

const PLACEHOLDER_IMG = "/products/baroque-necklace.svg";
const imgUrl = (id) => (id ? `/api/products/${id}/image` : PLACEHOLDER_IMG);

/* ============ Liste ============ */
export function StockLocationListPage() {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const { data: locations = [], isLoading, isFetching, error } = useQuery({
    queryKey: ["stock", "locations"],
    queryFn: () => listStockLocationsFresh(),
  });
  React.useEffect(() => { if (error) message.error(error?.message || "Stok yerleri yuklenemedi."); }, [error]);
  const loading = isLoading || isFetching;

  const open = (record) => navigate(`/stock/locations/${record.id}`);

  const columns = React.useMemo(() => [
    { title: "Stok Yeri", dataIndex: "name", key: "name", width: 200, sorter: (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "tr"), render: (v) => <Text strong>{v}</Text> },
    { title: "Bagli Magaza", dataIndex: "storeName", key: "storeName", width: 170, render: (v) => v || "-" },
    { title: "Merkez", dataIndex: "isDefaultMain", key: "isDefaultMain", width: 90, render: (v) => <Tag color={v ? "blue" : "default"}>{v ? "Evet" : "Hayir"}</Tag> },
    { title: "Urun Cesidi", dataIndex: "productVariety", key: "productVariety", width: 110, sorter: (a, b) => Number(a.productVariety || 0) - Number(b.productVariety || 0) },
    { title: "Toplam Adet", dataIndex: "totalQuantity", key: "totalQuantity", width: 120, align: "right", sorter: (a, b) => Number(a.totalQuantity || 0) - Number(b.totalQuantity || 0), render: (v) => <Text strong>{v}</Text> },
  ], []);

  return (
    <Space vertical size={20} style={{ width: "100%" }}>
      <Title level={3} style={{ margin: isMobile ? 0 : undefined, marginBottom: isMobile ? 0 : 6 }}>Stok Yerleri</Title>

      <Card title={`Stok Yeri Listesi${isMobile ? ` (${locations.length})` : ""}`} className="erp-list-table-card" loading={isMobile ? loading : false} styles={isMobile ? { body: { padding: 12 } } : undefined}>
        {isMobile ? (
          locations.length === 0 ? (
            <Text type="secondary">Stok yeri bulunamadı.</Text>
          ) : (
            <Space direction="vertical" size={10} style={{ width: "100%" }}>
              {locations.map((record) => (
                <div key={record.id} onClick={() => open(record)} style={{ padding: 14, borderRadius: 12, border: "1px solid #eceef2", boxShadow: "0 1px 4px rgba(16,24,40,0.05)", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 15 }}>{record.name}</Text>
                    {record.isDefaultMain ? <Tag color="blue" style={{ marginInlineEnd: 0 }}>Merkez</Tag> : null}
                  </div>
                  <Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 6 }}>{record.storeName || "-"}</Text>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <Text type="secondary">{record.productVariety} çeşit</Text>
                    <Text strong>{record.totalQuantity} adet</Text>
                  </div>
                </div>
              ))}
            </Space>
          )
        ) : (
          <Table
            size="small"
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={locations}
            pagination={false}
            scroll={{ x: "max-content" }}
            onRow={(record) => ({ onClick: () => open(record) })}
            rowClassName={() => "erp-clickable-row"}
          />
        )}
      </Card>
    </Space>
  );
}

/* ============ Detay (stok yeri içi stoklar) ============ */
const EMPTY_CORRECTION = { productId: null, productName: "", productCode: "", currentQty: 0, actualQty: null, note: "" };

export function StockLocationDetailPage() {
  const navigate = useNavigate();
  const { locationId } = useParams();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [correction, setCorrection] = React.useState(EMPTY_CORRECTION);
  const [correctionOpen, setCorrectionOpen] = React.useState(false);
  const [correctionLoading, setCorrectionLoading] = React.useState(false);

  const { data: locations = [] } = useQuery({ queryKey: ["stock", "locations"], queryFn: () => listStockLocationsFresh() });
  const location = locations.find((l) => l.id === locationId);

  const { data: balances = [], isLoading, isFetching, error } = useQuery({
    queryKey: ["stock", "location-balances", locationId],
    queryFn: () => listStockLocationBalancesFresh(locationId),
    enabled: Boolean(locationId),
  });
  React.useEffect(() => { if (error) message.error(error?.message || "Bakiyeler yuklenemedi."); }, [error]);
  const loading = isLoading || isFetching;

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return balances;
    return balances.filter((b) => String(b.productCode || "").toLowerCase().includes(q) || String(b.productName || "").toLowerCase().includes(q));
  }, [balances, search]);

  const totalValue = balances.reduce((s, b) => s + Number(b.quantity || 0) * Number(b.salePrice || 0), 0);

  const openCorrection = (b) => {
    setCorrection({ productId: b.productId, productName: b.productName, productCode: b.productCode, currentQty: b.quantity, actualQty: b.quantity, note: "" });
    setCorrectionOpen(true);
  };

  const handleCorrectionSave = async () => {
    if (correction.actualQty === null || correction.actualQty === undefined) { message.warning("Gerçek miktar giriniz."); return; }
    const delta = Number(correction.actualQty) - correction.currentQty;
    if (Math.abs(delta) < 0.0001) { message.info("Miktar değişmedi."); setCorrectionOpen(false); return; }
    try {
      setCorrectionLoading(true);
      await correctStockLocation(locationId, { productId: correction.productId, actualQty: Number(correction.actualQty), note: correction.note });
      message.success("Stok düzeltmesi kaydedildi.");
      setCorrectionOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stock", "location-balances", locationId] }),
        queryClient.invalidateQueries({ queryKey: ["stock", "locations"] }),
      ]);
    } catch (err) {
      message.error(err?.message || "Stok düzeltmesi kaydedilemedi.");
    } finally {
      setCorrectionLoading(false);
    }
  };

  const correctionDelta = correction.actualQty !== null && correction.actualQty !== undefined ? Number(correction.actualQty) - correction.currentQty : 0;

  const columns = [
    {
      title: "Ürün", key: "product",
      render: (_, r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={imgUrl(r.productId)} alt="" loading="lazy" onError={(e) => { if (!e.currentTarget.src.endsWith("baroque-necklace.svg")) e.currentTarget.src = PLACEHOLDER_IMG; }} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", background: "#f4f5f7" }} />
          <div><Text strong style={{ display: "block" }}>{r.productName}</Text><Text type="secondary" style={{ fontSize: 12 }}>{r.productCode}</Text></div>
        </div>
      ),
    },
    { title: "Adet", dataIndex: "quantity", key: "quantity", width: 90, align: "right", sorter: (a, b) => Number(a.quantity || 0) - Number(b.quantity || 0), render: (v) => <Text strong>{v}</Text> },
    { title: "Birim Fiyat", dataIndex: "salePrice", key: "salePrice", width: 120, align: "right", render: (v, r) => money(v, r.saleCurrency) },
    { title: "Değer", key: "value", width: 130, align: "right", render: (_, r) => money(Number(r.quantity || 0) * Number(r.salePrice || 0), r.saleCurrency) },
    { title: "", key: "actions", width: 56, render: (_, r) => <Tooltip title="Stok Düzelt"><Button size="small" icon={<AimOutlined />} onClick={() => openCorrection(r)} /></Tooltip> },
  ];

  return (
    <Space vertical size={16} style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/stock/locations")}>{isMobile ? "" : "Geri"}</Button>
        <Title level={3} style={{ margin: 0 }}>{location?.name || "Stok Yeri"}</Title>
        {location?.isDefaultMain ? <Tag color="blue">Merkez</Tag> : null}
      </div>

      {/* Ozet */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr) minmax(0,1fr)" : "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <Card bordered={false} styles={{ body: { padding: 14 } }}><Text type="secondary" style={{ fontSize: 13 }}>Bağlı Mağaza</Text><div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{location?.storeName || "-"}</div></Card>
        <Card bordered={false} styles={{ body: { padding: 14 } }}><Text type="secondary" style={{ fontSize: 13 }}>Ürün Çeşidi</Text><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{location?.productVariety ?? balances.length}</div></Card>
        <Card bordered={false} styles={{ body: { padding: 14 } }}><Text type="secondary" style={{ fontSize: 13 }}>Toplam Adet</Text><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{location?.totalQuantity ?? balances.reduce((s, b) => s + Number(b.quantity || 0), 0)}</div></Card>
        <Card bordered={false} styles={{ body: { padding: 14 } }}><Text type="secondary" style={{ fontSize: 13 }}>Toplam Değer</Text><div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: "#1f9d66" }}>{money(totalValue)}</div></Card>
      </div>

      <Card title={`Stoktaki Ürünler${balances.length ? ` (${balances.length})` : ""}`} className="erp-list-table-card" loading={isMobile ? loading : false} styles={isMobile ? { body: { padding: 12 } } : undefined}
        extra={!isMobile ? (
          <Input prefix={<SearchOutlined style={{ color: "#98a2b3" }} />} placeholder="Ürün ara" value={search} onChange={(e) => setSearch(e.target.value)} allowClear style={{ width: 240 }} />
        ) : null}
      >
        {isMobile ? (
          <>
            <Input prefix={<SearchOutlined style={{ color: "#98a2b3" }} />} placeholder="Ürün ara" value={search} onChange={(e) => setSearch(e.target.value)} allowClear style={{ marginBottom: 12 }} />
            {filtered.length === 0 ? <Text type="secondary">Pozitif bakiye yok.</Text> : (
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                {filtered.map((b) => (
                  <div key={`${b.stockLocationId}-${b.productId}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 12, border: "1px solid #eceef2" }}>
                    <img src={imgUrl(b.productId)} alt="" loading="lazy" onError={(e) => { if (!e.currentTarget.src.endsWith("baroque-necklace.svg")) e.currentTarget.src = PLACEHOLDER_IMG; }} style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", background: "#f4f5f7", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ fontSize: 14, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.productName}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{b.productCode}</Text>
                      <div style={{ fontSize: 12, color: "#98a2b3", marginTop: 2 }}>{money(Number(b.quantity || 0) * Number(b.salePrice || 0), b.saleCurrency)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{b.quantity}</div>
                      <Button size="small" icon={<AimOutlined />} onClick={() => openCorrection(b)} style={{ marginTop: 4 }}>Düzelt</Button>
                    </div>
                  </div>
                ))}
              </Space>
            )}
          </>
        ) : (
          <Table
            size="small"
            rowKey={(r) => `${r.stockLocationId}-${r.productId}`}
            loading={loading}
            columns={columns}
            dataSource={filtered}
            pagination={{ pageSize: 25, showSizeChanger: true, pageSizeOptions: ["25", "50", "100"], hideOnSinglePage: true }}
            locale={{ emptyText: "Pozitif bakiye yok." }}
          />
        )}
      </Card>

      <Modal
        title={`Stok Düzelt — ${correction.productCode} ${correction.productName}`}
        open={correctionOpen}
        onCancel={() => { if (!correctionLoading) setCorrectionOpen(false); }}
        onOk={handleCorrectionSave}
        okText="Düzeltmeyi Kaydet"
        cancelText="Vazgeç"
        confirmLoading={correctionLoading}
        destroyOnHidden
      >
        <Space vertical size={16} style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#f7f8fa", borderRadius: 10 }}>
            <span>Mevcut: <Text strong>{correction.currentQty}</Text></span>
            <span>Fark: {correctionDelta === 0 ? <Text type="secondary">—</Text> : <Text strong type={correctionDelta > 0 ? "success" : "danger"}>{correctionDelta > 0 ? `+${correctionDelta}` : correctionDelta}</Text>}</span>
          </div>
          <div>
            <Text type="secondary" style={{ display: "block", marginBottom: 6 }}>Gerçek (Sayılan) Miktar</Text>
            <InputNumber min={0} precision={0} value={correction.actualQty} onChange={(val) => setCorrection((prev) => ({ ...prev, actualQty: val }))} style={{ width: "100%" }} autoFocus />
          </div>
          <div>
            <Text type="secondary" style={{ display: "block", marginBottom: 6 }}>Not (isteğe bağlı)</Text>
            <Input placeholder="Sayım notunu girin" value={correction.note} onChange={(e) => setCorrection((prev) => ({ ...prev, note: e.target.value }))} />
          </div>
        </Space>
      </Modal>
    </Space>
  );
}
