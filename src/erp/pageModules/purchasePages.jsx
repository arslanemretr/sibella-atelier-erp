import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DeleteOutlined, DownloadOutlined, EditOutlined, FilterOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, Col, Descriptions, Drawer, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Typography, message } from "antd";
import { listMasterDataFresh } from "../masterData";
import { listProductsFresh } from "../productsData";
import { createPurchase, listPurchasesFresh, updatePurchase } from "../purchasesData";
import { listSuppliersFresh } from "../suppliersData";

const { Title, Text } = Typography;

function openDetailFromRow(setSelected, setOpen, record) {
  setSelected(record);
  setOpen(true);
}

export function PurchaseListPage() {
  const navigate = useNavigate();
  const SAVED_FILTERS_KEY = "sibella.erp.purchaseFilters.v1";
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedPurchase, setSelectedPurchase] = React.useState(null);
  const [purchases, setPurchases] = React.useState([]);
  const [tableLoading, setTableLoading] = React.useState(true);
  const [supplierOptions, setSupplierOptions] = React.useState([{ value: "all", label: "Tumu" }]);
  const [procurementOptions, setProcurementOptions] = React.useState([{ value: "all", label: "Tumu" }]);
  const [paymentOptions, setPaymentOptions] = React.useState([{ value: "all", label: "Tumu" }]);
  const [filters, setFilters] = React.useState({
    search: "",
    supplierId: undefined,
    procurementTypeId: undefined,
    paymentTermId: undefined,
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

  const refreshPurchases = React.useCallback(async () => {
    setTableLoading(true);
    try {
      const [suppliers, procurementTypes, paymentTerms, products] = await Promise.all([
        listSuppliersFresh(),
        listMasterDataFresh("procurement-types"),
        listMasterDataFresh("payment-terms"),
        listProductsFresh(),
      ]);
      const purchaseRows = await listPurchasesFresh({
        suppliers,
        procurementTypes,
        paymentTerms,
        products,
      });
      setPurchases(purchaseRows);
      setSupplierOptions([{ value: "all", label: "Tumu" }, ...suppliers.map((item) => ({ value: item.id, label: item.company }))]);
      setProcurementOptions([{ value: "all", label: "Tumu" }, ...procurementTypes.map((item) => ({ value: item.id, label: item.name }))]);
      setPaymentOptions([{ value: "all", label: "Tumu" }, ...paymentTerms.map((item) => ({ value: item.id, label: item.name }))]);
    } catch (error) {
      message.error(error?.message || "Satinalma listesi yuklenemedi.");
    } finally {
      setTableLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshPurchases();
  }, [refreshPurchases]);

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
      supplierId: undefined,
      procurementTypeId: undefined,
      paymentTermId: undefined,
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

  const filteredPurchases = purchases.filter((purchase) => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      [purchase.documentNo, purchase.supplierName, purchase.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    const matchesSupplier = !filters.supplierId || filters.supplierId === "all" || purchase.supplierId === filters.supplierId;
    const matchesProcurement = !filters.procurementTypeId || filters.procurementTypeId === "all" || purchase.procurementTypeId === filters.procurementTypeId;
    const matchesPayment = !filters.paymentTermId || filters.paymentTermId === "all" || purchase.paymentTermId === filters.paymentTermId;
    return matchesSearch && matchesSupplier && matchesProcurement && matchesPayment;
  });

  const handleExport = () => {
    const header = ["Belge No", "Tarih", "Tedarikci", "Tedarik Tipi", "Odeme Kosulu", "Kalem", "Toplam"];
    const rows = filteredPurchases.map((item) => [
      item.documentNo,
      item.date,
      item.supplierName,
      item.procurementTypeLabel,
      item.paymentTermLabel,
      item.lineCount,
      item.totalAmountDisplay,
    ]);
    const csvContent = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, "\"\"")}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "satinalma-listesi.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      title: "Belge No",
      dataIndex: "documentNo",
      key: "documentNo",
      sorter: (a, b) => a.documentNo.localeCompare(b.documentNo, "tr"),
      render: (value, record) => (
        <button
          type="button"
          className="erp-link-button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/purchasing/entry/${record.id}`);
          }}
        >
          {value}
        </button>
      ),
    },
    { title: "Tarih", dataIndex: "date", key: "date", sorter: (a, b) => a.date.localeCompare(b.date, "tr") },
    { title: "Tedarikci", dataIndex: "supplierName", key: "supplierName", sorter: (a, b) => a.supplierName.localeCompare(b.supplierName, "tr") },
    { title: "Tedarik Tipi", dataIndex: "procurementTypeLabel", key: "procurementTypeLabel", sorter: (a, b) => a.procurementTypeLabel.localeCompare(b.procurementTypeLabel, "tr") },
    { title: "Odeme Kosulu", dataIndex: "paymentTermLabel", key: "paymentTermLabel", sorter: (a, b) => a.paymentTermLabel.localeCompare(b.paymentTermLabel, "tr") },
    { title: "Kalem", dataIndex: "lineCount", key: "lineCount", sorter: (a, b) => a.lineCount - b.lineCount },
    { title: "Toplam", dataIndex: "totalAmountDisplay", key: "totalAmountDisplay", sorter: (a, b) => a.totalAmount - b.totalAmount },
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
              navigate(`/purchasing/entry/${record.id}`);
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Satinalma Listesi</Title>
          <Text type="secondary">Gecmis satin alma kayitlari tedarikci, belge ve toplam tutar ile listelenir.</Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/purchasing/entry")}>Satinalma Giris</Button>
        </Space>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar erp-product-toolbar-single">
          <Space wrap className="erp-product-toolbar-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/purchasing/entry")}>Yeni Satinalma</Button>
            <Button icon={<SearchOutlined />} onClick={() => message.info(`${filteredPurchases.length} kayit listeleniyor.`)}>Ara</Button>
            <Button icon={<DeleteOutlined />} onClick={handleResetFilters}>Temizle</Button>
            <Button icon={<ReloadOutlined />} onClick={() => { void refreshPurchases(); message.success("Satinalma listesi yenilendi."); }}>Yenile</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          </Space>
          <div className="erp-product-toolbar-search">
            <Input
              prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
              placeholder="Belge No"
              value={filters.search}
              onChange={(event) => handleFilterChange("search", event.target.value)}
              allowClear
            />
            <Button icon={<FilterOutlined />} onClick={() => setFilterModalOpen(true)} />
          </div>
        </div>
      </Card>

      <Card title="Tum Satinalma Kayitlari" className="erp-list-table-card">
        <Table
          loading={tableLoading}
          columns={columns}
          dataSource={filteredPurchases.map((purchase) => ({ key: purchase.id, ...purchase }))}
          pagination={false}
          onRow={(record) => ({
            onClick: () => openDetailFromRow(setSelectedPurchase, setDetailOpen, record),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
        <div className="erp-table-footer">
          <Space>
            <span>Sayfa Boyutu:</span>
            <Select defaultValue="100" size="small" style={{ width: 84 }} options={["25", "50", "100"].map((value) => ({ value, label: value }))} />
          </Space>
          <Space size={18}>
            <span>1 - {filteredPurchases.length} / {filteredPurchases.length}</span>
            <span>Sayfa 1 / 1</span>
          </Space>
        </div>
      </Card>

      <Drawer title="Satinalma Detayi" placement="right" width={460} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {selectedPurchase ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Belge No">{selectedPurchase.documentNo}</Descriptions.Item>
              <Descriptions.Item label="Tarih">{selectedPurchase.date}</Descriptions.Item>
              <Descriptions.Item label="Tedarikci">{selectedPurchase.supplierName}</Descriptions.Item>
              <Descriptions.Item label="Tedarik Tipi">{selectedPurchase.procurementTypeLabel}</Descriptions.Item>
              <Descriptions.Item label="Odeme Kosulu">{selectedPurchase.paymentTermLabel}</Descriptions.Item>
              <Descriptions.Item label="Toplam">{selectedPurchase.totalAmountDisplay}</Descriptions.Item>
              <Descriptions.Item label="Aciklama">{selectedPurchase.description || "-"}</Descriptions.Item>
            </Descriptions>
            <Card size="small" title="Kalemler">
              <Table
                rowKey="id"
                pagination={false}
                columns={[
                  { title: "Urun", dataIndex: "productName", key: "productName" },
                  { title: "Miktar", dataIndex: "quantity", key: "quantity" },
                  { title: "Birim Fiyat", dataIndex: "unitPriceDisplay", key: "unitPriceDisplay" },
                  { title: "Not", dataIndex: "note", key: "note" },
                ]}
                dataSource={selectedPurchase.lines}
                size="small"
              />
            </Card>
          </Space>
        ) : null}
      </Drawer>

      <Modal title="Gelismis Filtreler" open={filterModalOpen} onCancel={() => setFilterModalOpen(false)} footer={null}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={[12, 12]}>
            <Col span={24}>
              <Form.Item label="Tedarikci">
                <Select value={filters.supplierId} onChange={(value) => handleFilterChange("supplierId", value)} options={supplierOptions} allowClear />
              </Form.Item>
            </Col>
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

export function PurchaseEditorPage() {
  const navigate = useNavigate();
  const { purchaseId } = useParams();
  const isEditMode = Boolean(purchaseId);
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [pageLoading, setPageLoading] = React.useState(true);
  const [supplierOptions, setSupplierOptions] = React.useState([]);
  const [procurementOptions, setProcurementOptions] = React.useState([]);
  const [paymentOptions, setPaymentOptions] = React.useState([]);
  const [productOptions, setProductOptions] = React.useState([]);

  React.useEffect(() => {
    let cancelled = false;

    const loadPage = async () => {
      setPageLoading(true);
      try {
        const [suppliers, procurementTypes, paymentTerms, products, purchases] = await Promise.all([
          listSuppliersFresh(),
          listMasterDataFresh("procurement-types"),
          listMasterDataFresh("payment-terms"),
          listProductsFresh(),
          listPurchasesFresh(),
        ]);

        if (cancelled) {
          return;
        }

        setSupplierOptions(suppliers.map((item) => ({ value: item.id, label: item.company })));
        setProcurementOptions(procurementTypes.map((item) => ({ value: item.id, label: item.name })));
        setPaymentOptions(paymentTerms.map((item) => ({ value: item.id, label: item.name })));
        setProductOptions(products.map((item) => ({
          value: item.id,
          label: `${item.code} - ${item.name}`,
          searchText: `${item.code} ${item.name} ${item.categoryLabel}`.toLowerCase(),
        })));

        const baseValues = {
          documentNo: `SAT-${new Date().getFullYear()}-${String(purchases.length + 1).padStart(3, "0")}`,
          supplierId: undefined,
          date: new Date().toISOString().slice(0, 10),
          procurementTypeId: undefined,
          paymentTermId: undefined,
          description: "",
          lines: [{ productId: undefined, quantity: 1, unitPrice: 0, note: "" }],
        };

        if (!isEditMode) {
          form.setFieldsValue(baseValues);
          return;
        }

        const purchase = purchases.find((item) => item.id === purchaseId);
        if (!purchase) {
          message.error("Satinalma kaydi bulunamadi.");
          navigate("/purchasing/list");
          return;
        }

        form.setFieldsValue({
          ...baseValues,
          ...purchase,
          lines: purchase.lines?.length ? purchase.lines : baseValues.lines,
        });
      } catch (error) {
        if (!cancelled) {
          message.error(error?.message || "Satinalma ekrani yuklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [form, isEditMode, navigate, purchaseId]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      const savedPurchase = isEditMode ? updatePurchase(purchaseId, values) : createPurchase(values);
      message.success(isEditMode ? "Satinalma guncellendi." : "Satinalma kaydedildi.");
      navigate(`/purchasing/entry/${savedPurchase.id}`);
    } catch {
      // form validation handles errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>{isEditMode ? "Satinalma Duzenle" : "Satinalma Giris"}</Title>
          <Text type="secondary">Tedarikci, belge ve urun satirlari ile satin alma kaydi acilir.</Text>
        </div>
        <Space>
          <Button onClick={() => navigate("/purchasing/list")}>Listeye Don</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>Kaydet</Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <div className="erp-form-stack">
          <Card title="Genel Bilgiler" loading={pageLoading}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}><Form.Item name="supplierId" label="Tedarikci" rules={[{ required: true, message: "Tedarikci seciniz." }]}><Select options={supplierOptions} showSearch optionFilterProp="label" placeholder="Tedarikci seciniz" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="date" label="Tarih" rules={[{ required: true, message: "Tarih zorunludur." }]}><Input type="date" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="documentNo" label="Belge No" rules={[{ required: true, message: "Belge no zorunludur." }]}><Input placeholder="SAT-2026-001" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="procurementTypeId" label="Tedarik Tipi"><Select options={procurementOptions} placeholder="Seciniz" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="paymentTermId" label="Odeme Kosulu"><Select options={paymentOptions} placeholder="Seciniz" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="description" label="Aciklama"><Input placeholder="Aciklama" /></Form.Item></Col>
            </Row>
          </Card>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <Card title="Satinalma Kalemleri" extra={<Button icon={<PlusOutlined />} onClick={() => add({ productId: undefined, quantity: 1, unitPrice: 0, note: "" })}>Satir Ekle</Button>}>
                <Table
                  rowKey="key"
                  pagination={false}
                  dataSource={fields.map((field) => ({ key: field.key, field }))}
                  columns={[
                    {
                      title: "Urun",
                      dataIndex: "product",
                      key: "product",
                      render: (_, record) => (
                        <Form.Item name={[record.field.name, "productId"]} rules={[{ required: true, message: "Urun seciniz." }]}>
                          <Select
                            showSearch
                            placeholder="Urun seciniz"
                            options={productOptions}
                            optionFilterProp="label"
                            filterOption={(input, option) => {
                              const label = String(option?.label || "").toLowerCase();
                              return label.includes(input.toLowerCase());
                            }}
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "Miktar",
                      key: "quantity",
                      render: (_, record) => (
                        <Form.Item name={[record.field.name, "quantity"]} rules={[{ required: true, message: "Miktar girin." }]}>
                          <InputNumber min={1} style={{ width: "100%" }} />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "Birim Fiyat",
                      key: "unitPrice",
                      render: (_, record) => (
                        <Form.Item name={[record.field.name, "unitPrice"]} rules={[{ required: true, message: "Birim fiyat girin." }]}>
                          <InputNumber min={0} style={{ width: "100%" }} />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "Not",
                      key: "note",
                      render: (_, record) => (
                        <Form.Item name={[record.field.name, "note"]}>
                          <Input placeholder="Satir notu" />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "Islemler",
                      key: "actions",
                      width: 110,
                      render: (_, record) => (
                        <Button type="text" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} onClick={() => remove(record.field.name)} />
                      ),
                    },
                  ]}
                />
              </Card>
            )}
          </Form.List>
        </div>
      </Form>
    </Space>
  );
}
