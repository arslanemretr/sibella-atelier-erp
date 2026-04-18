import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Col, Descriptions, Drawer, Form, Input, InputNumber, Popconfirm, Row, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { createStore, deleteStore, listStoresFresh, updateStore } from "../storesData";

const { Title, Text } = Typography;

export function StoreListPage() {
  const navigate = useNavigate();
  const [stores, setStores] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedStore, setSelectedStore] = React.useState(null);

  const refreshStores = React.useCallback(async () => {
    try {
      setLoading(true);
      setStores(await listStoresFresh());
    } catch (error) {
      message.error(error?.message || "Magaza listesi yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshStores();
  }, [refreshStores]);

  const handleDelete = async (storeId) => {
    try {
      deleteStore(storeId);
      message.success("Magaza silindi.");
      await refreshStores();
    } catch (error) {
      message.error(error?.message || "Magaza silinemedi.");
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Magaza Listesi</Title>
          <Text type="secondary">Konsinye urun gonderilen magaza kartlari bu alanda tutulur.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/stores/new")}>Magaza Tanimla</Button>
      </div>

      <Card title="Tum Magazalar" className="erp-list-table-card" style={{ paddingBottom: 24 }}>
        <Table
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 800 }}
          dataSource={stores}
          columns={[
            {
              title: "Magaza Kodu",
              dataIndex: "code",
              key: "code",
              render: (value, record) => (
                <button
                  type="button"
                  className="erp-link-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/stores/${record.id}`);
                  }}
                >
                  {value}
                </button>
              ),
            },
            { title: "Magaza Adi", dataIndex: "name", key: "name" },
            { title: "VKN", dataIndex: "taxNumber", key: "taxNumber" },
            {
              title: "Komisyon",
              dataIndex: "commissionRate",
              key: "commissionRate",
              render: (value) => `%${Number(value || 0).toFixed(2)}`,
            },
            { title: "Stok Yeri", dataIndex: "stockLocationName", key: "stockLocationName" },
            {
              title: "Islemler",
              key: "actions",
              render: (_, record) => (
                <Space size={4}>
                  <Tooltip title="Düzenle">
                    <Button size="small" className="erp-icon-btn erp-icon-btn-view" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); navigate(`/stores/${record.id}`); }} />
                  </Tooltip>
                  <Popconfirm title="Magaza silinsin mi?" okText="Sil" cancelText="Vazgec" onConfirm={() => void handleDelete(record.id)}>
                    <Tooltip title="Sil">
                      <Button size="small" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                    </Tooltip>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
          onRow={(record) => ({
            onClick: () => {
              setSelectedStore(record);
              setDetailOpen(true);
            },
          })}
          rowClassName={() => "erp-clickable-row"}
        />
      </Card>

      <Drawer title="Magaza Detayi" placement="right" width={440} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {selectedStore ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Magaza Adi">{selectedStore.name}</Descriptions.Item>
            <Descriptions.Item label="Magaza Kodu">{selectedStore.code}</Descriptions.Item>
            <Descriptions.Item label="VKN">{selectedStore.taxNumber || "-"}</Descriptions.Item>
            <Descriptions.Item label="Komisyon">{`%${Number(selectedStore.commissionRate || 0).toFixed(2)}`}</Descriptions.Item>
            <Descriptions.Item label="Stok Yeri">{selectedStore.stockLocationName || "-"}</Descriptions.Item>
            <Descriptions.Item label="Yetkili">{selectedStore.contactName || "-"}</Descriptions.Item>
            <Descriptions.Item label="Telefon">{selectedStore.contactPhone || "-"}</Descriptions.Item>
            <Descriptions.Item label="E-posta">{selectedStore.contactEmail || "-"}</Descriptions.Item>
            <Descriptions.Item label="Adres">{selectedStore.address || "-"}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </Space>
  );
}

export function StoreEditorPage() {
  const navigate = useNavigate();
  const { storeId } = useParams();
  const isEditMode = Boolean(storeId);
  const [form] = Form.useForm();
  const [pageLoading, setPageLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const loadStoreEditor = async () => {
      try {
        setPageLoading(true);
        const stores = await listStoresFresh();
        if (cancelled) {
          return;
        }

        if (!isEditMode) {
          form.setFieldsValue({
            code: "",
            name: "",
            taxNumber: "",
            commissionRate: 0,
            address: "",
            contactName: "",
            contactPhone: "",
            contactEmail: "",
            stockLocationName: "",
          });
          return;
        }

        const store = stores.find((item) => item.id === storeId);
        if (!store) {
          message.error("Magaza kaydi bulunamadi.");
          navigate("/stores/list");
          return;
        }
        form.setFieldsValue(store);
      } catch (error) {
        if (!cancelled) {
          message.error(error?.message || "Magaza bilgileri yuklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadStoreEditor();
    return () => {
      cancelled = true;
    };
  }, [form, isEditMode, navigate, storeId]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      const savedStore = isEditMode ? updateStore(storeId, values) : createStore(values);
      message.success(isEditMode ? "Magaza guncellendi." : "Magaza kaydedildi.");
      navigate(`/stores/${savedStore.id}`);
    } catch (error) {
      if (!error?.errorFields) {
        message.error(error?.message || "Magaza kaydedilemedi.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>{isEditMode ? "Magaza Duzenle" : "Magaza Tanimla"}</Title>
          <Text type="secondary">Magaza karti ve bagli stok yeri bilgisi birlikte kaydedilir.</Text>
        </div>
        <Space>
          <Button onClick={() => navigate("/stores/list")}>Listeye Don</Button>
          <Button type="primary" loading={loading} onClick={handleSubmit}>Kaydet</Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <Row gutter={[20, 20]}>
          <Col xs={24} xl={10}>
            <Card title="Magaza Ozet" loading={pageLoading}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Magaza Adi">{form.getFieldValue("name") || "-"}</Descriptions.Item>
                <Descriptions.Item label="Magaza Kodu">{form.getFieldValue("code") || "-"}</Descriptions.Item>
                <Descriptions.Item label="Stok Yeri">{form.getFieldValue("stockLocationName") || "-"}</Descriptions.Item>
                <Descriptions.Item label="Komisyon">{`%${Number(form.getFieldValue("commissionRate") || 0).toFixed(2)}`}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col xs={24} xl={14}>
            <Space direction="vertical" size={20} style={{ width: "100%" }}>
              <Card title="Genel Bilgiler" loading={pageLoading}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}><Form.Item name="name" label="Magaza Adi" rules={[{ required: true, message: "Magaza adi zorunludur." }]}><Input /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="code" label="Magaza Kodu" rules={[{ required: true, message: "Magaza kodu zorunludur." }]}><Input /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="taxNumber" label="VKN" rules={[{ required: true, message: "VKN zorunludur." }]}><Input /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="commissionRate" label="Calisan Komisyon Orani" rules={[{ required: true, message: "Komisyon orani zorunludur." }]}><InputNumber min={0} max={100} style={{ width: "100%" }} addonAfter="%" /></Form.Item></Col>
                  <Col xs={24}><Form.Item name="stockLocationName" label="Stok Yeri Adi" rules={[{ required: true, message: "Stok yeri adi zorunludur." }]}><Input placeholder="Sarkoy Magaza / Nisantasi Showroom" /></Form.Item></Col>
                </Row>
              </Card>

              <Card title="Iletisim Bilgileri" loading={pageLoading}>
                <Row gutter={[16, 16]}>
                  <Col xs={24}><Form.Item name="address" label="Adres"><Input.TextArea rows={4} /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="contactName" label="Yetkili Kisi"><Input /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="contactPhone" label="Iletisim Telefonu"><Input /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="contactEmail" label="Iletisim E-postasi"><Input /></Form.Item></Col>
                </Row>
              </Card>
            </Space>
          </Col>
        </Row>
      </Form>
    </Space>
  );
}
