import React from "react";
import {
  Button, Card, Col, Row, Select, Space, Statistic, Table, Tag, Typography,
} from "antd";
import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Bar, CartesianGrid, ComposedChart,
  Legend, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import { requestJson } from "../apiClient";

const { Title, Text } = Typography;

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

// Özet kart alt satırı
function CardRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, lineHeight: 1.8 }}>
      <Text type="secondary">{label}</Text>
      <Text style={color ? { color } : undefined}>{fmt(value)}</Text>
    </div>
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

  // ── Aylık chart ────────────────────────────────────────────────────────────
  const monthlyChart = React.useMemo(() => {
    if (!data) return [];
    const map = {};
    (data.posMonthly || []).forEach((r) => {
      map[r.periodKey] = { key: r.periodKey, label: periodLabel(r.periodKey), posTotal: r.posTotal, storeGross: 0 };
    });
    (data.storeMonthly || []).forEach((r) => {
      if (!map[r.periodKey]) map[r.periodKey] = { key: r.periodKey, label: periodLabel(r.periodKey), posTotal: 0, storeGross: 0 };
      map[r.periodKey].storeGross = r.grossStoreSales;
    });
    return Object.values(map)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => ({ ...r, totalCiro: r.posTotal + r.storeGross }));
  }, [data]);

  // ── Excel ──────────────────────────────────────────────────────────────────
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
      ...monthlyChart.map((r) => [r.label, r.posTotal, r.storeGross, r.totalCiro]),
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

  // ── Mağaza tablosu ─────────────────────────────────────────────────────────
  const storeCols = [
    { title: "Mağaza",          dataIndex: "storeName",        key: "storeName",
      sorter: (a, b) => a.storeName.localeCompare(b.storeName, "tr") },
    { title: "Kom.%", width: 80, dataIndex: "commissionRate",  key: "commissionRate", align: "center",
      sorter: (a, b) => a.commissionRate - b.commissionRate,
      render: (v) => <Tag color="default">%{v}</Tag> },
    { title: "Brüt Satış",      dataIndex: "grossStoreSales",  key: "grossStoreSales", align: "right",
      sorter: (a, b) => a.grossStoreSales - b.grossStoreSales,
      render: (v) => <Text strong>{fmt(v)}</Text> },
    { title: "Sibella Hakediş", dataIndex: "invoiceTotal",     key: "invoiceTotal", align: "right",
      sorter: (a, b) => a.invoiceTotal - b.invoiceTotal, render: fmt },
    { title: "Mağaza Komisyon", dataIndex: "commissionAmount", key: "commissionAmount", align: "right",
      sorter: (a, b) => a.commissionAmount - b.commissionAmount, render: fmt },
  ];

  // ── POS tedarikçi tablosu — aynı kolon sırası ─────────────────────────────
  // Sibella Atelier için sibella payı = brüt satış (tamamı Sibella'ya ait)
  const supplierCols = [
    { title: "Tedarikçi",      key: "supplierName",    dataIndex: "supplierName",
      sorter: (a, b) => String(a.supplierName).localeCompare(String(b.supplierName), "tr") },
    { title: "Kom.%", width: 80, key: "commissionRate", align: "center",
      sorter: (a, b) => (a.isSibella ? 100 : a.commissionRate) - (b.isSibella ? 100 : b.commissionRate),
      render: (_, r) => r.isSibella
        ? <Tag color="blue">%100</Tag>
        : <Tag color="default">%{r.commissionRate}</Tag> },
    { title: "Brüt Satış",    dataIndex: "totalAmount",       key: "totalAmount", align: "right",
      sorter: (a, b) => a.totalAmount - b.totalAmount,
      render: (v) => <Text strong>{fmt(v)}</Text> },
    { title: "Sibella Payı",  key: "sibellaPay", align: "right",
      sorter: (a, b) => {
        const aV = a.isSibella ? a.totalAmount : a.sibellaCommission;
        const bV = b.isSibella ? b.totalAmount : b.sibellaCommission;
        return aV - bV;
      },
      render: (_, r) => fmt(r.isSibella ? r.totalAmount : r.sibellaCommission) },
    { title: "Tedarikçi Payı", key: "tedarikciPay", align: "right",
      sorter: (a, b) => {
        const aV = a.isSibella ? 0 : a.totalAmount - a.sibellaCommission;
        const bV = b.isSibella ? 0 : b.totalAmount - b.sibellaCommission;
        return aV - bV;
      },
      render: (_, r) => r.isSibella
        ? <Text type="secondary">₺0</Text>
        : fmt(r.totalAmount - r.sibellaCommission) },
  ];

  // ── Kategori tablosu ───────────────────────────────────────────────────────
  const catCols = [
    { title: "Kategori",  dataIndex: "category",      key: "category",
      sorter: (a, b) => String(a.category || "").localeCompare(String(b.category || ""), "tr") },
    { title: "Adet",      dataIndex: "totalQuantity", key: "totalQuantity", align: "center", width: 80,
      sorter: (a, b) => a.totalQuantity - b.totalQuantity },
    { title: "Tutar",     dataIndex: "totalAmount",   key: "totalAmount",   align: "right",
      sorter: (a, b) => a.totalAmount - b.totalAmount,
      render: (v) => <Text strong>{fmt(v)}</Text> },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      {/* Başlık */}
      <div className="erp-page-intro">
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>Konsolide Satış Raporu</Title>
          <Text type="secondary">Şarköy POS + Konsinye Mağaza faturaları birleşik ciro görünümü</Text>
        </div>
        <Space wrap className="erp-page-intro-actions">
          <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!data}>Excel'e Aktar</Button>
          <Button icon={<ReloadOutlined />} loading={loading}
            onClick={() => void fetchData(periodFrom, periodTo)}>Yenile</Button>
        </Space>
      </div>

      {/* Filtre */}
      <Card size="small">
        <Space wrap align="center">
          <Text strong>Dönem Başı:</Text>
          <PeriodPicker
            monthVal={period.fromMonth} yearVal={period.fromYear}
            onMonth={(v) => setPeriod((p) => ({ ...p, fromMonth: v }))}
            onYear={(v)  => setPeriod((p) => ({ ...p, fromYear: v }))}
          />
          <Text strong style={{ marginLeft: 8 }}>Dönem Sonu:</Text>
          <PeriodPicker
            monthVal={period.toMonth} yearVal={period.toYear}
            onMonth={(v) => setPeriod((p) => ({ ...p, toMonth: v }))}
            onYear={(v)  => setPeriod((p) => ({ ...p, toYear: v }))}
          />
        </Space>
      </Card>

      {/* ── Özet Kartlar ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Şarköy Toplam Satış" value={s.posTotal || 0} formatter={fmt} />
            <div style={{ marginTop: 8, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
              <CardRow label="Sibella Satış:"   value={s.sibellaPosTotal} />
              <CardRow label="Tedarikçi Satış:" value={s.tedarikciPosTotal} />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Mağazalar Toplam Satış" value={s.grossStoreTotal || 0} formatter={fmt} />
            <div style={{ marginTop: 8, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
              <CardRow label="Sibella Hakediş:" value={s.invoiceTotal} />
              <CardRow label="Mağaza Komisyon:" value={s.storeCommission} />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Toplam Ciro"
              value={s.totalCiro || 0}
              formatter={fmt}
              valueStyle={{ fontWeight: 700 }}
            />
            <div style={{ marginTop: 8, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
              <CardRow label="Şarköy Toplam:"   value={s.posTotal} />
              <CardRow label="Mağazalar Toplam:" value={s.grossStoreTotal} />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Net Sibella Ciro" value={s.netSibellaCiro || 0} formatter={fmt} />
            <div style={{ marginTop: 8, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
              <CardRow label="Şarköy Hakediş:" value={s.sarkoyHakEdis} />
              <CardRow label="Mağaza Hakediş:" value={s.invoiceTotal} />
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── Aylık Grafik ── */}
      {monthlyChart.length > 0 && (
        <Card title="Aylık Ciro Dağılımı">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthlyChart} margin={{ top: 8, right: 32, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="bar" tickFormatter={(v) => `₺${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="line" orientation="right" tickFormatter={(v) => `₺${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
              <RTooltip formatter={(v, name) => [fmt(v), name]} />
              <Legend />
              <Bar    yAxisId="bar"  dataKey="posTotal"   name="Şarköy Toplam Satış"   fill="#1677ff" radius={[3, 3, 0, 0]} />
              <Bar    yAxisId="bar"  dataKey="storeGross" name="Mağazalar Toplam Satış" fill="#52c41a" radius={[3, 3, 0, 0]} />
              <Line   yAxisId="line" dataKey="totalCiro"  name="Toplam Ciro"
                type="monotone" stroke="#722ed1" strokeWidth={2.5}
                dot={{ r: 4, fill: "#722ed1" }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Mağaza Bazlı Özet ── */}
      {(data?.storeBreakdown?.length > 0) && (
        <Card title="Mağaza Bazlı Özet">
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
                <Table.Summary.Row style={{ fontWeight: 600, background: "#fafafa" }}>
                  <Table.Summary.Cell>Toplam</Table.Summary.Cell>
                  <Table.Summary.Cell />
                  <Table.Summary.Cell align="right"><Text strong>{fmt(t.grossStoreSales)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell align="right">{fmt(t.invoiceTotal)}</Table.Summary.Cell>
                  <Table.Summary.Cell align="right">{fmt(t.commissionAmount)}</Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </Card>
      )}

      {/* ── Şarköy POS Tedarikçi Kırılımı ── */}
      {(data?.posSupplierBreakdown?.length > 0) && (
        <Card title="Şarköy POS — Tedarikçi Kırılımı">
          <Table
            rowKey={(r) => r.supplierId || r.supplierName}
            dataSource={data.posSupplierBreakdown}
            columns={supplierCols}
            pagination={false}
            size="small"
            loading={loading}
            summary={(rows) => {
              const t = rows.reduce((acc, r) => ({
                totalAmount:   acc.totalAmount   + r.totalAmount,
                sibellaPay:    acc.sibellaPay    + (r.isSibella ? r.totalAmount : r.sibellaCommission),
                tedarikciPay:  acc.tedarikciPay  + (r.isSibella ? 0 : r.totalAmount - r.sibellaCommission),
              }), { totalAmount: 0, sibellaPay: 0, tedarikciPay: 0 });
              return (
                <Table.Summary.Row style={{ fontWeight: 600, background: "#fafafa" }}>
                  <Table.Summary.Cell>Toplam</Table.Summary.Cell>
                  <Table.Summary.Cell />
                  <Table.Summary.Cell align="right"><Text strong>{fmt(t.totalAmount)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell align="right">{fmt(t.sibellaPay)}</Table.Summary.Cell>
                  <Table.Summary.Cell align="right">{fmt(t.tedarikciPay)}</Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </Card>
      )}

      {/* ── Kategori Kırılımı ── */}
      {(data?.categoryBreakdown?.length > 0) && (
        <Card title="Kategori Kırılımı — Sibella Ürünleri (POS)">
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
                <Table.Summary.Row style={{ fontWeight: 600, background: "#fafafa" }}>
                  <Table.Summary.Cell>Toplam</Table.Summary.Cell>
                  <Table.Summary.Cell align="center">{t.totalQuantity}</Table.Summary.Cell>
                  <Table.Summary.Cell align="right"><Text strong>{fmt(t.totalAmount)}</Text></Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </Card>
      )}
    </Space>
  );
}
