import React from "react";
import dayjs from "dayjs";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AutoComplete, Button, Card, Col, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Row, Segmented, Select, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import { AppstoreOutlined, BarsOutlined, CheckOutlined, DeleteOutlined, DownloadOutlined, DownOutlined, EditOutlined, EyeOutlined, FilterOutlined, InboxOutlined, PlusCircleOutlined, PlusOutlined, ReloadOutlined, RightOutlined, SearchOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import { getAuthUser } from "../../auth";
import { listContractsFresh } from "../contractsData";
import { completeDeliveryReceipt, createDeliveryPdf, deleteDeliveryList, getDeliveryListById, getNextDeliveryNoPreviewFresh, listDeliveryListsBySupplierFresh, listDeliveryListsFresh, updateDeliveryList } from "../deliveryListsData";
import { listEarningsRecordsFresh } from "../earningsData";
import { requestJson } from "../apiClient";
import { listMasterDataFresh } from "../masterData";
import { listPosSalesFresh, listPosReturnsFresh } from "../posData";
import { listProductsFresh, listProductsRawFresh } from "../productsData";
import { listSuppliersFresh } from "../suppliersData";

const { Title, Text } = Typography;

function downloadWorkbook(rows, sheetName, fileName) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

function openDetailFromRow(setSelected, setOpen, record) {
  setSelected(record);
  setOpen(true);
}

function showCenteredWarning(content) {
  Modal.warning({
    centered: true,
    title: "Uyarı",
    content,
    okText: "Tamam",
    className: "erp-warning-modal",
  });
}

function formatDisplayDate(value) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function formatDisplayMoney(value, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function toPeriodDate(value) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value, amount) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function getDefaultEarningsPeriod() {
  return addMonths(new Date(), -1);
}

function getMonthKey(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function getDateFromMonthKey(value) {
  const [year, month] = String(value || "").split("-").map((item) => Number(item || 0));
  return new Date(year, Math.max(month - 1, 0), 1);
}

function parseDateValue(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatPeriodLabel(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatPeriodBadge(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatDateDisplayShort(value) {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return "-";
  }
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function isCurrentPeriod(value) {
  const now = new Date();
  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
}

function getPeriodBounds(value) {
  const start = new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getPeriodContract(contracts, supplierId, periodDate) {
  const { start, end } = getPeriodBounds(periodDate);
  const relevantContracts = (contracts || [])
    .filter((item) => item.supplierId === supplierId)
    .slice()
    .sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || ""), "tr"));

  return (
    relevantContracts.find((item) => {
      const contractStart = item.startDate ? parseDateValue(item.startDate) : null;
      const contractEnd = item.endDate ? parseDateValue(item.endDate) : null;
      const startsBeforePeriod = !contractStart || contractStart <= end;
      const endsAfterPeriod = !contractEnd || contractEnd >= start;
      return startsBeforePeriod && endsAfterPeriod;
    }) ||
    relevantContracts[0] ||
    null
  );
}

const earningsStatusMetaMap = {
  "Dönem Tamamlanmadı": {
    color: "default",
    cardBg: "#f5f5f5",
    cardBorder: "#d9d9d9",
    icon: "🕐",
    bandBg: "#f5f5f5",
  },
  "Fatura Bekleniyor": {
    color: "gold",
    cardBg: "#fff7e6",
    cardBorder: "#ffd591",
    icon: "ℹ️",
    bandBg: "#fff7e6",
  },
  "Ödeme Bekleniyor": {
    color: "orange",
    cardBg: "#fff2e8",
    cardBorder: "#ffbb96",
    icon: "⏳",
    bandBg: "#fff2e8",
  },
  Tamamlandı: {
    color: "green",
    cardBg: "#f6ffed",
    cardBorder: "#b7eb8f",
    icon: "✅",
    bandBg: "#f6ffed",
  },
  "Satış Yok": {
    color: "default",
    cardBg: "#fafafa",
    cardBorder: "#d9d9d9",
    icon: "ℹ️",
    bandBg: "#fafafa",
  },
};

function resolveEarningsStatus(periodDate, earningsTotal, earningsRecord) {
  if (isCurrentPeriod(periodDate)) {
    return "Dönem Tamamlanmadı";
  }
  if (!Number(earningsTotal || 0)) {
    return "Satış Yok";
  }
  if (!earningsRecord?.invoiceNo) {
    return "Fatura Bekleniyor";
  }
  if (!earningsRecord?.paymentDate) {
    return "Ödeme Bekleniyor";
  }
  return "Tamamlandı";
}

function buildEarningsSummary({ periodDate, products = [], sales = [], returns = [], contracts = [], supplierId, earningsRecord = null }) {
  const relevantProducts = (products || []).filter((item) => item.supplierId === supplierId && item.productType === "konsinye");
  const productMap = new Map(relevantProducts.map((item) => [item.id, item]));
  const contract = getPeriodContract(contracts, supplierId, periodDate);
  const commissionRate = Number(contract?.commissionRate || 0);
  const { start, end } = getPeriodBounds(periodDate);
  const groupedRows = new Map();

  (sales || []).forEach((sale) => {
    const soldAt = parseDateValue(sale.soldAt);
    if (!soldAt || soldAt < start || soldAt > end) {
      return;
    }

    (sale.lines || []).forEach((line) => {
      const product = productMap.get(line.productId);
      if (!product) {
        return;
      }

      const grossAmount = Number(line.lineTotal || (Number(line.quantity || 0) * Number(line.unitPrice || 0)));
      const existingRow = groupedRows.get(line.productId) || {
        key: line.productId,
        productCode: line.productCode || product.code || "-",
        productName: line.productName || product.name || "-",
        salesQuantity: 0,
        returnQuantity: 0,
        unitPrice: Number(line.unitPrice || 0),
        grossAmount: 0,
      };

      existingRow.salesQuantity += Number(line.quantity || 0);
      existingRow.unitPrice = Number(line.unitPrice || existingRow.unitPrice || 0);
      existingRow.grossAmount += grossAmount;
      groupedRows.set(line.productId, existingRow);
    });
  });

  // İade adedini ürün bazında dönem içindeki iadelere göre hesapla
  (returns || []).forEach((ret) => {
    const retDate = parseDateValue(ret.returnDate);
    if (!retDate || retDate < start || retDate > end) return;
    (ret.lines || []).forEach((line) => {
      const existing = groupedRows.get(line.productId);
      if (!existing) return;
      existing.returnQuantity += Number(line.quantity || 0);
    });
  });

  const detailRows = Array.from(groupedRows.values())
    .map((row) => {
      const netQuantity = Math.max(0, row.salesQuantity - row.returnQuantity);
      const salesAmount = netQuantity * row.unitPrice;
      const commissionAmount = salesAmount * (commissionRate / 100);
      const netAmount = salesAmount - commissionAmount;
      return {
        ...row,
        netQuantity,
        salesAmount,
        commissionRate,
        commissionAmount,
        netAmount,
      };
    })
    .sort((a, b) => String(a.productCode || "").localeCompare(String(b.productCode || ""), "tr"));

  const grossTotal = detailRows.reduce((sum, item) => sum + item.grossAmount, 0);
  const returnTotal = detailRows.reduce((sum, item) => sum + item.returnQuantity * item.unitPrice, 0);
  const netSalesTotal = detailRows.reduce((sum, item) => sum + item.salesAmount, 0);
  const commissionTotal = detailRows.reduce((sum, item) => sum + item.commissionAmount, 0);
  const earningsTotal = detailRows.reduce((sum, item) => sum + item.netAmount, 0);
  const status = resolveEarningsStatus(periodDate, earningsTotal, earningsRecord);

  return {
    periodKey: getMonthKey(periodDate),
    periodDate,
    periodLabel: formatPeriodLabel(periodDate),
    contract,
    commissionRate,
    detailRows,
    grossTotal,
    returnTotal,
    netSalesTotal,
    commissionTotal,
    earningsTotal,
    invoiceNo: earningsRecord?.invoiceNo || null,
    invoiceDate: earningsRecord?.invoiceDate || null,
    paymentDueDate: earningsRecord?.paymentDueDate || null,
    paymentDate: earningsRecord?.paymentDate || null,
    status,
  };
}

export function SupplierPortalEarningsPage() {
  const authUser = getAuthUser();
  const [periodDate, setPeriodDate] = React.useState(() => toPeriodDate(getDefaultEarningsPeriod()));
  const [pageLoading, setPageLoading] = React.useState(false);
  const [resolvedSupplierId, setResolvedSupplierId] = React.useState(authUser?.supplierId || null);
  const [products, setProducts] = React.useState([]);
  const [sales, setSales] = React.useState([]);
  const [returns, setReturns] = React.useState([]);
  const [contracts, setContracts] = React.useState([]);
  const [earningsRecords, setEarningsRecords] = React.useState([]);

  React.useEffect(() => {
    let cancelled = false;
    const loadEarnings = async () => {
      try {
        setPageLoading(true);
        const [suppliers, nextProducts, nextSales, nextReturns, nextContracts, nextRecords] = await Promise.all([
          listSuppliersFresh(),
          listProductsFresh({ slim: true }),
          listPosSalesFresh(),
          listPosReturnsFresh(),
          listContractsFresh(),
          listEarningsRecordsFresh(),
        ]);

        if (cancelled) {
          return;
        }

        const normalizedAuthEmail = String(authUser?.email || "").trim().toLowerCase();
        const normalizedAuthName = String(authUser?.fullName || "").trim().toLowerCase();
        const resolvedSupplier =
          suppliers.find((item) => item.id === authUser?.supplierId) ||
          suppliers.find((item) => normalizedAuthEmail && String(item.email || "").trim().toLowerCase() === normalizedAuthEmail) ||
          suppliers.find((item) => normalizedAuthName && String(item.contact || "").trim().toLowerCase() === normalizedAuthName) ||
          null;
        const supplierId = resolvedSupplier?.id || authUser?.supplierId || null;

        setResolvedSupplierId(supplierId);
        setProducts(supplierId ? nextProducts.filter((item) => item.supplierId === supplierId) : []);
        setSales(nextSales || []);
        setReturns(nextReturns || []);
        setContracts(nextContracts || []);
        setEarningsRecords(nextRecords || []);
      } catch (error) {
        if (!cancelled) {
          setResolvedSupplierId(null);
          setProducts([]);
          setSales([]);
          setReturns([]);
          setContracts([]);
          setEarningsRecords([]);
          message.error(error?.message || "Hakediş verileri yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadEarnings();
    return () => {
      cancelled = true;
    };
  }, [authUser?.email, authUser?.fullName, authUser?.supplierId]);

  const earningsRecordMap = React.useMemo(
    () => new Map((earningsRecords || []).filter((r) => r.supplierId === resolvedSupplierId).map((r) => [r.periodKey, r])),
    [earningsRecords, resolvedSupplierId],
  );

  const currentSummary = React.useMemo(
    () => buildEarningsSummary({
      periodDate,
      products,
      sales,
      returns,
      contracts,
      supplierId: resolvedSupplierId,
      earningsRecord: earningsRecordMap.get(getMonthKey(periodDate)) || null,
    }),
    [contracts, earningsRecordMap, periodDate, products, resolvedSupplierId, returns, sales],
  );

  const historySummaries = React.useMemo(() => {
    const keys = new Set([getMonthKey(periodDate)]);
    const relevantProductIds = new Set(products.filter((item) => item.productType === "konsinye").map((item) => item.id));

    (sales || []).forEach((sale) => {
      const soldAt = parseDateValue(sale.soldAt);
      if (!soldAt) {
        return;
      }
      const hasSupplierConsignmentLine = (sale.lines || []).some((line) => relevantProductIds.has(line.productId));
      if (hasSupplierConsignmentLine) {
        keys.add(getMonthKey(new Date(soldAt.getFullYear(), soldAt.getMonth(), 1)));
      }
    });

    return Array.from(keys)
      .map((key) => getDateFromMonthKey(key))
      .sort((a, b) => b.getTime() - a.getTime())
      .map((item) => buildEarningsSummary({
        periodDate: item,
        products,
        sales,
        returns,
        contracts,
        supplierId: resolvedSupplierId,
        earningsRecord: earningsRecordMap.get(getMonthKey(item)) || null,
      }));
  }, [contracts, earningsRecordMap, periodDate, products, resolvedSupplierId, returns, sales]);

  const statusMeta = earningsStatusMetaMap[currentSummary.status] || earningsStatusMetaMap["Satis Yok"];

  const handleExportDetail = () => {
    const rows = [
      ["Dönem", currentSummary.periodLabel],
      ["Toplam Satış", formatDisplayMoney(currentSummary.grossTotal)],
      ["Hakediş Tutarı", formatDisplayMoney(currentSummary.earningsTotal)],
      ["Ödeme Durumu", currentSummary.status],
      [],
      ["Ürün Kodu", "Ürün Adı", "Satış Adet", "İade Adet", "Net Satış Adet", "Birim Fiyat", "Satış Fiyatı", "Komisyon %", "Hakediş Tutar"],
      ...currentSummary.detailRows.map((item) => [
        item.productCode,
        item.productName,
        item.salesQuantity,
        item.returnQuantity,
        item.netQuantity,
        formatDisplayMoney(item.unitPrice),
        formatDisplayMoney(item.salesAmount),
        `${Number(item.commissionRate || 0).toFixed(2)}%`,
        formatDisplayMoney(item.netAmount),
      ]),
      [],
      ["Toplam", "", "", "", "", "", "", "", formatDisplayMoney(currentSummary.earningsTotal)],
    ];
    downloadWorkbook(rows, "SatisDetayi", `satis-detayi-${currentSummary.periodKey}.xlsx`);
    message.success("Excel dosyası indirildi.");
  };

  const handleExportHistory = () => {
    const rows = [
      ["Dönem", "Toplam Satış Tutar", "Komisyon Oranı", "Toplam Hakediş Tutar", "Fatura Hizmet Tutar", "Fatura KDV Tutar (%20)", "Ödeme Durumu"],
      ...historySummaries.map((item) => [
        item.periodLabel,
        formatDisplayMoney(item.grossTotal),
        `${Number(item.commissionRate || 0).toFixed(2)}%`,
        formatDisplayMoney(Number(item.earningsTotal || 0) * 1.2),
        formatDisplayMoney(item.earningsTotal),
        formatDisplayMoney(Number(item.earningsTotal || 0) * 0.2),
        item.status,
      ]),
    ];
    downloadWorkbook(rows, "DonemGecmisi", `donem-gecmisi-${currentSummary.periodKey}.xlsx`);
    message.success("Excel dosyası indirildi.");
  };

  const summaryCards = [
    {
      title: "Toplam Net Satış",
      value: formatDisplayMoney(currentSummary.netSalesTotal),
    },
    {
      title: "Komisyon Oranı",
      value: `%${Number(currentSummary.commissionRate || 0).toFixed(2)}`,
    },
    {
      title: "Hakediş Tutarı",
      value: formatDisplayMoney(currentSummary.earningsTotal),
    },
    {
      title: "Ödeme Durumu",
      value: currentSummary.status,
      isStatus: true,
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div className="erp-page-intro">
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Hakediş Özeti</Title>
          <Text type="secondary">Konsinye stok satışlarına göre dönem bazlı hakediş tutarlarınızı buradan takip edebilirsiniz.</Text>
        </div>
        <Space wrap className="erp-page-intro-actions">
          <Button icon={<DownloadOutlined />} onClick={handleExportHistory}>Geçmiş Excel</Button>
        </Space>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Space wrap>
            <Button onClick={() => setPeriodDate((current) => addMonths(current, -1))}>← Önceki Ay</Button>
            <Tag color="blue" style={{ padding: "6px 12px", fontSize: 14 }}>{formatPeriodBadge(periodDate)}</Tag>
            <Button onClick={() => setPeriodDate((current) => addMonths(current, 1))}>Sonraki Ay →</Button>
          </Space>
          {isCurrentPeriod(periodDate) ? <Tag color="gold">Dönem henüz tamamlanmadı</Tag> : null}
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        {summaryCards.map((card) => (
          <Col xs={24} sm={12} xl={6} key={card.title}>
            <Card
              bordered={false}
              loading={pageLoading}
              style={{ background: statusMeta.cardBg, border: `1px solid ${statusMeta.cardBorder}` }}
            >
              <Text type="secondary">{card.title}</Text>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, marginBottom: 6 }}>
                {card.isStatus ? <Tag color={statusMeta.color} style={{ fontSize: 18, padding: "6px 10px" }}>{card.value}</Tag> : card.value}
              </div>
              {card.description ? <Text type="secondary">{card.description}</Text> : null}
            </Card>
          </Col>
        ))}
      </Row>

      <Card bordered={false} loading={pageLoading} style={{ background: statusMeta.bandBg, border: `1px solid ${statusMeta.cardBorder}` }}>
        {currentSummary.status === "Dönem Tamamlanmadı" ? (
          <Text>{statusMeta.icon} Dönem henüz tamamlanmadı. Dönem kapandığında hakediş hesabınız kesinleşecektir.</Text>
        ) : currentSummary.status === "Satış Yok" ? (
          <Text>{statusMeta.icon} Bu dönem için hakediş oluşturan konsinye satış bulunmamaktadır.</Text>
        ) : currentSummary.status === "Fatura Bekleniyor" ? (
          <Text>{statusMeta.icon} Fatura bilgisi: Hakediş tutarı olan {formatDisplayMoney(currentSummary.earningsTotal)} için fatura kesilmesi beklenmektedir. Son ödeme tarihi, fatura tarihinden itibaren 15 gün içinde gerçekleştirilecektir.</Text>
        ) : currentSummary.status === "Ödeme Bekleniyor" ? (
          <Text>{statusMeta.icon} Fatura alındı: {currentSummary.invoiceNo} | Fatura Tarihi: {formatDateDisplayShort(currentSummary.invoiceDate)} | Son Ödeme: {formatDateDisplayShort(currentSummary.paymentDueDate)}</Text>
        ) : currentSummary.status === "Tamamlandı" ? (
          <Text>{statusMeta.icon} Ödeme {formatDateDisplayShort(currentSummary.paymentDate)} tarihinde tamamlandı. Fatura: {currentSummary.invoiceNo}</Text>
        ) : (
          <Text>{statusMeta.icon} Bu dönem için hakediş oluşturan konsinye satış bulunmamaktadır.</Text>
        )}
      </Card>

      <Card
        title="Satış Detayı"
        bordered={false}
        loading={pageLoading}
        className="erp-card-logo-divider"
        extra={<Button icon={<DownloadOutlined />} onClick={handleExportDetail}>Excel'e Aktar</Button>}
      >
        <Table
          rowKey="key"
          pagination={false}
          dataSource={currentSummary.detailRows}
          locale={{ emptyText: "Bu dönemde satış bulunmamaktadır." }}
          scroll={{ x: 860 }}
          columns={[
            { title: "Ürün Kodu", dataIndex: "productCode", key: "productCode", width: 120, ellipsis: true },
            { title: "Ürün Adı", dataIndex: "productName", key: "productName", width: 180, ellipsis: true },
            { title: "Satış Adet", dataIndex: "salesQuantity", key: "salesQuantity", width: 95, align: "right" },
            {
              title: "İade Adet",
              dataIndex: "returnQuantity",
              key: "returnQuantity",
              width: 90,
              align: "right",
              render: (v) => v > 0 ? <Text style={{ color: "#cf1322" }}>{v}</Text> : <Text type="secondary">-</Text>,
            },
            {
              title: "Net Satış Adet",
              dataIndex: "netQuantity",
              key: "netQuantity",
              width: 115,
              align: "right",
              render: (v) => <Text strong>{v}</Text>,
            },
            { title: "Birim Fiyat", dataIndex: "unitPrice", key: "unitPrice", width: 120, align: "right", render: (value) => formatDisplayMoney(value) },
            {
              title: "Satış Fiyatı",
              dataIndex: "salesAmount",
              key: "salesAmount",
              width: 120,
              align: "right",
              render: (value) => formatDisplayMoney(value),
            },
            { title: "Komisyon %", dataIndex: "commissionRate", key: "commissionRate", width: 105, align: "right", render: (value) => `%${Number(value || 0).toFixed(2)}` },
            { title: "Hakediş Tutar", dataIndex: "netAmount", key: "netAmount", width: 130, align: "right", render: (value) => <Text strong>{formatDisplayMoney(value)}</Text> },
          ]}
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row style={{ background: "#d86d5b" }}>
                <Table.Summary.Cell index={0} colSpan={8}>
                  <Text strong style={{ color: "#fff" }}>Toplam</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8} align="right">
                  <Text strong style={{ color: "#fff" }}>{formatDisplayMoney(currentSummary.earningsTotal)}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      <Card
        title="Dönem Geçmişi"
        bordered={false}
        loading={pageLoading}
        className="erp-card-logo-divider"
        extra={<Button icon={<DownloadOutlined />} onClick={handleExportHistory}>Excel'e Aktar</Button>}
      >
        <Table
          rowKey="periodKey"
          pagination={false}
          dataSource={historySummaries}
          onRow={(record) => ({
            onClick: () => setPeriodDate(record.periodDate),
          })}
          rowClassName={(record) => (record.periodKey === currentSummary.periodKey ? "erp-clickable-row ant-table-row-selected" : "erp-clickable-row")}
          scroll={{ x: 900 }}
          columns={[
            { title: "Dönem", dataIndex: "periodLabel", key: "periodLabel", width: 130 },
            { title: "Brüt Satış", dataIndex: "grossTotal", key: "grossTotal", width: 140, align: "right", render: (v) => formatDisplayMoney(v) },
            {
              title: "İade Tutar",
              dataIndex: "returnTotal",
              key: "returnTotal",
              width: 120,
              align: "right",
              render: (v) => v > 0 ? <Text style={{ color: "#cf1322" }}>-{formatDisplayMoney(v)}</Text> : <Text type="secondary">-</Text>,
            },
            { title: "Net Satış", dataIndex: "netSalesTotal", key: "netSalesTotal", width: 140, align: "right", render: (v) => <Text strong>{formatDisplayMoney(v)}</Text> },
            { title: "Komisyon Oranı", dataIndex: "commissionRate", key: "commissionRate", width: 120, align: "right", render: (value) => `%${Number(value || 0).toFixed(2)}` },
            { title: "Fatura Hizmet Tutar", dataIndex: "earningsTotal", key: "invoiceServiceAmount", width: 155, align: "right", render: (value) => formatDisplayMoney(value) },
            { title: "Fatura KDV Tutar", key: "invoiceKdv", width: 135, align: "right", render: (_, record) => formatDisplayMoney(Number(record.earningsTotal || 0) * 0.2) },
            { title: "Toplam Hakediş", key: "earningsTotalKdv", width: 140, align: "right", render: (_, record) => <Text strong>{formatDisplayMoney(Number(record.earningsTotal || 0) * 1.2)}</Text> },
            {
              title: "Ödeme Durumu",
              dataIndex: "status",
              key: "status",
              width: 150,
              render: (value) => {
                const meta = earningsStatusMetaMap[value] || earningsStatusMetaMap["Satış Yok"];
                return <Tag color={meta.color}>{value}</Tag>;
              },
            },
          ]}
          summary={() => {
            const totalGross = historySummaries.reduce((sum, item) => sum + Number(item.grossTotal || 0), 0);
            const totalReturn = historySummaries.reduce((sum, item) => sum + Number(item.returnTotal || 0), 0);
            const totalNetSales = historySummaries.reduce((sum, item) => sum + Number(item.netSalesTotal || 0), 0);
            const totalEarnings = historySummaries.reduce((sum, item) => sum + Number(item.earningsTotal || 0), 0);
            const totalKdv = totalEarnings * 0.2;
            return (
              <Table.Summary>
                <Table.Summary.Row style={{ background: "#d86d5b" }}>
                  <Table.Summary.Cell index={0}><Text strong style={{ color: "#fff" }}>Toplam</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right"><Text strong style={{ color: "#fff" }}>{formatDisplayMoney(totalGross)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right"><Text strong style={{ color: "#fff" }}>{totalReturn > 0 ? `-${formatDisplayMoney(totalReturn)}` : "-"}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right"><Text strong style={{ color: "#fff" }}>{formatDisplayMoney(totalNetSales)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} />
                  <Table.Summary.Cell index={5} align="right"><Text strong style={{ color: "#fff" }}>{formatDisplayMoney(totalEarnings)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right"><Text strong style={{ color: "#fff" }}>{formatDisplayMoney(totalKdv)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right"><Text strong style={{ color: "#fff" }}>{formatDisplayMoney(totalEarnings * 1.2)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={8} />
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>
    </Space>
  );
}

export function SupplierPortalProductListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = getAuthUser();
  const supplierId = authUser?.supplierId || null;
  const SAVED_FILTERS_KEY = "sibella.erp.supplierPortalProductFilters.v1";
  const [viewMode, setViewMode] = React.useState("liste");
  const [products, setProducts] = React.useState([]);
  const [tableLoading, setTableLoading] = React.useState(false);
  const [categoryOptions, setCategoryOptions] = React.useState([{ value: "all", label: "Tumu" }]);
  const [collectionOptions, setCollectionOptions] = React.useState([{ value: "all", label: "Tumu" }]);
  const [filters, setFilters] = React.useState({
    search: "",
    categoryId: undefined,
    collectionId: undefined,
    status: undefined,
  });
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [savedFilterName, setSavedFilterName] = React.useState("");
  const [savedFilters, setSavedFilters] = React.useState(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      return JSON.parse(window.localStorage.getItem(SAVED_FILTERS_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const statusOptions = ["Tumu", "Aktif", "Pasif"].map((value) => ({ value, label: value }));

  const refreshProducts = React.useCallback(async () => {
    try {
      setTableLoading(true);
      const [nextProducts, categories, collections] = await Promise.all([
        listProductsFresh({ slim: true }),
        listMasterDataFresh("categories"),
        listMasterDataFresh("collections"),
      ]);
      setProducts(supplierId ? nextProducts.filter((item) => item.supplierId === supplierId) : []);
      setCategoryOptions([
        { value: "all", label: "Tumu" },
        ...categories.map((item) => ({ value: item.id, label: item.fullPath })),
      ]);
      setCollectionOptions([
        { value: "all", label: "Tumu" },
        ...collections.map((item) => ({ value: item.id, label: item.name })),
      ]);
    } catch (error) {
      message.error(error?.message || "Urunler yuklenemedi.");
    } finally {
      setTableLoading(false);
    }
  }, [supplierId]);

  React.useEffect(() => {
    void refreshProducts();
  }, [refreshProducts]);

  const persistSavedFilters = (nextSavedFilters) => {
    setSavedFilters(nextSavedFilters);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(nextSavedFilters));
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      categoryId: undefined,
      collectionId: undefined,
      status: undefined,
    });
  };

  const handleSaveFilterPreset = () => {
    if (!savedFilterName.trim()) {
      message.warning("Filtre adini girin.");
      return;
    }

    const nextSavedFilters = [
      { name: savedFilterName.trim(), filters },
      ...savedFilters.filter((item) => item.name !== savedFilterName.trim()),
    ];
    persistSavedFilters(nextSavedFilters);
    setSavedFilterName("");
    message.success("Filtre kaydedildi.");
  };

  const applySavedFilter = (savedFilter) => {
    setFilters(savedFilter.filters);
    setFilterModalOpen(false);
    message.success(`${savedFilter.name} filtresi uygulandi.`);
  };

  const filteredProducts = React.useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const dashboardFilter = location.state?.dashboardFilter;
    return products.filter((product) => {
      const stockValue = Number(product.stock || 0);
      if (dashboardFilter === "in-stock" && stockValue <= 0) {
        return false;
      }
      if (dashboardFilter === "out-of-stock" && stockValue !== 0) {
        return false;
      }
      const matchesSearch =
        !normalizedSearch ||
        [product.code, product.name, product.notes, product.workflowStatus, product.categoryLabel, product.collectionLabel]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      const matchesCategory = !filters.categoryId || filters.categoryId === "all" || product.categoryId === filters.categoryId;
      const matchesCollection = !filters.collectionId || filters.collectionId === "all" || product.collectionId === filters.collectionId;
      const matchesStatus = !filters.status || filters.status === "Tumu" || product.status === filters.status;

      return matchesSearch && matchesCategory && matchesCollection && matchesStatus;
    });
  }, [filters, location.state?.dashboardFilter, products]);

  const handleExport = () => {
    const header = ["Urun Kodu", "Urun Adi", "Aciklama", "Satis Fiyati", "Kalan Stok Adet", "Toplam Tutar"];
    const rows = filteredProducts.map((item) => [
      item.code,
      item.name,
      item.notes || "",
      item.priceDisplay,
      Number(item.stock || 0),
      formatDisplayMoney(Number(item.stock || 0) * Number(item.salePrice || 0), item.saleCurrency || "TRY"),
    ]);
    downloadWorkbook([header, ...rows], "UrunListem", "tedarikci-urun-listesi.xlsx");
    message.success("Excel dosyasi indirildi.");
  };

  const columns = [
    {
      title: "Urun Kodu",
      dataIndex: "code",
      key: "code",
      width: 150,
      sorter: (a, b) => a.code.localeCompare(b.code, "tr"),
      render: (value, record) => (
        <button
          type="button"
          className="erp-link-button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/supplier/products/${record.id}`);
          }}
        >
          {value}
        </button>
      ),
    },
    {
      title: "Urun Adi",
      dataIndex: "name",
      key: "name",
      width: 220,
      sorter: (a, b) => a.name.localeCompare(b.name, "tr"),
    },
    {
      title: "Satis Fiyati",
      dataIndex: "priceDisplay",
      key: "priceDisplay",
      width: 140,
      sorter: (a, b) => a.salePrice - b.salePrice,
    },
    {
      title: "Kalan Stok Adet",
      dataIndex: "stock",
      key: "stock",
      width: 150,
      sorter: (a, b) => Number(a.stock || 0) - Number(b.stock || 0),
      render: (value) => <Tag color={Number(value || 0) > 0 ? "blue" : "red"}>{Number(value || 0)}</Tag>,
    },
    {
      title: "Satış Adet",
      dataIndex: "soldQuantity",
      key: "soldQuantity",
      width: 110,
      sorter: (a, b) => Number(a.soldQuantity || 0) - Number(b.soldQuantity || 0),
      render: (value) => Number(value || 0),
    },
    {
      title: "İade Adet",
      dataIndex: "returnQuantity",
      key: "returnQuantity",
      width: 110,
      sorter: (a, b) => Number(a.returnQuantity || 0) - Number(b.returnQuantity || 0),
      render: (value) => Number(value || 0) > 0
        ? <Text style={{ color: "#cf1322" }}>{value}</Text>
        : <Text type="secondary">0</Text>,
    },
    {
      title: "Toplam Tutar",
      key: "totalAmount",
      width: 180,
      sorter: (a, b) => (Number(a.stock || 0) * Number(a.salePrice || 0)) - (Number(b.stock || 0) * Number(b.salePrice || 0)),
      render: (_, record) => formatDisplayMoney(Number(record.stock || 0) * Number(record.salePrice || 0), record.saleCurrency || "TRY"),
    },
    {
      title: "Islemler",
      key: "actions",
      width: 100,
      render: (_, record) => (
        <Tooltip title="Düzenle"><Button size="small" className="erp-icon-btn erp-icon-btn-view" icon={<EditOutlined />} onClick={() => navigate(`/supplier/products/${record.id}`)} /></Tooltip>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div className="erp-page-intro erp-page-intro-mobile-products">
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Ürünlerim</Title>
          <Text type="secondary">Yalnızca size ait ürün kayıtlarını görüntüleyebilirsiniz.</Text>
        </div>
        <Space wrap className="erp-page-intro-actions">
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: "kanban", icon: <AppstoreOutlined />, label: "Kanban" },
              { value: "liste", icon: <BarsOutlined />, label: "Liste" },
            ]}
          />
        </Space>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar erp-product-toolbar-single">
          <Space wrap className="erp-product-toolbar-actions">
            <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          </Space>
          <div className="erp-product-toolbar-search">
            <Input
              prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
              placeholder="Ürün kodu veya adı"
              value={filters.search}
              onChange={(event) => handleFilterChange("search", event.target.value)}
              allowClear
            />
            <Button icon={<FilterOutlined />} onClick={() => setFilterModalOpen(true)} />
          </div>
        </div>
      </Card>

      {viewMode === "liste" ? (
        <Card title="Ürün Listesi" className="erp-list-table-card erp-card-logo-divider erp-supplier-products-table-card">
          <Table
            rowKey="id"
            loading={tableLoading}
            columns={columns}
            dataSource={filteredProducts}
            pagination={false}
            scroll={{ x: 1180 }}
            locale={{ emptyText: "Henuz urun kaydiniz bulunmuyor." }}
            onRow={(record) => ({
              onClick: () => navigate(`/supplier/products/${record.id}`),
            })}
            rowClassName={() => "erp-clickable-row"}
          />
          <div className="erp-table-footer">
            <span>Toplam Kayit: {filteredProducts.length}</span>
          </div>
        </Card>
      ) : (
        <Card title="Kanban Görünümü" className="erp-card-logo-divider">
          <Row gutter={[16, 16]}>
            {filteredProducts.map((product) => (
              <Col xs={24} sm={12} xl={8} key={product.id}>
                <Card
                  hoverable
                  className="erp-product-kanban-card"
                  bodyStyle={{ padding: 14 }}
                  onClick={() => navigate(`/supplier/products/${product.id}`)}
                >
                  <div className="erp-product-kanban-row">
                    <div className="erp-product-kanban-content">
                      <Text strong className="erp-product-kanban-title">{product.name}</Text>
                      <Text type="secondary" className="erp-product-kanban-code">[{product.code}]</Text>
                      <Text className="erp-product-kanban-line">Fiyat: {product.priceDisplay}</Text>
                      <Text className="erp-product-kanban-line">Kalan Stok: {Number(product.stock || 0)}</Text>
                      <Text className="erp-product-kanban-line">Satis Adet: {Number(product.soldQuantity || 0)}</Text>
                    </div>
                    <div className="erp-product-kanban-thumb">
                      <img src={product.image} alt={product.name} className="erp-product-image-small" />
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Modal
        title="Gelismis Filtreler"
        open={filterModalOpen}
        onCancel={() => setFilterModalOpen(false)}
        footer={null}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={[12, 12]}>
            <Col span={24}>
              <Form.Item label="Kategori">
                <Select
                  placeholder="Tumu"
                  value={filters.categoryId}
                  onChange={(value) => handleFilterChange("categoryId", value)}
                  options={categoryOptions}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Koleksiyon">
                <Select
                  placeholder="Tumu"
                  value={filters.collectionId}
                  onChange={(value) => handleFilterChange("collectionId", value)}
                  options={collectionOptions}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Durum">
                <Select
                  placeholder="Tumu"
                  value={filters.status}
                  onChange={(value) => handleFilterChange("status", value)}
                  options={statusOptions}
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" title="Filtreyi Kaydet">
            <Space.Compact style={{ width: "100%" }}>
              <Input value={savedFilterName} onChange={(event) => setSavedFilterName(event.target.value)} placeholder="Filtre adi" />
              <Button type="primary" onClick={handleSaveFilterPreset}>Kaydet</Button>
            </Space.Compact>
          </Card>

          <Card size="small" title="Kayitli Filtreler">
            <Space wrap>
              {savedFilters.length === 0 ? <Text type="secondary">Henuz kayitli filtre yok.</Text> : null}
              {savedFilters.map((item) => (
                <Button key={item.name} onClick={() => applySavedFilter(item)}>{item.name}</Button>
              ))}
            </Space>
          </Card>

          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Button onClick={handleResetFilters}>Filtreleri Temizle</Button>
            <Button type="primary" onClick={() => setFilterModalOpen(false)}>Uygula</Button>
          </Space>
        </Space>
      </Modal>
    </Space>
  );
}
export function SupplierPortalProductEditorPage() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const authUser = getAuthUser();
  const supplierId = authUser?.supplierId || null;
  const [form] = Form.useForm();
  const [imagePreviewOpen, setImagePreviewOpen] = React.useState(false);
  const [pageLoading, setPageLoading] = React.useState(false);
  const [categoryOptions, setCategoryOptions] = React.useState([]);
  const [collectionOptions, setCollectionOptions] = React.useState([]);
  const [supplierOptions, setSupplierOptions] = React.useState([]);
  const isEditMode = Boolean(productId);
  const watchedImage = Form.useWatch("image", form) || "/products/baroque-necklace.svg";

  React.useEffect(() => {
    let cancelled = false;
    const loadPortalProduct = async () => {
      if (!supplierId) {
        message.error("Tedarikci eslesmesi bulunamadi.");
        navigate("/login", { replace: true });
        return;
      }

      if (!isEditMode) {
        navigate("/supplier/products", { replace: true });
        return;
      }

      try {
        setPageLoading(true);
        const [products, categories, collections, suppliers] = await Promise.all([
          listProductsRawFresh(),
          listMasterDataFresh("categories"),
          listMasterDataFresh("collections"),
          listSuppliersFresh(),
        ]);

        if (cancelled) {
          return;
        }

        setCategoryOptions(categories.filter((item) => item.status === "Aktif").map((item) => ({ value: item.id, label: item.fullPath })));
        setCollectionOptions(collections.filter((item) => item.status === "Aktif").map((item) => ({ value: item.id, label: item.name })));
        setSupplierOptions(suppliers.filter((item) => item.id === supplierId).map((item) => ({ value: item.id, label: item.company })));

        const product = products.find((item) => item.id === productId);
        if (!product || product.supplierId !== supplierId) {
          message.error("Bu urun kaydina erisim yetkiniz yok.");
          navigate("/supplier/products", { replace: true });
          return;
        }

        form.setFieldsValue({
          ...product,
          supplierId,
        });
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadPortalProduct();
    return () => {
      cancelled = true;
    };
  }, [form, isEditMode, navigate, productId, supplierId]);

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Urun Karti</Title>
          <Text type="secondary">Bu ekranda sadece size ait urun kartini goruntuleyebilirsiniz.</Text>
        </div>
        <Space wrap>
          <Button onClick={() => navigate("/supplier/products")}>Listeye Don</Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <Row gutter={[20, 20]}>
          <Col xs={24} xl={8}>
            <Card title="Urun Gorseli" loading={pageLoading}>
              <div
                className="erp-product-preview"
                onClick={() => setImagePreviewOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setImagePreviewOpen(true);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <img src={watchedImage} alt="Urun gorseli" className="erp-product-image-large" />
              </div>
              <Form.Item name="image" hidden rules={[{ required: true, message: "Urun gorseli zorunludur." }]}>
                <Input />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} xl={16}>
            <Space direction="vertical" size={20} style={{ width: "100%" }}>
              <Card title="Urun Bilgileri" extra={<Tag color="blue">{form.getFieldValue("workflowStatus") || "Taslak"}</Tag>} loading={pageLoading}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Form.Item name="supplierId" label="Tedarikci" rules={[{ required: true, message: "Tedarikci zorunludur." }]}>
                      <Select
                        disabled
                        options={supplierOptions}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="code" label="Urun Kodu" rules={[{ required: true, message: "Urun kodu zorunludur." }]}>
                      <Input disabled />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="name" label="Urun Adi" rules={[{ required: true, message: "Urun adi zorunludur." }]}>
                      <Input disabled />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="salePrice"
                      label="Satis Fiyati"
                      rules={[
                        { required: true, message: "Satis fiyati zorunludur." },
                        { validator: (_, value) => Number(value || 0) > 0 ? Promise.resolve() : Promise.reject(new Error("Satis fiyati 0'dan buyuk olmali.")) },
                      ]}
                    >
                      <InputNumber style={{ width: "100%" }} min={0} addonAfter="TRY" disabled />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="categoryId" label="Kategori">
                      <Select options={categoryOptions} showSearch optionFilterProp="label" placeholder="Kategori seciniz" disabled />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="collectionId" label="Koleksiyon">
                      <Select options={collectionOptions} showSearch optionFilterProp="label" placeholder="Koleksiyon seciniz" disabled />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item name="notes" label="Urun Aciklamasi / Bilgilendirme">
                      <Input.TextArea rows={6} disabled />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              <Card title="Kayit Bilgisi" loading={pageLoading}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Form.Item name="workflowStatus" label="Kayit Durumu">
                      <Select
                        options={["Taslak", "Onaya Gonderildi", "Onaylandi", "Revizyon Istendi"].map((value) => ({ value, label: value }))}
                        disabled
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="status" label="Kart Durumu">
                      <Select options={["Aktif", "Pasif"].map((value) => ({ value, label: value }))} disabled />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Space>
          </Col>
        </Row>
      </Form>

      <Modal
        title="Urun Gorsel Onizleme"
        open={imagePreviewOpen}
        footer={null}
        onCancel={() => setImagePreviewOpen(false)}
        width={720}
      >
        <div className="erp-product-preview erp-product-preview-modal">
          <img src={watchedImage} alt="Urun gorseli buyuk onizleme" className="erp-product-image-zoom" />
        </div>
      </Modal>
    </Space>
  );
}

const DELIVERY_FILTERS_KEY = "sibella.erp.deliveryFilters.v1";

function formatDateTR(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export function SupplierDeliveryListsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = React.useState({
    search: "",
    supplierId: undefined,
    status: undefined,
    dateFrom: null,
    dateTo: null,
  });
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [savedFilterName, setSavedFilterName] = React.useState("");
  const [savedFilters, setSavedFilters] = React.useState(() => {
    try { return JSON.parse(window.localStorage.getItem(DELIVERY_FILTERS_KEY) || "[]"); } catch { return []; }
  });
  const [supplierOptions, setSupplierOptions] = React.useState([]);
  const statusOptions = ["Taslak", "Onay Bekleniyor", "Onaylandi", "Tamamlandi", "Revizyon Istendi"].map((value) => ({ value, label: value }));
  const [records, setRecords] = React.useState([]);
  const [tableLoading, setTableLoading] = React.useState(false);

  const persistSavedFilters = (next) => {
    setSavedFilters(next);
    window.localStorage.setItem(DELIVERY_FILTERS_KEY, JSON.stringify(next));
  };

  const handleAdminDeleteRecord = async (record) => {
    try {
      deleteDeliveryList(record.id);
      message.success("Teslimat silindi.");
      await refreshRecords();
    } catch (error) {
      message.error(error?.message || "Teslimat silinemedi.");
    }
  };

  const refreshRecords = React.useCallback(async () => {
    try {
      setTableLoading(true);
      const [deliveries, suppliers] = await Promise.all([listDeliveryListsFresh(), listSuppliersFresh()]);
      setRecords(deliveries);
      setSupplierOptions(suppliers.map((item) => ({ value: item.id, label: item.company })));
    } catch (error) {
      message.error(error?.message || "Teslimat listesi yuklenemedi.");
    } finally {
      setTableLoading(false);
    }
  }, []);

  React.useEffect(() => { void refreshRecords(); }, [refreshRecords]);

  const filteredRecords = React.useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesSearch =
        !normalizedSearch ||
        [record.deliveryNo, record.supplierName, record.contactName, record.trackingNo, record.note]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      const matchesSupplier = !filters.supplierId || record.supplierId === filters.supplierId;
      const matchesStatus = !filters.status || (record.status || "Taslak") === filters.status;
      const recordDate = record.date ? new Date(record.date).getTime() : null;
      const matchesDateFrom = !filters.dateFrom || (recordDate && recordDate >= new Date(filters.dateFrom).getTime());
      const matchesDateTo = !filters.dateTo || (recordDate && recordDate <= new Date(filters.dateTo).setHours(23, 59, 59, 999));
      return matchesSearch && matchesSupplier && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [filters, records]);

  const handleStatusUpdate = async (recordId, status) => {
    const record = getDeliveryListById(recordId);
    if (!record) return;
    let updatedRecord = null;
    if (status === "Tamamlandi") {
      if ((record.status || "Taslak") !== "Onaylandi") {
        message.warning("Teslim alma islemi sadece onayli kayitlar icin yapilabilir.");
        return;
      }
      try {
        updatedRecord = completeDeliveryReceipt(recordId);
      } catch (error) {
        message.error(error?.message || "Teslimat stoga aktarilirken hata olustu.");
        return;
      }
    } else {
      updatedRecord = updateDeliveryList(recordId, { ...record, status });
      if (status === "Onaylandi") await createDeliveryPdf(updatedRecord);
    }
    refreshRecords();
    message.success(status === "Tamamlandi" ? "Teslimat tamamlandi ve stok hareketlerine aktarildi." : `Teslimat durumu "${status}" olarak guncellendi.`);
  };

  const activeFilterCount = [filters.supplierId, filters.status, filters.dateFrom, filters.dateTo].filter(Boolean).length;

  const columns = [
    {
      title: "Teslimat No",
      dataIndex: "deliveryNo",
      key: "deliveryNo",
      width: 170,
      sorter: (a, b) => a.deliveryNo.localeCompare(b.deliveryNo, "tr"),
      render: (value, record) => (
        <button type="button" className="erp-link-button" onClick={(event) => { event.stopPropagation(); navigate(`/supplier-portal/delivery-lists/${record.id}`); }}>
          {value}
        </button>
      ),
    },
    { title: "Tedarikci", dataIndex: "supplierName", key: "supplierName", sorter: (a, b) => a.supplierName.localeCompare(b.supplierName, "tr") },
    { title: "Yetkili", dataIndex: "contactName", key: "contactName", sorter: (a, b) => a.contactName.localeCompare(b.contactName, "tr") },
    {
      title: "Tarih",
      dataIndex: "date",
      key: "date",
      sorter: (a, b) => (a.date || "").localeCompare(b.date || "", "tr"),
      render: (value) => formatDateTR(value),
    },
    { title: "Kalem", dataIndex: "lineCount", key: "lineCount", sorter: (a, b) => a.lineCount - b.lineCount },
    { title: "Toplam", dataIndex: "totalAmountDisplay", key: "totalAmountDisplay", sorter: (a, b) => a.totalAmount - b.totalAmount },
    {
      title: "Teslimat Durumu",
      dataIndex: "status",
      key: "status",
      render: (value) => {
        const colorMap = { Taslak: "default", "Onay Bekleniyor": "gold", Onaylandi: "green", Tamamlandi: "blue", "Revizyon Istendi": "red" };
        return <Tag color={colorMap[value || "Taslak"] || "blue"}>{value || "Taslak"}</Tag>;
      },
    },
    {
      title: "Islemler",
      key: "actions",
      render: (_, record) => {
        const isCompleted = Boolean(record.stockEntryId || record.inventoryPostedAt);
        const isApproved = (record.status || "Taslak") === "Onaylandi";
        return (
          <Space size={4}>
            <Tooltip title="Teslimat Formu">
              <Button size="small" className="erp-icon-btn erp-icon-btn-view" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); navigate(`/supplier-portal/delivery-lists/${record.id}`); }} />
            </Tooltip>
            <Tooltip title="Revizyon Iste">
              <Button size="small" className="erp-icon-btn erp-icon-btn-edit" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleStatusUpdate(record.id, "Revizyon Istendi"); }} />
            </Tooltip>
            <Tooltip title="Onayla">
              <Button size="small" className="erp-icon-btn erp-icon-btn-approve" icon={<CheckOutlined />} onClick={(e) => { e.stopPropagation(); handleStatusUpdate(record.id, "Onaylandi"); }} />
            </Tooltip>
            <Tooltip title="Teslim Alindi">
              <Button size="small" className={`erp-icon-btn${isApproved && !isCompleted ? " erp-icon-btn-receive" : ""}`} icon={<InboxOutlined />} disabled={!isApproved || isCompleted} onClick={(e) => { e.stopPropagation(); handleStatusUpdate(record.id, "Tamamlandi"); }} />
            </Tooltip>
            {(record.status || "Taslak") === "Taslak" ? (
              <Popconfirm title="Bu teslimat silinsin mi?" okText="Sil" cancelText="Vazgeç" onConfirm={() => void handleAdminDeleteRecord(record)}>
                <Tooltip title="Sil">
                  <Button size="small" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                </Tooltip>
              </Popconfirm>
            ) : null}
          </Space>
        );
      },
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 6 }}>Teslimat Listeleri</Title>
        <Text type="secondary">Tedarikciler tarafindan olusturulan teslimat listeleri burada izlenir, acilir ve durumlari guncellenir.</Text>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar">
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => void refreshRecords()}>Yenile</Button>
          </Space>
          <Space wrap>
            <Input
              prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
              placeholder="Teslimat no veya tedarikci ara"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              allowClear
              style={{ width: 260 }}
            />
            <Button
              icon={<FilterOutlined />}
              onClick={() => setFilterModalOpen(true)}
              type={activeFilterCount > 0 ? "primary" : "default"}
            >
              {activeFilterCount > 0 ? `Filtreler (${activeFilterCount})` : "Gelismis Filtreler"}
            </Button>
          </Space>
        </div>
      </Card>

      <Card title="Gelen Kayitlar" className="erp-list-table-card">
        <Table
          rowKey="id"
          loading={tableLoading}
          columns={columns}
          dataSource={filteredRecords}
          pagination={{ pageSize: 25, showSizeChanger: true, pageSizeOptions: ["25", "50", "100"], showTotal: (total, range) => `${range[0]} - ${range[1]} / ${total}` }}
          locale={{ emptyText: "Tedarikci portalindan gelen kayit bulunmuyor." }}
          onRow={(record) => ({ onClick: () => navigate(`/supplier-portal/delivery-lists/${record.id}`) })}
          rowClassName={() => "erp-clickable-row"}
        />
        <div className="erp-table-footer">
          <span>Toplam Kayit: {filteredRecords.length}</span>
          <span>Satira tiklayarak teslimat formunu acabilirsiniz.</span>
        </div>
      </Card>

      <Modal title="Gelismis Filtreler" open={filterModalOpen} onCancel={() => setFilterModalOpen(false)} footer={null}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={[12, 12]}>
            <Col span={24}>
              <Form.Item label="Teslimat No">
                <Input
                  placeholder="Teslimat no ara"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Tedarikci">
                <Select
                  placeholder="Tumu"
                  value={filters.supplierId}
                  onChange={(value) => setFilters((prev) => ({ ...prev, supplierId: value }))}
                  options={supplierOptions}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Teslimat Durumu">
                <Select
                  placeholder="Tumu"
                  value={filters.status}
                  onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
                  options={statusOptions}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Baslangic Tarihi">
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD.MM.YYYY"
                  value={filters.dateFrom ? dayjs(filters.dateFrom) : null}
                  onChange={(dayjsVal) => setFilters((prev) => ({ ...prev, dateFrom: dayjsVal ? dayjsVal.toISOString() : null }))}
                  placeholder="gg.aa.yyyy"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Bitis Tarihi">
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD.MM.YYYY"
                  value={filters.dateTo ? dayjs(filters.dateTo) : null}
                  onChange={(dayjsVal) => setFilters((prev) => ({ ...prev, dateTo: dayjsVal ? dayjsVal.toISOString() : null }))}
                  placeholder="gg.aa.yyyy"
                />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" title="Filtreyi Kaydet">
            <Space.Compact style={{ width: "100%" }}>
              <Input value={savedFilterName} onChange={(e) => setSavedFilterName(e.target.value)} placeholder="Filtre adi" />
              <Button type="primary" onClick={() => {
                if (!savedFilterName.trim()) { message.warning("Filtre adi girin."); return; }
                const next = [{ name: savedFilterName.trim(), filters }, ...savedFilters.filter((f) => f.name !== savedFilterName.trim())];
                persistSavedFilters(next);
                setSavedFilterName("");
                message.success("Filtre kaydedildi.");
              }}>Kaydet</Button>
            </Space.Compact>
          </Card>

          <Card size="small" title="Kayitli Filtreler">
            {savedFilters.length === 0 ? <Text type="secondary">Henuz kayitli filtre yok.</Text> : (
              <Space direction="vertical" size={6} style={{ width: "100%" }}>
                {savedFilters.map((item) => (
                  <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Button style={{ flex: 1, textAlign: "left" }} onClick={() => { setFilters(item.filters); setFilterModalOpen(false); message.success(`${item.name} filtresi uygulandi.`); }}>{item.name}</Button>
                    <Popconfirm title="Bu filtre silinsin mi?" okText="Sil" cancelText="Vazgec" onConfirm={() => persistSavedFilters(savedFilters.filter((f) => f.name !== item.name))}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                ))}
              </Space>
            )}
          </Card>

          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Button onClick={() => setFilters({ search: "", supplierId: undefined, status: undefined, dateFrom: null, dateTo: null })}>Filtreleri Temizle</Button>
            <Button type="primary" onClick={() => setFilterModalOpen(false)}>Uygula</Button>
          </Space>
        </Space>
      </Modal>
    </Space>
  );
}

export function SupplierPortalDeliveryListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = getAuthUser();
  const supplierId = authUser?.supplierId || null;
  const [records, setRecords] = React.useState([]);
  const [tableLoading, setTableLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedRecord, setSelectedRecord] = React.useState(null);

  const handleDeleteRecord = async (record) => {
    try {
      deleteDeliveryList(record.id);
      message.success("Teslimat silindi.");
      await refreshRecords();
    } catch (error) {
      message.error(error?.message || "Teslimat silinemedi.");
    }
  };

  const handleDownloadPdf = async (record) => {
    try {
      await createDeliveryPdf(record.id);
    } catch (error) {
      message.error(error?.message || "PDF olusturulamadi.");
    }
  };

  const refreshRecords = React.useCallback(async () => {
    try {
      setTableLoading(true);
      const nextRecords = supplierId ? await listDeliveryListsBySupplierFresh(supplierId) : [];
      setRecords(nextRecords);
    } catch (error) {
      message.error(error?.message || "Teslimatlar yuklenemedi.");
    } finally {
      setTableLoading(false);
    }
  }, [supplierId]);

  React.useEffect(() => {
    void refreshRecords();
  }, [refreshRecords]);

  const filteredRecords = React.useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const dashboardFilter = location.state?.dashboardFilter;
    return records.filter((record) => {
      if (dashboardFilter === "pending-approval" && record.status !== "Onay Bekleniyor") {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }

      return [record.deliveryNo, record.trackingNo, record.note, record.contactName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
  }, [location.state?.dashboardFilter, records, search]);

  const columns = [
    {
      title: "Teslimat No",
      dataIndex: "deliveryNo",
      key: "deliveryNo",
      sorter: (a, b) => a.deliveryNo.localeCompare(b.deliveryNo, "tr"),
      render: (value, record) => (
        <button
          type="button"
          className="erp-link-button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/supplier/deliveries/${record.id}`);
          }}
        >
          {value}
        </button>
      ),
    },
    {
      title: "Durum",
      dataIndex: "status",
      key: "status",
      width: 160,
      render: (value) => {
        const colorMap = {
          Taslak: "default",
          "Onay Bekleniyor": "gold",
          Onaylandi: "green",
          Tamamlandi: "blue",
          "Revizyon Istendi": "red",
        };
        return <Tag color={colorMap[value || "Taslak"] || "blue"}>{value || "Taslak"}</Tag>;
      },
    },
    {
      title: "Tarih",
      dataIndex: "date",
      key: "date",
      width: 120,
      sorter: (a, b) => String(a.date || "").localeCompare(String(b.date || ""), "tr"),
      render: (value) => formatDisplayDate(value),
    },
    { title: "Yetkili", dataIndex: "contactName", key: "contactName", width: 170, sorter: (a, b) => a.contactName.localeCompare(b.contactName, "tr") },
    { title: "Ürün Çeşidi", dataIndex: "lineCount", key: "lineCount", width: 120, sorter: (a, b) => a.lineCount - b.lineCount },
    { title: "Toplam Teslim Adet", dataIndex: "totalQuantity", key: "totalQuantity", width: 160, sorter: (a, b) => a.totalQuantity - b.totalQuantity },
    { title: "Toplam Tutar", dataIndex: "totalAmountDisplay", key: "totalAmountDisplay", width: 180, sorter: (a, b) => a.totalAmount - b.totalAmount },
    {
      title: "İşlemler",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Görüntüle / Düzenle">
            <Button
              size="small"
              className="erp-icon-btn erp-icon-btn-view"
              icon={<EyeOutlined />}
              onClick={(e) => { e.stopPropagation(); navigate(`/supplier/deliveries/${record.id}`); }}
            />
          </Tooltip>
          <Tooltip title="PDF İndir">
            <Button
              size="small"
              className="erp-icon-btn erp-icon-btn-edit"
              icon={<DownloadOutlined />}
              onClick={(e) => { e.stopPropagation(); void handleDownloadPdf(record); }}
            />
          </Tooltip>
          {record.status === "Taslak" ? (
            <Popconfirm
              title="Bu teslimat silinsin mi?"
              okText="Sil"
              cancelText="Vazgeç"
              onConfirm={() => void handleDeleteRecord(record)}
            >
              <Tooltip title="Sil">
                <Button
                  size="small"
                  className="erp-icon-btn erp-icon-btn-delete"
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Tooltip>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Teslimat Listesi</Title>
          <Text type="secondary">Olusturdugunuz teslimatlar burada listelenir. Taslaklari duzenleyebilir ve gonderilen kayitlari izleyebilirsiniz.</Text>
        </div>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar erp-product-toolbar-single">
          <Space wrap className="erp-product-toolbar-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/supplier/deliveries/new")}>Yeni Teslimat</Button>
          </Space>
          <div className="erp-product-toolbar-search">
            <Input
              prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
              placeholder="Teslimat no / kargo / not"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              allowClear
            />
          </div>
        </div>
      </Card>

      <Card title="Teslimatlarim" className="erp-list-table-card erp-card-logo-divider erp-delivery-list-table-card">
        <Table
          rowKey="id"
          loading={tableLoading}
          columns={columns}
          dataSource={filteredRecords}
          pagination={false}
          scroll={{ x: 1360 }}
          locale={{ emptyText: "Henuz teslimat kaydiniz bulunmuyor." }}
          onRow={(record) => ({
            onClick: () => openDetailFromRow(setSelectedRecord, setDetailOpen, record),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
        <div className="erp-table-footer">
          <span>Toplam Kayit: {filteredRecords.length}</span>
        </div>
      </Card>

      <Drawer title="Teslimat Detayi" placement="right" width={420} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {selectedRecord ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Teslimat No">{selectedRecord.deliveryNo}</Descriptions.Item>
            <Descriptions.Item label="Tedarikci">{selectedRecord.supplierName}</Descriptions.Item>
            <Descriptions.Item label="Yetkili">{selectedRecord.contactName}</Descriptions.Item>
            <Descriptions.Item label="Tarih">{formatDisplayDate(selectedRecord.date)}</Descriptions.Item>
            <Descriptions.Item label="Gonderim">{selectedRecord.shippingMethod || "-"}</Descriptions.Item>
            <Descriptions.Item label="Takip No">{selectedRecord.trackingNo || "-"}</Descriptions.Item>
            <Descriptions.Item label="Durum">{selectedRecord.status || "Taslak"}</Descriptions.Item>
            <Descriptions.Item label="Urun Cesidi">{selectedRecord.lineCount}</Descriptions.Item>
            <Descriptions.Item label="Toplam Teslim Adet">{selectedRecord.totalQuantity}</Descriptions.Item>
            <Descriptions.Item label="Not">{selectedRecord.note || "-"}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </Space>
  );
}

export function SupplierPortalDeliveryEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { deliveryId: deliveryIdParam } = useParams();
  const [deliveryId, setDeliveryId] = React.useState(deliveryIdParam || null);
  const authUser = getAuthUser();
  const isAdminView = location.pathname.startsWith("/supplier-portal/");
  const supplierId = authUser?.supplierId || null;
  const isEditMode = Boolean(deliveryId);
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [pageLoading, setPageLoading] = React.useState(false);
  const [deliveryLines, setDeliveryLines] = React.useState([]);
  const [targetRecord, setTargetRecord] = React.useState(null);
  const [supplier, setSupplier] = React.useState(null);
  const [categoryOptions, setCategoryOptions] = React.useState([]);
  const [collectionOptions, setCollectionOptions] = React.useState([]);
  const [supplierProducts, setSupplierProducts] = React.useState([]);
  const [lineDraft, setLineDraft] = React.useState({
    productId: undefined,
    image: "",
    name: "",
    code: "",
    salePrice: 0,
    categoryId: undefined,
    categoryLabel: "",
    collectionId: undefined,
    collectionLabel: "",
    quantity: 1,
  });
  const [editIndex, setEditIndex] = React.useState(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editLine, setEditLine] = React.useState(null);
  const [promoteMode, setPromoteMode] = React.useState(false);
  const [generalInfoOpen, setGeneralInfoOpen] = React.useState(false);
  const lineDraftInputRef = React.useRef(null);
  const lineDraftGalleryInputRef = React.useRef(null);
  const editImageInputRef = React.useRef(null);
  const watchedLines = deliveryLines;
  const targetSupplierId = isAdminView ? (targetRecord?.supplierId || null) : supplierId;
  const categoryLabelMap = React.useMemo(
    () => Object.fromEntries(categoryOptions.map((item) => [item.value, item.label])),
    [categoryOptions],
  );
  const collectionLabelMap = React.useMemo(
    () => Object.fromEntries(collectionOptions.map((item) => [item.value, item.label])),
    [collectionOptions],
  );
  const productOptions = React.useMemo(
    () => supplierProducts
      .slice()
      .sort((a, b) => `${b.code || ""} - ${b.name || ""}`.localeCompare(`${a.code || ""} - ${a.name || ""}`, "tr"))
      .map((item) => ({ value: item.id, label: `${item.code || ""} - ${item.name || ""}`, product: item })),
    [supplierProducts],
  );
  const totalAmount = React.useMemo(
    () => watchedLines.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.salePrice || 0)), 0),
    [watchedLines],
  );
  const watchedStatus = Form.useWatch("status", form);
  const currentStatus = watchedStatus || form.getFieldValue("status") || targetRecord?.status || "Taslak";
  const isEditableSupplierStatus = ["Taslak", "Revizyon Istendi"].includes(currentStatus);
  const canEditDelivery = isAdminView || isEditableSupplierStatus;
  const isDeliveryLocked = !canEditDelivery;

  React.useEffect(() => {
    let cancelled = false;
    const loadDeliveryEditor = async () => {
      if (!isAdminView && !supplierId) {
        message.error("Tedarikci eslesmesi bulunamadi.");
        navigate("/login", { replace: true });
        return;
      }

      try {
        setPageLoading(true);
        const [categories, collections, suppliers, products, deliveries] = await Promise.all([
          listMasterDataFresh("categories"),
          listMasterDataFresh("collections"),
          listSuppliersFresh(),
          listProductsRawFresh(),
          listDeliveryListsFresh(),
        ]);

        if (cancelled) {
          return;
        }

        setCategoryOptions(
          categories
            .map((item) => ({ value: item.id, label: item.fullPath || item.level1 || item.id }))
            .sort((a, b) => a.label.localeCompare(b.label, "tr")),
        );
        setCollectionOptions(
          collections
            .map((item) => ({ value: item.id, label: item.name || item.id }))
            .sort((a, b) => a.label.localeCompare(b.label, "tr")),
        );

        const loadedRecord = isEditMode ? deliveries.find((item) => item.id === deliveryId) || null : null;
        const resolvedSupplierId = isAdminView ? (loadedRecord?.supplierId || null) : supplierId;
        const resolvedSupplier = suppliers.find((item) => item.id === resolvedSupplierId) || null;
        setTargetRecord(loadedRecord);
        setSupplier(resolvedSupplier);
        setSupplierProducts(products.filter((item) => item.supplierId === resolvedSupplierId));

        const baseValues = {
          supplierId: resolvedSupplierId,
          supplierName: resolvedSupplier?.company || "",
          contactName: resolvedSupplier?.contact || "",
          supplierEmail: resolvedSupplier?.email || authUser?.email || "",
          date: new Date().toISOString().slice(0, 10),
          deliveryNo: resolvedSupplierId ? await getNextDeliveryNoPreviewFresh(resolvedSupplierId) : "",
          shippingMethod: "Kargo",
          trackingNo: "",
          status: "Taslak",
          lines: [],
        };

        if (!isEditMode) {
          if (isAdminView) {
            navigate("/supplier-portal/delivery-lists", { replace: true });
            return;
          }
          form.setFieldsValue(baseValues);
          setDeliveryLines([]);
          return;
        }

        if (!loadedRecord || (!isAdminView && loadedRecord.supplierId !== supplierId)) {
          message.error("Bu teslimat kaydina erisim yetkiniz yok.");
          navigate(isAdminView ? "/supplier-portal/delivery-lists" : "/supplier/deliveries", { replace: true });
          return;
        }

        const loadedLines = loadedRecord.lines || [];
        form.setFieldsValue({
          ...baseValues,
          ...loadedRecord,
          lines: loadedLines,
        });
        setDeliveryLines(loadedLines);
      } catch (error) {
        if (!cancelled) {
          message.error(error?.message || "Teslimat verileri alinamadi.");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadDeliveryEditor();
    return () => {
      cancelled = true;
    };
  }, [authUser?.email, deliveryId, form, isAdminView, isEditMode, navigate, supplierId]);

  const resetLineDraft = React.useCallback(() => {
    setLineDraft({
      productId: undefined,
      image: "",
      name: "",
      code: "",
      salePrice: 0,
      categoryId: undefined,
      categoryLabel: "",
      collectionId: undefined,
      collectionLabel: "",
      quantity: 1,
    });
  }, []);

  const handleDraftProductSelect = (productId) => {
    if (isDeliveryLocked) {
      return;
    }
    const product = supplierProducts.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    setLineDraft((current) => ({
      ...current,
      productId,
      image: product.image || "",
      name: product.name || "",
      code: product.code || "",
      salePrice: Number(product.salePrice || 0),
      categoryId: product.categoryId || undefined,
      categoryLabel: product.categoryLabel || categoryLabelMap[product.categoryId] || "",
      collectionId: product.collectionId || undefined,
      collectionLabel: product.collectionLabel || collectionLabelMap[product.collectionId] || "",
    }));
  };

  const handleDraftImageUpload = (file) => {
    if (isDeliveryLocked) {
      return;
    }
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      message.error("Gecerli bir gorsel secmelisiniz.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.72);
        setLineDraft((current) => ({ ...current, image: compressed }));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleAddLine = async () => {
    if (isDeliveryLocked) return;
    if (!lineDraft.image) { showCenteredWarning("Gorsel eklemelisin."); return; }
    if (!lineDraft.name || !lineDraft.code || !lineDraft.salePrice || !lineDraft.quantity) {
      showCenteredWarning("Urun adi, kod, birim fiyat ve teslim adedi zorunludur.");
      return;
    }
    const duplicateLine = deliveryLines.find((line) =>
      lineDraft.productId
        ? line.productId === lineDraft.productId
        : String(line.code || "").trim().toUpperCase() === String(lineDraft.code || "").trim().toUpperCase(),
    );
    if (duplicateLine) { showCenteredWarning("Bu urun daha once eklendi."); return; }

    try {
      setLoading(true);
      let currentDeliveryId = deliveryId;

      if (!currentDeliveryId) {
        const headerValues = form.getFieldsValue();
        const created = await requestJson("POST", "/api/delivery-lists", {
          ...headerValues,
          supplierId: targetSupplierId,
          supplierName: supplier?.company || "",
          contactName: supplier?.contact || "",
          supplierEmail: supplier?.email || authUser?.email || "",
          status: "Taslak",
          createdBy: authUser?.id || null,
          lines: [],
        });
        currentDeliveryId = created?.id;
        setDeliveryId(currentDeliveryId);
        const newPath = isAdminView
          ? `/supplier-portal/delivery-lists/${currentDeliveryId}`
          : `/supplier/deliveries/${currentDeliveryId}`;
        navigate(newPath, { replace: true });
      }

      const result = await requestJson("POST", `/api/delivery-lists/${currentDeliveryId}/lines`, {
        productId: lineDraft.productId || null,
        isNewProduct: !lineDraft.productId,
        image: lineDraft.image,
        name: lineDraft.name,
        code: lineDraft.code,
        salePrice: Number(lineDraft.salePrice),
        saleCurrency: "TRY",
        categoryId: lineDraft.categoryId || null,
        categoryLabel: lineDraft.categoryLabel || "",
        collectionId: lineDraft.collectionId || null,
        collectionLabel: lineDraft.collectionLabel || "",
        quantity: Number(lineDraft.quantity),
        description: "",
      });

      const nextLines = result?.item?.lines || result?.lines || [...deliveryLines, { id: `line-${Date.now()}`, ...lineDraft }];
      setDeliveryLines(nextLines);
      form.setFieldValue("lines", nextLines);
      resetLineDraft();
      message.success("Urun listeye eklendi.");
    } catch (error) {
      message.error(error?.message || "Satir eklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLine = async (index, lineId) => {
    if (isDeliveryLocked) {
      return;
    }
    if (deliveryId && lineId) {
      try {
        setLoading(true);
        const result = await requestJson("DELETE", `/api/delivery-lists/${deliveryId}/lines/${lineId}`);
        const updatedLines = result?.item?.lines ?? result?.lines ?? deliveryLines.filter((_, i) => i !== index);
        setDeliveryLines(updatedLines);
        form.setFieldValue("lines", updatedLines);
        return;
      } catch (error) {
        message.error(error?.message || "Satir silinemedi.");
        return;
      } finally {
        setLoading(false);
      }
    }
    const currentLines = [...deliveryLines];
    currentLines.splice(index, 1);
    setDeliveryLines(currentLines);
    form.setFieldValue("lines", currentLines);
  };

  const openEditDrawer = (index) => {
    if (isDeliveryLocked && !isAdminView) {
      return;
    }
    const target = watchedLines[index];
    if (!target) {
      return;
    }
    setEditIndex(index);
    setEditLine({ ...target });
    setPromoteMode(false);
    setEditOpen(true);
  };

  const openPromoteDrawer = (index) => {
    const target = watchedLines[index];
    if (!target) {
      return;
    }
    setEditIndex(index);
    setEditLine({ ...target });
    setPromoteMode(true);
    setEditOpen(true);
  };

  const handleEditImageUpload = (file) => {
    if (isDeliveryLocked) {
      return;
    }
    if (!file || !editLine) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      message.error("Gecerli bir gorsel secmelisiniz.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setEditLine((current) => ({ ...current, image: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEditLine = () => {
    if (isDeliveryLocked && !isAdminView) {
      return;
    }
    if (editIndex === null || !editLine) {
      return;
    }

    const currentLines = [...deliveryLines];
    currentLines[editIndex] = {
      ...currentLines[editIndex],
      ...editLine,
      salePrice: Number(editLine.salePrice || 0),
      quantity: Number(editLine.quantity || 0),
      categoryLabel: categoryLabelMap[editLine.categoryId] || editLine.categoryLabel || "",
      collectionLabel: collectionLabelMap[editLine.collectionId] || editLine.collectionLabel || "",
    };
    setDeliveryLines(currentLines);
    form.setFieldValue("lines", currentLines);
    setEditOpen(false);
    setEditIndex(null);
    setEditLine(null);
  };

  const handlePromoteLineToProduct = async () => {
    if (!isAdminView || editIndex === null || !editLine || !targetSupplierId) {
      return;
    }
    if (!editLine.name || !editLine.code) {
      message.error("Urun adi ve urun kodu zorunludur.");
      return;
    }

    const duplicate = supplierProducts.find((product) => product.code === editLine.code && product.id !== editLine.productId);
    if (duplicate) {
      message.error("Bu urun kodu daha once kullanilmis.");
      return;
    }

    try {
      setLoading(true);
      const response = await requestJson("POST", "/api/products", {
        supplierId: targetSupplierId,
        code: editLine.code,
        name: editLine.name,
        salePrice: editLine.salePrice,
        saleCurrency: editLine.saleCurrency || "TRY",
        cost: 0,
        costCurrency: "TRY",
        categoryId: editLine.categoryId || null,
        collectionId: editLine.collectionId || null,
        posCategoryId: null,
        barcode: "",
        supplierCode: editLine.code,
        minStock: 0,
        supplierLeadTime: 0,
        productType: "konsinye",
        salesTax: "%20",
        image: editLine.image,
        isForSale: true,
        isForPurchase: true,
        useInPos: true,
        trackInventory: true,
        status: "Aktif",
        workflowStatus: "Onaylandi",
        createdBy: authUser?.id || null,
        notes: editLine.description || "",
        features: [],
      });
      const savedProduct = response?.item || response;

      const currentLines = [...deliveryLines];
      currentLines[editIndex] = {
        ...currentLines[editIndex],
        ...editLine,
        productId: savedProduct.id,
        isNewProduct: false,
        code: savedProduct.code,
        name: savedProduct.name,
        categoryId: savedProduct.categoryId || editLine.categoryId || null,
        categoryLabel: savedProduct.categoryLabel || categoryLabelMap[editLine.categoryId] || editLine.categoryLabel || "",
        collectionId: savedProduct.collectionId || editLine.collectionId || null,
        collectionLabel: savedProduct.collectionLabel || collectionLabelMap[editLine.collectionId] || editLine.collectionLabel || "",
      };
      setDeliveryLines(currentLines);
      form.setFieldValue("lines", currentLines);
      if (deliveryId) {
        await requestJson("PUT", `/api/delivery-lists/${encodeURIComponent(deliveryId)}`, {
          ...form.getFieldsValue(),
          supplierId: targetSupplierId,
          supplierName: supplier?.company || "",
          contactName: supplier?.contact || "",
          supplierEmail: supplier?.email || "",
          createdBy: targetRecord?.createdBy || authUser?.id || null,
          status: form.getFieldValue("status") || targetRecord?.status || "Taslak",
          lines: currentLines,
        });
      }
      setEditOpen(false);
      setEditIndex(null);
      setEditLine(null);
      setPromoteMode(false);
      message.success("Satir urun kartina donusturuldu.");
    } catch (error) {
      message.error(error?.message || "Urun karti olusturulamadi.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (status, shouldDownloadPdf = false) => {
    try {
      setLoading(true);
      if (!deliveryLines.length) {
        showCenteredWarning("Urun listesi bos olamaz.");
        return;
      }
      const values = await form.validateFields();
      const payload = {
        ...values,
        supplierId: targetSupplierId,
        supplierName: supplier?.company || "",
        contactName: supplier?.contact || "",
        supplierEmail: supplier?.email || authUser?.email || "",
        status,
        createdBy: authUser?.id || null,
      };

      let savedRecord;
      if (isEditMode) {
        savedRecord = await requestJson("PUT", `/api/delivery-lists/${deliveryId}`, payload);
        savedRecord = savedRecord?.item || savedRecord;
      } else {
        savedRecord = await requestJson("POST", "/api/delivery-lists", { ...payload, lines: deliveryLines });
        savedRecord = savedRecord?.item || savedRecord;
      }

      if (shouldDownloadPdf || status === "Onay Bekleniyor") {
        await createDeliveryPdf(savedRecord);
      }
      message.success(status === "Onay Bekleniyor" ? "Teslimat onaya gonderildi." : "Teslimat kaydedildi.");
      navigate(isAdminView ? `/supplier-portal/delivery-lists/${savedRecord.id}` : `/supplier/deliveries/${savedRecord.id}`);
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error?.message || "Teslimat kaydedilirken hata olustu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>{isAdminView ? "Teslimat Formu" : "Teslimat Olustur"}</Title>
          <Text type="secondary">{isAdminView ? "Tedarikciden gelen teslimat satirlarini inceleyin, yeni urun adaylarini urun kartina donusturun." : "Teslimat genel bilgilerini doldurun, urunleri ekleyin ve hazir oldugunda satin alma birimine gonderin."}</Text>
        </div>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => handleSave(form.getFieldValue("status") || "Taslak", true)} loading={loading}>
            PDF Olarak Indir
          </Button>
          {isAdminView ? (
            <>
              <Button onClick={() => handleSave(form.getFieldValue("status") || currentStatus || "Taslak")} loading={loading}>
                Guncelle
              </Button>
              <Button onClick={() => navigate("/supplier-portal/delivery-lists")}>Listeye Don</Button>
            </>
          ) : (
            <>
              <Button onClick={() => handleSave("Taslak")} loading={loading} disabled={isDeliveryLocked}>
                Taslak Kaydet
              </Button>
              <Button type="primary" onClick={() => handleSave("Onay Bekleniyor")} loading={loading} disabled={isDeliveryLocked}>
                Onaya Gonder
              </Button>
            </>
          )}
        </Space>
      </div>

      {!isAdminView && isDeliveryLocked ? (
        <Card
          size="small"
          style={{
            borderColor: "#ffe0b2",
            background: "#fff7e8",
          }}
        >
          <Text strong style={{ color: "#ad6800" }}>
            Bu teslimat sadece goruntuleme modundadir. Yalnizca Taslak ve Revizyon Istendi durumlarinda duzenleme yapilabilir.
          </Text>
        </Card>
      ) : null}

      <Form form={form} layout="vertical">
        <Form.Item name="status" hidden>
          <Input />
        </Form.Item>
        <Card
          title="Teslimat Genel Bilgiler"
          className="erp-card-logo-divider"
          loading={pageLoading}
          extra={(
            <Button
              type="text"
              icon={generalInfoOpen ? <DownOutlined /> : <RightOutlined />}
              onClick={() => setGeneralInfoOpen((current) => !current)}
            />
          )}
        >
          {generalInfoOpen ? (
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12} xl={6}><Form.Item name="deliveryNo" label="Teslimat Kodu"><Input disabled /></Form.Item></Col>
            <Col xs={24} md={12} xl={6}><Form.Item name="supplierName" label="Firma"><Input disabled /></Form.Item></Col>
            <Col xs={24} md={12} xl={6}><Form.Item name="contactName" label="Yetkili Kisi"><Input disabled /></Form.Item></Col>
            <Col xs={24} md={12} xl={6}><Form.Item name="supplierEmail" label="E-posta"><Input disabled /></Form.Item></Col>
            <Col xs={24} md={12} xl={6}><Form.Item name="date" label="Tarih" rules={[{ required: true, message: "Tarih zorunludur." }]}><Input type="date" disabled={isDeliveryLocked} /></Form.Item></Col>
            <Col xs={24} md={12} xl={6}><Form.Item name="status" label="Durum"><Input disabled /></Form.Item></Col>
            <Col xs={24} md={12} xl={6}><Form.Item name="shippingMethod" label="Gonderim Sekli"><Select disabled={isDeliveryLocked} options={["Kargo", "Elden Teslim"].map((value) => ({ value, label: value }))} /></Form.Item></Col>
            <Col xs={24} md={12} xl={6}><Form.Item name="trackingNo" label="Takip Kodu"><Input placeholder="Takip kodu" disabled={isDeliveryLocked} /></Form.Item></Col>
          </Row>
          ) : null}
        </Card>

        <Card title="Urun Listesi" className="erp-card-logo-divider" bodyStyle={{ paddingTop: 16 }} style={{ marginTop: 12 }}>
          {!isDeliveryLocked ? (
          <Card size="small" title="Urun Ekleme" style={{ marginBottom: 12 }}>
            <Row gutter={[12, 12]} align="bottom" className="erp-delivery-draft-grid">
              <Col xs={24} xl={6} className="erp-delivery-draft-name">
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontWeight: 500 }}>Urun Adi</div>
                  <AutoComplete
                    value={lineDraft.name}
                    options={productOptions.map((item) => ({ value: item.label, label: item.label, productId: item.value }))}
                    placeholder="Liste secin veya manuel urun adi yazin"
                    style={{ minWidth: 240, width: "100%" }}
                    disabled={isDeliveryLocked}
                    filterOption={(inputValue, option) => (option?.value || "").toLowerCase().includes(inputValue.toLowerCase())}
                    onSelect={(_, option) => {
                      if (option?.productId) {
                        handleDraftProductSelect(option.productId);
                      }
                    }}
                    onChange={(value) => {
                      setLineDraft((current) => ({
                        ...current,
                        productId: undefined,
                        name: value,
                      }));
                    }}
                  />
                </div>
              </Col>
              <Col xs={24} xl={4} className="erp-delivery-draft-code">
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Urun Kodu</div>
                <Input disabled={isDeliveryLocked || Boolean(lineDraft.productId)} value={lineDraft.code} onChange={(event) => setLineDraft((current) => ({ ...current, code: event.target.value }))} />
              </Col>
              <Col xs={12} xl={3}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Satis Fiyati</div>
                <InputNumber disabled={isDeliveryLocked || Boolean(lineDraft.productId)} style={{ width: "100%" }} min={0} value={lineDraft.salePrice} onChange={(value) => setLineDraft((current) => ({ ...current, salePrice: value || 0 }))} addonAfter="TRY" />
              </Col>
              <Col xs={12} xl={3}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Teslim Adedi</div>
                <InputNumber disabled={isDeliveryLocked} style={{ width: "100%" }} min={1} value={lineDraft.quantity} onChange={(value) => setLineDraft((current) => ({ ...current, quantity: value || 1 }))} />
              </Col>
              <Col xs={24} xl={6}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Gorsel</div>
                <Space.Compact style={{ width: "100%" }}>
                  <Button onClick={() => lineDraftInputRef.current?.click()} disabled={isDeliveryLocked}>Kamera</Button>
                  <Button onClick={() => lineDraftGalleryInputRef.current?.click()} disabled={isDeliveryLocked}>Galeri</Button>
                  <Input value={lineDraft.image ? "Gorsel eklendi" : ""} placeholder="Gorsel gerekli" readOnly />
                </Space.Compact>
                <input
                  ref={lineDraftInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    handleDraftImageUpload(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <input
                  ref={lineDraftGalleryInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    handleDraftImageUpload(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </Col>
              <Col xs={24} xl={2}>
                <Button type="primary" block onClick={handleAddLine} disabled={isDeliveryLocked} style={{ marginTop: 30 }}>
                  Ekle
                </Button>
              </Col>
            </Row>
          </Card>
          ) : null}

          <div className="erp-delivery-lines-table-wrap">
            <Table
              className="erp-delivery-lines-table"
              rowKey={(record, index) => record.id || `delivery-line-${index}`}
              pagination={false}
              dataSource={watchedLines.map((item, index) => ({ ...item, _rowIndex: index, totalAmount: Number(item.salePrice || 0) * Number(item.quantity || 0) }))}
              scroll={{ x: 1180 }}
              columns={[
              {
                title: "Gorsel",
                dataIndex: "image",
                key: "image",
                width: 90,
                render: (value) => <img src={value || "/products/baroque-necklace.svg"} alt="Urun" className="erp-delivery-line-image" />,
              },
              { title: "Urun Kodu", dataIndex: "code", key: "code", width: 140 },
              {
                title: "Urun Adi",
                dataIndex: "name",
                key: "name",
                width: 220,
                render: (_, record) => <Text strong>{record.name}</Text>,
              },
              {
                title: "Satis Fiyati",
                dataIndex: "salePrice",
                key: "salePrice",
                width: 140,
                render: (value) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(value || 0)),
              },
              { title: "Teslim Adet", dataIndex: "quantity", key: "quantity", width: 110 },
              {
                title: "Toplam Tutar",
                dataIndex: "totalAmount",
                key: "totalAmount",
                width: 150,
                render: (value) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(value || 0)),
              },
              {
                title: "Islemler",
                key: "actions",
                width: isAdminView ? 260 : 150,
                render: (_, record) => (
                  <Space size={4}>
                    <Tooltip title="Duzenle">
                      <Button size="small" className="erp-icon-btn erp-icon-btn-view" icon={<EditOutlined />} onClick={() => openEditDrawer(record._rowIndex)} disabled={isDeliveryLocked && !isAdminView} />
                    </Tooltip>
                    {isAdminView && record.isNewProduct && !record.productId ? (
                      <Tooltip title="Urun Olarak Ekle">
                        <Button size="small" className="erp-icon-btn erp-icon-btn-approve" icon={<PlusCircleOutlined />} onClick={() => openPromoteDrawer(record._rowIndex)} />
                      </Tooltip>
                    ) : null}
                    {!isDeliveryLocked ? (
                      <Tooltip title="Sil">
                        <Button size="small" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} onClick={() => handleDeleteLine(record._rowIndex, record.id)} disabled={isDeliveryLocked} />
                      </Tooltip>
                    ) : null}
                  </Space>
                ),
              },
              ]}
              summary={() => (
                <Table.Summary>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={5}>
                      <Text strong>Alt Toplam</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5}>
                      <Text strong>{new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(totalAmount)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6} />
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </div>
        </Card>
      </Form>

      <Drawer
        title="Teslimat Satiri Duzenle"
        placement="right"
        width={440}
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditIndex(null);
          setEditLine(null);
        }}
      >
        {editLine ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div className="erp-product-preview" style={{ minHeight: 220 }} onClick={() => (!isDeliveryLocked || isAdminView) && editImageInputRef.current?.click()} role="button" tabIndex={0}>
              <img src={editLine.image || "/products/baroque-necklace.svg"} alt="Urun gorseli" className="erp-product-image-large" />
            </div>
            <input
              ref={editImageInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(event) => {
                handleEditImageUpload(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <Button onClick={() => editImageInputRef.current?.click()} disabled={isDeliveryLocked && !isAdminView}>Gorsel Degistir</Button>
            <div>
              <Text strong>Urun Adi</Text>
              <Input disabled value={editLine.name} />
            </div>
            <div>
              <Text strong>Urun Kodu</Text>
              <Input disabled value={editLine.code} />
            </div>
            <Row gutter={12}>
              <Col span={12}>
                <Text strong>Satis Fiyati</Text>
                <InputNumber disabled style={{ width: "100%" }} min={0} value={editLine.salePrice} addonAfter="TRY" />
              </Col>
              <Col span={12}>
                <Text strong>Teslim Adedi</Text>
                <InputNumber disabled={isDeliveryLocked && !isAdminView} style={{ width: "100%" }} min={1} value={editLine.quantity} onChange={(value) => setEditLine((current) => ({ ...current, quantity: value || 1 }))} />
              </Col>
            </Row>
            <div>
              <Text strong>Aciklama</Text>
              <Input.TextArea disabled={isDeliveryLocked && !isAdminView} rows={4} value={editLine.description} onChange={(event) => setEditLine((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <Space style={{ justifyContent: "flex-end", width: "100%" }}>
              <Button onClick={() => setEditOpen(false)}>Vazgec</Button>
              {isAdminView && promoteMode && editLine.isNewProduct && !editLine.productId ? (
                <Button type="primary" loading={loading} onClick={() => void handlePromoteLineToProduct()}>Urun Olarak Kaydet</Button>
              ) : (
                <Button type="primary" onClick={handleSaveEditLine} disabled={isDeliveryLocked && !isAdminView}>Guncelle</Button>
              )}
            </Space>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}



