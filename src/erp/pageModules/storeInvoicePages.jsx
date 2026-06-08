import React from "react";
import { Button, Card, Col, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { requestJson } from "../apiClient";
import { listStoresFresh } from "../storesData";

const { Title, Text } = Typography;

const KDV_OPTIONS = [
  { value: 0,  label: "%0" },
  { value: 1,  label: "%1" },
  { value: 10, label: "%10" },
  { value: 18, label: "%18" },
  { value: 20, label: "%20" },
];

function formatMoney(v) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 }).format(Number(v || 0));
}

function formatDate(v) {
  if (!v) return "-";
  return dayjs(v).format("DD.MM.YYYY");
}

function periodLabel(key) {
  if (!key) return "-";
  const [y, m] = key.split("-");
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(Number(y), Number(m) - 1, 1));
}

const YEAR_OPTIONS = Array.from({ length: new Date().getFullYear() - 2020 + 2 }, (_, i) => {
  const y = 2021 + i;
  return { value: y, label: String(y) };
});

const MONTH_OPTIONS = [
  { value: 1,  label: "Ocak" },
  { value: 2,  label: "Şubat" },
  { value: 3,  label: "Mart" },
  { value: 4,  label: "Nisan" },
  { value: 5,  label: "Mayıs" },
  { value: 6,  label: "Haziran" },
  { value: 7,  label: "Temmuz" },
  { value: 8,  label: "Ağustos" },
  { value: 9,  label: "Eylül" },
  { value: 10, label: "Ekim" },
  { value: 11, label: "Kasım" },
  { value: 12, label: "Aralık" },
];

export function StoreInvoiceListPage() {
  const [invoices, setInvoices]     = React.useState([]);
  const [stores, setStores]         = React.useState([]);
  const [loading, setLoading]       = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editing, setEditing]       = React.useState(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selected, setSelected]     = React.useState(null);
  const [form]                      = Form.useForm();
  const [saving, setSaving]         = React.useState(false);
  const [nextNo, setNextNo]         = React.useState("");
  const [periodYear,  setPeriodYear]  = React.useState(() => new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = React.useState(() => new Date().getMonth() + 1);

  // Yıl + ay → YYYY-MM
  const derivedPeriodKey = React.useMemo(
    () => `${periodYear}-${String(periodMonth).padStart(2, "0")}`,
    [periodYear, periodMonth],
  );

  const [filters, setFilters] = React.useState({ storeId: undefined, periodFrom: undefined, periodTo: undefined });

  const storeOptions = React.useMemo(
    () => [{ value: "", label: "Tüm Mağazalar" }, ...stores.map((s) => ({ value: s.id, label: s.name }))],
    [stores],
  );

  const periodOptions = React.useMemo(() => buildPeriodOptions(), []);

  const refresh = React.useCallback(async (f) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (f?.storeId)    params.set("storeId",    f.storeId);
      if (f?.periodFrom) params.set("periodFrom", f.periodFrom);
      if (f?.periodTo)   params.set("periodTo",   f.periodTo);
      const url = `/api/store-invoices${params.toString() ? `?${params.toString()}` : ""}`;
      const [data, storeList] = await Promise.all([
        requestJson("GET", url),
        listStoresFresh(),
      ]);
      setInvoices(data?.items || []);
      setStores(storeList || []);
    } catch {
      message.error("Fatura listesi yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(filters); }, [refresh, filters]);

  // Hesaplama: toplam tutar + kdv oranı değişince otomatik hesapla
  const watchedTotal = Form.useWatch("totalAmount", form);
  const watchedKdv   = Form.useWatch("kdvRate", form);
  const watchedQty   = Form.useWatch("quantity", form);

  const computed = React.useMemo(() => {
    const total   = Number(watchedTotal || 0);
    const rate    = Number(watchedKdv   ?? 20);
    const qty     = Number(watchedQty   || 1);
    const service = rate > 0 ? total / (1 + rate / 100) : total;
    const kdv     = total - service;
    const unit    = qty > 0 ? service / qty : service;
    return {
      serviceAmount: Math.round(service * 100) / 100,
      kdvAmount:     Math.round(kdv    * 100) / 100,
      unitAmount:    Math.round(unit   * 100) / 100,
    };
  }, [watchedTotal, watchedKdv, watchedQty]);

  const openNew = async () => {
    try {
      const data = await requestJson("GET", "/api/store-invoices/next-no");
      setNextNo(data?.invoiceNo || "");
    } catch { setNextNo(""); }
    setEditing(null);
    form.resetFields();
    const now = new Date();
    setPeriodYear(now.getFullYear());
    setPeriodMonth(now.getMonth() + 1);
    form.setFieldsValue({
      invoiceDate: dayjs(),
      kdvRate: 20,
      quantity: 1,
    });
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setNextNo(record.invoiceNo);
    if (record.periodKey) {
      const [y, m] = record.periodKey.split("-").map(Number);
      setPeriodYear(y);
      setPeriodMonth(m);
    }
    form.setFieldsValue({
      storeId:      record.storeId,
      invoiceDate:  record.invoiceDate ? dayjs(record.invoiceDate) : dayjs(),
      totalAmount:  record.totalAmount,
      kdvRate:      record.kdvRate,
      quantity:     record.quantity,
      description:  record.description,
      extInvoiceNo: record.extInvoiceNo || "",
    });
    setDrawerOpen(true);
    setDetailOpen(false);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        invoiceDate: values.invoiceDate?.format("YYYY-MM-DD"),
        periodKey:   derivedPeriodKey,
      };
      if (editing) {
        await requestJson("PUT", `/api/store-invoices/${editing.id}`, payload);
        message.success("Fatura guncellendi.");
      } else {
        await requestJson("POST", "/api/store-invoices", payload);
        message.success("Fatura kaydedildi.");
      }
      setDrawerOpen(false);
      void refresh();
    } catch (error) {
      if (!error?.errorFields) message.error(error?.message || "Fatura kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await requestJson("DELETE", `/api/store-invoices/${id}`);
      message.success("Fatura silindi.");
      setDetailOpen(false);
      void refresh();
    } catch (error) {
      message.error(error?.message || "Fatura silinemedi.");
    }
  };

  const columns = [
    { title: "Fatura No", dataIndex: "invoiceNo", key: "invoiceNo", width: 140,
      sorter: (a, b) => String(a.invoiceNo || "").localeCompare(String(b.invoiceNo || ""), "tr"),
      render: (v, r) => <button type="button" className="erp-link-button" onClick={(e) => { e.stopPropagation(); setSelected(r); setDetailOpen(true); }}>{v}</button> },
    { title: "Gib Fatura No", dataIndex: "extInvoiceNo", key: "extInvoiceNo", width: 150,
      sorter: (a, b) => String(a.extInvoiceNo || "").localeCompare(String(b.extInvoiceNo || ""), "tr"),
      render: (v) => v || <Text type="secondary">-</Text> },
    { title: "Firma", dataIndex: "storeName", key: "storeName", width: 160,
      sorter: (a, b) => String(a.storeName || "").localeCompare(String(b.storeName || ""), "tr") },
    { title: "Fatura Tarihi", dataIndex: "invoiceDate", key: "invoiceDate", width: 120,
      sorter: (a, b) => String(a.invoiceDate || "").localeCompare(String(b.invoiceDate || "")),
      render: formatDate },
    { title: "Toplam Tutar", dataIndex: "totalAmount", key: "totalAmount", width: 140, align: "right",
      sorter: (a, b) => Number(a.totalAmount || 0) - Number(b.totalAmount || 0),
      render: formatMoney },
    { title: "KDV Oranı", dataIndex: "kdvRate", key: "kdvRate", width: 90, align: "center",
      sorter: (a, b) => Number(a.kdvRate || 0) - Number(b.kdvRate || 0),
      render: (v) => `%${v}` },
    { title: "KDV Tutarı", dataIndex: "kdvAmount", key: "kdvAmount", width: 130, align: "right",
      sorter: (a, b) => Number(a.kdvAmount || 0) - Number(b.kdvAmount || 0),
      render: formatMoney },
    { title: "Hizmet Tutarı", dataIndex: "serviceAmount", key: "serviceAmount", width: 140, align: "right",
      sorter: (a, b) => Number(a.serviceAmount || 0) - Number(b.serviceAmount || 0),
      render: formatMoney },
    { title: "İlgili Dönem", dataIndex: "periodKey", key: "periodKey", width: 130,
      sorter: (a, b) => String(a.periodKey || "").localeCompare(String(b.periodKey || "")),
      render: periodLabel },
    { title: "Vade Tarihi", dataIndex: "dueDate", key: "dueDate", width: 120,
      sorter: (a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")),
      render: formatDate },
    { title: "İşlemler", key: "actions", width: 90,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Düzenle">
            <Button size="small" className="erp-icon-btn erp-icon-btn-edit" icon={<EditOutlined />}
              onClick={(e) => { e.stopPropagation(); openEdit(r); }} />
          </Tooltip>
          <Popconfirm title="Bu fatura silinsin mi?" okText="Sil" cancelText="Vazgeç"
            onConfirm={() => void handleDelete(r.id)}>
            <Tooltip title="Sil">
              <Button size="small" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div className="erp-page-intro">
        <div><Title level={3} style={{ marginBottom: 6 }}>Mağaza Fatura Listesi</Title></div>
        <Space wrap className="erp-page-intro-actions">
          <Button icon={<ReloadOutlined />} onClick={() => void refresh()}>Yenile</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => void openNew()}>Yeni Fatura</Button>
        </Space>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <Space wrap size={12}>
          <Select
            placeholder="Tüm Mağazalar"
            allowClear
            style={{ width: 200 }}
            options={storeOptions}
            value={filters.storeId || undefined}
            onChange={(v) => setFilters((p) => ({ ...p, storeId: v || undefined }))}
            showSearch
            optionFilterProp="label"
          />
          <Select
            placeholder="Başlangıç Dönemi"
            allowClear
            style={{ width: 165 }}
            options={periodOptions}
            value={filters.periodFrom}
            onChange={(v) => setFilters((p) => ({ ...p, periodFrom: v }))}
            showSearch
            optionFilterProp="label"
          />
          <Text type="secondary">—</Text>
          <Select
            placeholder="Bitiş Dönemi"
            allowClear
            style={{ width: 165 }}
            options={periodOptions}
            value={filters.periodTo}
            onChange={(v) => setFilters((p) => ({ ...p, periodTo: v }))}
            showSearch
            optionFilterProp="label"
          />
          <Button
            onClick={() => setFilters({ storeId: undefined, periodFrom: undefined, periodTo: undefined })}
            disabled={!filters.storeId && !filters.periodFrom && !filters.periodTo}
          >
            Temizle
          </Button>
        </Space>
      </Card>

      <Card bordered={false} className="erp-list-table-card erp-card-logo-divider">
        <Table
          size="small"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={invoices}
          scroll={{ x: "max-content" }}
          pagination={{ pageSize: 50, showTotal: (t, r) => `${r[0]}–${r[1]} / ${t}` }}
          locale={{ emptyText: "Henüz fatura kaydı bulunmuyor." }}
          onRow={(r) => ({ onClick: () => { setSelected(r); setDetailOpen(true); } })}
          rowClassName={() => "erp-clickable-row"}
        />
      </Card>

      {/* Detay Drawer */}
      <Drawer title="Fatura Detayı" placement="right" styles={{ wrapper: { width: 460 } }}
        open={detailOpen} onClose={() => setDetailOpen(false)}>
        {selected ? (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Fatura No">{selected.invoiceNo}</Descriptions.Item>
              <Descriptions.Item label="Gib Fatura No">{selected.extInvoiceNo || "-"}</Descriptions.Item>
              <Descriptions.Item label="Firma">{selected.storeName}</Descriptions.Item>
              <Descriptions.Item label="Fatura Tarihi">{formatDate(selected.invoiceDate)}</Descriptions.Item>
              <Descriptions.Item label="Toplam Tutar">{formatMoney(selected.totalAmount)}</Descriptions.Item>
              <Descriptions.Item label="KDV Oranı">{`%${selected.kdvRate}`}</Descriptions.Item>
              <Descriptions.Item label="Miktar">{selected.quantity}</Descriptions.Item>
              <Descriptions.Item label="KDV Tutarı">{formatMoney(selected.kdvAmount)}</Descriptions.Item>
              <Descriptions.Item label="Birim Tutar">{formatMoney(selected.unitAmount)}</Descriptions.Item>
              <Descriptions.Item label="Hizmet Tutarı">{formatMoney(selected.serviceAmount)}</Descriptions.Item>
              <Descriptions.Item label="İlgili Dönem">{periodLabel(selected.periodKey)}</Descriptions.Item>
              <Descriptions.Item label="Vade Tarihi">{formatDate(selected.dueDate)}</Descriptions.Item>
              <Descriptions.Item label="Açıklama">{selected.description || "-"}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <Button type="primary" icon={<EditOutlined />} onClick={() => openEdit(selected)}>Düzenle</Button>
              <Popconfirm title="Bu fatura silinsin mi?" okText="Sil" cancelText="Vazgeç"
                onConfirm={() => void handleDelete(selected.id)}>
                <Button danger icon={<DeleteOutlined />}>Sil</Button>
              </Popconfirm>
            </div>
          </>
        ) : null}
      </Drawer>

      {/* Yeni / Düzenle Modal */}
      <Modal
        title={editing ? "Fatura Düzenle" : "Yeni Fatura"}
        open={drawerOpen}
        onCancel={() => { if (!saving) setDrawerOpen(false); }}
        onOk={() => void handleSave()}
        okText="Kaydet"
        cancelText="Vazgeç"
        confirmLoading={saving}
        width={640}
        destroyOnClose
        centered
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={[16, 0]}>
            {/* Satır 1: Fatura No + GİB No */}
            <Col span={12}>
              <Form.Item label="Fatura No" style={{ marginBottom: 16 }}>
                <div style={{ padding: "5px 11px", background: "#f5f5f5", borderRadius: 6, border: "1px solid #d9d9d9" }}>
                  <Text strong>{nextNo || "—"}</Text>
                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>otomatik</Text>
                </div>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="extInvoiceNo" label="GİB Fatura No" style={{ marginBottom: 16 }}>
                <Input placeholder="Opsiyonel" />
              </Form.Item>
            </Col>
            {/* Satır 2: Firma */}
            <Col span={24}>
              <Form.Item name="storeId" label="Firma" rules={[{ required: true, message: "Firma seçiniz." }]} style={{ marginBottom: 16 }}>
                <Select options={storeOptions} showSearch optionFilterProp="label" placeholder="Mağaza seçin" />
              </Form.Item>
            </Col>
            {/* Satır 3: Tarih + Dönem */}
            <Col span={12}>
              <Form.Item name="invoiceDate" label="Fatura Tarihi" rules={[{ required: true, message: "Tarih zorunludur." }]} style={{ marginBottom: 16 }}>
                <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="İlgili Dönem" required style={{ marginBottom: 16 }}>
                <Space.Compact style={{ width: "100%" }}>
                  <Select
                    style={{ width: "55%" }}
                    options={MONTH_OPTIONS}
                    value={periodMonth}
                    onChange={(v) => setPeriodMonth(v)}
                  />
                  <Select
                    style={{ width: "45%" }}
                    options={YEAR_OPTIONS}
                    value={periodYear}
                    onChange={(v) => setPeriodYear(v)}
                  />
                </Space.Compact>
                <Text type="secondary" style={{ fontSize: 11 }}>{periodLabel(derivedPeriodKey)}</Text>
              </Form.Item>
            </Col>
            {/* Satır 4: Toplam Tutar + KDV + Miktar */}
            <Col span={10}>
              <Form.Item name="totalAmount" label="Toplam Tutar (KDV Dahil)" rules={[{ required: true, message: "Tutar zorunludur." }]} style={{ marginBottom: 16 }}>
                <InputNumber style={{ width: "100%" }} min={0} addonAfter="₺" precision={2} />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="kdvRate" label="KDV Oranı" rules={[{ required: true }]} style={{ marginBottom: 16 }}>
                <Select options={KDV_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="quantity" label="Miktar" rules={[{ required: true }]} style={{ marginBottom: 16 }}>
                <InputNumber style={{ width: "100%" }} min={0.0001} precision={4} />
              </Form.Item>
            </Col>
          </Row>

          {/* Hesaplanan alanlar */}
          <Card size="small" bordered style={{ background: "#f8fbff", marginBottom: 12 }}>
            <Row gutter={[12, 8]}>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>KDV Tutarı</Text>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{formatMoney(computed.kdvAmount)}</div>
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>Birim Tutar</Text>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{formatMoney(computed.unitAmount)}</div>
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>Hizmet Tutarı</Text>
                <div style={{ fontWeight: 700, color: "#d86d5b", fontSize: 14 }}>{formatMoney(computed.serviceAmount)}</div>
              </Col>
            </Row>
          </Card>

          <Form.Item name="description" label="Açıklama">
            <Input.TextArea rows={3} placeholder="Genel açıklama..." />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
