import React from "react";
import dayjs from "dayjs";
import { Button, Card, Col, DatePicker, Descriptions, Form, Input, InputNumber, Row, Select, Space, Switch, Table, Tag, Typography, message } from "antd";
import { EyeOutlined, MailOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { listContractsFresh } from "../contractsData";
import { listEarningsRecordsFresh } from "../earningsData";
import {
  buildAdminEarningsList,
  EARNINGS_STATUS_META,
  formatDate,
  formatMoney,
  formatPeriodLabel,
  getPreviousMonthPeriodKey,
  getThirdFridayAfterPeriodEnd,
} from "../earningsReportUtils";
import { listPosSalesFresh, listPosReturnsFresh } from "../posData";
import { listProductsFresh } from "../productsData";
import { getReportSchedule, sendConsolidatedEarningsReportNow, updateReportSchedule } from "../reportsData";
import { listSuppliersFresh } from "../suppliersData";

const { Title, Text } = Typography;
const REPORT_KEY = "consolidated-earnings";
const periodOffsetOptions = [
  { value: 0, label: "Ayni ay" },
  { value: -1, label: "Bir onceki ay" },
  { value: -2, label: "Iki ay once" },
  { value: -3, label: "Uc ay once" },
];

const availableVariables = [
  "{{periodLabel}}",
  "{{generatedAt}}",
  "{{supplierCount}}",
  "{{grossTotal}}",
  "{{netTotal}}",
  "{{commissionTotal}}",
  "{{earningsTotal}}",
  "{{reportRowsHtml}}",
  "{{logoUrl}}",
];

function getDefaultPreviewMonth() {
  return dayjs(`${getPreviousMonthPeriodKey()}-01`);
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

function buildReportRowsHtml(rows) {
  if (!rows.length) {
    return `
      <tr>
        <td colspan="6" style="padding:18px 14px;border-bottom:1px solid #f0e5e0;color:#8c7a76;text-align:center;">
          Secili donem icin raporlanacak veri bulunamadi.
        </td>
      </tr>
    `.trim();
  }

  return rows.map((row) => `
    <tr>
      <td style="padding:14px;border-bottom:1px solid #f0e5e0;">${row.supplierName}</td>
      <td style="padding:14px;border-bottom:1px solid #f0e5e0;">${row.periodLabel}</td>
      <td style="padding:14px;border-bottom:1px solid #f0e5e0;text-align:right;">${formatMoney(row.grossTotal)}</td>
      <td style="padding:14px;border-bottom:1px solid #f0e5e0;text-align:right;">${formatMoney(row.netTotal)}</td>
      <td style="padding:14px;border-bottom:1px solid #f0e5e0;text-align:right;">${formatMoney(Number(row.netTotal || 0) - Number(row.earningsTotal || 0))}</td>
      <td style="padding:14px;border-bottom:1px solid #f0e5e0;text-align:right;font-weight:700;color:#389e0d;">${formatMoney(row.earningsTotal)}</td>
    </tr>
  `).join("");
}

function buildReportContext({ previewRows, totals, previewPeriodKey }) {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";

  return {
    periodLabel: formatPeriodLabel(previewPeriodKey),
    generatedAt: new Date().toLocaleString("tr-TR"),
    supplierCount: previewRows.length,
    grossTotal: formatMoney(totals.grossTotal),
    netTotal: formatMoney(totals.netTotal),
    commissionTotal: formatMoney(totals.commissionTotal),
    earningsTotal: formatMoney(totals.earningsTotal),
    reportRowsHtml: buildReportRowsHtml(previewRows),
    logoUrl: origin ? `${origin}/pdf-logo.png` : "/pdf-logo.png",
  };
}

export default function ConsolidatedEarningsReportPage() {
  const [form] = Form.useForm();
  const [rows, setRows] = React.useState([]);
  const [pageLoading, setPageLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [schedule, setSchedule] = React.useState(null);
  const [previewMonth, setPreviewMonth] = React.useState(() => getDefaultPreviewMonth());

  const watchedRecipientEmails = Form.useWatch("recipientEmails", form);
  const watchedSubjectTemplate = Form.useWatch("subjectTemplate", form);
  const watchedHtmlTemplate = Form.useWatch("htmlTemplate", form);

  const refresh = React.useCallback(async () => {
    try {
      setPageLoading(true);
      const [{ item }, suppliers, products, sales, returns, contracts, earningsRecords] = await Promise.all([
        getReportSchedule(REPORT_KEY),
        listSuppliersFresh(),
        listProductsFresh(),
        listPosSalesFresh(),
        listPosReturnsFresh(),
        listContractsFresh(),
        listEarningsRecordsFresh(),
      ]);

      setSchedule(item);
      form.setFieldsValue({
        enabled: Boolean(item?.enabled),
        dayOfMonth: Number(item?.dayOfMonth || 2),
        sendHour: Number(item?.sendHour ?? 9),
        sendMinute: Number(item?.sendMinute ?? 0),
        periodOffsetMonths: Number(item?.periodOffsetMonths ?? -1),
        recipientEmails: item?.recipientEmails || "",
        subjectTemplate: item?.subjectTemplate || "",
        htmlTemplate: item?.htmlTemplate || "",
      });

      const nextRows = buildAdminEarningsList({ suppliers, products, sales, returns, contracts, earningsRecords });
      setRows(nextRows);
    } catch (error) {
      message.error(error?.message || "Toplu hakedis raporu verileri yuklenemedi.");
    } finally {
      setPageLoading(false);
    }
  }, [form]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const previewPeriodKey = previewMonth ? previewMonth.format("YYYY-MM") : getPreviousMonthPeriodKey();
  const previewRows = React.useMemo(
    () => rows.filter((row) => row.periodKey === previewPeriodKey),
    [rows, previewPeriodKey],
  );

  const totals = React.useMemo(() => ({
    grossTotal: previewRows.reduce((sum, row) => sum + Number(row.grossTotal || 0), 0),
    netTotal: previewRows.reduce((sum, row) => sum + Number(row.netTotal || 0), 0),
    commissionTotal: previewRows.reduce((sum, row) => sum + (Number(row.netTotal || 0) - Number(row.earningsTotal || 0)), 0),
    earningsTotal: previewRows.reduce((sum, row) => sum + Number(row.earningsTotal || 0), 0),
  }), [previewRows]);

  const reportContext = React.useMemo(
    () => buildReportContext({ previewRows, totals, previewPeriodKey }),
    [previewRows, totals, previewPeriodKey],
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
        recipientEmails: saved?.recipientEmails || "",
        subjectTemplate: saved?.subjectTemplate || "",
        htmlTemplate: saved?.htmlTemplate || "",
      });
      message.success("Toplu hakedis raporu ayarlari kaydedildi.");
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      message.error(error?.message || "Rapor ayarlari kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async () => {
    try {
      const values = await form.validateFields();
      const toEmails = parseEmailList(values.recipientEmails);
      if (!previewRows.length) {
        message.warning("Secili donem icin gonderilecek rapor verisi bulunamadi.");
        return;
      }
      if (!renderedHtml.trim()) {
        message.warning("Mail HTML sablonu bos olamaz.");
        return;
      }

      setSending(true);
      const payload = await sendConsolidatedEarningsReportNow({
        toEmails,
        subject: renderTemplateString(values.subjectTemplate, reportContext),
        htmlBody: renderedHtml,
        textBody: htmlToPlainText(renderedHtml),
        periodKey: previewPeriodKey,
      });
      message.success(payload?.message || "Toplu hakedis raporu gonderildi.");
    } catch (error) {
      if (!error?.errorFields) {
        message.error(error?.message || "Toplu hakedis raporu gonderilemedi.");
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
            <Title level={3} style={{ marginBottom: 6 }}>Toplu Hakedis Raporu</Title>
            <Text type="secondary">
              Bu ekran, <strong>supplier-portal/earnings</strong> gorunumundeki donemsel toplamlari secilen periyotta belirlediginiz mail adreslerine gonderecek raporun ayarlarini ve mail tasarimini yonetir.
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
                  <Form.Item
                    label="Ayin Kacinci Gunu"
                    name="dayOfMonth"
                    rules={[{ required: true, message: "Gonderim gununu girin." }]}
                  >
                    <InputNumber min={1} max={31} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Saat"
                    name="sendHour"
                    rules={[{ required: true, message: "Saat bilgisini girin." }]}
                  >
                    <InputNumber min={0} max={23} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Dakika"
                    name="sendMinute"
                    rules={[{ required: true, message: "Dakika bilgisini girin." }]}
                  >
                    <InputNumber min={0} max={59} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    label="Alici Mail Adresleri"
                    name="recipientEmails"
                    extra="Birden fazla adresi virgul veya alt satir ile ayirabilirsiniz."
                    rules={[{ required: true, message: "En az bir mail adresi girin." }]}
                  >
                    <Input.TextArea rows={4} placeholder="ornek@sibella.com, muhasebe@sibella.com" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    label="Mail Konu Sabonu"
                    name="subjectTemplate"
                    extra="Kullanilabilir degiskenler: {{periodLabel}}, {{supplierCount}}, {{grossTotal}}, {{earningsTotal}}"
                    rules={[{ required: true, message: "Mail konu sablonunu girin." }]}
                  >
                    <Input placeholder="Toplu Hakedis Raporu - {{periodLabel}}" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} xl={10}>
            <Card bordered={false} className="erp-list-toolbar-card" title="Plan Ozeti">
              <Descriptions column={1} size="small" labelStyle={{ width: 170 }}>
                <Descriptions.Item label="Kaynak ekran">supplier-portal/earnings</Descriptions.Item>
                <Descriptions.Item label="Calisma ritmi">{formatScheduleSummary(schedule || form.getFieldsValue(true))}</Descriptions.Item>
                <Descriptions.Item label="Rapor kapsami">{formatPeriodOffsetLabel(Number(schedule?.periodOffsetMonths ?? form.getFieldValue("periodOffsetMonths") ?? -1))}</Descriptions.Item>
                <Descriptions.Item label="Onizleme donemi">{formatPeriodLabel(previewPeriodKey)}</Descriptions.Item>
                <Descriptions.Item label="Alici sayisi">{parseEmailList(watchedRecipientEmails).length || 0}</Descriptions.Item>
                <Descriptions.Item label="Son durum">{schedule?.lastRunStatus || "Henuz calismadi"}</Descriptions.Item>
                <Descriptions.Item label="Son calisma">{schedule?.lastRunAt ? formatDate(new Date(schedule.lastRunAt)) : "-"}</Descriptions.Item>
                <Descriptions.Item label="Son guncelleme">{schedule?.updatedAt ? formatDate(new Date(schedule.updatedAt)) : "-"}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Card bordered={false} className="erp-list-toolbar-card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <Title level={5} style={{ margin: 0 }}>Mail Tasarimi</Title>
              <Text type="secondary">HTML editorunde sablonu duzenleyin; sag tarafta mailin aliciya nasil gidecegini birebir gorun.</Text>
            </div>
            <Space>
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
            <Card bordered={false} style={{ background: "#fff7e6", border: "1px solid #ffd591" }}>
              <Text type="secondary" style={{ fontSize: 13 }}>Toplam Satis</Text>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{formatMoney(totals.grossTotal)}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>{formatPeriodLabel(previewPeriodKey)} donemi</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered={false} style={{ background: "#f0f5ff", border: "1px solid #adc6ff" }}>
              <Text type="secondary" style={{ fontSize: 13 }}>Net Satis</Text>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{formatMoney(totals.netTotal)}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>Iade dusulmus toplam</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered={false} style={{ background: "#fff1f0", border: "1px solid #ffa39e" }}>
              <Text type="secondary" style={{ fontSize: 13 }}>Komisyon</Text>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{formatMoney(totals.commissionTotal)}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>Kesilecek toplam tutar</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered={false} style={{ background: "#f6ffed", border: "1px solid #b7eb8f" }}>
              <Text type="secondary" style={{ fontSize: 13 }}>Toplam Hakedis</Text>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{formatMoney(totals.earningsTotal)}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>Tedarikcilere dagilacak toplam</Text>
            </Card>
          </Col>
        </Row>

        <Card bordered={false} className="erp-list-table-card" style={{ paddingBottom: 16 }}>
          <Table
            rowKey="key"
            loading={pageLoading}
            dataSource={previewRows}
            pagination={false}
            locale={{ emptyText: "Secili donem icin raporlanacak hakedis satiri bulunamadi." }}
            scroll={{ x: 1080 }}
            columns={[
              { title: "Tedarikci", dataIndex: "supplierName", key: "supplierName", width: 220 },
              { title: "Donem", dataIndex: "periodLabel", key: "periodLabel", width: 150 },
              { title: "Toplam Satis", dataIndex: "grossTotal", key: "grossTotal", width: 150, render: (value) => formatMoney(value) },
              { title: "Iade", dataIndex: "returnTotal", key: "returnTotal", width: 140, render: (value) => (value ? <span style={{ color: "#cf1322" }}>-{formatMoney(value)}</span> : "-") },
              { title: "Net Satis", dataIndex: "netTotal", key: "netTotal", width: 150, render: (value) => formatMoney(value) },
              { title: "Komisyon", key: "commissionAmount", width: 150, render: (_, row) => formatMoney(Number(row.netTotal || 0) - Number(row.earningsTotal || 0)) },
              { title: "Hakedis", dataIndex: "earningsTotal", key: "earningsTotal", width: 150, render: (value) => formatMoney(value) },
              {
                title: "Odeme Son Tarihi",
                key: "paymentDeadline",
                width: 170,
                render: (_, row) => <Text type="secondary">{formatDate(getThirdFridayAfterPeriodEnd(row.periodKey))}</Text>,
              },
              {
                title: "Durum",
                dataIndex: "status",
                key: "status",
                width: 150,
                render: (value) => {
                  const meta = EARNINGS_STATUS_META[value] || { color: "default" };
                  return <Tag color={meta.color}>{value}</Tag>;
                },
              },
            ]}
          />
        </Card>
      </Space>
    </Form>
  );
}
