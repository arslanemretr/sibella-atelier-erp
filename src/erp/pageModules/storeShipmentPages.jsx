import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AutoComplete, Button, Card, Col, Descriptions, Drawer, Form, Input, InputNumber, Row, Select, Space, Table, Tag, Tooltip, Typography, Upload, message } from "antd";
import { CheckOutlined, DeleteOutlined, EditOutlined, FilePdfOutlined, PlusCircleOutlined, PlusOutlined, SendOutlined, UploadOutlined } from "@ant-design/icons";
import { getAuthUser } from "../../auth";
import { listMasterData } from "../masterData";
import { createProduct, listProductsFresh } from "../productsData";
import { listSuppliers } from "../suppliersData";
import { createStoreShipment, createStoreShipmentPdf, getNextStoreShipmentNoPreviewFresh, getStoreShipmentById, listStoreShipmentsFresh, sendStoreShipment, updateStoreShipment } from "../storeShipmentsData";
import { listStoresFresh } from "../storesData";

const { Title, Text } = Typography;

function formatMoney(value, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDisplayDate(value) {
  if (!value) return "-";
  const [y, m, d] = String(value).split("-");
  if (!y || !m || !d) return value;
  return `${d}.${m}.${String(y).slice(2)}`;
}

function buildDraftFromProduct(product) {
  return {
    productId: product.id,
    isManualProduct: false,
    image: product.image || "",
    name: product.name || "",
    code: product.code || "",
    salePrice: Number(product.salePrice || 0),
    saleCurrency: product.saleCurrency || "TRY",
    quantity: 1,
    description: "",
  };
}

export function StoreShipmentListPage() {
  const navigate = useNavigate();
  const [shipments, setShipments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedShipment, setSelectedShipment] = React.useState(null);

  const refreshShipments = React.useCallback(async () => {
    try {
      setLoading(true);
      setShipments(await listStoreShipmentsFresh());
    } catch (error) {
      message.error(error?.message || "Gonderi listesi yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshShipments();
  }, [refreshShipments]);

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Gonderi Listesi</Title>
          <Text type="secondary">Magazalara acilan konsinye gonderiler durum bazli izlenir.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/stores/shipments/new")}>Gonderi Olustur</Button>
      </div>

      <Card title="Tum Gonderiler" className="erp-list-table-card" style={{ paddingBottom: 24 }}>
        <Table
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 900 }}
          dataSource={shipments}
          columns={[
            {
              title: "Gonderi No",
              dataIndex: "shipmentNo",
              key: "shipmentNo",
              render: (value, record) => (
                <button
                  type="button"
                  className="erp-link-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/stores/shipments/${record.id}`);
                  }}
                >
                  {value}
                </button>
              ),
            },
            { title: "Magaza", dataIndex: "storeName", key: "storeName" },
            {
              title: "Tarih",
              dataIndex: "date",
              key: "date",
              render: (value) => formatDisplayDate(value),
            },
            { title: "Kalem", dataIndex: "lineCount", key: "lineCount", width: 80 },
            { title: "Toplam Adet", dataIndex: "totalQuantity", key: "totalQuantity", width: 110 },
            { title: "Toplam Tutar", dataIndex: "totalAmountDisplay", key: "totalAmountDisplay" },
            {
              title: "Durum",
              dataIndex: "status",
              key: "status",
              render: (value) => (
                <Tag color={value === "Gonderildi" ? "green" : value === "Hazirlandi" ? "gold" : "default"}>{value}</Tag>
              ),
            },
          ]}
          onRow={(record) => ({
            onClick: () => {
              setSelectedShipment(record);
              setDetailOpen(true);
            },
          })}
          rowClassName={() => "erp-clickable-row"}
        />
      </Card>

      <Drawer title="Gonderi Detayi" placement="right" width={520} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {selectedShipment ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Gonderi No">{selectedShipment.shipmentNo}</Descriptions.Item>
              <Descriptions.Item label="Magaza">{selectedShipment.storeName}</Descriptions.Item>
              <Descriptions.Item label="Durum">{selectedShipment.status}</Descriptions.Item>
              <Descriptions.Item label="Tarih">{formatDisplayDate(selectedShipment.date)}</Descriptions.Item>
              <Descriptions.Item label="Gonderim Sekli">{selectedShipment.shippingMethod || "-"}</Descriptions.Item>
              <Descriptions.Item label="Takip No">{selectedShipment.trackingNo || "-"}</Descriptions.Item>
              <Descriptions.Item label="Not">{selectedShipment.note || "-"}</Descriptions.Item>
            </Descriptions>

            <Table
              rowKey="id"
              pagination={false}
              dataSource={selectedShipment.lines || []}
              columns={[
                {
                  title: "",
                  dataIndex: "image",
                  key: "image",
                  width: 48,
                  render: (value) => (
                    <img
                      src={value || "/products/baroque-necklace.svg"}
                      alt=""
                      style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 4 }}
                    />
                  ),
                },
                { title: "Urun Kodu", dataIndex: "code", key: "code" },
                { title: "Urun Adi", dataIndex: "name", key: "name" },
                { title: "Adet", dataIndex: "quantity", key: "quantity", width: 70 },
                { title: "Fiyat", dataIndex: "salePrice", key: "salePrice", render: (value, record) => formatMoney(value, record.saleCurrency) },
              ]}
            />
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}

export function StoreShipmentEditorPage() {
  const navigate = useNavigate();
  const { shipmentId } = useParams();
  const isEditMode = Boolean(shipmentId);
  const authUser = getAuthUser();
  const [form] = Form.useForm();
  const [pageLoading, setPageLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [stores, setStores] = React.useState([]);
  const [products, setProducts] = React.useState([]);
  const [shipmentLines, setShipmentLines] = React.useState([]);
  const [lineDraft, setLineDraft] = React.useState({
    productId: undefined,
    isManualProduct: false,
    image: "",
    name: "",
    code: "",
    salePrice: 0,
    saleCurrency: "TRY",
    quantity: 1,
    description: "",
  });
  const [editOpen, setEditOpen] = React.useState(false);
  const [editIndex, setEditIndex] = React.useState(null);
  const [editLine, setEditLine] = React.useState(null);
  const [promoteFields, setPromoteFields] = React.useState({
    supplierId: null,
    categoryId: null,
    collectionId: null,
    productType: "kendi",
    salesTax: "%20",
    cost: 0,
  });
  const [categories, setCategories] = React.useState([]);
  const [collections, setCollections] = React.useState([]);
  const [suppliers, setSuppliers] = React.useState([]);
  const watchedStoreId = Form.useWatch("storeId", form);
  const watchedStatus = Form.useWatch("status", form) || "Taslak";
  const isLocked = watchedStatus === "Gonderildi";

  React.useEffect(() => {
    let cancelled = false;
    const loadEditor = async () => {
      try {
        setPageLoading(true);
        const [storeRows, productRows] = await Promise.all([
          listStoresFresh(),
          listProductsFresh(),
        ]);
        if (cancelled) {
          return;
        }
        setStores(storeRows);
        setProducts(productRows);
        setCategories(listMasterData("categories"));
        setCollections(listMasterData("collections"));
        setSuppliers(listSuppliers());

        if (!isEditMode) {
          form.setFieldsValue({
            shipmentNo: "",
            storeId: undefined,
            date: new Date().toISOString().slice(0, 10),
            shippingMethod: "Kargo",
            trackingNo: "",
            note: "",
            status: "Taslak",
          });
          return;
        }

        const existing = getStoreShipmentById(shipmentId) || (await listStoreShipmentsFresh()).find((item) => item.id === shipmentId);
        if (!existing) {
          message.error("Gonderi kaydi bulunamadi.");
          navigate("/stores/shipments");
          return;
        }
        form.setFieldsValue(existing);
        setShipmentLines(existing.lines || []);
      } catch (error) {
        if (!cancelled) {
          message.error(error?.message || "Gonderi verileri yuklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadEditor();
    return () => {
      cancelled = true;
    };
  }, [form, isEditMode, navigate, shipmentId]);

  React.useEffect(() => {
    if (!watchedStoreId || isEditMode) {
      return;
    }
    void getNextStoreShipmentNoPreviewFresh(watchedStoreId).then((nextNo) => {
      form.setFieldValue("shipmentNo", nextNo);
    }).catch(() => {});
  }, [form, isEditMode, watchedStoreId]);

  const productOptions = React.useMemo(
    () => products.map((item) => ({
      value: `${item.code} - ${item.name}`,
      label: `${item.code} - ${item.name}`,
      productId: item.id,
    })),
    [products],
  );

  const handleDraftProductSelect = (productId) => {
    const selectedProduct = products.find((item) => item.id === productId);
    if (!selectedProduct) {
      return;
    }
    setLineDraft(buildDraftFromProduct(selectedProduct));
  };

  const handleDraftImageUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setLineDraft((current) => ({ ...current, image: e.target.result }));
    reader.readAsDataURL(file);
    return false;
  };

  const handleAddLine = () => {
    if (!lineDraft.name || !lineDraft.quantity) {
      message.warning("Urun adi ve miktar zorunludur.");
      return;
    }
    if (!lineDraft.salePrice || Number(lineDraft.salePrice) <= 0) {
      message.warning("Satis fiyati zorunludur ve 0'dan buyuk olmalidir.");
      return;
    }
    if (!lineDraft.productId && !lineDraft.image) {
      message.warning("Manuel urunler icin gorsel zorunludur.");
      return;
    }
    setShipmentLines((current) => [
      ...current,
      {
        ...lineDraft,
        id: lineDraft.id || `line-${Date.now()}`,
        isManualProduct: !lineDraft.productId,
      },
    ]);
    setLineDraft({
      productId: undefined,
      isManualProduct: false,
      image: "",
      name: "",
      code: "",
      salePrice: 0,
      saleCurrency: "TRY",
      quantity: 1,
      description: "",
    });
  };

  const openEditDrawer = (lineIndex) => {
    setEditIndex(lineIndex);
    setEditLine({ ...shipmentLines[lineIndex] });
    setEditOpen(true);
  };

  const handleSaveEditLine = () => {
    if (editIndex === null || !editLine) {
      return;
    }
    const nextLines = [...shipmentLines];
    nextLines[editIndex] = {
      ...editLine,
      quantity: Number(editLine.quantity || 0),
      salePrice: Number(editLine.salePrice || 0),
    };
    setShipmentLines(nextLines);
    setEditOpen(false);
    setEditIndex(null);
    setEditLine(null);
  };

  const handlePromoteLineToProduct = () => {
    if (editIndex === null || !editLine) {
      return;
    }
    if (!editLine.name || !editLine.code) {
      message.error("Urun adi ve urun kodu zorunludur.");
      return;
    }
    if (!promoteFields.categoryId) {
      message.error("Kategori secimi zorunludur.");
      return;
    }
    if (!promoteFields.collectionId) {
      message.error("Koleksiyon secimi zorunludur.");
      return;
    }

    try {
      const savedProduct = createProduct({
        supplierId: promoteFields.supplierId || null,
        code: editLine.code,
        name: editLine.name,
        salePrice: editLine.salePrice,
        saleCurrency: editLine.saleCurrency || "TRY",
        cost: Number(promoteFields.cost || 0),
        costCurrency: "TRY",
        categoryId: promoteFields.categoryId,
        collectionId: promoteFields.collectionId,
        posCategoryId: null,
        barcode: "",
        supplierCode: editLine.code,
        minStock: 0,
        supplierLeadTime: 0,
        stock: 0,
        productType: promoteFields.productType || "kendi",
        salesTax: promoteFields.salesTax || "%20",
        image: editLine.image || "/products/baroque-necklace.svg",
        isForSale: true,
        isForPurchase: true,
        useInPos: true,
        trackInventory: true,
        status: "Aktif",
        workflowStatus: "Onaylandi",
        createdBy: authUser?.id || null,
        notes: editLine.description || "",
        features: [],
      });

      setProducts((current) => [...current, savedProduct]);
      const nextLines = [...shipmentLines];
      nextLines[editIndex] = {
        ...nextLines[editIndex],
        productId: savedProduct.id,
        isManualProduct: false,
        name: savedProduct.name,
        code: savedProduct.code,
        salePrice: savedProduct.salePrice,
        saleCurrency: savedProduct.saleCurrency,
        image: savedProduct.image,
      };
      setShipmentLines(nextLines);
      setEditOpen(false);
      setEditIndex(null);
      setEditLine(null);
      setPromoteFields({ supplierId: null, categoryId: null, collectionId: null, productType: "kendi", salesTax: "%20", cost: 0 });
      message.success("Satir urun kartina donusturuldu.");
    } catch (error) {
      message.error(error?.message || "Urun karti olusturulamadi.");
    }
  };

  const validateBeforeSave = async () => {
    const values = await form.validateFields();
    if (!shipmentLines.length) {
      throw new Error("En az bir satir eklenmelidir.");
    }
    return {
      ...values,
      lines: shipmentLines,
      createdBy: authUser?.id || null,
    };
  };

  const handleSave = async (statusOverride) => {
    try {
      setLoading(true);
      const values = await validateBeforeSave();
      const payload = {
        ...values,
        status: statusOverride || values.status || "Taslak",
      };
      const saved = isEditMode ? updateStoreShipment(shipmentId, payload) : createStoreShipment(payload);
      message.success(isEditMode ? "Gonderi guncellendi." : "Gonderi kaydedildi.");
      navigate(`/stores/shipments/${saved.id}`);
    } catch (error) {
      if (!error?.errorFields) {
        message.error(error?.message || "Gonderi kaydedilemedi.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrepare = async () => {
    try {
      setLoading(true);
      const values = await validateBeforeSave();
      const payload = { ...values, status: "Hazirlandi" };
      const saved = isEditMode ? updateStoreShipment(shipmentId, payload) : createStoreShipment(payload);
      await createStoreShipmentPdf(saved);
      message.success("Gonderi hazirlandi ve PDF olusturuldu.");
      navigate(`/stores/shipments/${saved.id}`);
    } catch (error) {
      if (!error?.errorFields) {
        message.error(error?.message || "Gonderi hazirlaniamadi.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setLoading(true);
      const values = form.getFieldsValue();
      const record = {
        ...values,
        lines: shipmentLines,
        storeName: stores.find((s) => s.id === values.storeId)?.name || "-",
        lineCount: shipmentLines.length,
        totalQuantity: shipmentLines.reduce((sum, l) => sum + Number(l.quantity || 0), 0),
        totalAmount: shipmentLines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.salePrice || 0), 0),
        totalAmountDisplay: new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
          shipmentLines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.salePrice || 0), 0),
        ),
        id: shipmentId || "preview",
        shipmentNo: values.shipmentNo || "TASLAK",
      };
      await createStoreShipmentPdf(record);
    } catch (error) {
      message.error(error?.message || "PDF olusturulamadi.");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    try {
      setLoading(true);
      if (!isEditMode) {
        const values = await validateBeforeSave();
        const created = createStoreShipment({ ...values, status: "Hazirlandi" });
        const sent = sendStoreShipment(created.id);
        message.success("Gonderi magazaya aktarildi.");
        navigate(`/stores/shipments/${sent.id}`);
        return;
      }

      const values = await validateBeforeSave();
      updateStoreShipment(shipmentId, { ...values, status: "Hazirlandi" });
      const sent = sendStoreShipment(shipmentId);
      message.success("Gonderi magazaya aktarildi.");
      navigate(`/stores/shipments/${sent.id}`);
    } catch (error) {
      if (!error?.errorFields) {
        message.error(error?.message || "Gonderi gonderilemedi.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>{isEditMode ? "Gonderi Formu" : "Gonderi Olustur"}</Title>
          <Text type="secondary">Taslak ve hazirlanan kayitlar duzenlenebilir, gonderildi durumunda kilitlenir.</Text>
        </div>
        <Space wrap>
          <Button onClick={() => navigate("/stores/shipments")}>Listeye Don</Button>
          <Button icon={<FilePdfOutlined />} onClick={() => void handleDownloadPdf()} loading={loading}>PDF Olustur</Button>
          <Button onClick={() => void handleSave("Taslak")} loading={loading} disabled={isLocked}>Taslak Kaydet</Button>
          <Button icon={<CheckOutlined />} onClick={() => void handlePrepare()} loading={loading} disabled={isLocked}>Hazirla</Button>
          <Button type="primary" icon={<SendOutlined />} onClick={() => void handleSend()} loading={loading} disabled={isLocked}>Gonderildi Olarak Isle</Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <Card title="Gonderi Genel Bilgileri" loading={pageLoading}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}><Form.Item name="shipmentNo" label="Gonderi No"><Input disabled /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="storeId" label="Magaza" rules={[{ required: true, message: "Magaza seciniz." }]}><Select disabled={isLocked} options={stores.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="date" label="Tarih" rules={[{ required: true, message: "Tarih zorunludur." }]}><Input type="date" disabled={isLocked} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="status" label="Durum"><Select disabled options={["Taslak", "Hazirlandi", "Gonderildi"].map((value) => ({ value, label: value }))} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="shippingMethod" label="Gonderim Sekli"><Select disabled={isLocked} options={["Kargo", "Elden Teslim"].map((value) => ({ value, label: value }))} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="trackingNo" label="Takip No"><Input disabled={isLocked} /></Form.Item></Col>
            <Col xs={24}><Form.Item name="note" label="Not"><Input.TextArea rows={3} disabled={isLocked} /></Form.Item></Col>
          </Row>
        </Card>

        <Card title="Satirlar" className="erp-card-logo-divider" style={{ marginTop: 20 }}>
          {!isLocked ? (
            <Card size="small" title="Satir Ekle" style={{ marginBottom: 16 }}>
              <Row gutter={[12, 12]} align="bottom">
                <Col xs={24} xl={7}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <Text strong>Urun Adi</Text>
                    <AutoComplete
                      value={lineDraft.name}
                      options={productOptions}
                      placeholder="Mevcut urun secin veya manuel girin"
                      style={{ minWidth: 240, width: "100%" }}
                      filterOption={(inputValue, option) => (option?.label || "").toLowerCase().includes(inputValue.toLowerCase())}
                      onSelect={(_, option) => {
                        if (option?.productId) {
                          handleDraftProductSelect(option.productId);
                        }
                      }}
                      onChange={(value) => {
                        setLineDraft((current) => ({
                          ...current,
                          productId: undefined,
                          isManualProduct: true,
                          name: value,
                          image: "",
                        }));
                      }}
                    />
                  </div>
                </Col>
                <Col xs={24} xl={4}>
                  <Text strong>Urun Kodu</Text>
                  <Input value={lineDraft.code} disabled={Boolean(lineDraft.productId)} onChange={(event) => setLineDraft((current) => ({ ...current, code: event.target.value }))} />
                </Col>
                <Col xs={12} xl={3}>
                  <Text strong>Satis Fiyati</Text>
                  <InputNumber style={{ width: "100%" }} min={0} value={lineDraft.salePrice} onChange={(value) => setLineDraft((current) => ({ ...current, salePrice: value || 0 }))} addonAfter="TRY" />
                </Col>
                <Col xs={12} xl={2}>
                  <Text strong>Adet</Text>
                  <InputNumber style={{ width: "100%" }} min={1} value={lineDraft.quantity} onChange={(value) => setLineDraft((current) => ({ ...current, quantity: value || 1 }))} />
                </Col>
                <Col xs={24} xl={3}>
                  <Text strong>Aciklama</Text>
                  <Input value={lineDraft.description} onChange={(event) => setLineDraft((current) => ({ ...current, description: event.target.value }))} />
                </Col>
                <Col xs={24} xl={3}>
                  {!lineDraft.productId ? (
                    <>
                      <Text strong>
                        Gorsel <span style={{ color: "#ff4d4f" }}>*</span>
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        <Upload
                          accept="image/*"
                          showUploadList={false}
                          maxCount={1}
                          beforeUpload={handleDraftImageUpload}
                        >
                          {lineDraft.image ? (
                            <img
                              src={lineDraft.image}
                              alt="gorsel"
                              style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, cursor: "pointer", border: "1px solid #d9d9d9" }}
                            />
                          ) : (
                            <Button icon={<UploadOutlined />} size="small">Gorsel</Button>
                          )}
                        </Upload>
                      </div>
                    </>
                  ) : lineDraft.image ? (
                    <img
                      src={lineDraft.image}
                      alt="gorsel"
                      style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, border: "1px solid #d9d9d9", marginTop: 22 }}
                    />
                  ) : null}
                </Col>
                <Col xs={24} xl={2} style={{ display: "flex", alignItems: "flex-end" }}>
                  <Button type="primary" style={{ width: "100%" }} onClick={handleAddLine}>Ekle</Button>
                </Col>
              </Row>
            </Card>
          ) : null}

          <Table
            rowKey="id"
            pagination={false}
            dataSource={shipmentLines.map((item, index) => ({ ...item, _rowIndex: index }))}
            locale={{ emptyText: "Henuz satir eklenmedi." }}
            scroll={{ x: 700 }}
            columns={[
              {
                title: "",
                dataIndex: "image",
                key: "image",
                width: 52,
                render: (value) => (
                  <img
                    src={value || "/products/baroque-necklace.svg"}
                    alt=""
                    style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4 }}
                  />
                ),
              },
              { title: "Urun Kodu", dataIndex: "code", key: "code", width: 130 },
              { title: "Urun Adi", dataIndex: "name", key: "name" },
              { title: "Adet", dataIndex: "quantity", key: "quantity", width: 80 },
              {
                title: "Birim Fiyat",
                dataIndex: "salePrice",
                key: "salePrice",
                width: 120,
                render: (value, record) => formatMoney(value, record.saleCurrency),
              },
              {
                title: "Toplam Fiyat",
                key: "totalPrice",
                width: 130,
                render: (_, record) => formatMoney(Number(record.salePrice || 0) * Number(record.quantity || 0), record.saleCurrency),
              },
              {
                title: "Islemler",
                key: "actions",
                width: 100,
                render: (_, record) => (
                  <Space size={4}>
                    <Tooltip title="Düzenle">
                      <Button size="small" className="erp-icon-btn erp-icon-btn-view" icon={<EditOutlined />} onClick={() => openEditDrawer(record._rowIndex)} />
                    </Tooltip>
                    {!isLocked ? (
                      <Tooltip title="Sil">
                        <Button size="small" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} onClick={() => setShipmentLines((current) => current.filter((_, index) => index !== record._rowIndex))} />
                      </Tooltip>
                    ) : null}
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Form>

      <Drawer
        title="Gonderi Satiri"
        placement="right"
        width={520}
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditIndex(null);
          setEditLine(null);
          setPromoteFields({ supplierId: null, categoryId: null, collectionId: null, productType: "kendi", salesTax: "%20", cost: 0 });
        }}
      >
        {editLine ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div>
              <Text strong>Gorsel</Text>
              <div style={{ marginTop: 4 }}>
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  maxCount={1}
                  disabled={Boolean(editLine.productId)}
                  beforeUpload={(file) => {
                    const reader = new FileReader();
                    reader.onload = (e) => setEditLine((current) => ({ ...current, image: e.target.result }));
                    reader.readAsDataURL(file);
                    return false;
                  }}
                >
                  {editLine.image ? (
                    <img
                      src={editLine.image}
                      alt="gorsel"
                      style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, cursor: editLine.productId ? "default" : "pointer", border: "1px solid #d9d9d9" }}
                    />
                  ) : !editLine.productId ? (
                    <Button icon={<UploadOutlined />}>Gorsel Sec</Button>
                  ) : null}
                </Upload>
              </div>
            </div>
            <div>
              <Text strong>Urun Adi</Text>
              <Input value={editLine.name} disabled={Boolean(editLine.productId)} onChange={(event) => setEditLine((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div>
              <Text strong>Urun Kodu</Text>
              <Input value={editLine.code} disabled={Boolean(editLine.productId)} onChange={(event) => setEditLine((current) => ({ ...current, code: event.target.value }))} />
            </div>
            <Row gutter={12}>
              <Col span={12}>
                <Text strong>Satis Fiyati</Text>
                <InputNumber style={{ width: "100%" }} min={0} value={editLine.salePrice} onChange={(value) => setEditLine((current) => ({ ...current, salePrice: value || 0 }))} addonAfter="TRY" />
              </Col>
              <Col span={12}>
                <Text strong>Adet</Text>
                <InputNumber style={{ width: "100%" }} min={1} value={editLine.quantity} onChange={(value) => setEditLine((current) => ({ ...current, quantity: value || 1 }))} />
              </Col>
            </Row>
            <div>
              <Text strong>Aciklama</Text>
              <Input.TextArea rows={3} value={editLine.description} onChange={(event) => setEditLine((current) => ({ ...current, description: event.target.value }))} />
            </div>
            {!editLine.productId ? (
              <Card
                size="small"
                title="Urun Karti Bilgileri"
                style={{ border: "1px solid #e8edf3", borderRadius: 8, background: "#fafbfc" }}
              >
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Text strong>
                        Kategori <span style={{ color: "#ff4d4f" }}>*</span>
                      </Text>
                      <Select
                        style={{ width: "100%", marginTop: 4 }}
                        placeholder="Kategori seciniz"
                        value={promoteFields.categoryId}
                        onChange={(val) => setPromoteFields((f) => ({ ...f, categoryId: val }))}
                        options={categories.map((c) => ({ value: c.id, label: c.name }))}
                        showSearch
                        filterOption={(input, option) => (option?.label || "").toLowerCase().includes(input.toLowerCase())}
                      />
                    </Col>
                    <Col span={12}>
                      <Text strong>
                        Koleksiyon <span style={{ color: "#ff4d4f" }}>*</span>
                      </Text>
                      <Select
                        style={{ width: "100%", marginTop: 4 }}
                        placeholder="Koleksiyon seciniz"
                        value={promoteFields.collectionId}
                        onChange={(val) => setPromoteFields((f) => ({ ...f, collectionId: val }))}
                        options={collections.map((c) => ({ value: c.id, label: c.name }))}
                        showSearch
                        filterOption={(input, option) => (option?.label || "").toLowerCase().includes(input.toLowerCase())}
                      />
                    </Col>
                  </Row>
                  <div>
                    <Text strong>Tedarikci</Text>
                    <Select
                      style={{ width: "100%", marginTop: 4 }}
                      placeholder="Tedarikci seciniz (opsiyonel)"
                      allowClear
                      value={promoteFields.supplierId}
                      onChange={(val) => setPromoteFields((f) => ({ ...f, supplierId: val || null }))}
                      options={suppliers.map((s) => ({ value: s.id, label: s.company }))}
                      showSearch
                      filterOption={(input, option) => (option?.label || "").toLowerCase().includes(input.toLowerCase())}
                    />
                  </div>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Text strong>Urun Tipi</Text>
                      <Select
                        style={{ width: "100%", marginTop: 4 }}
                        value={promoteFields.productType}
                        onChange={(val) => setPromoteFields((f) => ({ ...f, productType: val }))}
                        options={[
                          { value: "kendi", label: "Kendi" },
                          { value: "konsinye", label: "Konsinye" },
                          { value: "hizmet", label: "Hizmet" },
                        ]}
                      />
                    </Col>
                    <Col span={8}>
                      <Text strong>KDV Orani</Text>
                      <Select
                        style={{ width: "100%", marginTop: 4 }}
                        value={promoteFields.salesTax}
                        onChange={(val) => setPromoteFields((f) => ({ ...f, salesTax: val }))}
                        options={["%1", "%10", "%20"].map((v) => ({ value: v, label: v }))}
                      />
                    </Col>
                    <Col span={8}>
                      <Text strong>Maliyet</Text>
                      <InputNumber
                        style={{ width: "100%", marginTop: 4 }}
                        min={0}
                        value={promoteFields.cost}
                        onChange={(val) => setPromoteFields((f) => ({ ...f, cost: val || 0 }))}
                        addonAfter="TRY"
                      />
                    </Col>
                  </Row>
                </Space>
              </Card>
            ) : null}

            <Space style={{ justifyContent: "flex-end", width: "100%" }}>
              {!editLine.productId ? (
                <Button icon={<PlusCircleOutlined />} onClick={handlePromoteLineToProduct}>
                  Urun Olarak Ekle
                </Button>
              ) : null}
              <Button type="primary" onClick={handleSaveEditLine}>Guncelle</Button>
            </Space>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}
