import React from "react";
import dayjs from "dayjs";
import { Button, Card, DatePicker, Drawer, Grid, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { DeleteOutlined, EditOutlined, SearchOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listStoresFresh } from "../storesData";
import { listStoreSalesFresh, getStoreSaleFresh, updateStoreSale, deleteStoreSale } from "../storeSalesData";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function money(v, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(Number(v || 0));
}

export function StoreSalesListPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const queryClient = useQueryClient();

  const [storeId, setStoreId] = React.useState(null);
  const [range, setRange] = React.useState([dayjs().startOf("year"), dayjs()]);
  const [search, setSearch] = React.useState("");
  const [selectedRowKeys, setSelectedRowKeys] = React.useState([]);

  const [detail, setDetail] = React.useState(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editTargets, setEditTargets] = React.useState([]); // [{id, saleNo}]
  const [editLoading, setEditLoading] = React.useState(false);

  const { data: stores = [] } = useQuery({ queryKey: ["stores"], queryFn: () => listStoresFresh() });

  const filters = React.useMemo(() => ({
    storeId: storeId || undefined,
    periodFrom: range?.[0] ? range[0].format("YYYY-MM") : undefined,
    periodTo: range?.[1] ? range[1].format("YYYY-MM") : undefined,
  }), [storeId, range]);

  const { data: sales = [], isLoading, isFetching, error } = useQuery({
    queryKey: ["store-sales", filters],
    queryFn: () => listStoreSalesFresh(filters),
  });
  React.useEffect(() => { if (error) message.error(error?.message || "Mağaza satışları yüklenemedi."); }, [error]);
  const loading = isLoading || isFetching;

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => [s.saleNo, s.storeName, s.invoiceName].some((v) => String(v || "").toLowerCase().includes(q)));
  }, [sales, search]);

  const openDetail = async (record) => {
    setDetailOpen(true);
    setDetail({ ...record, lines: record.lines || [] });
    try { const full = await getStoreSaleFresh(record.id); if (full) setDetail(full); } catch { /* yoksay */ }
  };

  const openEdit = (targets) => {
    if (!targets.length) return;
    setEditTargets(targets);
    setEditName(targets.length === 1 ? (targets[0].invoiceName || "") : "");
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    try {
      setEditLoading(true);
      for (const t of editTargets) {
        await updateStoreSale(t.id, { invoiceName: editName.trim() || null, note: t.note || null });
      }
      message.success("Fatura ismi güncellendi.");
      setEditOpen(false);
      setSelectedRowKeys([]);
      await queryClient.invalidateQueries({ queryKey: ["store-sales"] });
    } catch (err) {
      message.error(err?.message || "Güncellenemedi.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: "Satış silinsin mi?",
      content: `${record.saleNo} — stok geri yüklenecek.`,
      okText: "Sil", okType: "danger", cancelText: "Vazgeç",
      onOk: async () => {
        try {
          await deleteStoreSale(record.id);
          message.success("Satış silindi, stok geri yüklendi.");
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["store-sales"] }),
            queryClient.invalidateQueries({ queryKey: ["stock", "locations"] }),
            queryClient.invalidateQueries({ queryKey: ["stock", "location-balances"] }),
          ]);
        } catch (err) {
          message.error(err?.message || "Silinemedi.");
        }
      },
    });
  };

  const selectedSales = filtered.filter((s) => selectedRowKeys.includes(s.id));

  const columns = [
    { title: "Satış No", dataIndex: "saleNo", key: "saleNo", width: 150, render: (v) => <Text strong>{v}</Text> },
    { title: "Tarih", dataIndex: "saleDate", key: "saleDate", width: 110 },
    { title: "Mağaza", dataIndex: "storeName", key: "storeName", width: 160 },
    { title: "Dönem", dataIndex: "periodKey", key: "periodKey", width: 90 },
    { title: "Fatura İsmi", dataIndex: "invoiceName", key: "invoiceName", width: 180, render: (v) => v || <Text type="secondary">—</Text> },
    { title: "Kalem", dataIndex: "lineCount", key: "lineCount", width: 80, align: "right" },
    { title: "Adet", dataIndex: "totalQuantity", key: "totalQuantity", width: 80, align: "right" },
    { title: "Tutar", dataIndex: "totalAmount", key: "totalAmount", width: 130, align: "right", render: (v) => <Text strong>{money(v)}</Text> },
    {
      title: "", key: "actions", width: 90, align: "right",
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openEdit([r]); }} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); handleDelete(r); }} />
        </Space>
      ),
    },
  ];

  const totalAmount = filtered.reduce((s, x) => s + Number(x.totalAmount || 0), 0);

  return (
    <Space vertical size={16} style={{ width: "100%" }}>
      <Title level={3} style={{ margin: isMobile ? 0 : undefined }}>Mağaza Satışlar</Title>

      <Card styles={{ body: { padding: 12 } }}>
        <Space wrap size={10} style={{ width: "100%" }}>
          <Select allowClear placeholder="Tüm mağazalar" value={storeId} onChange={setStoreId} style={{ minWidth: 180 }}
            options={stores.map((s) => ({ value: s.id, label: s.name }))} />
          <RangePicker picker="month" value={range} onChange={(v) => setRange(v || [])} format="YYYY-MM" allowClear={false} />
          <Input prefix={<SearchOutlined style={{ color: "#98a2b3" }} />} placeholder="No / mağaza / fatura ara" value={search} onChange={(e) => setSearch(e.target.value)} allowClear style={{ minWidth: 200, flex: isMobile ? 1 : undefined }} />
          {selectedRowKeys.length > 0 ? (
            <Button type="primary" icon={<EditOutlined />} onClick={() => openEdit(selectedSales)}>
              Fatura İsmi Düzenle ({selectedRowKeys.length})
            </Button>
          ) : null}
        </Space>
      </Card>

      <Card title={`Satışlar (${filtered.length}) · ${money(totalAmount)}`} className="erp-list-table-card" loading={isMobile ? loading : false} styles={isMobile ? { body: { padding: 12 } } : undefined}>
        {isMobile ? (
          filtered.length === 0 ? <Text type="secondary">Satış bulunamadı.</Text> : (
            <Space vertical size={10} style={{ width: "100%" }}>
              {filtered.map((s) => (
                <div key={s.id} style={{ padding: 12, borderRadius: 12, border: "1px solid #eceef2" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text strong>{s.saleNo}</Text>
                    <Text strong>{money(s.totalAmount)}</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 13, display: "block" }}>{s.storeName} · {s.saleDate} · {s.periodKey}</Text>
                  <div style={{ fontSize: 13, margin: "4px 0" }}>Fatura: {s.invoiceName || <Text type="secondary">—</Text>} · {s.lineCount} kalem · {s.totalQuantity} adet</div>
                  <Space size={6} style={{ marginTop: 6 }}>
                    <Button size="small" onClick={() => openDetail(s)}>Detay</Button>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit([s])}>Fatura İsmi</Button>
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(s)} />
                  </Space>
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
            dataSource={filtered}
            pagination={{ pageSize: 25, showSizeChanger: true, hideOnSinglePage: true }}
            rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
            onRow={(record) => ({ onClick: () => openDetail(record) })}
            rowClassName={() => "erp-clickable-row"}
            scroll={{ x: "max-content" }}
          />
        )}
      </Card>

      {/* Detay */}
      <Drawer title={detail?.saleNo || "Satış Detayı"} open={detailOpen} onClose={() => setDetailOpen(false)} width={isMobile ? "100%" : 480}>
        {detail ? (
          <Space vertical size={14} style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><Text type="secondary">Mağaza</Text><Text strong>{detail.storeName}</Text></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><Text type="secondary">Tarih / Dönem</Text><Text>{detail.saleDate} · {detail.periodKey}</Text></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><Text type="secondary">Fatura İsmi</Text><Text strong>{detail.invoiceName || "—"}</Text></div>
            <Card size="small" title="Satırlar" styles={{ body: { padding: 0 } }}>
              {(detail.lines || []).map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #f0f0f0" }}>
                  <div><Text strong style={{ fontSize: 13 }}>{l.productName}</Text><div><Text type="secondary" style={{ fontSize: 11 }}>{l.productCode} · {l.quantity} × {money(l.unitPrice)}</Text></div></div>
                  <Text strong>{money(l.lineTotal)}</Text>
                </div>
              ))}
            </Card>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16 }}><Text strong>Toplam</Text><Text strong>{money(detail.totalAmount)}</Text></div>
          </Space>
        ) : null}
      </Drawer>

      {/* Fatura ismi düzenle */}
      <Modal
        title={editTargets.length > 1 ? `Fatura İsmi (${editTargets.length} satış)` : "Fatura İsmi Düzenle"}
        open={editOpen}
        onCancel={() => { if (!editLoading) setEditOpen(false); }}
        onOk={handleEditSave}
        okText="Kaydet"
        cancelText="Vazgeç"
        confirmLoading={editLoading}
        destroyOnHidden
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>Seçili satış(lar)ın fatura ismi:</Text>
        <Input placeholder="Fatura/müşteri ismi" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
      </Modal>
    </Space>
  );
}
