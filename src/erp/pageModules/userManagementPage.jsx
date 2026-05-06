import React from "react";
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { listSuppliersFresh } from "../suppliersData";
import { createUser, deleteUser, listUsersFresh, updateUser } from "../usersData";

const { Title, Text } = Typography;

const roleOptions = ["Yonetici", "Magaza", "Muhasebe", "Tedarikci"].map((value) => ({ value, label: value }));
const statusOptions = ["Aktif", "Pasif"].map((value) => ({ value, label: value }));

function UserManagementPage() {
  const [form] = Form.useForm();
  const [users, setUsers] = React.useState([]);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [tableLoading, setTableLoading] = React.useState(false);
  const [supplierOptions, setSupplierOptions] = React.useState([]);
  const watchedRole = Form.useWatch("role", form);

  const refreshUsers = async () => {
    setTableLoading(true);
    try {
      const [nextUsers, suppliers] = await Promise.all([
        listUsersFresh(),
        listSuppliersFresh({ slim: true }),
      ]);
      setUsers(nextUsers);
      setSupplierOptions(suppliers.map((item) => ({ value: item.id, label: item.company })));
    } catch (error) {
      message.error(error?.message || "Kullanici listesi alinamadi.");
    } finally {
      setTableLoading(false);
    }
  };

  React.useEffect(() => {
    void refreshUsers();
  }, []);

  const openCreate = () => {
    setEditingUser(null);
    form.setFieldsValue({
      fullName: "",
      email: "",
      password: "",
      role: "Magaza",
      supplierId: undefined,
      status: "Aktif",
    });
    setDrawerOpen(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    form.setFieldsValue({
      ...user,
      password: "",
    });
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      const payload = {
        ...values,
        password: values.password || editingUser?.password,
        supplierId: values.role === "Tedarikci" ? values.supplierId || null : null,
      };

      if (editingUser) {
        await updateUser(editingUser.id, payload);
        message.success("Kullanici guncellendi.");
      } else {
        await createUser(payload);
        message.success("Kullanici eklendi.");
      }

      setDrawerOpen(false);
      await refreshUsers();
    } catch (error) {
      if (!error?.errorFields) {
        message.error(error?.message || "Kullanici kaydi basarisiz oldu.");
      }
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Ad Soyad",
      dataIndex: "fullName",
      key: "fullName",
      render: (value, record) => (
        <button type="button" className="erp-link-button" onClick={() => openEdit(record)}>
          {value}
        </button>
      ),
    },
    { title: "E-posta", dataIndex: "email", key: "email" },
    { title: "Rol", dataIndex: "role", key: "role" },
    {
      title: "Durum",
      dataIndex: "status",
      key: "status",
      render: (value) => <Tag color={value === "Aktif" ? "green" : "default"}>{value}</Tag>,
    },
    {
      title: "Son Giris",
      dataIndex: "lastLoginAt",
      key: "lastLoginAt",
      render: (value) => (value ? new Date(value).toLocaleString("tr-TR") : "-"),
    },
    {
      title: "Islemler",
      key: "actions",
      render: (_, record) => (
        <Space size={8}>
          <Button type="text" className="erp-icon-btn erp-icon-btn-edit" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="Kullanici silinsin mi?" okText="Sil" cancelText="Vazgec" onConfirm={() => {
            void (async () => {
              try {
                await deleteUser(record.id);
                await refreshUsers();
                message.success("Kullanici silindi.");
              } catch (error) {
                message.error(error?.message || "Kullanici silinemedi.");
              }
            })();
          }}>
            <Button type="text" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Kullanici</Title>
          <Text type="secondary">ERP giris kullanicilari, roller ve durum yonetimi bu ekrandan yapilir.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Kullanici Ekle</Button>
      </div>

      <Card>
        <Table rowKey="id" loading={tableLoading} columns={columns} dataSource={users} pagination={{ pageSize: 10 }} />
      </Card>

      <Drawer
        title={editingUser ? "Kullanici Duzenle" : "Yeni Kullanici"}
        placement="right"
        width={420}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={<Button type="primary" onClick={handleSubmit} loading={loading}>Kaydet</Button>}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="fullName" label="Ad Soyad" rules={[{ required: true, message: "Ad soyad zorunludur." }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="E-posta"
            rules={[
              { required: true, message: "E-posta zorunludur." },
              { type: "email", message: "Gecerli bir e-posta adresi girin." },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingUser ? "Yeni Sifre" : "Sifre"}
            rules={
              editingUser
                ? [{ min: 8, message: "Yeni sifre en az 8 karakter olmali." }]
                : [
                    { required: true, message: "Sifre zorunludur." },
                    { min: 8, message: "Sifre en az 8 karakter olmali." },
                  ]
            }
          >
            <Input.Password placeholder={editingUser ? "Degistirmek istemiyorsaniz bos birakin" : "Sifre"} />
          </Form.Item>
          <Form.Item name="role" label="Rol" rules={[{ required: true, message: "Rol seciniz." }]}>
            <Select options={roleOptions} />
          </Form.Item>
          {watchedRole === "Tedarikci" ? (
            <Form.Item
              name="supplierId"
              label="Tedarikci"
              rules={[{ required: true, message: "Tedarikci seciniz." }]}
            >
              <Select
                options={supplierOptions}
                showSearch
                optionFilterProp="label"
                placeholder="Tedarikci seciniz"
              />
            </Form.Item>
          ) : null}
          <Form.Item name="status" label="Durum" rules={[{ required: true, message: "Durum seciniz." }]}>
            <Select options={statusOptions} />
          </Form.Item>
        </Form>
      </Drawer>
    </Space>
  );
}

export default UserManagementPage;
