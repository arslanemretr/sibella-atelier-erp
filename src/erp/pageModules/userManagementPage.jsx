import React from "react";
import {
  Button,
  Card,
  Checkbox,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { listSuppliersFresh } from "../suppliersData";
import { createUser, deleteUser, listUsersFresh, updateUser } from "../usersData";
import { createRole, deleteRole, listRolesFresh, updateRole } from "../rolesData";

const { Title, Text } = Typography;

const SCREEN_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "products_list", label: "Ürün Listesi" },
  { key: "pos_sessions", label: "POS — Oturumlar" },
  { key: "pos_store", label: "POS — Satış Ekranı" },
  { key: "pos_orders", label: "POS — Siparişler" },
  { key: "pos_returns", label: "POS — İadeler" },
  { key: "purchasing_suppliers", label: "Tedarikçiler" },
  { key: "purchasing_contracts", label: "Sözleşmeler" },
  { key: "stores_list", label: "Mağazalar" },
  { key: "stores_shipments", label: "Sevkiyatlar" },
  { key: "stock_entry", label: "Stok Giriş" },
  { key: "stock_list", label: "Stok Listesi" },
  { key: "stock_locations", label: "Stok Yerleri" },
  { key: "reports_consolidated", label: "Raporlar — Konsolide Hakedis" },
  { key: "reports_supplier", label: "Raporlar — Tedarikçi Hakedis" },
  { key: "settings_users", label: "Ayarlar — Kullanıcılar" },
  { key: "settings_categories", label: "Ayarlar — Kategoriler" },
  { key: "settings_collections", label: "Ayarlar — Koleksiyonlar" },
  { key: "settings_pos_categories", label: "Ayarlar — POS Kategorileri" },
  { key: "settings_barcode", label: "Ayarlar — Barkod Standartları" },
  { key: "settings_procurement", label: "Ayarlar — Tedarik Tipi" },
  { key: "settings_payment_terms", label: "Ayarlar — Ödeme Koşulları" },
  { key: "settings_parameters", label: "Ayarlar — Parametreler" },
  { key: "settings_mail", label: "Ayarlar — Mail Yönetimi" },
];

const statusOptions = ["Aktif", "Pasif"].map((v) => ({ value: v, label: v }));

function PermissionsTable({ value = {}, onChange }) {
  const handleChange = (screenKey, type, checked) => {
    const current = { ...(value[screenKey] || { view: false, write: false }) };
    if (type === "view") {
      current.view = checked;
      if (!checked) current.write = false;
    } else {
      current.write = checked;
      if (checked) current.view = true;
    }
    onChange?.({ ...value, [screenKey]: current });
  };

  const columns = [
    { title: "Ekran / Modül", dataIndex: "label", key: "label" },
    {
      title: "Görüntüleme",
      key: "view",
      width: 130,
      align: "center",
      render: (_, record) => (
        <Checkbox
          checked={Boolean(value[record.key]?.view)}
          onChange={(e) => handleChange(record.key, "view", e.target.checked)}
        />
      ),
    },
    {
      title: "Kayıt / İşlem",
      key: "write",
      width: 130,
      align: "center",
      render: (_, record) => (
        <Checkbox
          checked={Boolean(value[record.key]?.write)}
          onChange={(e) => handleChange(record.key, "write", e.target.checked)}
        />
      ),
    },
  ];

  return (
    <Table
      rowKey="key"
      size="small"
      dataSource={SCREEN_PERMISSIONS}
      columns={columns}
      pagination={false}
      bordered
    />
  );
}

function UserManagementPage() {
  const [userForm] = Form.useForm();
  const [roleForm] = Form.useForm();

  // ── Kullanıcılar ──────────────────────────────────────────────────────────
  const [users, setUsers] = React.useState([]);
  const [tableLoading, setTableLoading] = React.useState(false);
  const [supplierOptions, setSupplierOptions] = React.useState([]);
  const [userDrawerOpen, setUserDrawerOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState(null);
  const [userSaving, setUserSaving] = React.useState(false);
  const watchedRole = Form.useWatch("role", userForm);

  // ── Roller ────────────────────────────────────────────────────────────────
  const [roles, setRoles] = React.useState([]);
  const [rolesLoading, setRolesLoading] = React.useState(false);
  const [roleModalOpen, setRoleModalOpen] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState(null);
  const [roleSaving, setRoleSaving] = React.useState(false);
  const [rolePermissions, setRolePermissions] = React.useState({});

  const roleSelectOptions = React.useMemo(
    () => roles.map((r) => ({ value: r.name, label: r.name })),
    [roles],
  );

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const refreshUsers = React.useCallback(async () => {
    setTableLoading(true);
    try {
      const [nextUsers, suppliers] = await Promise.all([
        listUsersFresh(),
        listSuppliersFresh({ slim: true }),
      ]);
      setUsers(nextUsers);
      setSupplierOptions(suppliers.map((s) => ({ value: s.id, label: s.company })));
    } catch (error) {
      message.error(error?.message || "Kullanici listesi alinamadi.");
    } finally {
      setTableLoading(false);
    }
  }, []);

  const refreshRoles = React.useCallback(async () => {
    setRolesLoading(true);
    try {
      setRoles(await listRolesFresh());
    } catch (error) {
      message.error(error?.message || "Rol listesi alinamadi.");
    } finally {
      setRolesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshUsers();
    void refreshRoles();
  }, [refreshUsers, refreshRoles]);

  // ── Kullanıcı CRUD ────────────────────────────────────────────────────────
  const openCreateUser = () => {
    setEditingUser(null);
    userForm.setFieldsValue({
      fullName: "", email: "", password: "",
      role: roles[0]?.name || "Yonetici",
      supplierId: undefined, status: "Aktif",
    });
    setUserDrawerOpen(true);
  };

  const openEditUser = (user) => {
    setEditingUser(user);
    userForm.setFieldsValue({ ...user, password: "" });
    setUserDrawerOpen(true);
  };

  const handleSaveUser = async () => {
    try {
      setUserSaving(true);
      const values = await userForm.validateFields();
      const payload = {
        ...values,
        password: values.password || editingUser?.password,
        supplierId: values.role === "Tedarikci" ? (values.supplierId || null) : null,
      };
      if (editingUser) {
        await updateUser(editingUser.id, payload);
        message.success("Kullanici guncellendi.");
      } else {
        await createUser(payload);
        message.success("Kullanici eklendi.");
      }
      setUserDrawerOpen(false);
      await refreshUsers();
    } catch (error) {
      if (!error?.errorFields) message.error(error?.message || "Kullanici kaydedilemedi.");
    } finally {
      setUserSaving(false);
    }
  };

  // ── Rol CRUD ──────────────────────────────────────────────────────────────
  const openCreateRole = () => {
    setEditingRole(null);
    roleForm.resetFields();
    setRolePermissions({});
    setRoleModalOpen(true);
  };

  const openEditRole = (role) => {
    setEditingRole(role);
    roleForm.setFieldsValue({ name: role.name, description: role.description });
    setRolePermissions(role.permissions || {});
    setRoleModalOpen(true);
  };

  const handleSaveRole = async () => {
    try {
      setRoleSaving(true);
      const values = await roleForm.validateFields();
      const payload = { ...values, permissions: rolePermissions };
      if (editingRole) {
        await updateRole(editingRole.id, payload);
        message.success("Rol güncellendi.");
      } else {
        await createRole(payload);
        message.success("Rol oluşturuldu.");
      }
      setRoleModalOpen(false);
      await refreshRoles();
    } catch (error) {
      if (!error?.errorFields) message.error(error?.message || "Rol kaydedilemedi.");
    } finally {
      setRoleSaving(false);
    }
  };

  const handleDeleteRole = async (role) => {
    try {
      await deleteRole(role.id);
      message.success("Rol silindi.");
      await refreshRoles();
    } catch (error) {
      message.error(error?.message || "Rol silinemedi.");
    }
  };

  // ── Tablo kolonları ───────────────────────────────────────────────────────
  const userColumns = [
    {
      title: "Ad Soyad", dataIndex: "fullName", key: "fullName",
      render: (v, record) => (
        <button type="button" className="erp-link-button" onClick={() => openEditUser(record)}>{v}</button>
      ),
    },
    { title: "E-posta", dataIndex: "email", key: "email" },
    { title: "Rol", dataIndex: "role", key: "role" },
    {
      title: "Durum", dataIndex: "status", key: "status",
      render: (v) => <Tag color={v === "Aktif" ? "green" : "default"}>{v}</Tag>,
    },
    {
      title: "Son Giriş", dataIndex: "lastLoginAt", key: "lastLoginAt",
      render: (v) => (v ? new Date(v).toLocaleString("tr-TR") : "-"),
    },
    {
      title: "İşlemler", key: "actions",
      render: (_, record) => (
        <Space size={8}>
          <Button type="text" className="erp-icon-btn erp-icon-btn-edit" icon={<EditOutlined />} onClick={() => openEditUser(record)} />
          <Popconfirm title="Kullanici silinsin mi?" okText="Sil" cancelText="Vazgec"
            onConfirm={() => void (async () => {
              try { await deleteUser(record.id); await refreshUsers(); message.success("Kullanici silindi."); }
              catch (e) { message.error(e?.message || "Kullanici silinemedi."); }
            })()}>
            <Button type="text" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const roleColumns = [
    { title: "Rol Adı", dataIndex: "name", key: "name" },
    { title: "Açıklama", dataIndex: "description", key: "description", render: (v) => v || "-" },
    {
      title: "Tür", dataIndex: "isSystem", key: "isSystem",
      render: (v) => v ? <Tag color="blue">Sistem</Tag> : <Tag color="default">Özel</Tag>,
    },
    {
      title: "İşlemler", key: "actions",
      render: (_, record) => (
        <Space size={8}>
          <Button type="text" className="erp-icon-btn erp-icon-btn-edit" icon={<EditOutlined />} onClick={() => openEditRole(record)} />
          <Tooltip title={record.isSystem ? "Sistem rolleri silinemez" : ""}>
            <Popconfirm
              title="Bu rol silinsin mi?"
              okText="Sil" cancelText="Vazgeç"
              disabled={record.isSystem}
              onConfirm={() => void handleDeleteRole(record)}
            >
              <Button type="text" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} disabled={record.isSystem} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  const tabItems = [
    {
      key: "users",
      label: "Kullanıcılar",
      children: (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateUser}>Kullanici Ekle</Button>
          </div>
          <Card>
            <Table rowKey="id" loading={tableLoading} columns={userColumns} dataSource={users} pagination={{ pageSize: 10 }} />
          </Card>
        </Space>
      ),
    },
    {
      key: "roles",
      label: "Roller",
      children: (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateRole}>Rol Oluştur</Button>
          </div>
          <Card>
            <Table rowKey="id" loading={rolesLoading} columns={roleColumns} dataSource={roles} pagination={false} />
          </Card>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 6 }}>Kullanıcı Yönetimi</Title>
        <Text type="secondary">ERP giriş kullanıcıları, roller ve yetki yönetimi bu ekrandan yapılır.</Text>
      </div>

      <Tabs items={tabItems} />

      {/* ── Kullanıcı drawer ── */}
      <Drawer
        title={editingUser ? "Kullanici Duzenle" : "Yeni Kullanici"}
        placement="right"
        width={420}
        open={userDrawerOpen}
        onClose={() => setUserDrawerOpen(false)}
        extra={<Button type="primary" onClick={handleSaveUser} loading={userSaving}>Kaydet</Button>}
      >
        <Form form={userForm} layout="vertical">
          <Form.Item name="fullName" label="Ad Soyad" rules={[{ required: true, message: "Ad soyad zorunludur." }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="E-posta" rules={[
            { required: true, message: "E-posta zorunludur." },
            { type: "email", message: "Gecerli bir e-posta adresi girin." },
          ]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingUser ? "Yeni Sifre" : "Sifre"}
            rules={editingUser
              ? [{ min: 8, message: "Sifre en az 8 karakter olmali." }]
              : [{ required: true, message: "Sifre zorunludur." }, { min: 8, message: "Sifre en az 8 karakter olmali." }]}
          >
            <Input.Password placeholder={editingUser ? "Degistirmek istemiyorsaniz bos birakin" : "Sifre"} />
          </Form.Item>
          <Form.Item name="role" label="Rol" rules={[{ required: true, message: "Rol seciniz." }]}>
            <Select options={roleSelectOptions} />
          </Form.Item>
          {watchedRole === "Tedarikci" ? (
            <Form.Item name="supplierId" label="Tedarikci" rules={[{ required: true, message: "Tedarikci seciniz." }]}>
              <Select options={supplierOptions} showSearch optionFilterProp="label" placeholder="Tedarikci seciniz" />
            </Form.Item>
          ) : null}
          <Form.Item name="status" label="Durum" rules={[{ required: true, message: "Durum seciniz." }]}>
            <Select options={statusOptions} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Rol modal ── */}
      <Modal
        title={editingRole ? "Rol Düzenle" : "Yeni Rol Oluştur"}
        open={roleModalOpen}
        onCancel={() => setRoleModalOpen(false)}
        onOk={handleSaveRole}
        confirmLoading={roleSaving}
        okText="Kaydet"
        cancelText="İptal"
        width={760}
        destroyOnClose
      >
        <Form form={roleForm} layout="vertical" style={{ marginBottom: 16 }}>
          <Form.Item name="name" label="Rol Adı" rules={[{ required: true, message: "Rol adı zorunludur." }]}>
            <Input disabled={Boolean(editingRole?.isSystem)} placeholder="Örn: Satış Kullanıcısı" />
          </Form.Item>
          <Form.Item name="description" label="Açıklama">
            <Input.TextArea rows={2} placeholder="Bu rolün kısa açıklaması" />
          </Form.Item>
        </Form>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Ekran Yetkileri</div>
        <PermissionsTable value={rolePermissions} onChange={setRolePermissions} />
      </Modal>
    </Space>
  );
}

export default UserManagementPage;
