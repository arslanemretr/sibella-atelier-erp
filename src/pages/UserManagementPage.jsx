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
import { listSuppliers } from "../erp/suppliersData";
import { createUser, deleteUser, listUsers, updateUser } from "../erp/usersData";

const { Title, Text } = Typography;

const roleOptions = ["Yonetici", "Magaza", "Muhasebe", "Tedarikci"].map((value) => ({ value, label: value }));
const statusOptions = ["Aktif", "Pasif"].map((value) => ({ value, label: value }));

function UserManagementPage() {
  const [form] = Form.useForm();
  const [users, setUsers] = React.useState(() => listUsers());
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const watchedRole = Form.useWatch("role", form);
  const supplierOptions = React.useMemo(
    () => listSuppliers().map((item) => ({ value: item.id, label: item.company })),
    [],
  );

  const refreshUsers = () => setUsers(listUsers());

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
        updateUser(editingUser.id, payload);
        message.success("Kullanici guncellendi.");
      } else {
        createUser(payload);
        message.success("Kullanici eklendi.");
      }

      setDrawerOpen(false);
      refreshUsers();
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
            deleteUser(record.id);
            refreshUsers();
            message.success("Kullanici silindi.");
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
        <Table rowKey="id" columns={columns} dataSource={users} pagination={{ pageSize: 10 }} />
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
          <Form.Item name="email" label="E-posta" rules={[{ required: true, message: "E-posta zorunludur." }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label={editingUser ? "Yeni Sifre" : "Sifre"} rules={editingUser ? [] : [{ required: true, message: "Sifre zorunludur." }]}>
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
