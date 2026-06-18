import React from "react";
import { Button, Card, Col, DatePicker, Grid, InputNumber, Row, Segmented, Select, Space, Table, Tag, Typography, message } from "antd";
import { listProductsRawFresh, listProductPriceHistoryFresh, bulkUpdateProductPrices } from "../productsData";

const { Title, Text } = Typography;

function money(value, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(Number(value || 0));
}

const SOURCE_LABEL = { "urun-karti": "Ürün Kartı", gonderi: "Gönderi", toplu: "Toplu İşlem" };
const FIELD_LABEL = { merkez: "Merkez", magaza: "Mağaza", ikisi: "İkisi" };

function sourceTag(source) {
  const color = source === "gonderi" ? "blue" : source === "toplu" ? "purple" : "default";
  return <Tag color={color}>{SOURCE_LABEL[source] || source || "-"}</Tag>;
}

export function PriceHistoryPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [products, setProducts] = React.useState([]);
  const [history, setHistory] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  // Filtreler
  const [filterProductId, setFilterProductId] = React.useState(undefined);
  const [filterType, setFilterType] = React.useState("all");

  // Toplu fiyat paneli
  const [bulkProductIds, setBulkProductIds] = React.useState([]);
  const [bulkAll, setBulkAll] = React.useState(false);
  const [bulkTarget, setBulkTarget] = React.useState("magaza");
  const [bulkMode, setBulkMode] = React.useState("percent");
  const [bulkValue, setBulkValue] = React.useState(0);
  const [bulkSaving, setBulkSaving] = React.useState(false);

  const refreshHistory = React.useCallback(async () => {
    try {
      setLoading(true);
      const rows = await listProductPriceHistoryFresh({
        productId: filterProductId || undefined,
        type: filterType !== "all" ? filterType : undefined,
      });
      setHistory(rows);
    } catch (error) {
      message.error(error?.message || "Fiyat gecmisi yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [filterProductId, filterType]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listProductsRawFresh({});
        if (!cancelled) setProducts(rows);
      } catch { /* yoksay */ }
    })();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => { void refreshHistory(); }, [refreshHistory]);

  const productOptions = React.useMemo(
    () => products.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` })),
    [products],
  );

  const handleBulkApply = async () => {
    const ids = bulkAll ? products.map((p) => p.id) : bulkProductIds;
    if (!ids.length) { message.warning("Urun secin veya 'Tum urunler'i isaretleyin."); return; }
    if (!Number.isFinite(Number(bulkValue))) { message.warning("Gecerli bir deger girin."); return; }
    try {
      setBulkSaving(true);
      const result = await bulkUpdateProductPrices({
        productIds: ids,
        mode: bulkMode,
        target: bulkTarget,
        value: Number(bulkValue),
      });
      message.success(`${result?.updated ?? 0} urun guncellendi.`);
      setBulkProductIds([]);
      setBulkAll(false);
      setBulkValue(0);
      await refreshHistory();
    } catch (error) {
      message.error(error?.message || "Toplu fiyat guncellenemedi.");
    } finally {
      setBulkSaving(false);
    }
  };

  const columns = [
    {
      title: "Tarih", dataIndex: "changedAt", key: "changedAt", width: 150,
      render: (v) => (v ? new Date(v).toLocaleString("tr-TR") : "-"),
    },
    {
      title: "Ürün", key: "product", width: 220,
      render: (_, r) => <span><Text strong>{r.productCode}</Text> <Text type="secondary">{r.productName}</Text></span>,
    },
    { title: "Mağaza Fiyatı", dataIndex: "storePrice", key: "storePrice", width: 130, render: (v, r) => money(v, r.currency) },
    { title: "Merkez Fiyatı", dataIndex: "merkezPrice", key: "merkezPrice", width: 130, render: (v, r) => money(v, r.currency) },
    { title: "Değişen", dataIndex: "changedField", key: "changedField", width: 90, render: (v) => FIELD_LABEL[v] || v },
    { title: "Kaynak", dataIndex: "source", key: "source", width: 120, render: sourceTag },
    { title: "Kullanıcı", dataIndex: "changedByName", key: "changedByName", width: 140, render: (v) => v || "-" },
  ];

  return (
    <Space vertical size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Fiyat Geçmişi ve Toplu Fiyat</Title>
        <Button onClick={() => void refreshHistory()} loading={loading}>Yenile</Button>
      </div>

      {/* Toplu fiyat islemi */}
      <Card title="Toplu Fiyat İşlemi" size="small">
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} md={8}>
            <Text strong style={{ display: "block", marginBottom: 4 }}>Ürünler</Text>
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder="Ürün seçin"
              style={{ width: "100%" }}
              value={bulkProductIds}
              onChange={setBulkProductIds}
              disabled={bulkAll}
              options={productOptions}
              filterOption={(input, option) => (option?.label || "").toLowerCase().includes(input.toLowerCase())}
              maxTagCount="responsive"
            />
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={bulkAll} onChange={(e) => setBulkAll(e.target.checked)} />
              <Text type="secondary" style={{ fontSize: 13 }}>Tüm ürünlere uygula ({products.length})</Text>
            </label>
          </Col>
          <Col xs={24} md={5}>
            <Text strong style={{ display: "block", marginBottom: 4 }}>Hedef Fiyat</Text>
            <Segmented
              block
              value={bulkTarget}
              onChange={setBulkTarget}
              options={[{ value: "magaza", label: "Mağaza" }, { value: "merkez", label: "Merkez" }, { value: "ikisi", label: "İkisi" }]}
            />
          </Col>
          <Col xs={24} md={4}>
            <Text strong style={{ display: "block", marginBottom: 4 }}>İşlem</Text>
            <Segmented
              block
              value={bulkMode}
              onChange={setBulkMode}
              options={[{ value: "percent", label: "% Zam/İnd." }, { value: "fixed", label: "Sabit" }]}
            />
          </Col>
          <Col xs={24} md={4}>
            <Text strong style={{ display: "block", marginBottom: 4 }}>{bulkMode === "percent" ? "Yüzde (%)" : "Tutar"}</Text>
            <InputNumber
              style={{ width: "100%" }}
              value={bulkValue}
              onChange={(v) => setBulkValue(v ?? 0)}
              addonAfter={bulkMode === "percent" ? "%" : "TRY"}
              placeholder={bulkMode === "percent" ? "örn: 10 veya -5" : "0,00"}
            />
          </Col>
          <Col xs={24} md={3}>
            <Button type="primary" block loading={bulkSaving} onClick={() => void handleBulkApply()}>Uygula</Button>
          </Col>
        </Row>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 8 }}>
          Örnek: Hedef "Mağaza", İşlem "%", Yüzde "10" → seçili ürünlerin mağaza fiyatına %10 zam. Negatif değer indirim yapar.
        </Text>
      </Card>

      {/* Gecmis filtreleri */}
      <Card
        title="Değişiklik Geçmişi"
        size="small"
        extra={isMobile ? null : (
          <Space wrap>
            <Select
              allowClear
              showSearch
              placeholder="Ürün filtrele"
              style={{ width: 220 }}
              value={filterProductId}
              onChange={setFilterProductId}
              options={productOptions}
              filterOption={(input, option) => (option?.label || "").toLowerCase().includes(input.toLowerCase())}
            />
            <Segmented
              value={filterType}
              onChange={setFilterType}
              options={[{ value: "all", label: "Hepsi" }, { value: "magaza", label: "Mağaza" }, { value: "merkez", label: "Merkez" }]}
            />
          </Space>
        )}
      >
        {isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            <Select
              allowClear
              showSearch
              placeholder="Ürün filtrele"
              style={{ width: "100%" }}
              value={filterProductId}
              onChange={setFilterProductId}
              options={productOptions}
              filterOption={(input, option) => (option?.label || "").toLowerCase().includes(input.toLowerCase())}
            />
            <Segmented
              block
              value={filterType}
              onChange={setFilterType}
              options={[{ value: "all", label: "Hepsi" }, { value: "magaza", label: "Mağaza" }, { value: "merkez", label: "Merkez" }]}
            />
          </div>
        ) : null}
        {isMobile ? (
          history.length === 0 ? <Text type="secondary">Kayit bulunamadi.</Text> : (
            <Space direction="vertical" size={10} style={{ width: "100%" }}>
              {history.map((r) => (
                <div key={r.id} style={{ padding: 12, border: "1px solid #f0f0f0", borderRadius: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Text strong>{r.productCode}</Text>
                    {sourceTag(r.source)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, display: "block" }}>{r.productName}</Text>
                  <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 13 }}>
                    <span>Mağaza: <Text strong>{money(r.storePrice, r.currency)}</Text></span>
                    <span>Merkez: <Text strong>{money(r.merkezPrice, r.currency)}</Text></span>
                  </div>
                  <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
                    {r.changedAt ? new Date(r.changedAt).toLocaleString("tr-TR") : "-"} · {FIELD_LABEL[r.changedField] || r.changedField} · {r.changedByName || "-"}
                  </Text>
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
            dataSource={history}
            scroll={{ x: "max-content" }}
            pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ["25", "50", "100"] }}
          />
        )}
      </Card>
    </Space>
  );
}
