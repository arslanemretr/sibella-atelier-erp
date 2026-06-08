import React from "react";
import {
  Button, Card, Col, Row, Select, Space, Statistic, Table, Tag, Typography,
} from "antd";
import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Bar, BarChart, CartesianGrid, Cell,
  Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import { requestJson } from "../apiClient";

const { Title, Text } = Typography;

const C = {
  sibellaPos:    "#1677ff",
  tedarikciPos:  "#adc6ff",
  storeGross:    "#52c41a",
  storeService:  "#13c2c2",
  storeComm:     "#fa8c16",
  totalCiro:     "#722ed1",
};

function fmt(v) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", minimumFractionDigits: 0,
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
  const now  = new Date();
  const y    = now.getFullYear();
  const m    = String(now.getMonth() + 1).padStart(2, "0");
  return { fromMonth: "01", fromYear: y, toMonth: m, toYear: y };
}

// ── Küçük yardımcı: dönem seçici ─────────────────────────────────────────────
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
      map[r.periodKey] = {
        key: r.periodKey, label: periodLabel(r.periodKey),
        sibellaPos: r.sibellaAmount, tedarikciPos: r.tedarikciAmount,
        storeGross: 0, storeService: 0, storeComm: 0,
      };
    });
    (data.storeMonthly || []).forEach((r) => {
      if (!map[r.periodKey]) map[r.periodKey] = {
        key: r.periodKey, label: periodLabel(r.periodKey),
        sibellaPos: 0, tedarikciPos: 0, storeGross: 0, storeService: 0, storeComm: 0,
      };
      map[r.periodKey].storeGross   = r.grossStoreSales;
      map[r.periodKey].storeService = r.serviceAmount;
      map[r.periodKey].storeComm    = r.commissionAmount;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [data]);

  // ── POS pasta verisi ──────────────────────────────────────────────────────
  const posPieData = s.posTotal > 0 ? [
    { name: "Sibella Ürünleri",    value: s.sibellaPosTotal,   fill: C.sibellaPos },
    { name: "Tedarikçi Ürünleri",  value: s.tedarikciPosTotal, fill: C.tedarikciPos },
  ].filter((d) => d.value > 0) : [];

  const storePieData = s.grossStoreTotal > 0 ? [
    { name: "Sibella Hakediş",  value: s.serviceTotal,   fill: C.storeService },
    { name: "Mağaza Komisyonu", value: s.storeCommission, fill: C.storeComm },
  ].filter((d) => d.value > 0) : [];

  // ── Excel ─────────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Gösterge", "Tutar"],
      ["Şarköy Toplam Satış",       s.posTotal],
      ["  — Sibella Ürünleri",      s.sibellaPosTotal],
      ["  — Tedarikçi Ürünleri",    s.tedarikciPosTotal],
      ["Mağazalar Toplam Satış",    s.grossStoreTotal],
      ["  — Sibella Hakediş",       s.serviceTotal],
      ["  — Mağaza Komisyonu",      s.storeCommission],
      ["Toplam Ciro",               s.totalCiro],
      ["Net Sibella Ciro",          s.netSibellaCiro],
    ]), "Özet");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Dönem", "Şarköy Sibella", "Şarköy Tedarikçi", "Mağaza Brüt", "Mağaza Hakediş", "Mağaza Komisyon"],
      ...monthlyChart.map((r) => [r.label, r.sibellaPos, r.tedarikciPos, r.storeGross, r.storeService, r.storeComm]),
    ]), "Aylık");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Mağaza", "Komisyon %", "Fatura Toplam", "Brüt Satış", "Sibella Hakediş", "Mağaza Komisyon"],
      ...(data.storeBreakdown || []).map((r) => [r.storeName, r.commissionRate, r.invoiceTotal, r.grossStoreSales, r.serviceAmount, r.commissionAmount]),
    ]), "Mağaza");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Tedarikçi", "Sibella mi?", "Adet", "POS Satış"],
      ...(data.posSupplierBreakdown || []).map((r) => [r.supplierName, r.isSibella ? "Evet" : "Hayır", r.totalQuantity, r.totalAmount]),
    ]), "POS Tedarikçi");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Kat.1", "Kat.2", "Kat.3", "Adet", "Tutar"],
      ...(data.categoryBreakdown || []).map((r) => [r.level1, r.level2, r.level3, r.totalQuantity, r.totalAmount]),
    ]), "Kategori");
    XLSX.writeFile(wb, `konsolide-satis-${periodFrom}-${periodTo}.xlsx`);
  };

  // ── Tablo: mağaza ─────────────────────────────────────────────────────────
  const storeCols = [
    { title: "Mağaza",           dataIndex: "storeName",        sorter: (a, b) => a.storeName.localeCompare(b.storeName, "tr") },
    { title: "Kom.%", width: 80, dataIndex: "commissionRate",   align: "center",
      sorter: (a, b) => a.commissionRate - b.commissionRate,
      render: (v) => <Tag color="orange">%{v}</Tag> },
    { title: "Fatura Toplam",    dataIndex: "invoiceTotal",     align: "right",
      sorter: (a, b) => a.invoiceTotal - b.invoiceTotal, render: fmt },
    { title: "Brüt Satış",       dataIndex: "grossStoreSales",  align: "right",
      sorter: (a, b) => a.grossStoreSales - b.grossStoreSales,
      render: (v) => <Text strong>{fmt(v)}</Text> },
    { title: "Sibella Hakediş",  dataIndex: "serviceAmount",    align: "right",
      sorter: (a, b) => a.serviceAmount - b.serviceAmount,
      render: (v) => <Text style={{ color: C.storeService }}>{fmt(v)}</Text> },
    { title: "Mağaza Komisyon",  dataIndex: "commissionAmount", align: "right",
      sorter: (a, b) => a.commissionAmount - b.commissionAmount,
      render: (v) => <Text style={{ color: C.storeComm }}>{fmt(v)}</Text> },
  ];

  // ── Tablo: POS tedarikçi ──────────────────────────────────────────────────
  const supplierCols = [
    { title: "Tedarikçi",  dataIndex: "supplierName",
      sorter: (a, b) => String(a.supplierName).localeCompare(String(b.supplierName), "tr"),
      render: (v, r) => r.isSibella ? <Text strong style={{ color: C.sibellaPos }}>{v}</Text> : v },
    { title: "Adet",       dataIndex: "totalQuantity", align: "center", width: 80,
      sorter: (a, b) => a.totalQuantity - b.totalQuantity },
    { title: "POS Satış",  dataIndex: "totalAmount",   align: "right",
      sorter: (a, b) => a.totalAmount - b.totalAmount, render: fmt },
  ];

  // ── Tablo: kategori ───────────────────────────────────────────────────────
  const catCols = [
    { title: "Kat. 1", dataIndex: "level1", sorter: (a, b) => String(a.level1 || "").localeCompare(String(b.level1 || ""), "tr") },
    { title: "Kat. 2", dataIndex: "level2", sorter: (a, b) => String(a.level2 || "").localeCompare(String(b.level2 || ""), "tr"),
      render: (v) => v || <Text type="secondary">-</Text> },
    { title: "Kat. 3", dataIndex: "level3", sorter: (a, b) => String(a.level3 || "").localeCompare(String(b.level3 || ""), "tr"),
      render: (v) => v || <Text type="secondary">-</Text> },
    { title: "Adet", dataIndex: "totalQuantity", align: "center", width: 80,
      sorter: (a, b) => a.totalQuantity - b.totalQuantity },
    { title: "POS Satış", dataIndex: "totalAmount", align: "right",
      sorter: (a, b) => a.totalAmount - b.totalAmount, render: fmt },
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
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void fetchData(periodFrom, periodTo)}>Yenile</Button>
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

      {/* ── Ana Metrikler ── */}
      <Row gutter={[16, 16]}>
        {/* Şarköy Toplam Satış */}
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Şarköy Toplam Satış"
              value={s.posTotal || 0}
              formatter={fmt}
              valueStyle={{ color: C.sibellaPos }}
            />
            <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6 }}>
              <Text type="secondary">Sibella: </Text>
              <Text strong style={{ color: C.sibellaPos }}>{fmt(s.sibellaPosTotal)}</Text>
              <br />
              <Text type="secondary">Tedarikçi: </Text>
              <Text>{fmt(s.tedarikciPosTotal)}</Text>
            </div>
          </Card>
        </Col>

        {/* Mağazalar Toplam Satış */}
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Mağazalar Toplam Satış"
              value={s.grossStoreTotal || 0}
              formatter={fmt}
              valueStyle={{ color: C.storeGross }}
            />
            <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6 }}>
              <Text type="secondary">Sibella Hakediş: </Text>
              <Text strong style={{ color: C.storeService }}>{fmt(s.serviceTotal)}</Text>
              <br />
              <Text type="secondary">Mağaza Komisyon: </Text>
              <Text style={{ color: C.storeComm }}>{fmt(s.storeCommission)}</Text>
            </div>
          </Card>
        </Col>

        {/* Toplam Ciro */}
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderColor: C.totalCiro }}>
            <Statistic
              title="Toplam Ciro"
              value={s.totalCiro || 0}
              formatter={fmt}
              valueStyle={{ color: C.totalCiro, fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Şarköy + Mağazalar Toplam
            </Text>
          </Card>
        </Col>

        {/* Net Sibella Ciro */}
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Net Sibella Ciro"
              value={s.netSibellaCiro || 0}
              formatter={fmt}
              valueStyle={{ color: "#13c2c2" }}
            />
            <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6 }}>
              <Text type="secondary">Sibella POS: </Text>
              <Text>{fmt(s.sibellaPosTotal)}</Text>
              <br />
              <Text type="secondary">Mağaza Hakediş: </Text>
              <Text>{fmt(s.serviceTotal)}</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── Aylık Grafik ── */}
      {monthlyChart.length > 0 && (
        <Card title="Aylık Ciro Dağılımı">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyChart} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `₺${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
              <RTooltip formatter={(v, name) => [fmt(v), name]} />
              <Legend />
              <Bar dataKey="sibellaPos"   name="Şarköy — Sibella"    stackId="a" fill={C.sibellaPos} />
              <Bar dataKey="tedarikciPos" name="Şarköy — Tedarikçi"  stackId="a" fill={C.tedarikciPos} />
              <Bar dataKey="storeService" name="Mağaza Hakediş"       stackId="a" fill={C.storeService} />
              <Bar dataKey="storeComm"    name="Mağaza Komisyon"      stackId="a" fill={C.storeComm} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Pasta Grafikler ── */}
      {(posPieData.length > 0 || storePieData.length > 0) && (
        <Row gutter={[16, 16]}>
          {posPieData.length > 0 && (
            <Col xs={24} md={12}>
              <Card title="Şarköy POS — Ürün Dağılımı">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={posPieData} dataKey="value" nameKey="name"
                         cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`}>
                      {posPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <RTooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          )}
          {storePieData.length > 0 && (
            <Col xs={24} md={12}>
              <Card title="Mağaza Satışları — Gelir Dağılımı">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={storePieData} dataKey="value" nameKey="name"
                         cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`}>
                      {storePieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <RTooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          )}
        </Row>
      )}

      {/* ── Mağaza Tablosu ── */}
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
                invoiceTotal:    acc.invoiceTotal + r.invoiceTotal,
                grossStoreSales: acc.grossStoreSales + r.grossStoreSales,
                serviceAmount:   acc.serviceAmount + r.serviceAmount,
                commissionAmount: acc.commissionAmount + r.commissionAmount,
              }), { invoiceTotal: 0, grossStoreSales: 0, serviceAmount: 0, commissionAmount: 0 });
              return (
                <Table.Summary.Row style={{ fontWeight: 600, background: "#fafafa" }}>
                  <Table.Summary.Cell>Toplam</Table.Summary.Cell>
                  <Table.Summary.Cell />
                  <Table.Summary.Cell align="right">{fmt(t.invoiceTotal)}</Table.Summary.Cell>
                  <Table.Summary.Cell align="right"><Text strong>{fmt(t.grossStoreSales)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell align="right"><Text style={{ color: C.storeService }}>{fmt(t.serviceAmount)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell align="right"><Text style={{ color: C.storeComm }}>{fmt(t.commissionAmount)}</Text></Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </Card>
      )}

      {/* ── POS Tedarikçi Kırılımı ── */}
      {(data?.posSupplierBreakdown?.length > 0) && (
        <Card title="Şarköy POS — Tedarikçi Kırılımı">
          <Table
            rowKey={(r) => r.supplierId || r.supplierName}
            dataSource={data.posSupplierBreakdown}
            columns={supplierCols}
            pagination={false}
            size="small"
            loading={loading}
          />
        </Card>
      )}

      {/* ── Kategori Kırılımı ── */}
      {(data?.categoryBreakdown?.length > 0) && (
        <Card title="Kategori Kırılımı — Sibella Ürünleri (POS)">
          <Table
            rowKey={(r) => `${r.level1}|${r.level2}|${r.level3}`}
            dataSource={data.categoryBreakdown}
            columns={catCols}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            size="small"
            loading={loading}
          />
        </Card>
      )}
    </Space>
  );
}
