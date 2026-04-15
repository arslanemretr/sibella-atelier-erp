import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppstoreOutlined, BarsOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, FilterOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, Col, Descriptions, Drawer, Form, Input, Modal, Popconfirm, Row, Segmented, Select, Space, Table, Tag, Typography, message } from "antd";
import { createMasterData, listMasterDataFresh } from "../masterData";
import { listProductsFresh } from "../productsData";
import { createSupplier, deleteSupplier, listSuppliersFresh, updateSupplier } from "../suppliersData";

const { Title, Text } = Typography;

function openDetailFromRow(setSelected, setOpen, record) {
  setSelected(record);
  setOpen(true);
}

function preventRowClick(event) {
  event.stopPropagation();
}

export function SupplierListPage() {
  const navigate = useNavigate();
  const SAVED_FILTERS_KEY = "sibella.erp.supplierFilters.v1";
  const [viewMode, setViewMode] = React.useState("liste");
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedSupplier, setSelectedSupplier] = React.useState(null);
  const [suppliers, setSuppliers] = React.useState([]);
  const [tableLoading, setTableLoading] = React.useState(false);
  const [filters, setFilters] = React.useState({
    search: "",
    procurementTypeId: undefined,
    paymentTermId: undefined,
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
  const [procurementOptions, setProcurementOptions] = React.useState([{ value: "all", label: "Tumu" }]);
  const [paymentOptions, setPaymentOptions] = React.useState([{ value: "all", label: "Tumu" }]);
  const statusOptions = ["Tumu", "Aktif", "Pasif"].map((value) => ({ value, label: value }));

  const refreshSuppliers = React.useCallback(async () => {
    try {
      setTableLoading(true);
      const [nextSuppliers, procurementTypes, paymentTerms] = await Promise.all([
        listSuppliersFresh(),
        listMasterDataFresh("procurement-types"),
        listMasterDataFresh("payment-terms"),
      ]);
      setSuppliers(nextSuppliers);
      setProcurementOptions([{ value: "all", label: "Tumu" }, ...procurementTypes.map((item) => ({
        value: item.id,
        label: item.name,
      }))]);
      setPaymentOptions([{ value: "all", label: "Tumu" }, ...paymentTerms.map((item) => ({
        value: item.id,
        label: item.name,
      }))]);
    } catch (error) {
      message.error(error?.message || "Tedarikci listesi yuklenemedi.");
    } finally {
      setTableLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshSuppliers();
  }, [refreshSuppliers]);

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
      procurementTypeId: undefined,
      paymentTermId: undefined,
      status: undefined,
    });
  };

  const handleDelete = (supplierId) => {
    deleteSupplier(supplierId);
    void refreshSuppliers();
    message.success("Tedarikci silindi.");
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      [supplier.company, supplier.contact, supplier.email, supplier.phone, supplier.city]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    const matchesProcurement = !filters.procurementTypeId || filters.procurementTypeId === "all" || supplier.procurementTypeId === filters.procurementTypeId;
    const matchesPayment = !filters.paymentTermId || filters.paymentTermId === "all" || supplier.paymentTermId === filters.paymentTermId;
    const matchesStatus = !filters.status || filters.status === "Tumu" || supplier.status === filters.status;

    return matchesSearch && matchesProcurement && matchesPayment && matchesStatus;
  });

  const handleExport = () => {
    const header = ["Kisa Kod", "Firma", "Yetkili", "Tedarik Tipi", "Odeme Kosulu", "E-posta", "Telefon", "Sehir", "Durum"];
    const rows = filteredSuppliers.map((item) => [
      item.shortCode || "",
      item.company,
      item.contact,
      item.procurementTypeLabel,
      item.paymentTermLabel,
      item.email,
      item.phone,
      item.city,
      item.status,
    ]);
    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, "\"\"")}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tedarikci-listesi.csv";
    link.click();
    URL.revokeObjectURL(url);
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

  const columns = [
    {
      title: "Firma",
      dataIndex: "company",
      key: "company",
      sorter: (a, b) => a.company.localeCompare(b.company, "tr"),
      render: (value, record) => (
        <button
          type="button"
          className="erp-link-button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/purchasing/suppliers/${record.id}`);
          }}
        >
          {value}
        </button>
      ),
    },
    { title: "Yetkili", dataIndex: "contact", key: "contact", sorter: (a, b) => a.contact.localeCompare(b.contact, "tr") },
    { title: "Tedarik Tipi", dataIndex: "procurementTypeLabel", key: "procurementTypeLabel", sorter: (a, b) => a.procurementTypeLabel.localeCompare(b.procurementTypeLabel, "tr") },
    { title: "Odeme Kosulu", dataIndex: "paymentTermLabel", key: "paymentTermLabel", sorter: (a, b) => a.paymentTermLabel.localeCompare(b.paymentTermLabel, "tr") },
    { title: "E-posta", dataIndex: "email", key: "email", sorter: (a, b) => a.email.localeCompare(b.email, "tr") },
    { title: "Telefon", dataIndex: "phone", key: "phone", sorter: (a, b) => a.phone.localeCompare(b.phone, "tr") },
    { title: "Durum", dataIndex: "status", key: "status", sorter: (a, b) => a.status.localeCompare(b.status, "tr"), render: (value) => <Tag color={value === "Aktif" ? "green" : "default"}>{value}</Tag> },
    {
      title: "Islemler",
      key: "actions",
      render: (_, record) => (
        <Space size={8}>
          <Button
            type="text"
            className="erp-icon-btn erp-icon-btn-edit"
            icon={<EditOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/purchasing/suppliers/${record.id}`);
            }}
          />
          <Popconfirm title="Tedarikci silinsin mi?" okText="Sil" cancelText="Vazgec" onConfirm={() => handleDelete(record.id)}>
            <span onClick={preventRowClick}>
              <Button type="text" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} />
            </span>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Tedarikci Listesi</Title>
          <Text type="secondary">Tedarikciler tedarik tipi, odeme kosulu ve iletisim bilgileri ile izlenir.</Text>
        </div>
        <Space>
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: "kanban", icon: <AppstoreOutlined />, label: "Kanban" },
              { value: "liste", icon: <BarsOutlined />, label: "Liste" },
            ]}
          />
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/purchasing/suppliers/new")}>Tedarikci Ekle</Button>
        </Space>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar erp-product-toolbar-single">
          <Space wrap className="erp-product-toolbar-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/purchasing/suppliers/new")}>Yeni Tedarikci</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          </Space>

          <div className="erp-product-toolbar-search">
            <Input
              prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
              placeholder="Firma"
              value={filters.search}
              onChange={(event) => handleFilterChange("search", event.target.value)}
              allowClear
            />
            <Button icon={<FilterOutlined />} onClick={() => setFilterModalOpen(true)} />
          </div>
        </div>
      </Card>

      {viewMode === "liste" ? (
        <Card title="Tum Tedarikciler" className="erp-list-table-card">
          <Table
            loading={tableLoading}
            columns={columns}
            dataSource={filteredSuppliers.map((supplier) => ({ key: supplier.id, ...supplier }))}
            pagination={false}
            onRow={(record) => ({
              onClick: () => openDetailFromRow(setSelectedSupplier, setDetailOpen, record),
            })}
            rowClassName={() => "erp-clickable-row"}
          />
          <div className="erp-table-footer">
            <Space>
              <span>Sayfa Boyutu:</span>
              <Select
                defaultValue="100"
                size="small"
                style={{ width: 84 }}
                options={["25", "50", "100"].map((value) => ({ value, label: value }))}
              />
            </Space>
            <Space size={18}>
              <span>1 - {filteredSuppliers.length} / {filteredSuppliers.length}</span>
              <span>Sayfa 1 / 1</span>
            </Space>
          </div>
        </Card>
      ) : (
        <Card title="Kanban Gorunumu">
          <Row gutter={[16, 16]}>
            {filteredSuppliers.map((supplier) => (
              <Col xs={24} sm={12} xl={6} key={supplier.id}>
                <Card hoverable className="erp-product-kanban-card" bodyStyle={{ padding: 14 }} onClick={() => openDetailFromRow(setSelectedSupplier, setDetailOpen, supplier)}>
                  <div className="erp-supplier-kanban">
                    <div className="erp-supplier-avatar">{supplier.initials}</div>
                    <div className="erp-product-kanban-content">
                      <Text strong className="erp-product-kanban-title">{supplier.company}</Text>
                      <Text type="secondary" className="erp-product-kanban-code">{supplier.contact}</Text>
                      <Text className="erp-product-kanban-line">{supplier.procurementTypeLabel}</Text>
                      <Text className="erp-product-kanban-line">{supplier.paymentTermLabel}</Text>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Drawer title="Tedarikci Detayi" placement="right" width={420} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {selectedSupplier ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Kisa Kod">{selectedSupplier.shortCode || "-"}</Descriptions.Item>
            <Descriptions.Item label="Firma">{selectedSupplier.company}</Descriptions.Item>
            <Descriptions.Item label="Yetkili">{selectedSupplier.contact}</Descriptions.Item>
            <Descriptions.Item label="Tedarik Tipi">{selectedSupplier.procurementTypeLabel}</Descriptions.Item>
            <Descriptions.Item label="Odeme Kosulu">{selectedSupplier.paymentTermLabel}</Descriptions.Item>
            <Descriptions.Item label="E-posta">{selectedSupplier.email}</Descriptions.Item>
            <Descriptions.Item label="Telefon">{selectedSupplier.phone}</Descriptions.Item>
            <Descriptions.Item label="Sehir">{selectedSupplier.city || "-"}</Descriptions.Item>
            <Descriptions.Item label="Durum">{selectedSupplier.status}</Descriptions.Item>
            <Descriptions.Item label="Not">{selectedSupplier.note || "-"}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>

      <Modal title="Gelismis Filtreler" open={filterModalOpen} onCancel={() => setFilterModalOpen(false)} footer={null}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={[12, 12]}>
            <Col span={24}>
              <Form.Item label="Tedarik Tipi">
                <Select value={filters.procurementTypeId} onChange={(value) => handleFilterChange("procurementTypeId", value)} options={procurementOptions} allowClear />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Odeme Kosulu">
                <Select value={filters.paymentTermId} onChange={(value) => handleFilterChange("paymentTermId", value)} options={paymentOptions} allowClear />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Durum">
                <Select value={filters.status} onChange={(value) => handleFilterChange("status", value)} options={statusOptions} allowClear />
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

export function SupplierEditorPage() {
  const navigate = useNavigate();
  const { supplierId } = useParams();
  const isEditMode = Boolean(supplierId);
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [pageLoading, setPageLoading] = React.useState(false);
  const [productList, setProductList] = React.useState([]);
  const [supplierList, setSupplierList] = React.useState([]);
  const [procurementOptions, setProcurementOptions] = React.useState([]);
  const [paymentOptions, setPaymentOptions] = React.useState([]);
  const logoInputRef = React.useRef(null);
  const [logoValue, setLogoValue] = React.useState("");
  const watchedCompany = Form.useWatch("company", form) || "Yeni Tedarikci";
  const watchedShortCode = Form.useWatch("shortCode", form) || "-";
  const watchedContact = Form.useWatch("contact", form) || "Yetkili kisi bilgisi";
  const watchedProcurementTypeId = Form.useWatch("procurementTypeId", form);
  const watchedPaymentTermId = Form.useWatch("paymentTermId", form);
  const watchedIban = Form.useWatch("iban", form) || "-";
  const watchedStatus = Form.useWatch("status", form) || "-";
  const watchedSupplierProducts = React.useMemo(
    () =>
      productList
        .filter((item) => item.supplierId === supplierId)
        .map((item) => ({
          key: item.id,
          code: item.code,
          name: item.name,
          id: item.id,
        })),
    [productList, supplierId],
  );
  const statusOptions = ["Aktif", "Pasif"].map((value) => ({ value, label: value }));

  React.useEffect(() => {
    let cancelled = false;
    const baseValues = {
      shortCode: "",
      company: "",
      logo: "",
      contact: "",
      email: "",
      phone: "",
      city: "",
      iban: "",
      taxNumber: "",
      taxOffice: "",
      address: "",
      procurementTypeId: undefined,
      paymentTermId: undefined,
      status: "Aktif",
      note: "",
    };

    const loadSupplierEditor = async () => {
      try {
        setPageLoading(true);
        const [suppliers, products, procurementTypes, paymentTerms] = await Promise.all([
          listSuppliersFresh(),
          listProductsFresh(),
          listMasterDataFresh("procurement-types"),
          listMasterDataFresh("payment-terms"),
        ]);

        if (cancelled) {
          return;
        }

        setSupplierList(suppliers);
        setProductList(products);
        setProcurementOptions(procurementTypes.map((item) => ({
          value: item.id,
          label: item.name,
        })));
        setPaymentOptions(paymentTerms.map((item) => ({
          value: item.id,
          label: item.name,
        })));

        if (!isEditMode) {
          form.setFieldsValue(baseValues);
          setLogoValue(baseValues.logo || "");
          return;
        }

        const supplier = suppliers.find((item) => item.id === supplierId);
        if (!supplier) {
          message.error("Tedarikci kaydi bulunamadi.");
          navigate("/purchasing/suppliers");
          return;
        }

        form.setFieldsValue({ ...baseValues, ...supplier });
        setLogoValue(supplier.logo || "");
      } catch (error) {
        if (!cancelled) {
          message.error(error?.message || "Tedarikci verileri alinamadi.");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadSupplierEditor();

    return () => {
      cancelled = true;
    };
  }, [form, isEditMode, navigate, supplierId]);

  const handleLogoUpload = (file) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      message.error("Gecerli bir gorsel secmelisiniz.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLogoValue(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const formValues = await form.validateFields();
      const values = {
        ...formValues,
        logo: logoValue || "",
      };
      const duplicateSupplier = supplierList.find((item) => item.email === values.email && item.id !== supplierId);
      if (values.email && duplicateSupplier) {
        message.error("Bu e-posta ile baska bir tedarikci kayitli.");
        return;
      }

      const savedSupplier = isEditMode ? updateSupplier(supplierId, values) : createSupplier(values);
      message.success(isEditMode ? "Tedarikci guncellendi." : "Tedarikci kaydedildi.");
      navigate(`/purchasing/suppliers/${savedSupplier.id}`);
    } catch {
      // form validation handles error display
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>{isEditMode ? "Tedarikci Duzenle" : "Tedarikci Ekle"}</Title>
          <Text type="secondary">Tedarikci kartina ait temel bilgiler, tedarik tipi ve odeme kosulu burada yonetilir.</Text>
        </div>
        <Space>
          <Button onClick={() => navigate("/purchasing/suppliers")}>Listeye Don</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>Kaydet</Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <Row gutter={[20, 20]}>
          <Col xs={24} xl={8}>
            <Space direction="vertical" size={20} style={{ width: "100%" }}>
              <Card title="Tedarikci Ozet" loading={pageLoading}>
                <Space direction="vertical" size={14} style={{ width: "100%" }}>
                  <div className="erp-supplier-summary">
                    {logoValue ? (
                      <img src={logoValue} alt={watchedCompany} className="erp-supplier-avatar erp-supplier-avatar-large erp-supplier-logo-image" />
                    ) : (
                      <div className="erp-supplier-avatar erp-supplier-avatar-large erp-supplier-logo-empty">
                        Logo
                      </div>
                    )}
                    <div>
                      <Title level={5} style={{ margin: 0 }}>{watchedCompany}</Title>
                      <Text type="secondary">{watchedContact}</Text>
                    </div>
                  </div>
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="Kisa Kod">{watchedShortCode}</Descriptions.Item>
                    <Descriptions.Item label="Tedarik Tipi">
                      {procurementOptions.find((item) => item.value === watchedProcurementTypeId)?.label || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Odeme Kosulu">
                      {paymentOptions.find((item) => item.value === watchedPaymentTermId)?.label || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="IBAN">{watchedIban}</Descriptions.Item>
                    <Descriptions.Item label="Durum">{watchedStatus}</Descriptions.Item>
                  </Descriptions>
                </Space>
              </Card>

              <Card title="Tedarikci Urunleri" loading={pageLoading}>
                <Table
                  size="small"
                  pagination={false}
                  locale={{ emptyText: "Bu tedarikci ile eslesen urun yok." }}
                  dataSource={watchedSupplierProducts}
                  columns={[
                    {
                      title: "Urun Kodu",
                      dataIndex: "code",
                      key: "code",
                      render: (value, record) => (
                        <button
                          type="button"
                          className="erp-link-button"
                          onClick={() => navigate(`/products/${record.id}`)}
                        >
                          {value}
                        </button>
                      ),
                    },
                    {
                      title: "Urun Adi",
                      dataIndex: "name",
                      key: "name",
                    },
                  ]}
                />
              </Card>
            </Space>
          </Col>

          <Col xs={24} xl={16}>
            <Space direction="vertical" size={20} style={{ width: "100%" }}>
              <Card title="Genel Bilgiler" loading={pageLoading}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}><Form.Item name="shortCode" label="Tedarikci Kisa Kod"><Input placeholder="MINA" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="company" label="Firma / Kisi Adi" rules={[{ required: true, message: "Firma adi zorunludur." }]}><Input placeholder="Mina Aksesuar" /></Form.Item></Col>
                  <Col xs={24}>
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                      <Text strong>Tedarikci Logosu</Text>
                      <div className="erp-supplier-logo-upload">
                        {logoValue ? (
                          <img src={logoValue} alt={watchedCompany} className="erp-supplier-logo-preview" />
                        ) : (
                          <div className="erp-supplier-logo-placeholder">Logo onizleme</div>
                        )}
                      </div>
                      <Space wrap>
                        <Button onClick={() => logoInputRef.current?.click()}>Logo Sec</Button>
                        {logoValue ? <Button onClick={() => setLogoValue("")}>Logoyu Kaldir</Button> : null}
                      </Space>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(event) => {
                          handleLogoUpload(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                    </Space>
                  </Col>
                  <Col xs={24} md={12}><Form.Item name="contact" label="Yetkili Kisi" rules={[{ required: true, message: "Yetkili kisi zorunludur." }]}><Input placeholder="Mina Demir" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="email" label="E-posta" rules={[{ type: "email", message: "Gecerli e-posta girin." }]}><Input placeholder="ornek@tedarikci.com" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="phone" label="Telefon"><Input placeholder="0532..." /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="city" label="Sehir"><Input placeholder="Istanbul" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="status" label="Durum"><Select options={statusOptions} /></Form.Item></Col>
                </Row>
              </Card>

              <Card title="Vergi ve Banka Bilgileri" loading={pageLoading}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}><Form.Item name="iban" label="IBAN"><Input placeholder="TR..." /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="taxNumber" label="Vergi Kimlik No"><Input placeholder="1234567890" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="taxOffice" label="Vergi Dairesi"><Input placeholder="Beyoglu" /></Form.Item></Col>
                  <Col xs={24}><Form.Item name="address" label="Adres"><Input.TextArea rows={4} placeholder="Acik adres bilgisi" /></Form.Item></Col>
                </Row>
              </Card>

              <Card title="Tedarik Parametreleri" loading={pageLoading}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}><Form.Item name="procurementTypeId" label="Tedarik Tipi" rules={[{ required: true, message: "Tedarik tipi seciniz." }]}><Select options={procurementOptions} placeholder="Tedarik tipi seciniz" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="paymentTermId" label="Odeme Kosulu" rules={[{ required: true, message: "Odeme kosulu seciniz." }]}><Select options={paymentOptions} placeholder="Odeme kosulu seciniz" /></Form.Item></Col>
                </Row>
              </Card>

              <Card title="Notlar" loading={pageLoading}>
                <Form.Item name="note">
                  <Input.TextArea rows={5} placeholder="Tedarikci ile ilgili dahili notlar" />
                </Form.Item>
              </Card>
            </Space>
          </Col>
        </Row>
      </Form>
    </Space>
  );
}
