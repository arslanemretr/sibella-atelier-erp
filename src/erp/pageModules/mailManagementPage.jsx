import React from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { requestJson } from "../apiClient";
import {
  createEmailScenario,
  createEmailTemplate,
  deleteEmailScenario,
  deleteEmailTemplate,
  listEmailDeliveryLogsFresh,
  listEmailScenariosFresh,
  listEmailTemplatesFresh,
  updateEmailScenario,
  updateEmailTemplate,
} from "../mailManagement";
import { getSmtpSettingsFresh, updateSmtpSettings } from "../smtpSettings";

const { Title, Text } = Typography;

const statusOptions = ["Aktif", "Pasif"].map((value) => ({ value, label: value }));
const roleOptions = ["Yonetici", "Magaza", "Muhasebe", "Tedarikci"].map((value) => ({ value, label: value }));
const matchTypeOptions = [
  { value: "all", label: "Tum Kosullar" },
  { value: "any", label: "Kosullardan Biri" },
];

function requiredWhenEnabled(label) {
  return ({ getFieldValue }) => ({
    validator(_, value) {
      if (!getFieldValue("enabled")) {
        return Promise.resolve();
      }
      if (value === undefined || value === null || String(value).trim() === "") {
        return Promise.reject(new Error(`${label} zorunludur.`));
      }
      return Promise.resolve();
    },
  });
}

function renderTemplateString(template, context) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = context?.[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function summarizeRecipients(record) {
  const parts = [];
  if (record.recipientMode === "event") {
    parts.push("Olay Alicisi");
  }
  if (record.recipientMode === "fixed") {
    parts.push(`Sabit: ${record.fixedToEmails || "-"}`);
  }
  if (record.recipientMode === "event_plus_fixed") {
    parts.push(`Olay + Sabit: ${record.fixedToEmails || "-"}`);
  }
  if (record.ccEmails) {
    parts.push(`CC: ${record.ccEmails}`);
  }
  if (record.bccEmails) {
    parts.push(`BCC: ${record.bccEmails}`);
  }
  return parts.join(" | ") || "-";
}

function summarizeConditions(record) {
  const parts = [];
  if (record.matchType === "any" && (record.conditions?.length || 0) > 1) {
    parts.push("Eslesme: Biri");
  }
  if ((record.conditions?.length || 0) > 0) {
    parts.push(`Kosul: ${record.conditions.length}`);
  }
  if (record.attachments?.length) {
    parts.push(`Ek Dosya: ${record.attachments.length}`);
  }
  return parts.join(" | ") || "Kosul yok";
}

function MailManagementPage() {
  const [smtpForm] = Form.useForm();
  const [testForm] = Form.useForm();
  const [templateForm] = Form.useForm();
  const [scenarioForm] = Form.useForm();
  const [smtpLoading, setSmtpLoading] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [templatesLoading, setTemplatesLoading] = React.useState(false);
  const [scenariosLoading, setScenariosLoading] = React.useState(false);
  const [logsLoading, setLogsLoading] = React.useState(false);
  const [templateSaving, setTemplateSaving] = React.useState(false);
  const [scenarioSaving, setScenarioSaving] = React.useState(false);
  const [attachmentUploading, setAttachmentUploading] = React.useState(false);
  const [templates, setTemplates] = React.useState([]);
  const [scenarios, setScenarios] = React.useState([]);
  const [logs, setLogs] = React.useState([]);
  const [eventDefinitions, setEventDefinitions] = React.useState([]);
  const [recipientModeOptions, setRecipientModeOptions] = React.useState([
    { value: "event", label: "Olay Alicisi" },
    { value: "fixed", label: "Sabit Alicilar" },
    { value: "event_plus_fixed", label: "Olay + Sabit Alicilar" },
  ]);
  const [conditionOperatorOptions, setConditionOperatorOptions] = React.useState([]);
  const [templateDrawerOpen, setTemplateDrawerOpen] = React.useState(false);
  const [scenarioDrawerOpen, setScenarioDrawerOpen] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState(null);
  const [editingScenario, setEditingScenario] = React.useState(null);
  const attachmentInputRef = React.useRef(null);

  const watchedTemplateEventKey = Form.useWatch("eventKey", templateForm);
  const watchedTemplateSubject = Form.useWatch("subject", templateForm);
  const watchedTemplateTextBody = Form.useWatch("textBody", templateForm);
  const watchedTemplateHtmlBody = Form.useWatch("htmlBody", templateForm);
  const watchedScenarioEventKey = Form.useWatch("eventKey", scenarioForm);
  const watchedScenarioRecipientMode = Form.useWatch("recipientMode", scenarioForm);
  const watchedScenarioConditions = Form.useWatch("conditions", scenarioForm) || [];
  const watchedScenarioAttachments = Form.useWatch("attachments", scenarioForm) || [];

  const eventMap = React.useMemo(
    () => new Map(eventDefinitions.map((item) => [item.key, item])),
    [eventDefinitions],
  );

  const filteredTemplateOptions = React.useMemo(
    () => templates
      .filter((item) => !watchedScenarioEventKey || item.eventKey === watchedScenarioEventKey)
      .map((item) => ({
        value: item.id,
        label: `${item.name}${item.isSystem ? " (Sistem)" : ""}`,
      })),
    [templates, watchedScenarioEventKey],
  );

  const selectedTemplateDefinition = eventMap.get(watchedTemplateEventKey);
  const selectedScenarioDefinition = eventMap.get(watchedScenarioEventKey);
  const previewContext = selectedTemplateDefinition?.sampleContext || {};
  const availableConditionFields = selectedScenarioDefinition?.conditionFields || [];

  const refreshSmtp = React.useCallback(async () => {
    try {
      setSmtpLoading(true);
      smtpForm.setFieldsValue(await getSmtpSettingsFresh());
    } finally {
      setSmtpLoading(false);
    }
  }, [smtpForm]);

  const refreshTemplates = React.useCallback(async () => {
    try {
      setTemplatesLoading(true);
      const payload = await listEmailTemplatesFresh();
      setTemplates(payload.items);
      setEventDefinitions(payload.meta?.events || []);
    } catch (error) {
      message.error(error?.message || "Mail sablonlari yuklenemedi.");
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const refreshScenarios = React.useCallback(async () => {
    try {
      setScenariosLoading(true);
      const payload = await listEmailScenariosFresh();
      setScenarios(payload.items);
      if (!eventDefinitions.length && Array.isArray(payload.meta?.events)) {
        setEventDefinitions(payload.meta.events);
      }
      if (Array.isArray(payload.meta?.recipientModes)) {
        setRecipientModeOptions(payload.meta.recipientModes);
      }
      if (Array.isArray(payload.meta?.conditionOperators)) {
        setConditionOperatorOptions(payload.meta.conditionOperators);
      }
    } catch (error) {
      message.error(error?.message || "Mail senaryolari yuklenemedi.");
    } finally {
      setScenariosLoading(false);
    }
  }, [eventDefinitions.length]);

  const refreshLogs = React.useCallback(async () => {
    try {
      setLogsLoading(true);
      setLogs(await listEmailDeliveryLogsFresh());
    } catch (error) {
      message.error(error?.message || "Gonderim loglari yuklenemedi.");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void Promise.all([refreshSmtp(), refreshTemplates(), refreshScenarios(), refreshLogs()]);
  }, [refreshSmtp, refreshTemplates, refreshScenarios, refreshLogs]);

  const applyGmailPreset = React.useCallback(() => {
    smtpForm.setFieldsValue({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      fromName: smtpForm.getFieldValue("fromName") || "Sibella Atelier",
    });
    message.success("Gmail icin onerilen SMTP ayarlari dolduruldu.");
  }, [smtpForm]);

  const handleSaveSmtp = async () => {
    try {
      const values = await smtpForm.validateFields();
      updateSmtpSettings(values);
      message.success("SMTP ayarlari kaydedildi.");
    } catch {
      // validation handled by form
    }
  };

  const handleSendTestEmail = async () => {
    try {
      const values = await testForm.validateFields();
      setTesting(true);
      const payload = await requestJson("POST", "/api/settings/smtp/test", { toEmail: values.toEmail });
      message.success(payload?.message || "Test maili gonderildi.");
      await refreshLogs();
    } catch (error) {
      if (!error?.errorFields) {
        message.error(error?.message || "Test maili gonderilemedi.");
        await refreshLogs();
      }
    } finally {
      setTesting(false);
    }
  };

  const openTemplateCreate = () => {
    setEditingTemplate(null);
    templateForm.setFieldsValue({
      name: "",
      code: "",
      eventKey: eventDefinitions[0]?.key || "password_reset_requested",
      description: "",
      subject: "",
      textBody: "",
      htmlBody: "",
      status: "Aktif",
    });
    setTemplateDrawerOpen(true);
  };

  const openTemplateEdit = (record) => {
    setEditingTemplate(record);
    templateForm.setFieldsValue({ ...record });
    setTemplateDrawerOpen(true);
  };

  const handleTemplateSubmit = async () => {
    try {
      setTemplateSaving(true);
      const values = await templateForm.validateFields();
      if (editingTemplate) {
        await updateEmailTemplate(editingTemplate.id, values);
        message.success("Mail sablonu guncellendi.");
      } else {
        await createEmailTemplate(values);
        message.success("Mail sablonu eklendi.");
      }
      setTemplateDrawerOpen(false);
      await refreshTemplates();
      await refreshScenarios();
    } catch (error) {
      if (!error?.errorFields) {
        message.error(error?.message || "Mail sablonu kaydedilemedi.");
      }
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleTemplateDelete = async (record) => {
    try {
      await deleteEmailTemplate(record.id);
      await refreshTemplates();
      message.success("Mail sablonu silindi.");
    } catch (error) {
      message.error(error?.message || "Mail sablonu silinemedi.");
    }
  };

  const openScenarioCreate = () => {
    setEditingScenario(null);
    scenarioForm.setFieldsValue({
      name: "",
      code: "",
      eventKey: eventDefinitions[0]?.key || "password_reset_requested",
      templateId: undefined,
      recipientMode: "event",
      fixedToEmails: "",
      ccEmails: "",
      bccEmails: "",
      matchType: "all",
      conditions: [],
      attachments: [],
      sortOrder: 100,
      status: "Aktif",
    });
    setScenarioDrawerOpen(true);
  };

  const openScenarioEdit = (record) => {
    setEditingScenario(record);
    scenarioForm.setFieldsValue({
      ...record,
      conditions: record.conditions || [],
      attachments: record.attachments || [],
    });
    setScenarioDrawerOpen(true);
  };

  const handleScenarioSubmit = async () => {
    try {
      setScenarioSaving(true);
      await scenarioForm.validateFields();
      const values = scenarioForm.getFieldsValue(true);
      if (editingScenario) {
        await updateEmailScenario(editingScenario.id, values);
        message.success("Mail senaryosu guncellendi.");
      } else {
        await createEmailScenario(values);
        message.success("Mail senaryosu eklendi.");
      }
      setScenarioDrawerOpen(false);
      await refreshScenarios();
    } catch (error) {
      if (!error?.errorFields) {
        message.error(error?.message || "Mail senaryosu kaydedilemedi.");
      }
    } finally {
      setScenarioSaving(false);
    }
  };

  const handleScenarioDelete = async (record) => {
    try {
      await deleteEmailScenario(record.id);
      await refreshScenarios();
      message.success("Mail senaryosu silindi.");
    } catch (error) {
      message.error(error?.message || "Mail senaryosu silinemedi.");
    }
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Dosya okunamadi."));
    reader.readAsDataURL(file);
  });

  const handleAttachmentFilesSelected = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    try {
      setAttachmentUploading(true);
      const uploaded = [];
      for (const file of files) {
        const base64 = await fileToBase64(file);
        const payload = await requestJson("POST", "/api/assets/upload", {
          filename: file.name,
          base64,
        });
        uploaded.push({
          name: file.name,
          url: payload?.url || "",
        });
      }
      scenarioForm.setFieldValue("attachments", [
        ...(scenarioForm.getFieldValue("attachments") || []),
        ...uploaded,
      ]);
      message.success(`${uploaded.length} dosya eklendi.`);
    } catch (error) {
      message.error(error?.message || "Ek dosya yuklenemedi.");
    } finally {
      setAttachmentUploading(false);
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = "";
      }
    }
  };

  const removeAttachment = (index) => {
    const next = [...(scenarioForm.getFieldValue("attachments") || [])];
    next.splice(index, 1);
    scenarioForm.setFieldValue("attachments", next);
  };

  const templateColumns = [
    {
      title: "Sablon",
      dataIndex: "name",
      key: "name",
      render: (value, record) => (
        <button type="button" className="erp-link-button" onClick={() => openTemplateEdit(record)}>
          {value}
        </button>
      ),
    },
    { title: "Kod", dataIndex: "code", key: "code", width: 180 },
    { title: "Olay", dataIndex: "eventLabel", key: "eventLabel", width: 220 },
    {
      title: "Durum",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value) => <Tag color={value === "Aktif" ? "green" : "default"}>{value}</Tag>,
    },
    {
      title: "Tip",
      key: "type",
      width: 120,
      render: (_, record) => <Tag color={record.isSystem ? "blue" : "purple"}>{record.isSystem ? "Sistem" : "Ozel"}</Tag>,
    },
    {
      title: "Islemler",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Space size={8}>
          <Button type="text" className="erp-icon-btn erp-icon-btn-edit" icon={<EditOutlined />} onClick={() => openTemplateEdit(record)} />
          {record.isSystem ? null : (
            <Popconfirm title="Sablon silinsin mi?" okText="Sil" cancelText="Vazgec" onConfirm={() => {
              void handleTemplateDelete(record);
            }}>
              <Button type="text" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const scenarioColumns = [
    {
      title: "Senaryo",
      dataIndex: "name",
      key: "name",
      render: (value, record) => (
        <button type="button" className="erp-link-button" onClick={() => openScenarioEdit(record)}>
          {value}
        </button>
      ),
    },
    { title: "Olay", dataIndex: "eventLabel", key: "eventLabel", width: 220 },
    { title: "Sablon", dataIndex: "templateName", key: "templateName", width: 200, render: (value) => value || "-" },
    {
      title: "Alicilar",
      key: "recipients",
      render: (_, record) => summarizeRecipients(record),
    },
    {
      title: "Kosullar",
      key: "conditions",
      render: (_, record) => summarizeConditions(record),
    },
    {
      title: "Durum",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value) => <Tag color={value === "Aktif" ? "green" : "default"}>{value}</Tag>,
    },
    {
      title: "Islemler",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Space size={8}>
          <Button type="text" className="erp-icon-btn erp-icon-btn-edit" icon={<EditOutlined />} onClick={() => openScenarioEdit(record)} />
          {record.isSystem ? null : (
            <Popconfirm title="Senaryo silinsin mi?" okText="Sil" cancelText="Vazgec" onConfirm={() => {
              void handleScenarioDelete(record);
            }}>
              <Button type="text" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const logColumns = [
    {
      title: "Tarih",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (value) => (value ? new Date(value).toLocaleString("tr-TR") : "-"),
    },
    { title: "Olay", dataIndex: "eventLabel", key: "eventLabel", width: 180 },
    { title: "Senaryo", dataIndex: "scenarioName", key: "scenarioName", width: 220 },
    { title: "Sablon", dataIndex: "templateName", key: "templateName", width: 220 },
    {
      title: "Alici",
      dataIndex: "toEmails",
      key: "toEmails",
      render: (value, record) => [value, record.ccEmails ? `CC: ${record.ccEmails}` : "", record.bccEmails ? `BCC: ${record.bccEmails}` : ""].filter(Boolean).join(" | "),
    },
    { title: "Konu", dataIndex: "subject", key: "subject" },
    {
      title: "Durum",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value) => <Tag color={value === "Basarili" ? "green" : value === "Reddedildi" ? "gold" : "red"}>{value}</Tag>,
    },
    {
      title: "Detay",
      key: "detail",
      render: (_, record) => record.errorMessage || (record.attachmentCount ? `${record.attachmentCount} ek dosya` : record.messageId || "-"),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 6 }}>Mail Yonetimi</Title>
        <Text type="secondary">SMTP ayarlari, mail sablonlari, faz 2 senaryo kurallari ve gonderim gecmisi bu ekrandan yonetilir.</Text>
      </div>

      <Tabs
        defaultActiveKey="smtp"
        items={[
          {
            key: "smtp",
            label: "SMTP Ayarlari",
            children: (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Card title="SMTP Ayarlari" extra={<Button type="primary" onClick={handleSaveSmtp}>Kaydet</Button>} loading={smtpLoading}>
                  <Form form={smtpForm} layout="vertical">
                    <Space direction="vertical" size={12} style={{ width: "100%", marginBottom: 16 }}>
                      <Alert
                        type="info"
                        showIcon
                        message="Gmail kurulumu"
                        description={(
                          <Space direction="vertical" size={2}>
                            <Text>1. Google hesabinizda 2 Adimli Dogrulama acin.</Text>
                            <Text>2. 16 haneli Uygulama Sifresi olusturun.</Text>
                            <Text>3. Gmail ayarlarini doldurup test maili gonderin.</Text>
                          </Space>
                        )}
                      />
                      <Space wrap>
                        <Button onClick={applyGmailPreset}>Gmail Ayarlarini Doldur</Button>
                        <Text type="secondary">Onerilen kombinasyon: `smtp.gmail.com` + `587` + `STARTTLS` + uygulama sifresi.</Text>
                      </Space>
                    </Space>
                    <Row gutter={[16, 16]}>
                      <Col xs={24} md={12} xl={8}>
                        <Card size="small" title="SMTP Durumu">
                          <Space direction="vertical" size={12} style={{ width: "100%" }}>
                            <Text type="secondary">Aktif oldugunda sistem mailleri e-posta ile gonderilir.</Text>
                            <Form.Item name="enabled" valuePropName="checked" style={{ marginBottom: 0 }}>
                              <Switch checkedChildren="Aktif" unCheckedChildren="Pasif" />
                            </Form.Item>
                          </Space>
                        </Card>
                      </Col>
                      <Col xs={24} md={12} xl={8}>
                        <Form.Item name="host" label="SMTP Host" rules={[requiredWhenEnabled("SMTP Host")]}>
                          <Input placeholder="smtp.gmail.com" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12} xl={4}>
                        <Form.Item name="port" label="Port" rules={[requiredWhenEnabled("Port")]}>
                          <InputNumber style={{ width: "100%" }} min={1} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12} xl={4}>
                        <Form.Item name="secure" label="Guvenli Baglanti" valuePropName="checked">
                          <Switch checkedChildren="SSL/TLS" unCheckedChildren="STARTTLS" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="username"
                          label="Kullanici Adi"
                          rules={[
                            requiredWhenEnabled("Kullanici Adi"),
                            { type: "email", message: "Gecerli bir e-posta adresi girin." },
                          ]}
                        >
                          <Input placeholder="seninadresin@gmail.com" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="password"
                          label="Sifre"
                          extra="Gmail normal sifresi yerine uygulama sifresi kullanin."
                          rules={[requiredWhenEnabled("Sifre")]}
                        >
                          <Input.Password placeholder="16 haneli uygulama sifresi" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="fromName" label="Gonderen Adi">
                          <Input placeholder="Sibella Atelier" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="fromEmail"
                          label="Gonderen E-posta"
                          rules={[
                            requiredWhenEnabled("Gonderen E-posta"),
                            { type: "email", message: "Gecerli bir e-posta adresi girin." },
                          ]}
                        >
                          <Input placeholder="seninadresin@gmail.com" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Form>
                </Card>

                <Card title="Test E-postasi Gonder">
                  <Form form={testForm} layout="inline" onFinish={handleSendTestEmail}>
                    <Form.Item
                      name="toEmail"
                      rules={[
                        { required: true, message: "Test e-posta adresi zorunludur." },
                        { type: "email", message: "Gecerli bir e-posta adresi girin." },
                      ]}
                      style={{ flex: 1, minWidth: 280 }}
                    >
                      <Input placeholder="test@ornek.com" />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0 }}>
                      <Button type="primary" htmlType="submit" loading={testing}>Test Maili Gonder</Button>
                    </Form.Item>
                  </Form>
                </Card>
              </Space>
            ),
          },
          {
            key: "templates",
            label: "Sablonlar",
            children: (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                  <Text type="secondary">HTML icerik, konu ve duz metin alanlarini sablon bazinda yonetin.</Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openTemplateCreate}>Yeni Sablon Ekle</Button>
                </div>
                <Card className="erp-list-table-card">
                  <Table rowKey="id" loading={templatesLoading} columns={templateColumns} dataSource={templates} pagination={{ pageSize: 8 }} />
                </Card>
              </Space>
            ),
          },
          {
            key: "scenarios",
            label: "Senaryolar",
            children: (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Alert
                  type="info"
                  showIcon
                  message="Faz 2"
                  description="Bu surumde gelismis kosullar, coklu alici, CC/BCC ve ek dosya desteklenir. Eslesen ilk aktif senaryo secilir."
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                  <Text type="secondary">Kosul yapisini genisletin, sabit alicilar ekleyin ve dosya baglayin.</Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openScenarioCreate}>Yeni Senaryo Ekle</Button>
                </div>
                <Card className="erp-list-table-card">
                  <Table rowKey="id" loading={scenariosLoading} columns={scenarioColumns} dataSource={scenarios} pagination={{ pageSize: 8 }} />
                </Card>
              </Space>
            ),
          },
          {
            key: "logs",
            label: "Gonderim Gecmisi",
            children: (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                  <Text type="secondary">Son 250 mail gonderim kaydi izlenir.</Text>
                  <Button icon={<ReloadOutlined />} onClick={() => { void refreshLogs(); }}>Yenile</Button>
                </div>
                <Card className="erp-list-table-card">
                  <Table rowKey="id" loading={logsLoading} columns={logColumns} dataSource={logs} pagination={{ pageSize: 10 }} />
                </Card>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        title={editingTemplate ? "Mail Sablonu Duzenle" : "Yeni Mail Sablonu"}
        placement="right"
        width={760}
        open={templateDrawerOpen}
        onClose={() => setTemplateDrawerOpen(false)}
        extra={<Button type="primary" onClick={handleTemplateSubmit} loading={templateSaving}>Kaydet</Button>}
      >
        <Form form={templateForm} layout="vertical">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Sablon Adi" rules={[{ required: true, message: "Sablon adi zorunludur." }]}>
                <Input placeholder="Tedarikci Sifre Yenileme" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="code" label="Teknik Kod">
                <Input placeholder="tedarikci-sifre-yenileme" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="eventKey" label="Mail Olayi" rules={[{ required: true, message: "Mail olayi seciniz." }]}>
                <Select options={eventDefinitions.map((item) => ({ value: item.key, label: item.label }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="status" label="Durum" rules={[{ required: true, message: "Durum seciniz." }]}>
                <Select options={statusOptions} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="description" label="Aciklama">
                <Input.TextArea rows={2} placeholder="Bu sablonun hangi amacla kullanildigini yazin." />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Alert
                type="info"
                showIcon
                message="Kullanilabilir degiskenler"
                description={(selectedTemplateDefinition?.variables || []).length ? (
                  <Space wrap>
                    {(selectedTemplateDefinition?.variables || []).map((item) => (
                      <Tag key={item}>{`{{${item}}}`}</Tag>
                    ))}
                  </Space>
                ) : "Degisken bulunamadi."}
              />
            </Col>
            <Col xs={24}>
              <Form.Item name="subject" label="Konu" rules={[{ required: true, message: "Konu zorunludur." }]}>
                <Input placeholder="{{appName}} - Mail Konusu" />
              </Form.Item>
            </Col>
          </Row>

          <Tabs
            defaultActiveKey="html"
            items={[
              {
                key: "html",
                label: "HTML Icerik",
                children: (
                  <Form.Item name="htmlBody" label="HTML" rules={[{ required: true, message: "HTML icerigi zorunludur." }]}>
                    <Input.TextArea rows={16} placeholder="<div>Mail icerigi</div>" />
                  </Form.Item>
                ),
              },
              {
                key: "text",
                label: "Duz Metin",
                children: (
                  <Form.Item name="textBody" label="Duz Metin" rules={[{ required: true, message: "Duz metin icerigi zorunludur." }]}>
                    <Input.TextArea rows={12} placeholder="Mail iceriginin duz metin hali" />
                  </Form.Item>
                ),
              },
              {
                key: "preview",
                label: "Onizleme",
                children: (
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <Card size="small" title="Konu Onizleme">
                      <Text>{renderTemplateString(watchedTemplateSubject, previewContext) || "-"}</Text>
                    </Card>
                    <Card size="small" title="HTML Onizleme">
                      <iframe
                        title="mail-template-preview"
                        sandbox=""
                        style={{ width: "100%", minHeight: 360, border: "1px solid #f0f0f0", borderRadius: 8, background: "#fff" }}
                        srcDoc={renderTemplateString(watchedTemplateHtmlBody, previewContext)}
                      />
                    </Card>
                    <Card size="small" title="Duz Metin Onizleme">
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                        {renderTemplateString(watchedTemplateTextBody, previewContext) || "-"}
                      </pre>
                    </Card>
                  </Space>
                ),
              },
            ]}
          />
        </Form>
      </Drawer>

      <Drawer
        title={editingScenario ? "Mail Senaryosu Duzenle" : "Yeni Mail Senaryosu"}
        placement="right"
        width={720}
        open={scenarioDrawerOpen}
        onClose={() => setScenarioDrawerOpen(false)}
        extra={<Button type="primary" onClick={handleScenarioSubmit} loading={scenarioSaving}>Kaydet</Button>}
      >
        <Form form={scenarioForm} layout="vertical">
          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Senaryo Adi" rules={[{ required: true, message: "Senaryo adi zorunludur." }]}>
                <Input placeholder="Tedarikci Sifre Yenileme Senaryosu" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="code" label="Teknik Kod">
                <Input placeholder="tedarikci-sifre-yenileme-senaryosu" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="eventKey" label="Mail Olayi" rules={[{ required: true, message: "Mail olayi seciniz." }]}>
                <Select
                  options={eventDefinitions.map((item) => ({ value: item.key, label: item.label }))}
                  onChange={() => {
                    scenarioForm.setFieldValue("templateId", undefined);
                    scenarioForm.setFieldValue("conditions", []);
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="templateId" label="Kullanilacak Sablon" rules={[{ required: true, message: "Sablon seciniz." }]}>
                <Select options={filteredTemplateOptions} placeholder="Sablon seciniz" showSearch optionFilterProp="label" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="recipientMode" label="Alici Tipi" rules={[{ required: true, message: "Alici tipi seciniz." }]}>
                <Select options={recipientModeOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="status" label="Durum" rules={[{ required: true, message: "Durum seciniz." }]}>
                <Select options={statusOptions} />
              </Form.Item>
            </Col>
          </Row>

          {watchedScenarioRecipientMode !== "event" ? (
            <Form.Item
              name="fixedToEmails"
              label="Sabit Alicilar"
              extra="Birden fazla e-posta icin virgul veya yeni satir kullanin."
              rules={[{ required: true, message: "En az bir sabit alici girin." }]}
            >
              <Input.TextArea rows={3} placeholder="mail1@ornek.com, mail2@ornek.com" />
            </Form.Item>
          ) : null}

          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
              <Form.Item name="ccEmails" label="CC">
                <Input.TextArea rows={3} placeholder="cc@ornek.com" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="bccEmails" label="BCC">
                <Input.TextArea rows={3} placeholder="bcc@ornek.com" />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" title="Kosul Mantigi" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item name="matchType" label="Eslesme Tipi">
                  <Select options={matchTypeOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="sortOrder" label="Oncelik" rules={[{ required: true, message: "Oncelik zorunludur." }]}>
                  <InputNumber min={1} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.List name="conditions">
              {(fields, { add, remove }) => (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  {fields.map((field) => {
                    const currentOperator = scenarioForm.getFieldValue(["conditions", field.name, "operator"]);
                    const hideValue = currentOperator === "is_empty" || currentOperator === "is_not_empty";
                    return (
                      <Card
                        key={field.key}
                        size="small"
                        extra={<Button type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />}
                      >
                        <Row gutter={[12, 12]}>
                          <Col xs={24} md={8}>
                            <Form.Item
                              name={[field.name, "field"]}
                              label="Alan"
                              rules={[{ required: true, message: "Alan seciniz." }]}
                            >
                              <Select options={availableConditionFields.map((item) => ({ value: item.key, label: item.label }))} />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item
                              name={[field.name, "operator"]}
                              label="Operator"
                              rules={[{ required: true, message: "Operator seciniz." }]}
                            >
                              <Select options={conditionOperatorOptions} />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item
                              name={[field.name, "value"]}
                              label="Deger"
                              rules={hideValue ? [] : [{ required: true, message: "Deger giriniz." }]}
                            >
                              <Input disabled={hideValue} placeholder={hideValue ? "Bu operator icin gerekmez" : "Kosul degeri"} />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    );
                  })}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ field: availableConditionFields[0]?.key, operator: "equals", value: "" })}>
                    Kosul Ekle
                  </Button>
                </Space>
              )}
            </Form.List>
          </Card>

          <Card size="small" title="Ek Dosyalar">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <input
                ref={attachmentInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(event) => { void handleAttachmentFilesSelected(event); }}
              />
              <Space wrap>
                <Button onClick={() => attachmentInputRef.current?.click()} loading={attachmentUploading}>Dosya Yukle</Button>
                <Text type="secondary">Yuklenen dosyalar mail ile ekte gonderilir.</Text>
              </Space>
              {(watchedScenarioAttachments || []).length ? (
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  {watchedScenarioAttachments.map((attachment, index) => (
                    <Card
                      key={`${attachment.url}-${index}`}
                      size="small"
                      extra={<Button type="text" icon={<DeleteOutlined />} onClick={() => removeAttachment(index)} />}
                    >
                      <Text strong>{attachment.name || `Dosya ${index + 1}`}</Text>
                      <div><Text type="secondary">{attachment.url}</Text></div>
                    </Card>
                  ))}
                </Space>
              ) : (
                <Text type="secondary">Ek dosya yok.</Text>
              )}
            </Space>
          </Card>

          <Alert
            style={{ marginTop: 16 }}
            type="info"
            showIcon
            message="Senaryo Ozeti"
            description={(
              <Space direction="vertical" size={2}>
                <Text>{`Kosul sayisi: ${watchedScenarioConditions.length}`}</Text>
                <Text>{`Ek dosya sayisi: ${watchedScenarioAttachments.length}`}</Text>
              </Space>
            )}
          />
        </Form>
      </Drawer>
    </Space>
  );
}

export default MailManagementPage;
