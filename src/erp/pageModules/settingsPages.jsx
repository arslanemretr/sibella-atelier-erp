import React from "react";
import { Button, Card, Col, Descriptions, Drawer, Form, Input, InputNumber, Row, Select, Space, Switch, Table, Tag, Typography, message } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { createMasterData, listMasterDataFresh, masterDataDefinitions, updateMasterData } from "../masterData";
import { getSmtpSettingsFresh, updateSmtpSettings } from "../smtpSettings";
import { getSystemParametersFresh, updateSystemParameters } from "../systemParameters";

const { Title, Text } = Typography;

export function SettingsDefinitionPage({ entityKey }) {
  const activeConfig = masterDataDefinitions[entityKey];
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [records, setRecords] = React.useState([]);
  const [tableLoading, setTableLoading] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedRecord, setSelectedRecord] = React.useState(null);

  React.useEffect(() => {
    if (!activeConfig) {
      return undefined;
    }

    let cancelled = false;
    const loadRecords = async () => {
      try {
        setTableLoading(true);
        const nextRecords = await listMasterDataFresh(activeConfig.entityKey);
        if (!cancelled) {
          setRecords(nextRecords);
        }
      } catch (error) {
        if (!cancelled) {
          message.error(error?.message || "Tanim listesi yuklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setTableLoading(false);
        }
      }
    };

    void loadRecords();

    return () => {
      cancelled = true;
    };
  }, [activeConfig]);

  if (!activeConfig) {
    return null;
  }

  const refreshRecords = async () => {
    const nextRecords = await listMasterDataFresh(activeConfig.entityKey);
    setRecords(nextRecords);
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      createMasterData(activeConfig.entityKey, values);
      createForm.resetFields();
      createForm.setFieldsValue(activeConfig.emptyValues);
      await refreshRecords();
      message.success("Kayit basariyla eklendi.");
    } catch {
      // validation handled by form
    }
  };

  const handleOpenEdit = (record, event) => {
    if (event) {
      event.stopPropagation();
    }

    setSelectedRecord(record);
    editForm.setFieldsValue(record);
    setDrawerOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedRecord) {
      return;
    }

    try {
      const values = await editForm.validateFields();
      updateMasterData(activeConfig.entityKey, selectedRecord.id, values);
      await refreshRecords();
      setSelectedRecord((prev) => ({ ...prev, ...values }));
      setDrawerOpen(false);
      message.success("Kayit basariyla guncellendi.");
    } catch {
      // validation handled by form
    }
  };

  const tableColumns = activeConfig.columns.map((column) => ({
    title: column.label,
    dataIndex: column.key,
    key: column.key,
    sorter: (a, b) => String(a[column.key] ?? "").localeCompare(String(b[column.key] ?? ""), "tr", { numeric: true }),
    render: (value) =>
      column.key === "status" ? (
        <Tag color={value === "Aktif" ? "green" : "default"}>{value}</Tag>
      ) : column.key === activeConfig.columns[0].key ? (
        <span className="erp-link-cell">{value}</span>
      ) : (
        value || "-"
      ),
  }));

  tableColumns.push({
    title: "Islemler",
    key: "actions",
    width: 120,
    render: (_, record) => (
      <Space size={8}>
        <Button
          type="text"
          className="erp-icon-btn erp-icon-btn-edit"
          icon={<EditOutlined />}
          onClick={(event) => handleOpenEdit(record, event)}
        />
      </Space>
    ),
  });

  const renderField = (field) => {
    if (field.type === "number") {
      return <InputNumber style={{ width: "100%" }} min={0} />;
    }

    if (field.type === "textarea") {
      return <Input.TextArea rows={3} />;
    }

    if (field.type === "select") {
      return <Select options={(field.options || []).map((option) => ({ value: option, label: option }))} />;
    }

    return <Input placeholder={`${field.label} giriniz`} />;
  };

  const formColSpan = activeConfig.fields.length <= 3 ? 8 : 6;

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>{activeConfig.title}</Title>
          <Text type="secondary">{activeConfig.description}</Text>
        </div>
        <Button type="primary" onClick={handleCreate}>{activeConfig.createLabel}</Button>
      </div>

      <Card title="Tanim Formu" extra={<Tag color="blue">Kalici Kayit Acik</Tag>}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Text type="secondary">
            {activeConfig.relationText.join(" ")}
          </Text>

          <Form form={createForm} layout="vertical" initialValues={activeConfig.emptyValues}>
            <Row gutter={[16, 16]}>
              {activeConfig.fields.map((field) => (
                <Col xs={24} md={12} xl={formColSpan} key={field.name}>
                  <Form.Item
                    name={field.name}
                    label={field.label}
                    rules={field.required ? [{ required: true, message: `${field.label} zorunludur.` }] : []}
                  >
                    {renderField(field)}
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Form>
        </Space>
      </Card>

      <Card title="Tanim Listesi" className="erp-list-table-card">
        <Table
          rowKey="id"
          loading={tableLoading}
          columns={tableColumns}
          dataSource={records}
          pagination={false}
          onRow={(record) => ({
            onClick: () => handleOpenEdit(record),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
        <div className="erp-table-footer">
          <Space>
            <span>Sayfa Boyutu:</span>
            <Select
              defaultValue="50"
              size="small"
              style={{ width: 84 }}
              options={["25", "50", "100"].map((value) => ({ value, label: value }))}
            />
          </Space>
          <Space size={18}>
            <span>1 - {records.length} / {records.length}</span>
            <span>Toplam {records.length} kayit</span>
          </Space>
        </div>
      </Card>

      <Drawer
        title={activeConfig.editTitle}
        placement="right"
        width={460}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={<Button type="primary" onClick={handleUpdate}>Guncelle</Button>}
      >
        {selectedRecord ? (
          <Space direction="vertical" size={18} style={{ width: "100%" }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Kayit No">{selectedRecord.id}</Descriptions.Item>
              <Descriptions.Item label="Olusturma Tarihi">{new Date(selectedRecord.createdAt).toLocaleString("tr-TR")}</Descriptions.Item>
              <Descriptions.Item label="Son Guncelleme">{new Date(selectedRecord.updatedAt).toLocaleString("tr-TR")}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Kayit Bilgileri">
              <Form form={editForm} layout="vertical">
                <Row gutter={[12, 12]}>
                  {activeConfig.fields.map((field) => (
                    <Col xs={24} key={field.name}>
                      <Form.Item
                        name={field.name}
                        label={field.label}
                        rules={field.required ? [{ required: true, message: `${field.label} zorunludur.` }] : []}
                      >
                        {renderField(field)}
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
              </Form>
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}

export function ParametersPage() {
  const [form] = Form.useForm();
  const [pageLoading, setPageLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      try {
        setPageLoading(true);
        const values = await getSystemParametersFresh();
        if (!cancelled) {
          form.setFieldsValue(values);
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      updateSystemParameters(values);
      message.success("Parametreler kaydedildi.");
    } catch {
      // validation handled by form
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Parametreler</Title>
          <Text type="secondary">Sistem genelinde kullanilan ac/kapat ve davranis parametreleri burada yonetilir.</Text>
        </div>
        <Button type="primary" onClick={handleSubmit}>Kaydet</Button>
      </div>

      <Card title="Genel Parametreler" extra={<Tag color="blue">Kalici Kayit Acik</Tag>} loading={pageLoading}>
        <Form form={form} layout="vertical">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12} xl={8}>
              <Card size="small" title="Urun Kodu Kontrolu">
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Text type="secondary">
                    Aktifken urun kodu tedarikci kisa koduna gore otomatik uretilir ve tekrar kontrol edilir. Pasifken manuel girise izin verilir.
                  </Text>
                  <Form.Item name="productCodeControlEnabled" valuePropName="checked" style={{ marginBottom: 0 }}>
                    <Switch checkedChildren="Aktif" unCheckedChildren="Pasif" />
                  </Form.Item>
                </Space>
              </Card>
            </Col>
          </Row>
        </Form>
      </Card>
    </Space>
  );
}

export function SmtpSettingsPage() {
  const [smtpForm] = Form.useForm();
  const [testForm] = Form.useForm();
  const [testing, setTesting] = React.useState(false);
  const [pageLoading, setPageLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const loadSmtpSettings = async () => {
      try {
        setPageLoading(true);
        const values = await getSmtpSettingsFresh();
        if (!cancelled) {
          smtpForm.setFieldsValue(values);
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadSmtpSettings();
    return () => {
      cancelled = true;
    };
  }, [smtpForm]);

  const handleSubmit = async () => {
    try {
      const smtpValues = await smtpForm.validateFields();
      updateSmtpSettings(smtpValues);
      message.success("SMTP ayarlari kaydedildi.");
    } catch {
      // validation handled by form
    }
  };

  const handleSendTestEmail = async () => {
    try {
      const values = await testForm.validateFields();
      setTesting(true);
      const response = await fetch("/api/settings/smtp/test", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: values.toEmail }),
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.message || "Test maili gonderilemedi.");
      }

      message.success(payload?.message || "Test maili gonderildi.");
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      message.error(error?.message || "Test maili gonderilemedi.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>SMTP ve E-posta</Title>
          <Text type="secondary">Sifre yenileme kodu gonderimi icin SMTP ayarlarinizi bu ekrandan yonetin.</Text>
        </div>
        <Button type="primary" onClick={handleSubmit}>Kaydet</Button>
      </div>

      <Card title="SMTP Ayarlari" extra={<Tag color="gold">Sifremi Unuttum Maili</Tag>} loading={pageLoading}>
        <Form form={smtpForm} layout="vertical">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12} xl={8}>
              <Card size="small" title="SMTP Durumu">
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Text type="secondary">
                    Aktif oldugunda sifre yenileme kodlari ekranda gosterilmek yerine e-posta ile gonderilir.
                  </Text>
                  <Form.Item name="enabled" valuePropName="checked" style={{ marginBottom: 0 }}>
                    <Switch checkedChildren="Aktif" unCheckedChildren="Pasif" />
                  </Form.Item>
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={12} xl={8}><Form.Item name="host" label="SMTP Host"><Input placeholder="smtp.example.com" /></Form.Item></Col>
            <Col xs={24} md={12} xl={4}><Form.Item name="port" label="Port"><InputNumber style={{ width: "100%" }} min={1} /></Form.Item></Col>
            <Col xs={24} md={12} xl={4}>
              <Form.Item name="secure" label="Guvenli Baglanti" valuePropName="checked">
                <Switch checkedChildren="SSL/TLS" unCheckedChildren="STARTTLS" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}><Form.Item name="username" label="Kullanici Adi"><Input placeholder="smtp kullanici adi" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="password" label="Sifre"><Input.Password placeholder="smtp sifresi" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="fromName" label="Gonderen Adi"><Input placeholder="Sibella Atelier" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="fromEmail" label="Gonderen E-posta"><Input placeholder="info@sibellaatelier.com" /></Form.Item></Col>
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
  );
}
