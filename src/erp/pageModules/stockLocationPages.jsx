import React from "react";
import dayjs from "dayjs";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, DatePicker, Drawer, Empty, Grid, Input, InputNumber, Modal, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import { AimOutlined, ArrowLeftOutlined, DeleteOutlined, SearchOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { correctStockLocation, listStockLocationBalancesFresh, listStockLocationsFresh } from "../stockLocationsData";
import { createStoreSale } from "../storeSalesData";

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

  // Satış sepeti (çoklu satır, anında kesinleşir)
  const [cart, setCart] = React.useState([]);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [saleLoading, setSaleLoading] = React.useState(false);
  const [salePeriod, setSalePeriod] = React.useState(() => dayjs());
  const [invoiceName, setInvoiceName] = React.useState("");

  const { data: locations = [] } = useQuery({ queryKey: ["stock", "locations"], queryFn: () => listStockLocationsFresh() });
  const location = locations.find((l) => l.id === locationId);
  const canSell = Boolean(location?.storeId);

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

  // ── Satış sepeti ──
  const cartQty = cart.reduce((s, l) => s + Number(l.quantity || 0), 0);
  const cartTotal = cart.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0);

  const addToCart = (b) => {
    const maxQty = Number(b.quantity || 0);
    if (maxQty <= 0) { message.warning("Bu üründe satılacak stok yok."); return; }
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === b.productId);
      if (existing) {
        if (existing.quantity >= maxQty) { message.warning("Stok adedini aştınız."); return prev; }
        return prev.map((l) => (l.productId === b.productId ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, {
        productId: b.productId,
        productCode: b.productCode,
        productName: b.productName,
        quantity: 1,
        unitPrice: Number(b.storePrice ?? b.salePrice ?? 0),
        maxQty,
        saleCurrency: b.saleCurrency || "TRY",
      }];
    });
    message.success(`${b.productName} sepete eklendi.`);
  };

  const updateCartLine = (productId, patch) => setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  const removeCartLine = (productId) => setCart((prev) => prev.filter((l) => l.productId !== productId));

  const handleCompleteSale = async () => {
    if (!canSell) { message.error("Bu stok yeri bir mağazaya bağlı değil."); return; }
    if (!cart.length) { message.warning("Sepet boş."); return; }
    if (cart.some((l) => Number(l.quantity || 0) <= 0)) { message.warning("Adet 0 olan satır var."); return; }
    if (cart.some((l) => Number(l.quantity || 0) > Number(l.maxQty || 0))) { message.warning("Stok adedini aşan satır var."); return; }
    try {
      setSaleLoading(true);
      await createStoreSale({
        storeId: location.storeId,
        periodKey: salePeriod.format("YYYY-MM"),
        saleDate: dayjs().format("YYYY-MM-DD"),
        invoiceName: invoiceName.trim() || null,
        lines: cart.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
      });
      message.success("Satış kaydedildi, stok düşüldü.");
      setCart([]);
      setInvoiceName("");
      setCartOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stock", "location-balances", locationId] }),
        queryClient.invalidateQueries({ queryKey: ["stock", "locations"] }),
        queryClient.invalidateQueries({ queryKey: ["store-sales"] }),
      ]);
    } catch (err) {
      message.error(err?.message || "Satış kaydedilemedi.");
    } finally {
      setSaleLoading(false);
    }
  };

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
    {
      title: "", key: "actions", width: canSell ? 150 : 56, align: "right",
      render: (_, r) => (
        <Space size={4}>
          {canSell ? (
            <Button size="small" type="primary" ghost icon={<ShoppingCartOutlined />} onClick={() => addToCart(r)}>Sat</Button>
          ) : null}
          <Tooltip title="Stok Düzelt"><Button size="small" icon={<AimOutlined />} onClick={() => openCorrection(r)} /></Tooltip>
        </Space>
      ),
    },
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
                      <Space size={4} style={{ marginTop: 4 }}>
                        {canSell ? <Button size="small" type="primary" ghost icon={<ShoppingCartOutlined />} onClick={() => addToCart(b)}>Sat</Button> : null}
                        <Button size="small" icon={<AimOutlined />} onClick={() => openCorrection(b)} />
                      </Space>
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

      {/* Yüzen sepet butonu */}
      {canSell && cart.length > 0 ? (
        <div style={{ position: "fixed", right: 20, bottom: isMobile ? 84 : 24, zIndex: 1000 }}>
          <Badge count={cartQty} color="#e8674e" offset={[-4, 4]}>
            <Button type="primary" size="large" shape="round" icon={<ShoppingCartOutlined />} onClick={() => setCartOpen(true)}>
              Satış ({money(cartTotal)})
            </Button>
          </Badge>
        </div>
      ) : null}

      {/* Satış sepeti drawer */}
      <Drawer
        title="Satış Girişi"
        open={cartOpen}
        onClose={() => { if (!saleLoading) setCartOpen(false); }}
        width={isMobile ? "100%" : 460}
        zIndex={1200}
        footer={(
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div><Text type="secondary" style={{ fontSize: 12 }}>Toplam</Text><div style={{ fontSize: 18, fontWeight: 700 }}>{money(cartTotal)}</div></div>
            <Button type="primary" size="large" loading={saleLoading} disabled={!cart.length} onClick={handleCompleteSale}>Satışı Tamamla</Button>
          </div>
        )}
      >
        <Space vertical size={16} style={{ width: "100%" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Satış Dönemi</Text>
              <DatePicker picker="month" value={salePeriod} onChange={(v) => v && setSalePeriod(v)} allowClear={false} format="YYYY-MM" style={{ width: "100%" }} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Mağaza (Cari)</Text>
              <Input value={location?.storeName || "-"} disabled />
            </div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Fatura İsmi (isteğe bağlı)</Text>
            <Input placeholder="Fatura/müşteri ismi" value={invoiceName} onChange={(e) => setInvoiceName(e.target.value)} />
          </div>

          {cart.length === 0 ? <Empty description="Sepet boş" /> : (
            <Space vertical size={10} style={{ width: "100%" }}>
              {cart.map((l) => (
                <div key={l.productId} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, border: "1px solid #eceef2" }}>
                  <img src={imgUrl(l.productId)} alt="" loading="lazy" onError={(e) => { if (!e.currentTarget.src.endsWith("baroque-necklace.svg")) e.currentTarget.src = PLACEHOLDER_IMG; }} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", background: "#f4f5f7", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ fontSize: 13, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.productName}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{l.productCode} · stok {l.maxQty}</Text>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                      <InputNumber size="small" min={1} max={l.maxQty} precision={0} value={l.quantity} onChange={(v) => updateCartLine(l.productId, { quantity: Number(v || 1) })} style={{ width: 64 }} />
                      <span style={{ color: "#98a2b3" }}>×</span>
                      <InputNumber size="small" min={0} value={l.unitPrice} onChange={(v) => updateCartLine(l.productId, { unitPrice: Number(v || 0) })} style={{ width: 100 }} formatter={(v) => `${v}`} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 700 }}>{money(Number(l.quantity || 0) * Number(l.unitPrice || 0), l.saleCurrency)}</div>
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeCartLine(l.productId)} />
                  </div>
                </div>
              ))}
            </Space>
          )}
        </Space>
      </Drawer>
    </Space>
  );
}
