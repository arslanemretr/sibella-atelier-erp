import React from "react";
import {
  Button, Card, Col, Row, Select, Space, Statistic, Table, Tag, Typography,
} from "antd";
import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import { requestJson } from "../apiClient";

const { Title, Text } = Typography;

const PALETTE = ["#d86d5b","#1677ff","#52c41a","#fa8c16","#722ed1","#13c2c2","#eb2f96","#faad14"];

function fmt(v) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Number(v || 0));
}

function periodLabel(k) {
  if (!k) return "-";
  const [y, m] = k.split("-");
  return new Intl.DateTimeFormat("tr-TR", { month: "short", year: "2-digit" })
    .format(new Date(Number(y), Number(m) - 1, 1));
}

const YEAR_OPTIONS = (() => {
  const opts = [];
  for (let y = 2021; y <= new Date().getFullYear() + 1; y++)
    opts.push({ value: y, label: String(y) });
  return opts.reverse();
})();

const MONTH_OPTIONS = [
  { value: "01", label: "Ocak" },   { value: "02", label: "Şubat" },
  { value: "03", label: "Mart" },   { value: "04", label: "Nisan" },
  { value: "05", label: "Mayıs" },  { value: "06", label: "Haziran" },
  { value: "07", label: "Temmuz" }, { value: "08", label: "Ağustos" },
  { value: "09", label: "Eylül" },  { value: "10", label: "Ekim" },
  { value: "11", label: "Kasım" },  { value: "12", label: "Aralık" },
];

function defaultPeriods() {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  return { fromMonth: "01", fromYear: y, toMonth: m, toYear: y };
}

function PeriodPicker({ monthVal, yearVal, onMonth, onYear }) {
  return (
    <Space.Compact>
      <Select value={monthVal} onChange={onMonth} options={MONTH_OPTIONS} style={{ width: 110 }} />
      <Select value={yearVal}  onChange={onYear}  options={YEAR_OPTIONS}  style={{ width: 90 }} />
    </Space.Compact>
  );
}

export default function ConsolidatedSalesReportPage() {
  const [data,    setData]    = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [period,  setPeriod]  = React.useState(defaultPeriods);

  const periodFrom = `${period.fromYear}-${period.fromMonth}`;
  const periodTo   = `${period.toYear}-${period.toMonth}`;

  const fetchData = React.useCallback(async (pFrom, pTo) => {
    try {
      setLoading(true);
      const result = await requestJson(
        "GET",
        `/api/reports/consolidated-sales?periodFrom=${pFrom}&periodTo=${pTo}`,
      );
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void fetchData(periodFrom, periodTo); }, [fetchData, periodFrom, periodTo]);

  const s = data?.summary || {};

  // ── Aylık chart verisi ────────────────────────────────────────────────────
  const monthlyChart = React.useMemo(() => {
    if (!data) return [];
    const map = {};
    (data.posMonthly || []).forEach((r) => {
      map[r.periodKey] = { key: r.periodKey, label: periodLabel(r.periodKey), pos: r.posTotal, store: 0 };
    });
    (data.storeMonthly || []).forEach((r) => {
      if (!map[r.periodKey]) map[r.periodKey] = { key: r.periodKey, label: periodLabel(r.periodKey), pos: 0, store: 0 };
      map[r.periodKey].store = r.grossStoreSales;
    });
    return Object.values(map)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => ({ ...r, total: r.pos + r.store }));
  }, [data]);

  // ── Mağaza bar chart ──────────────────────────────────────────────────────
  const storeBarData = (data?.storeBreakdown || []).map((r) => ({
    store: r.storeName,
    brut:  r.grossStoreSales,
    hakEdis: r.invoiceTotal,
    komisyon: r.commissionAmount,
  }));

  // ── Excel ─────────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Gösterge", "Tutar"],
      ["Şarköy Toplam Satış",    s.posTotal],
      ["  — Sibella Satış",      s.sibellaPosTotal],
      ["  — Tedarikçi Satış",    s.tedarikciPosTotal],
      ["Mağazalar Toplam Satış", s.grossStoreTotal],
      ["  — Sibella Hakediş",    s.invoiceTotal],
      ["  — Mağaza Komisyon",    s.storeCommission],
      ["Toplam Ciro",            s.totalCiro],
      ["Net Sibella Ciro",       s.netSibellaCiro],
    ]), "Özet");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Dönem", "Şarköy Toplam", "Mağazalar Toplam", "Toplam Ciro"],
      ...monthlyChart.map((r) => [r.label, r.pos, r.store, r.total]),
    ]), "Aylık");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Mağaza", "Komisyon %", "Brüt Satış", "Sibella Hakediş", "Mağaza Komisyon"],
      ...(data.storeBreakdown || []).map((r) => [r.storeName, r.commissionRate, r.grossStoreSales, r.invoiceTotal, r.commissionAmount]),
    ]), "Mağaza");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Tedarikçi", "Komisyon %", "Brüt Satış", "Sibella Payı", "Tedarikçi Payı"],
      ...(data.posSupplierBreakdown || []).map((r) => [
        r.supplierName, r.isSibella ? 100 : r.commissionRate,
        r.totalAmount,
        r.isSibella ? r.totalAmount : r.sibellaCommission,
        r.isSibella ? 0 : r.totalAmount - r.sibellaCommission,
      ]),
    ]), "POS Tedarikçi");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Kategori", "Adet", "Tutar"],
      ...(data.categoryBreakdown || []).map((r) => [r.category, r.totalQuantity, r.totalAmount]),
    ]), "Kategori");
    XLSX.writeFile(wb, `konsolide-satis-${periodFrom}-${periodTo}.xlsx`);
  };

  // ── Tablo sütunları: Mağaza ───────────────────────────────────────────────
  const storeCols = [
    { title: "Mağaza",          dataIndex: "storeName",        key: "s1",
      sorter: (a, b) => a.storeName.localeCompare(b.storeName, "tr") },
    { title: "Kom.%", width: 80, dataIndex: "commissionRate",  key: "s2", align: "center",
      sorter: (a, b) => a.commissionRate - b.commissionRate,
      render: (v) => <Tag color="orange">%{v}</Tag> },
    { title: "Brüt Satış",      dataIndex: "grossStoreSales",  key: "s3", align: "right",
      sorter: (a, b) => a.grossStoreSales - b.grossStoreSales,
      render: (v) => <Text strong>{fmt(v)}</Text> },
    { title: "Sibella Hakediş", dataIndex: "invoiceTotal",     key: "s4", align: "right",
      sorter: (a, b) => a.invoiceTotal - b.invoiceTotal, render: fmt },
    { title: "Mağaza Komisyon", dataIndex: "commissionAmount", key: "s5", align: "right",
      sorter: (a, b) => a.commissionAmount - b.commissionAmount, render: fmt },
  ];

  // ── Tablo sütunları: POS Tedarikçi ────────────────────────────────────────
  const supplierCols = [
    { title: "Tedarikçi",       dataIndex: "supplierName",  key: "p1",
      sorter: (a, b) => String(a.supplierName).localeCompare(String(b.supplierName), "tr") },
    { title: "Kom.%", width: 80, key: "p2", align: "center",
      sorter: (a, b) => (a.isSibella ? 100 : a.commissionRate) - (b.isSibella ? 100 : b.commissionRate),
      render: (_, r) => r.isSibella
        ? <Tag color="blue">%100</Tag>
        : <Tag color="orange">%{r.commissionRate}</Tag> },
    { title: "Brüt Satış",     dataIndex: "totalAmount",        key: "p3", align: "right",
      sorter: (a, b) => a.totalAmount - b.totalAmount,
      render: (v) => <Text strong>{fmt(v)}</Text> },
    { title: "Sibella Payı",   key: "p4", align: "right",
      sorter: (a, b) => (a.isSibella ? a.totalAmount : a.sibellaCommission) - (b.isSibella ? b.totalAmount : b.sibellaCommission),
      render: (_, r) => fmt(r.isSibella ? r.totalAmount : r.sibellaCommission) },
    { title: "Tedarikçi Payı", key: "p5", align: "right",
      sorter: (a, b) => (a.isSibella ? 0 : a.totalAmount - a.sibellaCommission) - (b.isSibella ? 0 : b.totalAmount - b.sibellaCommission),
      render: (_, r) => r.isSibella
        ? <Text type="secondary">₺0</Text>
        : fmt(r.totalAmount - r.sibellaCommission) },
  ];

  // ── Tablo sütunları: Kategori ─────────────────────────────────────────────
  const catCols = [
    { title: "Kategori",  dataIndex: "category",      key: "c1",
      sorter: (a, b) => String(a.category || "").localeCompare(String(b.category || ""), "tr") },
    { title: "Adet",      dataIndex: "totalQuantity", key: "c2", align: "center", width: 80,
      sorter: (a, b) => a.totalQuantity - b.totalQuantity },
    { title: "Tutar",     dataIndex: "totalAmount",   key: "c3", align: "right",
      sorter: (a, b) => a.totalAmount - b.totalAmount,
      render: (v) => <Text strong>{fmt(v)}</Text> },
  ];

  const SUMMARY_STYLE = { background: "#d86d5b" };
  const SUMMARY_TEXT  = { color: "#fff" };
  const SUMMARY_BOLD  = { color: "#fff", fontWeight: 600 };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      {/* Başlık */}
      <div className="erp-page-intro">
        <div><Title level={3} style={{ marginBottom: 6 }}>Konsolide Satış Raporu</Title></div>
        <Space wrap className="erp-page-intro-actions">
          <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!data}>Excel'e Aktar</Button>
          <Button icon={<ReloadOutlined />} loading={loading}
            onClick={() => void fetchData(periodFrom, periodTo)}>Yenile</Button>
        </Space>
      </div>

      {/* Filtre */}
      <Card bordered={false} className="erp-list-toolbar-card">
        <Space wrap align="center" size={12}>
          <Text strong>Dönem Başı:</Text>
          <PeriodPicker
            monthVal={period.fromMonth} yearVal={period.fromYear}
            onMonth={(v) => setPeriod((p) => ({ ...p, fromMonth: v }))}
            onYear={(v)  => setPeriod((p) => ({ ...p, fromYear: v }))}
          />
          <Text type="secondary" style={{ marginLeft: 4 }}>—</Text>
          <Text strong style={{ marginLeft: 4 }}>Dönem Sonu:</Text>
          <PeriodPicker
            monthVal={period.toMonth} yearVal={period.toYear}
            onMonth={(v) => setPeriod((p) => ({ ...p, toMonth: v }))}
            onYear={(v)  => setPeriod((p) => ({ ...p, toYear: v }))}
          />
        </Space>
      </Card>

      {/* ── Özet Kartlar ── */}
      <Row gutter={[16, 16]}>
        {[
          { title: "Şarköy Toplam Satış",    value: s.posTotal,         color: "#1677ff",
            sub: [["Sibella Satış", s.sibellaPosTotal], ["Tedarikçi Satış", s.tedarikciPosTotal]] },
          { title: "Mağazalar Toplam Satış", value: s.grossStoreTotal,  color: "#d86d5b",
            sub: [["Sibella Hakediş", s.invoiceTotal], ["Mağaza Komisyon", s.storeCommission]] },
          { title: "Toplam Ciro",            value: s.totalCiro,        color: "#722ed1",
            sub: [["Şarköy Toplam", s.posTotal], ["Mağazalar Toplam", s.grossStoreTotal]] },
          { title: "Net Sibella Ciro",       value: s.netSibellaCiro,   color: "#52c41a",
            sub: [["Şarköy Hakediş", s.sarkoyHakEdis], ["Mağaza Hakediş", s.invoiceTotal]] },
        ].map((c) => (
          <Col xs={12} md={6} key={c.title}>
            <Card bordered={false} className="erp-card-logo-divider" loading={loading}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>{c.title}</Text>}
                value={fmt(c.value || 0)}
                valueStyle={{ color: c.color, fontSize: 20, fontWeight: 700 }}
              />
              <div style={{ marginTop: 6, borderTop: "1px solid #f5f5f5", paddingTop: 6 }}>
                {c.sub.map(([label, val]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, lineHeight: 1.7 }}>
                    <Text type="secondary">{label}</Text>
                    <Text>{fmt(val)}</Text>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Grafikler ── */}
      <Row gutter={[16, 16]}>
        {/* Aylık trend */}
        <Col xs={24} xl={14}>
          <Card title="Aylık Ciro Dağılımı" bordered={false} className="erp-card-logo-divider" loading={loading}>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={monthlyChart} margin={{ top: 8, right: 32, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#1677ff" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#1677ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradStore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#d86d5b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#d86d5b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `₺${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n) => [fmt(v), n]} />
                <Legend />
                <Area type="monotone" dataKey="pos"   name="Şarköy"      stroke="#1677ff" fill="url(#gradPos)"   strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="store" name="Mağazalar"   stroke="#d86d5b" fill="url(#gradStore)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="total" name="Toplam Ciro"
                  stroke="#722ed1" strokeWidth={2.5} dot={{ r: 4, fill: "#722ed1" }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Mağaza bar chart */}
        {storeBarData.length > 0 && (
          <Col xs={24} xl={10}>
            <Card title="Mağaza Bazlı Brüt Satış" bordered={false} className="erp-card-logo-divider" loading={loading}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={storeBarData} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₺${(v/1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="store" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(v) => [fmt(v), ""]} />
                  <Bar dataKey="brut" name="Brüt Satış" radius={[0, 4, 4, 0]}>
                    {storeBarData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        )}
      </Row>

      {/* ── Mağaza Bazlı Özet ── */}
      {(data?.storeBreakdown?.length > 0) && (
        <Card title="Mağaza Bazlı Özet" bordered={false} className="erp-list-table-card erp-card-logo-divider">
          <Table
            rowKey="storeId"
            dataSource={data.storeBreakdown}
            columns={storeCols}
            pagination={false}
            size="small"
            loading={loading}
            summary={(rows) => {
              const t = rows.reduce((acc, r) => ({
                grossStoreSales:  acc.grossStoreSales  + r.grossStoreSales,
                invoiceTotal:     acc.invoiceTotal     + r.invoiceTotal,
                commissionAmount: acc.commissionAmount + r.commissionAmount,
              }), { grossStoreSales: 0, invoiceTotal: 0, commissionAmount: 0 });
              return (
                <Table.Summary.Row style={SUMMARY_STYLE}>
                  <Table.Summary.Cell><Text style={SUMMARY_BOLD}>Toplam</Text></Table.Summary.Cell>
                  <Table.Summary.Cell />
                  <Table.Summary.Cell align="right"><Text style={SUMMARY_BOLD}>{fmt(t.grossStoreSales)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell align="right"><Text style={SUMMARY_TEXT}>{fmt(t.invoiceTotal)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell align="right"><Text style={SUMMARY_TEXT}>{fmt(t.commissionAmount)}</Text></Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </Card>
      )}

      {/* ── POS Tedarikçi Kırılımı ── */}
      {(data?.posSupplierBreakdown?.length > 0) && (
        <Card title="Şarköy POS — Tedarikçi Kırılımı" bordered={false} className="erp-list-table-card erp-card-logo-divider">
          <Table
            rowKey={(r) => r.supplierId || r.supplierName}
            dataSource={data.posSupplierBreakdown}
            columns={supplierCols}
            pagination={false}
            size="small"
            loading={loading}
            summary={(rows) => {
              const t = rows.reduce((acc, r) => ({
                totalAmount:  acc.totalAmount  + r.totalAmount,
                sibellaPay:   acc.sibellaPay   + (r.isSibella ? r.totalAmount : r.sibellaCommission),
                tedarikciPay: acc.tedarikciPay + (r.isSibella ? 0 : r.totalAmount - r.sibellaCommission),
              }), { totalAmount: 0, sibellaPay: 0, tedarikciPay: 0 });
              return (
                <Table.Summary.Row style={SUMMARY_STYLE}>
                  <Table.Summary.Cell><Text style={SUMMARY_BOLD}>Toplam</Text></Table.Summary.Cell>
                  <Table.Summary.Cell />
                  <Table.Summary.Cell align="right"><Text style={SUMMARY_BOLD}>{fmt(t.totalAmount)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell align="right"><Text style={SUMMARY_TEXT}>{fmt(t.sibellaPay)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell align="right"><Text style={SUMMARY_TEXT}>{fmt(t.tedarikciPay)}</Text></Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </Card>
      )}

      {/* ── Kategori Kırılımı ── */}
      {(data?.categoryBreakdown?.length > 0) && (
        <Card title="Kategori Kırılımı — Sibella Ürünleri (POS)" bordered={false} className="erp-list-table-card erp-card-logo-divider">
          <Table
            rowKey="category"
            dataSource={data.categoryBreakdown}
            columns={catCols}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            size="small"
            loading={loading}
            summary={(rows) => {
              const t = rows.reduce((acc, r) => ({
                totalQuantity: acc.totalQuantity + r.totalQuantity,
                totalAmount:   acc.totalAmount   + r.totalAmount,
              }), { totalQuantity: 0, totalAmount: 0 });
              return (
                <Table.Summary.Row style={SUMMARY_STYLE}>
                  <Table.Summary.Cell><Text style={SUMMARY_BOLD}>Toplam</Text></Table.Summary.Cell>
                  <Table.Summary.Cell align="center"><Text style={SUMMARY_TEXT}>{t.totalQuantity}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell align="right"><Text style={SUMMARY_BOLD}>{fmt(t.totalAmount)}</Text></Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </Card>
      )}
    </Space>
  );
}
