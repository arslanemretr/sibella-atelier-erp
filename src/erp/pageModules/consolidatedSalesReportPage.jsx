import React from "react";
import {
  Button, Card, Col, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography,
} from "antd";
import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  Legend, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import { requestJson } from "../apiClient";

const { Title, Text } = Typography;

const PALETTE = {
  pos:        "#1677ff",
  storeGross: "#52c41a",
  commission: "#fa8c16",
  service:    "#13c2c2",
};

// ── helpers ──────────────────────────────────────────────────────────────────
function fmt(v) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", minimumFractionDigits: 0,
  }).format(Number(v || 0));
}

function pct(v) {
  return `%${Number(v || 0).toFixed(1)}`;
}

function periodLabel(k) {
  if (!k) return "-";
  const [y, m] = k.split("-");
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long", year: "numeric",
  }).format(new Date(Number(y), Number(m) - 1, 1));
}

// ── period option builders ────────────────────────────────────────────────────
const YEAR_OPTIONS = (() => {
  const opts = [];
  for (let y = 2021; y <= new Date().getFullYear() + 1; y++) opts.push({ value: y, label: String(y) });
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

// ── component ─────────────────────────────────────────────────────────────────
export default function ConsolidatedSalesReportPage() {
  const [data,    setData]    = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [{ fromMonth, fromYear, toMonth, toYear }, setPeriod] = React.useState(defaultPeriods);

  const periodFrom = `${fromYear}-${fromMonth}`;
  const periodTo   = `${toYear}-${toMonth}`;

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

  React.useEffect(() => {
    void fetchData(periodFrom, periodTo);
  }, [fetchData, periodFrom, periodTo]);

  // ── monthly chart data: merge POS + store by period ──────────────────────
  const monthlyChart = React.useMemo(() => {
    if (!data) return [];
    const map = {};
    (data.posMonthly || []).forEach((r) => {
      if (!map[r.periodKey]) map[r.periodKey] = { key: r.periodKey, period: periodLabel(r.periodKey), posAmount: 0, storeGross: 0, storeService: 0, commission: 0 };
      map[r.periodKey].posAmount = r.totalAmount;
    });
    (data.storeMonthly || []).forEach((r) => {
      if (!map[r.periodKey]) map[r.periodKey] = { key: r.periodKey, period: periodLabel(r.periodKey), posAmount: 0, storeGross: 0, storeService: 0, commission: 0 };
      map[r.periodKey].storeGross   += r.totalAmount;
      map[r.periodKey].storeService += r.serviceAmount;
      map[r.periodKey].commission   += r.commissionAmount;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [data]);

  // ── export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    // Özet
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ["Gösterge", "Tutar"],
      ["Şarköy POS Satış", data.summary.posTotal],
      ["Mağaza Fatura (Brüt)", data.summary.storeGrossTotal],
      ["Mağaza Net (Sibella Payı)", data.summary.storeServiceTotal],
      ["Komisyon (Mağaza Payı)", data.summary.commissionTotal],
      ["Konsolide Brüt Ciro", data.summary.consolidatedTotal],
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Özet");

    // Aylık
    const monthlyHeader = ["Dönem", "POS Satış", "Mağaza Brüt", "Mağaza Net", "Komisyon", "Toplam Brüt"];
    const monthlyRows = monthlyChart.map((r) => [
      r.period, r.posAmount, r.storeGross, r.storeService, r.commission, r.posAmount + r.storeGross,
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([monthlyHeader, ...monthlyRows]), "Aylık");

    // Mağaza bazlı
    const storeHeader = ["Mağaza", "Fatura Sayısı", "Brüt Tutar", "Net Tutar", "Komisyon Tutar", "Komisyon %"];
    const storeRows = (data.storeBreakdown || []).map((r) => [
      r.storeName, r.invoiceCount, r.totalAmount, r.serviceAmount, r.commissionAmount, r.commissionRate,
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([storeHeader, ...storeRows]), "Mağaza");

    // Kategori
    const catHeader = ["Kategori 1", "Kategori 2", "Kategori 3", "Adet", "Satış Tutarı"];
    const catRows = (data.categoryBreakdown || []).map((r) => [
      r.level1, r.level2, r.level3, r.totalQuantity, r.totalAmount,
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([catHeader, ...catRows]), "Kategori (POS)");

    XLSX.writeFile(wb, `konsolide-satis-${periodFrom}-${periodTo}.xlsx`);
  };

  const summary = data?.summary || {};

  // ── store table columns ──────────────────────────────────────────────────
  const storeCols = [
    {
      title: "Mağaza",
      dataIndex: "storeName",
      key: "storeName",
      sorter: (a, b) => a.storeName.localeCompare(b.storeName, "tr"),
    },
    {
      title: "Fatura",
      dataIndex: "invoiceCount",
      key: "invoiceCount",
      width: 80,
      align: "center",
      sorter: (a, b) => a.invoiceCount - b.invoiceCount,
    },
    {
      title: "Komisyon %",
      dataIndex: "commissionRate",
      key: "commissionRate",
      width: 110,
      align: "center",
      sorter: (a, b) => a.commissionRate - b.commissionRate,
      render: (v) => <Tag color="orange">%{v}</Tag>,
    },
    {
      title: "Brüt Tutar",
      dataIndex: "totalAmount",
      key: "totalAmount",
      align: "right",
      sorter: (a, b) => a.totalAmount - b.totalAmount,
      render: fmt,
    },
    {
      title: "Sibella Net",
      dataIndex: "serviceAmount",
      key: "serviceAmount",
      align: "right",
      sorter: (a, b) => a.serviceAmount - b.serviceAmount,
      render: (v) => <Text strong style={{ color: "#13c2c2" }}>{fmt(v)}</Text>,
    },
    {
      title: "Komisyon",
      dataIndex: "commissionAmount",
      key: "commissionAmount",
      align: "right",
      sorter: (a, b) => a.commissionAmount - b.commissionAmount,
      render: (v) => <Text style={{ color: "#fa8c16" }}>{fmt(v)}</Text>,
    },
  ];

  // ── category table columns ───────────────────────────────────────────────
  const catCols = [
    {
      title: "Kategori 1",
      dataIndex: "level1",
      key: "level1",
      sorter: (a, b) => String(a.level1 || "").localeCompare(String(b.level1 || ""), "tr"),
    },
    {
      title: "Kategori 2",
      dataIndex: "level2",
      key: "level2",
      sorter: (a, b) => String(a.level2 || "").localeCompare(String(b.level2 || ""), "tr"),
      render: (v) => v || <Text type="secondary">-</Text>,
    },
    {
      title: "Kategori 3",
      dataIndex: "level3",
      key: "level3",
      sorter: (a, b) => String(a.level3 || "").localeCompare(String(b.level3 || ""), "tr"),
      render: (v) => v || <Text type="secondary">-</Text>,
    },
    {
      title: "Adet",
      dataIndex: "totalQuantity",
      key: "totalQuantity",
      width: 80,
      align: "center",
      sorter: (a, b) => a.totalQuantity - b.totalQuantity,
    },
    {
      title: "POS Satış",
      dataIndex: "totalAmount",
      key: "totalAmount",
      align: "right",
      sorter: (a, b) => a.totalAmount - b.totalAmount,
      render: fmt,
    },
  ];

  // ── period selector helpers ───────────────────────────────────────────────
  const PeriodSelector = ({ label, monthVal, yearVal, onMonthChange, onYearChange }) => (
    <Space.Compact>
      <Select
        value={monthVal}
        onChange={onMonthChange}
        options={MONTH_OPTIONS}
        style={{ width: 110 }}
        placeholder="Ay"
      />
      <Select
        value={yearVal}
        onChange={onYearChange}
        options={YEAR_OPTIONS}
        style={{ width: 90 }}
        placeholder="Yıl"
      />
    </Space.Compact>
  );

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      {/* Başlık */}
      <div className="erp-page-intro">
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>Konsolide Satış Raporu</Title>
          <Text type="secondary">
            Şarköy POS + Konsinye Mağaza faturaları birleşik ciro görünümü
          </Text>
        </div>
        <Space wrap className="erp-page-intro-actions">
          <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!data}>
            Excel'e Aktar
          </Button>
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void fetchData(periodFrom, periodTo)}
          >
            Yenile
          </Button>
        </Space>
      </div>

      {/* Filtreler */}
      <Card size="small">
        <Space wrap align="center">
          <Text strong>Dönem Başı:</Text>
          <PeriodSelector
            monthVal={fromMonth}
            yearVal={fromYear}
            onMonthChange={(v) => setPeriod((p) => ({ ...p, fromMonth: v }))}
            onYearChange={(v)  => setPeriod((p) => ({ ...p, fromYear: v }))}
          />
          <Text strong style={{ marginLeft: 8 }}>Dönem Sonu:</Text>
          <PeriodSelector
            monthVal={toMonth}
            yearVal={toYear}
            onMonthChange={(v) => setPeriod((p) => ({ ...p, toMonth: v }))}
            onYearChange={(v)  => setPeriod((p) => ({ ...p, toYear: v }))}
          />
        </Space>
      </Card>

      {/* Özet kartlar */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Şarköy POS Satış"
              value={summary.posTotal || 0}
              formatter={(v) => fmt(v)}
              valueStyle={{ color: PALETTE.pos }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>Şarköy mağaza POS satışları</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Mağaza Fatura Brüt"
              value={summary.storeGrossTotal || 0}
              formatter={(v) => fmt(v)}
              valueStyle={{ color: PALETTE.storeGross }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Konsinye mağazalarda gerçekleşen satış
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Tooltip title="Mağaza Fatura Brüt − Komisyon">
              <Statistic
                title="Sibella Net (Hizmet Payı)"
                value={summary.storeServiceTotal || 0}
                formatter={(v) => fmt(v)}
                valueStyle={{ color: PALETTE.service }}
              />
            </Tooltip>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {summary.storeGrossTotal
                ? `Komisyon ort. ${pct(((summary.commissionTotal || 0) / summary.storeGrossTotal) * 100)}`
                : ""}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderColor: "#1677ff" }}>
            <Statistic
              title="Konsolide Brüt Ciro"
              value={summary.consolidatedTotal || 0}
              formatter={(v) => fmt(v)}
              valueStyle={{ color: "#1677ff", fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              POS + Mağaza Brüt Toplam
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Aylık trend grafiği */}
      {monthlyChart.length > 0 && (
        <Card title="Aylık Ciro Dağılımı">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthlyChart} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `₺${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
              <RTooltip formatter={(v, name) => [fmt(v), name]} />
              <Legend />
              <Bar dataKey="posAmount"   name="Şarköy POS"     stackId="a" fill={PALETTE.pos}        />
              <Bar dataKey="storeService" name="Mağaza Net"     stackId="a" fill={PALETTE.service}    />
              <Bar dataKey="commission"   name="Mağaza Komisyon" stackId="a" fill={PALETTE.commission} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Mağaza bazlı */}
      {(data?.storeBreakdown?.length > 0) && (
        <Card title="Mağaza Bazlı Fatura Özeti">
          <Table
            rowKey="storeId"
            dataSource={data.storeBreakdown}
            columns={storeCols}
            pagination={false}
            size="small"
            loading={loading}
            summary={(rows) => {
              const totals = rows.reduce(
                (acc, r) => ({
                  invoiceCount:    acc.invoiceCount + r.invoiceCount,
                  totalAmount:     acc.totalAmount + r.totalAmount,
                  serviceAmount:   acc.serviceAmount + r.serviceAmount,
                  commissionAmount: acc.commissionAmount + r.commissionAmount,
                }),
                { invoiceCount: 0, totalAmount: 0, serviceAmount: 0, commissionAmount: 0 },
              );
              return (
                <Table.Summary.Row style={{ fontWeight: 600, background: "#fafafa" }}>
                  <Table.Summary.Cell>Toplam</Table.Summary.Cell>
                  <Table.Summary.Cell align="center">{totals.invoiceCount}</Table.Summary.Cell>
                  <Table.Summary.Cell />
                  <Table.Summary.Cell align="right">{fmt(totals.totalAmount)}</Table.Summary.Cell>
                  <Table.Summary.Cell align="right">
                    <Text strong style={{ color: "#13c2c2" }}>{fmt(totals.serviceAmount)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell align="right">
                    <Text style={{ color: "#fa8c16" }}>{fmt(totals.commissionAmount)}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </Card>
      )}

      {/* Kategori kırılımı (POS) */}
      {(data?.categoryBreakdown?.length > 0) && (
        <Card title="Kategori Kırılımı — Şarköy POS Satışları">
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
