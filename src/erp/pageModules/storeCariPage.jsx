import React from "react";
import { Button, Card, Col, DatePicker, Form, Input, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography, message } from "antd";
import { CheckCircleOutlined, ReloadOutlined, RollbackOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { requestJson } from "../apiClient";
import { listStoresFresh } from "../storesData";

const { Title, Text } = Typography;

const PAYMENT_METHOD_OPTIONS = [
  { value: "Havale/EFT", label: "Havale / EFT" },
  { value: "Nakit",      label: "Nakit" },
  { value: "Cek",        label: "Çek" },
  { value: "Diger",      label: "Diğer" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "",              label: "Tümü" },
  { value: "Odenmedi",      label: "Ödenmedi" },
  { value: "VadesiGecti",   label: "Vadesi Geçti" },
  { value: "Kismi",         label: "Kısmi Ödeme" },
  { value: "Odendi",        label: "Ödendi" },
];

function fmt(v) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 }).format(Number(v || 0));
}
function fmtDate(v) {
  if (!v) return "-";
  return dayjs(v).format("DD.MM.YYYY");
}
function periodLabel(k) {
  if (!k) return "-";
  const [y, m] = k.split("-");
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(Number(y), Number(m) - 1, 1));
}
function buildPeriodOptions() {
  const opts = [];
  for (let y = 2021; y <= new Date().getFullYear() + 1; y++)
    for (let m = 1; m <= 12; m++) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      opts.push({ value: key, label: periodLabel(key) });
    }
  return opts.reverse();
}
const PERIOD_OPTIONS = buildPeriodOptions();

function resolveStatus(invoice) {
  if (invoice.paymentStatus === "Odendi") return "Odendi";
  if (invoice.paymentStatus === "Kismi")  return "Kismi";
  if (invoice.dueDate && dayjs(invoice.dueDate).isBefore(dayjs(), "day")) return "VadesiGecti";
  return "Odenmedi";
}

const STATUS_META = {
  Odendi:      { color: "green",   label: "Ödendi",        icon: "✅" },
  Kismi:       { color: "blue",    label: "Kısmi",          icon: "🔵" },
  VadesiGecti: { color: "red",     label: "Vadesi Geçti",   icon: "⚠️" },
  Odenmedi:    { color: "default", label: "Ödenmedi",       icon: "🔴" },
};

export default function StoreCariPage() {
  const [invoices, setInvoices]     = React.useState([]);
  const [stores, setStores]         = React.useState([]);
  const [loading, setLoading]       = React.useState(false);
  const [filters, setFilters]       = React.useState({ storeId: undefined, periodFrom: undefined, periodTo: undefined, statusFilter: "" });
  const [paymentModal, setPaymentModal] = React.useState(null); // { invoice }
  const [paymentForm]               = Form.useForm();
  const [saving, setSaving]         = React.useState(false);

  const storeOptions = React.useMemo(
    () => [{ value: "", label: "Tüm Mağazalar" }, ...stores.map((s) => ({ value: s.id, label: s.name }))],
    [stores],
  );

  const fetchData = React.useCallback(async (f) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (f.storeId)    params.set("storeId",    f.storeId);
      if (f.periodFrom) params.set("periodFrom", f.periodFrom);
      if (f.periodTo)   params.set("periodTo",   f.periodTo);
      const [data, storeList] = await Promise.all([
        requestJson("GET", `/api/store-invoices?${params.toString()}`),
        listStoresFresh(),
      ]);
      setInvoices(data?.items || []);
      setStores(storeList || []);
    } catch { setInvoices([]); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void fetchData(filters); }, [fetchData, filters]);

  const displayedInvoices = React.useMemo(() => {
    if (!filters.statusFilter) return invoices;
    return invoices.filter((inv) => resolveStatus(inv) === filters.statusFilter);
  }, [invoices, filters.statusFilter]);

  // Özet
  const summary = React.useMemo(() => {
    const total    = invoices.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
    const paid     = invoices.reduce((s, r) => s + (r.paymentStatus === "Odendi" ? Number(r.totalAmount || 0) : r.paymentStatus === "Kismi" ? Number(r.paidAmount || 0) : 0), 0);
    const overdue  = invoices.filter((r) => resolveStatus(r) === "VadesiGecti").reduce((s, r) => s + Number(r.totalAmount || 0), 0);
    return { total, paid, pending: total - paid, overdue };
  }, [invoices]);

  // Mağaza özeti
  const storeSummary = React.useMemo(() => {
    const map = {};
    invoices.forEach((r) => {
      const k = r.storeName || r.storeId;
      if (!map[k]) map[k] = { store: k, total: 0, paid: 0, overdue: 0 };
      map[k].total += Number(r.totalAmount || 0);
      if (r.paymentStatus === "Odendi") map[k].paid += Number(r.totalAmount || 0);
      else if (r.paymentStatus === "Kismi") map[k].paid += Number(r.paidAmount || 0);
      if (resolveStatus(r) === "VadesiGecti") map[k].overdue += Number(r.totalAmount || 0);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [invoices]);

  const openPaymentModal = (invoice) => {
    setPaymentModal({ invoice });
    paymentForm.setFieldsValue({
      paidAt:        dayjs(),
      paymentMethod: "Havale/EFT",
      paidAmount:    invoice.totalAmount,
      paymentNote:   "",
    });
  };

  const handleSavePayment = async () => {
    try {
      const values = await paymentForm.validateFields();
      setSaving(true);
      await requestJson("PUT", `/api/store-invoices/${paymentModal.invoice.id}/payment`, {
        paidAt:        values.paidAt.format("YYYY-MM-DD"),
        paymentMethod: values.paymentMethod,
        paidAmount:    Number(values.paidAmount),
        paymentNote:   values.paymentNote || "",
      });
      message.success("Ödeme kaydedildi.");
      setPaymentModal(null);
      void fetchData(filters);
    } catch (error) {
      if (!error?.errorFields) message.error(error?.message || "Odeme kaydedilemedi.");
    } finally { setSaving(false); }
  };

  const handleRevert = async (invoiceId) => {
    try {
      await requestJson("PUT", `/api/store-invoices/${invoiceId}/payment-revert`, {});
      message.success("Ödeme geri alındı.");
      void fetchData(filters);
    } catch (error) { message.error(error?.message || "Islem basarisiz."); }
  };

  const columns = [
    { title: "Fatura No",   dataIndex: "invoiceNo",   key: "invoiceNo",  width: 140,
      render: (v) => <Text strong style={{ fontSize: 12 }}>{v}</Text> },
    { title: "GİB No",      dataIndex: "extInvoiceNo",key: "extInvoiceNo",width: 150, render: (v) => v || <Text type="secondary">-</Text> },
    { title: "Firma",       dataIndex: "storeName",   key: "storeName",  width: 160 },
    { title: "Dönem",       dataIndex: "periodKey",   key: "periodKey",  width: 120, render: periodLabel },
    { title: "Vade",        dataIndex: "dueDate",     key: "dueDate",    width: 110, render: (v, r) => {
      const isOverdue = resolveStatus(r) === "VadesiGecti";
      return <span style={{ color: isOverdue ? "#cf1322" : undefined, fontWeight: isOverdue ? 600 : 400 }}>{fmtDate(v)}</span>;
    }},
    { title: "Tutar",       dataIndex: "totalAmount", key: "totalAmount",width: 130, align: "right", render: fmt },
    { title: "Durum",       key: "status",            width: 130,
      render: (_, r) => {
        const s = resolveStatus(r);
        const meta = STATUS_META[s];
        return <Tag color={meta.color}>{meta.icon} {meta.label}</Tag>;
      },
    },
    { title: "Ödeme Tarihi",dataIndex: "paidAt",      key: "paidAt",     width: 120, render: fmtDate },
    { title: "Yöntem",      dataIndex: "paymentMethod",key: "paymentMethod",width: 110, render: (v) => v || "-" },
    { title: "İşlemler",    key: "actions",            width: 130,
      render: (_, r) => {
        const s = resolveStatus(r);
        if (s === "Odendi") {
          return (
            <Popconfirm title="Ödeme geri alınsın mı?" okText="Evet" cancelText="Hayır"
              onConfirm={() => void handleRevert(r.id)}>
              <Tooltip title="Ödemeyi Geri Al">
                <Button size="small" className="erp-icon-btn erp-icon-btn-edit" icon={<RollbackOutlined />} />
              </Tooltip>
            </Popconfirm>
          );
        }
        return (
          <Button size="small" type="primary" icon={<CheckCircleOutlined />}
            onClick={() => openPaymentModal(r)} style={{ fontSize: 12 }}>
            Ödendi
          </Button>
        );
      },
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div className="erp-page-intro">
        <div><Title level={3} style={{ marginBottom: 6 }}>Mağaza Cari Hesap</Title></div>
        <Space wrap className="erp-page-intro-actions">
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void fetchData(filters)}>Yenile</Button>
        </Space>
      </div>

      {/* Filtreler */}
      <Card bordered={false} className="erp-list-toolbar-card">
        <Space wrap size={12}>
          <Select placeholder="Tüm Mağazalar" allowClear style={{ width: 200 }}
            options={storeOptions} value={filters.storeId || undefined}
            onChange={(v) => setFilters((p) => ({ ...p, storeId: v || undefined }))}
            showSearch optionFilterProp="label" />
          <Select placeholder="Başlangıç Dönemi" allowClear style={{ width: 160 }}
            options={PERIOD_OPTIONS} value={filters.periodFrom}
            onChange={(v) => setFilters((p) => ({ ...p, periodFrom: v }))}
            showSearch optionFilterProp="label" />
          <Text type="secondary">—</Text>
          <Select placeholder="Bitiş Dönemi" allowClear style={{ width: 160 }}
            options={PERIOD_OPTIONS} value={filters.periodTo}
            onChange={(v) => setFilters((p) => ({ ...p, periodTo: v }))}
            showSearch optionFilterProp="label" />
          <Select placeholder="Durum" style={{ width: 150 }}
            options={STATUS_FILTER_OPTIONS} value={filters.statusFilter}
            onChange={(v) => setFilters((p) => ({ ...p, statusFilter: v || "" }))} />
          <Button onClick={() => setFilters({ storeId: undefined, periodFrom: undefined, periodTo: undefined, statusFilter: "" })}>
            Temizle
          </Button>
        </Space>
      </Card>

      {/* Özet Kartlar */}
      <Row gutter={[16, 16]}>
        {[
          { title: "Toplam Fatura",   value: summary.total,   color: "#1677ff" },
          { title: "Ödenen",          value: summary.paid,    color: "#52c41a" },
          { title: "Bekleyen",        value: summary.pending, color: "#fa8c16" },
          { title: "Vadesi Geçmiş",   value: summary.overdue, color: "#cf1322" },
        ].map((c) => (
          <Col xs={12} md={6} key={c.title}>
            <Card bordered={false} loading={loading}>
              <Statistic title={<Text type="secondary" style={{ fontSize: 13 }}>{c.title}</Text>}
                value={fmt(c.value)} valueStyle={{ color: c.color, fontSize: 20, fontWeight: 700 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Fatura Tablosu */}
      <Card title={`Fatura Listesi (${displayedInvoices.length} kayıt)`}
        bordered={false} className="erp-list-table-card erp-card-logo-divider">
        <Table size="small" rowKey="id" loading={loading} columns={columns}
          dataSource={displayedInvoices} scroll={{ x: "max-content" }}
          pagination={{ pageSize: 50, showTotal: (t, r) => `${r[0]}–${r[1]} / ${t}` }}
          locale={{ emptyText: "Kayıt bulunamadı." }}
          summary={() => {
            if (!displayedInvoices.length) return null;
            const totalAmt = displayedInvoices.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
            return (
              <Table.Summary>
                <Table.Summary.Row style={{ background: "#d86d5b" }}>
                  <Table.Summary.Cell index={0} colSpan={5}><Text strong style={{ color: "#fff" }}>Toplam</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right"><Text strong style={{ color: "#fff" }}>{fmt(totalAmt)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={6} colSpan={4} />
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>

      {/* Mağaza Özet */}
      {storeSummary.length > 1 && (
        <Card title="Mağaza Bazlı Özet" bordered={false} className="erp-card-logo-divider">
          <Table size="small" rowKey="store" pagination={false}
            dataSource={storeSummary}
            columns={[
              { title: "Mağaza",          dataIndex: "store",   key: "store",   width: 180 },
              { title: "Toplam Fatura",   dataIndex: "total",   key: "total",   width: 150, align: "right", render: fmt },
              { title: "Ödenen",          dataIndex: "paid",    key: "paid",    width: 150, align: "right", render: (v) => <Text style={{ color: "#52c41a" }}>{fmt(v)}</Text> },
              { title: "Bekleyen",        key: "pending",       width: 150,     align: "right",
                render: (_, r) => <Text style={{ color: "#fa8c16" }}>{fmt(r.total - r.paid)}</Text> },
              { title: "Vadesi Geçmiş",   dataIndex: "overdue", key: "overdue", width: 150, align: "right",
                render: (v) => v > 0 ? <Text style={{ color: "#cf1322", fontWeight: 700 }}>{fmt(v)}</Text> : <Text type="secondary">-</Text> },
            ]}
          />
        </Card>
      )}

      {/* Ödeme Modal */}
      <Modal title={`Ödeme Kaydı — ${paymentModal?.invoice?.invoiceNo || ""}`}
        open={Boolean(paymentModal)} centered width={460}
        onCancel={() => { if (!saving) setPaymentModal(null); }}
        onOk={() => void handleSavePayment()}
        okText="Ödendi Kaydet" cancelText="Vazgeç" confirmLoading={saving}>
        {paymentModal && (
          <Form form={paymentForm} layout="vertical" style={{ marginTop: 8 }}>
            <Row gutter={[12, 0]}>
              <Col span={24}>
                <div style={{ background: "#f5f5f5", borderRadius: 6, padding: "10px 14px", marginBottom: 16 }}>
                  <Text type="secondary">Fatura Tutarı</Text>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#d86d5b" }}>
                    {fmt(paymentModal.invoice.totalAmount)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {paymentModal.invoice.storeName} · {periodLabel(paymentModal.invoice.periodKey)}
                  </Text>
                </div>
              </Col>
              <Col span={12}>
                <Form.Item name="paidAt" label="Ödeme Tarihi" rules={[{ required: true }]}>
                  <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="paymentMethod" label="Yöntem">
                  <Select options={PAYMENT_METHOD_OPTIONS} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="paidAmount" label="Ödenen Tutar" rules={[{ required: true }]}>
                  <input type="number" step="0.01"
                    style={{ width: "100%", padding: "6px 11px", borderRadius: 6, border: "1px solid #d9d9d9", fontSize: 14 }}
                    onChange={(e) => paymentForm.setFieldValue("paidAmount", e.target.value)} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="paymentNote" label="Not">
                  <Input placeholder="Opsiyonel" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        )}
      </Modal>
    </Space>
  );
}
