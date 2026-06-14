import React from "react";
import { Button, Card, Col, Grid, Row, Select, Space, Statistic, Table, Tag, Typography } from "antd";
import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import { requestJson } from "../apiClient";
import { listStoresFresh } from "../storesData";

const { Title, Text } = Typography;

const PALETTE = ["#d86d5b","#1677ff","#52c41a","#fa8c16","#722ed1","#13c2c2","#eb2f96","#faad14"];

function fmt(v) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 }).format(Number(v || 0));
}
function fmtDate(v) {
  if (!v) return "-";
  const [y, m, d] = String(v).slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}
function periodLabel(k) {
  if (!k) return "-";
  const [y, m] = k.split("-");
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(Number(y), Number(m) - 1, 1));
}

function buildPeriodOptions() {
  const opts = [];
  for (let y = 2021; y <= new Date().getFullYear() + 1; y++) {
    for (let m = 1; m <= 12; m++) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      opts.push({ value: key, label: periodLabel(key) });
    }
  }
  return opts.reverse();
}

const PERIOD_OPTIONS = buildPeriodOptions();

export default function StoreInvoiceReportPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [invoices, setInvoices]   = React.useState([]);
  const [stores, setStores]       = React.useState([]);
  const [loading, setLoading]     = React.useState(false);
  const [filters, setFilters]     = React.useState({
    storeId:    undefined,
    periodFrom: undefined,
    periodTo:   undefined,
  });

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
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void fetchData(filters); }, [fetchData, filters]);

  // ── Özet hesaplamalar ──────────────────────────────────────────────────────
  const summary = React.useMemo(() => ({
    count:         invoices.length,
    totalAmount:   invoices.reduce((s, r) => s + Number(r.totalAmount  || 0), 0),
    kdvAmount:     invoices.reduce((s, r) => s + Number(r.kdvAmount    || 0), 0),
    serviceAmount: invoices.reduce((s, r) => s + Number(r.serviceAmount || 0), 0),
  }), [invoices]);

  // ── Aylık trend ───────────────────────────────────────────────────────────
  const monthlyChart = React.useMemo(() => {
    const map = {};
    invoices.forEach((r) => {
      const k = r.periodKey || "";
      if (!map[k]) map[k] = { period: periodLabel(k), key: k, total: 0, service: 0, kdv: 0 };
      map[k].total   += Number(r.totalAmount  || 0);
      map[k].service += Number(r.serviceAmount || 0);
      map[k].kdv     += Number(r.kdvAmount    || 0);
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [invoices]);

  // ── Mağaza bazlı ─────────────────────────────────────────────────────────
  const storeChart = React.useMemo(() => {
    const map = {};
    invoices.forEach((r) => {
      const k = r.storeName || r.storeId;
      if (!map[k]) map[k] = { store: k, total: 0, service: 0, count: 0 };
      map[k].total   += Number(r.totalAmount  || 0);
      map[k].service += Number(r.serviceAmount || 0);
      map[k].count   += 1;
    });
    return Object.values(map).sort((a, b) => b.service - a.service);
  }, [invoices]);

  // ── Excel export ──────────────────────────────────────────────────────────
  const handleExport = () => {
    const header = ["Fatura No","GİB Fatura No","Firma","Fatura Tarihi","Toplam Tutar","KDV Oranı","Miktar","KDV Tutarı","Hizmet Tutarı","Dönem","Vade Tarihi"];
    const rows = invoices.map((r) => [
      r.invoiceNo, r.extInvoiceNo || "", r.storeName,
      fmtDate(r.invoiceDate), r.totalAmount, `%${r.kdvRate}`, r.quantity,
      r.kdvAmount, r.serviceAmount, periodLabel(r.periodKey), fmtDate(r.dueDate),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MağazaSatışRaporu");
    XLSX.writeFile(wb, `magaza-satis-raporu-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const tableColumns = [
    { title: "Fatura No",    dataIndex: "invoiceNo",     key: "invoiceNo",     width: 140,
      sorter: (a, b) => String(a.invoiceNo || "").localeCompare(String(b.invoiceNo || ""), "tr") },
    { title: "GİB No",       dataIndex: "extInvoiceNo",  key: "extInvoiceNo",  width: 150,
      sorter: (a, b) => String(a.extInvoiceNo || "").localeCompare(String(b.extInvoiceNo || ""), "tr"),
      render: (v) => v || <Text type="secondary">-</Text> },
    { title: "Firma",        dataIndex: "storeName",     key: "storeName",     width: 160,
      sorter: (a, b) => String(a.storeName || "").localeCompare(String(b.storeName || ""), "tr") },
    { title: "Tarih",        dataIndex: "invoiceDate",   key: "invoiceDate",   width: 110,
      sorter: (a, b) => String(a.invoiceDate || "").localeCompare(String(b.invoiceDate || "")),
      render: fmtDate },
    { title: "Toplam",       dataIndex: "totalAmount",   key: "totalAmount",   width: 130, align: "right",
      sorter: (a, b) => Number(a.totalAmount || 0) - Number(b.totalAmount || 0),
      render: fmt },
    { title: "KDV %",        dataIndex: "kdvRate",       key: "kdvRate",       width: 75,  align: "center",
      sorter: (a, b) => Number(a.kdvRate || 0) - Number(b.kdvRate || 0),
      render: (v) => `%${v}` },
    { title: "KDV Tutar",    dataIndex: "kdvAmount",     key: "kdvAmount",     width: 120, align: "right",
      sorter: (a, b) => Number(a.kdvAmount || 0) - Number(b.kdvAmount || 0),
      render: fmt },
    { title: "Hizmet Tutar", dataIndex: "serviceAmount", key: "serviceAmount", width: 130, align: "right",
      sorter: (a, b) => Number(a.serviceAmount || 0) - Number(b.serviceAmount || 0),
      render: (v) => <Text strong>{fmt(v)}</Text> },
    { title: "Dönem",        dataIndex: "periodKey",     key: "periodKey",     width: 120,
      sorter: (a, b) => String(a.periodKey || "").localeCompare(String(b.periodKey || "")),
      render: periodLabel },
    { title: "Vade",         dataIndex: "dueDate",       key: "dueDate",       width: 110,
      sorter: (a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")),
      render: fmtDate },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      {/* Başlık */}
      <div className="erp-page-intro">
        <div><Title level={3} style={{ marginBottom: 6 }}>Mağaza Satış Raporu</Title></div>
        <Space wrap className="erp-page-intro-actions">
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void fetchData(filters)}>Yenile</Button>
        </Space>
      </div>

      {/* Filtreler */}
      <Card bordered={false} className="erp-list-toolbar-card" styles={isMobile ? { body: { padding: 12 } } : undefined}>
        <Space wrap size={isMobile ? 8 : 12} style={isMobile ? { width: "100%" } : undefined}>
          <Select
            placeholder="Tüm Mağazalar"
            allowClear
            style={{ width: isMobile ? "100%" : 200 }}
            options={storeOptions}
            value={filters.storeId || undefined}
            onChange={(v) => setFilters((p) => ({ ...p, storeId: v || undefined }))}
            showSearch optionFilterProp="label"
          />
          <Select
            placeholder="Başlangıç Dönemi"
            allowClear
            style={{ width: isMobile ? "calc(50% - 4px)" : 170 }}
            options={PERIOD_OPTIONS}
            value={filters.periodFrom}
            onChange={(v) => setFilters((p) => ({ ...p, periodFrom: v }))}
            showSearch optionFilterProp="label"
          />
          {!isMobile ? <Text type="secondary">—</Text> : null}
          <Select
            placeholder="Bitiş Dönemi"
            allowClear
            style={{ width: isMobile ? "calc(50% - 4px)" : 170 }}
            options={PERIOD_OPTIONS}
            value={filters.periodTo}
            onChange={(v) => setFilters((p) => ({ ...p, periodTo: v }))}
            showSearch optionFilterProp="label"
          />
          <Button onClick={() => setFilters({ storeId: undefined, periodFrom: undefined, periodTo: undefined })} block={isMobile}>
            Temizle
          </Button>
        </Space>
      </Card>

      {/* Özet Kartlar */}
      <Row gutter={[16, 16]}>
        {[
          { title: "Fatura Sayısı",   value: summary.count,         fmt: (v) => v,    color: "#1677ff" },
          { title: "Toplam Tutar",    value: summary.totalAmount,   fmt: fmt,         color: "#d86d5b" },
          { title: "Toplam KDV",      value: summary.kdvAmount,     fmt: fmt,         color: "#fa8c16" },
          { title: "Hizmet Tutarı",   value: summary.serviceAmount, fmt: fmt,         color: "#52c41a" },
        ].map((c) => (
          <Col xs={12} md={6} key={c.title}>
            <Card bordered={false} loading={loading}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>{c.title}</Text>}
                value={c.fmt(c.value)}
                valueStyle={{ color: c.color, fontSize: 22, fontWeight: 700 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Grafikler */}
      <Row gutter={[16, 16]}>
        {/* Aylık Trend */}
        <Col xs={24} xl={14}>
          <Card title="Aylık Tutar Trendi" bordered={false} className="erp-card-logo-divider" loading={loading}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={monthlyChart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#d86d5b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#d86d5b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradService" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#52c41a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(monthlyChart.length / 8))} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₺${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v, n) => [fmt(v), n === "total" ? "Toplam" : "Hizmet"]} />
                <Legend formatter={(v) => v === "total" ? "Toplam Tutar" : "Hizmet Tutarı"} />
                <Area type="monotone" dataKey="total"   stroke="#d86d5b" fill="url(#gradTotal)"   strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="service" stroke="#52c41a" fill="url(#gradService)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Mağaza Bazlı */}
        <Col xs={24} xl={10}>
          <Card title="Mağaza Bazlı Hizmet Tutarı" bordered={false} className="erp-card-logo-divider" loading={loading}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={storeChart} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₺${(v/1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="store" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(v) => [fmt(v), "Hizmet Tutarı"]} />
                <Bar dataKey="service" name="Hizmet Tutarı" radius={[0,4,4,0]}>
                  {storeChart.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Detay Tablo */}
      <Card title={`Fatura Listesi (${invoices.length} kayıt)`} bordered={false} className="erp-list-table-card erp-card-logo-divider">
        <Table
          size="small"
          rowKey="id"
          loading={loading}
          columns={tableColumns}
          dataSource={invoices}
          scroll={{ x: "max-content" }}
          pagination={{ pageSize: 50, showTotal: (t, r) => `${r[0]}–${r[1]} / ${t}` }}
          locale={{ emptyText: "Filtre kriterlerine uygun kayıt bulunamadı." }}
          summary={() => {
            if (!invoices.length) return null;
            return (
              <Table.Summary>
                <Table.Summary.Row style={{ background: "#d86d5b" }}>
                  <Table.Summary.Cell index={0} colSpan={4}><Text strong style={{ color: "#fff" }}>Toplam</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right"><Text strong style={{ color: "#fff" }}>{fmt(summary.totalAmount)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={5} />
                  <Table.Summary.Cell index={6} align="right"><Text strong style={{ color: "#fff" }}>{fmt(summary.kdvAmount)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right"><Text strong style={{ color: "#fff" }}>{fmt(summary.serviceAmount)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={8} colSpan={2} />
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>
    </Space>
  );
}
