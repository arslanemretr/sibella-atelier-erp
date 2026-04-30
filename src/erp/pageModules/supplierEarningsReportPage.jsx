import React from "react";
import dayjs from "dayjs";
import { Button, Card, Col, DatePicker, Descriptions, Form, Input, InputNumber, Row, Select, Space, Switch, Table, Tag, Typography, message } from "antd";
import { EyeOutlined, MailOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { listContractsFresh } from "../contractsData";
import { listEarningsRecordsFresh } from "../earningsData";
import { listPosSalesFresh, listPosReturnsFresh } from "../posData";
import { listProductsFresh } from "../productsData";
import { getReportSchedule, sendSupplierEarningsReportNow, updateReportSchedule } from "../reportsData";
import {
  addSupplierMonths,
  buildSupplierEarningsSummary,
  buildSupplierStatusMessage,
  formatSupplierDateShort,
  formatSupplierPeriodLabel,
  formatSupplierReportMoney,
  getDefaultSupplierEarningsPeriod,
  getSupplierDateFromMonthKey,
  getSupplierMonthKey,
  SUPPLIER_EARNINGS_STATUS_META,
} from "../supplierEarningsReportUtils";
import { listSuppliersFresh } from "../suppliersData";

const { Title, Text } = Typography;
const REPORT_KEY = "supplier-earnings";

const periodOffsetOptions = [
  { value: 0, label: "Ayni ay" },
  { value: -1, label: "Bir onceki ay" },
  { value: -2, label: "Iki ay once" },
  { value: -3, label: "Uc ay once" },
];

const availableVariables = [
  "{{supplierName}}",
  "{{periodLabel}}",
  "{{generatedAt}}",
  "{{grossTotal}}",
  "{{returnTotal}}",
  "{{netSalesTotal}}",
  "{{commissionRate}}",
  "{{commissionTotal}}",
  "{{earningsTotal}}",
  "{{status}}",
  "{{statusMessage}}",
  "{{invoiceNo}}",
  "{{invoiceDate}}",
  "{{paymentDueDate}}",
  "{{paymentDate}}",
  "{{detailRowsHtml}}",
  "{{logoUrl}}",
];

function parseEmailList(value) {
  return String(value || "")
    .split(/[\n,;]+/)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function renderTemplateString(template, context) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = context?.[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function htmlToPlainText(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n\s+\n/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function buildDetailRowsHtml(rows) {
  if (!rows.length) {
    return `
      <tr>
        <td colspan="6" style="padding:18px 14px;border-bottom:1px solid #f0e5e0;color:#8c7a76;text-align:center;">
          Secili donem icin satis detayi bulunamadi.
        </td>
      </tr>
    `.trim();
  }

  return rows.map((row) => `
    <tr>
      <td style="padding:14px 16px;border-bottom:1px solid #f0e5e0;">
        <div style="font-weight:700;color:#4a342f;">${row.productName}</div>
        <div style="margin-top:4px;font-size:12px;color:#8c7a76;">${row.productCode}</div>
      </td>
      <td style="padding:14px 16px;border-bottom:1px solid #f0e5e0;text-align:right;">${row.salesQuantity}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #f0e5e0;text-align:right;">${row.returnQuantity}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #f0e5e0;text-align:right;">${row.netQuantity}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #f0e5e0;text-align:right;">${formatSupplierReportMoney(row.salesAmount)}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #f0e5e0;text-align:right;font-weight:700;color:#2f7d46;">${formatSupplierReportMoney(row.netAmount)}</td>
    </tr>
  `).join("");
}

function buildSupplierReportContext({ supplier, summary }) {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";

  return {
    supplierName: supplier?.company || "-",
    periodLabel: summary?.periodLabel || "-",
    generatedAt: new Date().toLocaleString("tr-TR"),
    grossTotal: formatSupplierReportMoney(summary?.grossTotal || 0),
    returnTotal: formatSupplierReportMoney(summary?.returnTotal || 0),
    netSalesTotal: formatSupplierReportMoney(summary?.netSalesTotal || 0),
    commissionRate: `%${Number(summary?.commissionRate || 0).toFixed(2)}`,
    commissionTotal: formatSupplierReportMoney(summary?.commissionTotal || 0),
    earningsTotal: formatSupplierReportMoney(summary?.earningsTotal || 0),
    status: summary?.status || "-",
    statusMessage: buildSupplierStatusMessage(summary),
    invoiceNo: summary?.invoiceNo || "-",
    invoiceDate: formatSupplierDateShort(summary?.invoiceDate),
    paymentDueDate: formatSupplierDateShort(summary?.paymentDueDate),
    paymentDate: formatSupplierDateShort(summary?.paymentDate),
    detailRowsHtml: buildDetailRowsHtml(summary?.detailRows || []),
    logoUrl: origin ? `${origin}/pdf-logo.png` : "/pdf-logo.png",
  };
}

function formatScheduleSummary(values) {
  if (!values?.enabled) {
    return "Pasif";
  }
  const hour = String(values.sendHour ?? 0).padStart(2, "0");
  const minute = String(values.sendMinute ?? 0).padStart(2, "0");
  return `Her ayin ${values.dayOfMonth}. gunu saat ${hour}:${minute}`;
}

function formatPeriodOffsetLabel(offset) {
  if (offset === 0) {
    return "Ayni ay";
  }
  if (offset === -1) {
    return "Bir onceki ay";
  }
  return `${Math.abs(Number(offset || 0))} ay once`;
}

export default function SupplierEarningsReportPage() {
  const [form] = Form.useForm();
  const [pageLoading, setPageLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [schedule, setSchedule] = React.useState(null);
  const [suppliers, setSuppliers] = React.useState([]);
  const [products, setProducts] = React.useState([]);
  const [sales, setSales] = React.useState([]);
  const [returns, setReturns] = React.useState([]);
  const [contracts, setContracts] = React.useState([]);
  const [earningsRecords, setEarningsRecords] = React.useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = React.useState(null);
  const [previewMonth, setPreviewMonth] = React.useState(() => dayjs(getDefaultSupplierEarningsPeriod()));

  const watchedSubjectTemplate = Form.useWatch("subjectTemplate", form);
  const watchedHtmlTemplate = Form.useWatch("htmlTemplate", form);

  const refresh = React.useCallback(async () => {
    try {
      setPageLoading(true);
      const [{ item }, nextSuppliers, nextProducts, nextSales, nextReturns, nextContracts, nextRecords] = await Promise.all([
        getReportSchedule(REPORT_KEY),
        listSuppliersFresh(),
        listProductsFresh(),
        listPosSalesFresh(),
        listPosReturnsFresh(),
        listContractsFresh(),
        listEarningsRecordsFresh(),
      ]);

      setSchedule(item);
      setSuppliers(nextSuppliers);
      setProducts(nextProducts);
      setSales(nextSales);
      setReturns(nextReturns);
      setContracts(nextContracts);
      setEarningsRecords(nextRecords);
      setSelectedSupplierId((current) => current || nextSuppliers.find((item) => item.status === "Aktif" && item.email)?.id || nextSuppliers[0]?.id || null);

      form.setFieldsValue({
        enabled: Boolean(item?.enabled),
        dayOfMonth: Number(item?.dayOfMonth || 2),
        sendHour: Number(item?.sendHour ?? 9),
        sendMinute: Number(item?.sendMinute ?? 0),
        periodOffsetMonths: Number(item?.periodOffsetMonths ?? -1),
        subjectTemplate: item?.subjectTemplate || "",
        htmlTemplate: item?.htmlTemplate || "",
      });
    } catch (error) {
      message.error(error?.message || "Tedarikci hakedis raporu verileri yuklenemedi.");
    } finally {
      setPageLoading(false);
    }
  }, [form]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedSupplier = React.useMemo(
    () => suppliers.find((item) => item.id === selectedSupplierId) || null,
    [suppliers, selectedSupplierId],
  );

  const earningsRecordMap = React.useMemo(
    () => new Map((earningsRecords || []).filter((item) => item.supplierId === selectedSupplierId).map((item) => [item.periodKey, item])),
    [earningsRecords, selectedSupplierId],
  );

  const previewPeriodDate = React.useMemo(
    () => (previewMonth ? previewMonth.toDate() : getSupplierDateFromMonthKey(getSupplierMonthKey(getDefaultSupplierEarningsPeriod()))),
    [previewMonth],
  );

  const currentSummary = React.useMemo(
    () => buildSupplierEarningsSummary({
      periodDate: previewPeriodDate,
      products,
      sales,
      returns,
      contracts,
      supplierId: selectedSupplierId,
      earningsRecord: earningsRecordMap.get(getSupplierMonthKey(previewPeriodDate)) || null,
    }),
    [contracts, earningsRecordMap, previewPeriodDate, products, returns, sales, selectedSupplierId],
  );

  const reportContext = React.useMemo(
    () => buildSupplierReportContext({ supplier: selectedSupplier, summary: currentSummary }),
    [selectedSupplier, currentSummary],
  );

  const renderedSubject = React.useMemo(
    () => renderTemplateString(watchedSubjectTemplate || schedule?.subjectTemplate || "", reportContext),
    [watchedSubjectTemplate, schedule?.subjectTemplate, reportContext],
  );

  const renderedHtml = React.useMemo(
    () => renderTemplateString(watchedHtmlTemplate || schedule?.htmlTemplate || "", reportContext),
    [watchedHtmlTemplate, schedule?.htmlTemplate, reportContext],
  );

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const saved = await updateReportSchedule(REPORT_KEY, values);
      setSchedule(saved);
      form.setFieldsValue({
        enabled: Boolean(saved?.enabled),
        dayOfMonth: Number(saved?.dayOfMonth || 2),
        sendHour: Number(saved?.sendHour ?? 9),
        sendMinute: Number(saved?.sendMinute ?? 0),
        periodOffsetMonths: Number(saved?.periodOffsetMonths ?? -1),
        subjectTemplate: saved?.subjectTemplate || "",
        htmlTemplate: saved?.htmlTemplate || "",
      });
      message.success("Tedarikci hakedis raporu ayarlari kaydedildi.");
    } catch (error) {
      if (!error?.errorFields) {
        message.error(error?.message || "Rapor ayarlari kaydedilemedi.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async () => {
    try {
      const values = await form.validateFields();
      if (!selectedSupplier?.email) {
        message.warning("Secili tedarikcinin sistemde tanimli bir e-posta adresi bulunmuyor.");
        return;
      }
      if (!currentSummary?.detailRows?.length && !Number(currentSummary?.earningsTotal || 0)) {
        message.warning("Secili tedarikci ve donem icin gonderilecek rapor verisi bulunamadi.");
        return;
      }

      setSending(true);
      const payload = await sendSupplierEarningsReportNow({
        toEmails: [selectedSupplier.email],
        supplierId: selectedSupplier.id,
        subject: renderTemplateString(values.subjectTemplate, reportContext),
        htmlBody: renderedHtml,
        textBody: htmlToPlainText(renderedHtml),
        periodKey: currentSummary.periodKey,
      });
      message.success(payload?.message || "Tedarikci hakedis raporu gonderildi.");
    } catch (error) {
      if (!error?.errorFields) {
        message.error(error?.message || "Tedarikci hakedis raporu gonderilemedi.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Form form={form} layout="vertical">
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <Title level={3} style={{ marginBottom: 6 }}>Tedarikci Hakedis Raporu</Title>
            <Text type="secondary">
              Bu ekran, <strong>supplier/earnings</strong> gorunumundeki raporun tedarikcilere gidecek mail tasarimini yonetir. Otomatikte her tedarikciye kendi ozet bilgisi gidecek; <strong>Simdi Gonder</strong> secili tedarikciye test amaclidir.
            </Text>
          </div>
          <Space wrap>
            <Button icon={<ReloadOutlined />} loading={pageLoading} onClick={() => void refresh()}>
              Yenile
            </Button>
            <Button icon={<MailOutlined />} loading={sending} onClick={() => void handleSendNow()}>
              Simdi Gonder
            </Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void handleSave()}>
              Ayarlari Kaydet
            </Button>
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={14}>
            <Card bordered={false} className="erp-list-toolbar-card" title="Rapor Plani">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Form.Item label="Rapor Durumu" name="enabled" valuePropName="checked">
                    <Switch checkedChildren="Aktif" unCheckedChildren="Pasif" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Rapor Donemi" name="periodOffsetMonths">
                    <Select options={periodOffsetOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Ayin Kacinci Gunu" name="dayOfMonth" rules={[{ required: true, message: "Gonderim gununu girin." }]}>
                    <InputNumber min={1} max={31} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Saat" name="sendHour" rules={[{ required: true, message: "Saat bilgisini girin." }]}>
                    <InputNumber min={0} max={23} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Dakika" name="sendMinute" rules={[{ required: true, message: "Dakika bilgisini girin." }]}>
                    <InputNumber min={0} max={59} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    label="Mail Konu Sabonu"
                    name="subjectTemplate"
                    extra="Kullanilabilir degiskenler: {{supplierName}}, {{periodLabel}}, {{earningsTotal}}, {{status}}"
                    rules={[{ required: true, message: "Mail konu sablonunu girin." }]}
                  >
                    <Input placeholder="Hakedis Raporunuz - {{supplierName}} - {{periodLabel}}" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} xl={10}>
            <Card bordered={false} className="erp-list-toolbar-card" title="Plan Ozeti">
              <Descriptions column={1} size="small" labelStyle={{ width: 170 }}>
                <Descriptions.Item label="Kaynak ekran">supplier/earnings</Descriptions.Item>
                <Descriptions.Item label="Calisma ritmi">{formatScheduleSummary(schedule || form.getFieldsValue(true))}</Descriptions.Item>
                <Descriptions.Item label="Rapor kapsami">{formatPeriodOffsetLabel(Number(schedule?.periodOffsetMonths ?? form.getFieldValue("periodOffsetMonths") ?? -1))}</Descriptions.Item>
                <Descriptions.Item label="Alici modeli">Sistemdeki tedarikci e-postalari</Descriptions.Item>
                <Descriptions.Item label="Secili tedarikci">{selectedSupplier?.company || "-"}</Descriptions.Item>
                <Descriptions.Item label="Secili mail">{selectedSupplier?.email || "-"}</Descriptions.Item>
                <Descriptions.Item label="Son durum">{schedule?.lastRunStatus || "Henuz calismadi"}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Card bordered={false} className="erp-list-toolbar-card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <Title level={5} style={{ margin: 0 }}>Preview Secimi</Title>
              <Text type="secondary">Tasarimi secili tedarikci ve doneme gore canli gorun.</Text>
            </div>
            <Space wrap>
              <Select
                showSearch
                style={{ width: 280 }}
                value={selectedSupplierId}
                options={suppliers.map((item) => ({
                  value: item.id,
                  label: `${item.company}${item.email ? ` - ${item.email}` : ""}`,
                }))}
                onChange={setSelectedSupplierId}
                placeholder="Tedarikci secin"
                optionFilterProp="label"
              />
              <DatePicker
                picker="month"
                value={previewMonth}
                allowClear={false}
                format="MMMM YYYY"
                onChange={(value) => {
                  if (value) {
                    setPreviewMonth(value.startOf("month"));
                  }
                }}
              />
              <Button icon={<EyeOutlined />} onClick={() => void refresh()}>
                Onizlemeyi Guncelle
              </Button>
            </Space>
          </div>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={13}>
            <Card bordered={false} className="erp-list-toolbar-card" title="HTML Editor">
              <Form.Item
                label="Mail HTML Sablonu"
                name="htmlTemplate"
                extra={`Degiskenler: ${availableVariables.join(", ")}`}
                rules={[{ required: true, message: "Mail HTML sablonunu girin." }]}
              >
                <Input.TextArea
                  rows={24}
                  spellCheck={false}
                  style={{
                    fontFamily: "Consolas, 'Courier New', monospace",
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} xl={11}>
            <Card bordered={false} className="erp-list-toolbar-card" title="Canli Mail Onizlemesi">
              <div style={{ border: "1px solid #eadfd9", borderRadius: 16, overflow: "hidden", background: "#ffffff" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0e5e0", background: "#fff8f5" }}>
                  <div style={{ fontSize: 12, color: "#8c7a76", textTransform: "uppercase", letterSpacing: "0.08em" }}>Konu</div>
                  <div style={{ marginTop: 6, fontWeight: 700, color: "#3f2e2a" }}>{renderedSubject || "-"}</div>
                </div>
                <div style={{ maxHeight: 720, overflow: "auto", background: "#f5f5f5", padding: 18 }}>
                  <div
                    style={{
                      maxWidth: 780,
                      margin: "0 auto",
                      background: "#ffffff",
                      borderRadius: 18,
                      overflow: "hidden",
                      boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
                    }}
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  />
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered={false} style={{ background: "#fff8ea", border: "1px solid #f5dfb4" }}>
              <Text type="secondary" style={{ fontSize: 13 }}>Brut Satis</Text>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{formatSupplierReportMoney(currentSummary.grossTotal)}</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered={false} style={{ background: "#eef6ff", border: "1px solid #cde1f8" }}>
              <Text type="secondary" style={{ fontSize: 13 }}>Net Satis</Text>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{formatSupplierReportMoney(currentSummary.netSalesTotal)}</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered={false} style={{ background: "#fff4ef", border: "1px solid #f5d2c8" }}>
              <Text type="secondary" style={{ fontSize: 13 }}>Komisyon</Text>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{formatSupplierReportMoney(currentSummary.commissionTotal)}</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered={false} style={{ background: "#edf8ef", border: "1px solid #cde7d1" }}>
              <Text type="secondary" style={{ fontSize: 13 }}>Toplam Hakedis</Text>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{formatSupplierReportMoney(currentSummary.earningsTotal)}</div>
              <div style={{ marginTop: 8 }}>
                <Tag color={(SUPPLIER_EARNINGS_STATUS_META[currentSummary.status] || { color: "default" }).color}>{currentSummary.status}</Tag>
              </div>
            </Card>
          </Col>
        </Row>

        <Card bordered={false} className="erp-list-table-card" style={{ paddingBottom: 16 }}>
          <Table
            rowKey="key"
            loading={pageLoading}
            dataSource={currentSummary.detailRows}
            pagination={false}
            locale={{ emptyText: "Secili tedarikci ve donem icin satis bulunamadi." }}
            scroll={{ x: 980 }}
            columns={[
              { title: "Urun Kodu", dataIndex: "productCode", key: "productCode", width: 120 },
              { title: "Urun Adi", dataIndex: "productName", key: "productName", width: 220 },
              { title: "Satis Adet", dataIndex: "salesQuantity", key: "salesQuantity", width: 110, align: "right" },
              { title: "Iade", dataIndex: "returnQuantity", key: "returnQuantity", width: 90, align: "right" },
              { title: "Net Adet", dataIndex: "netQuantity", key: "netQuantity", width: 100, align: "right" },
              { title: "Satis Tutari", dataIndex: "salesAmount", key: "salesAmount", width: 140, align: "right", render: (value) => formatSupplierReportMoney(value) },
              { title: "Komisyon", dataIndex: "commissionAmount", key: "commissionAmount", width: 140, align: "right", render: (value) => formatSupplierReportMoney(value) },
              { title: "Hakedis", dataIndex: "netAmount", key: "netAmount", width: 140, align: "right", render: (value) => <Text strong>{formatSupplierReportMoney(value)}</Text> },
            ]}
          />
        </Card>
      </Space>
    </Form>
  );
}
