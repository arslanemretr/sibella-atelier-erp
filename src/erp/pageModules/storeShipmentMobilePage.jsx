import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AutoComplete, Button, Card, Drawer, Form, Input, InputNumber, Select, Space, Tag, Typography, Upload, message } from "antd";
import { ArrowLeftOutlined, CameraOutlined, DeleteOutlined, FilePdfOutlined, MinusOutlined, PlusOutlined, SaveOutlined, SendOutlined } from "@ant-design/icons";
import { getAuthUser } from "../../auth";
import { requestJson } from "../apiClient";
import { compressImageFile } from "../imageCompress";
import { getNextProductCodeFresh, listProductsCatalogFresh } from "../productsData";
import { listSuppliersFresh } from "../suppliersData";
import { createStoreShipmentPdf, getNextStoreShipmentNoPreviewFresh, getStoreShipmentFresh } from "../storeShipmentsData";
import { listStoresFresh } from "../storesData";

const { Text } = Typography;

const EMPTY_DRAFT = {
  productId: undefined,
  isManualProduct: false,
  image: "",
  name: "",
  code: "",
  salePrice: 0,
  saleCurrency: "TRY",
  quantity: 1,
};

function formatMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatSbse(seq) {
  return `SBSE${String(seq).padStart(4, "0")}`;
}

export function StoreShipmentMobileEditorPage() {
  const navigate = useNavigate();
  const { shipmentId } = useParams();
  const isEditMode = Boolean(shipmentId);
  const authUser = getAuthUser();
  const [form] = Form.useForm();

  const [stores, setStores] = React.useState([]);
  const [products, setProducts] = React.useState([]);
  const [sbseSupplierId, setSbseSupplierId] = React.useState(null);
  const [nextSeq, setNextSeq] = React.useState(null); // SBSE sonraki sira no (onizleme)
  const [pageLoading, setPageLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [pdfLoading, setPdfLoading] = React.useState(false);

  const [lines, setLines] = React.useState([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(EMPTY_DRAFT);
  const lineSeqRef = React.useRef(0);

  const watchedStoreId = Form.useWatch("storeId", form);
  const watchedStatus = Form.useWatch("status", form) || "Taslak";
  const isLocked = watchedStatus === "Gonderildi";

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setPageLoading(true);
        const [storeRows, productRows, supplierRows, nextCode, existing] = await Promise.all([
          listStoresFresh(),
          listProductsCatalogFresh({ productType: "kendi" }),
          listSuppliersFresh({ slim: true }),
          getNextProductCodeFresh(),
          isEditMode ? getStoreShipmentFresh(shipmentId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setStores(storeRows);
        setProducts(productRows);
        const sbse = supplierRows.find((s) => String(s.shortCode || "").toUpperCase() === "SBSE");
        setSbseSupplierId(sbse?.id || null);
        setNextSeq(nextCode?.next ?? null);

        if (isEditMode) {
          if (!existing) {
            message.error("Gonderi kaydi bulunamadi.");
            navigate("/stores/shipments");
            return;
          }
          form.setFieldsValue({
            storeId: existing.storeId,
            date: existing.date || new Date().toISOString().slice(0, 10),
            shippingMethod: existing.shippingMethod || "Kargo",
            note: existing.note || "",
            status: existing.status || "Taslak",
            shipmentNo: existing.shipmentNo || "",
          });
          const loadedLines = (existing.lines || []).map((line, index) => {
            lineSeqRef.current = index + 1;
            return { ...line, id: line.id || `line-${index + 1}` };
          });
          setLines(loadedLines);
        } else {
          form.setFieldsValue({
            storeId: undefined,
            date: new Date().toISOString().slice(0, 10),
            shippingMethod: "Kargo",
            note: "",
            status: "Taslak",
            shipmentNo: "",
          });
        }
      } catch (error) {
        if (!cancelled) message.error(error?.message || "Veriler yuklenemedi.");
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [form, isEditMode, shipmentId, navigate]);

  React.useEffect(() => {
    if (!watchedStoreId || isEditMode) return;
    getNextStoreShipmentNoPreviewFresh(watchedStoreId)
      .then((nextNo) => form.setFieldValue("shipmentNo", nextNo))
      .catch(() => {});
  }, [form, watchedStoreId, isEditMode]);

  const productOptions = React.useMemo(
    () => products.map((item) => ({
      value: `${item.code} - ${item.name}`,
      label: `${item.code} - ${item.name}`,
      productId: item.id,
    })),
    [products],
  );

  // Eklenmis manuel satir sayisi — sonraki manuel kodun onizlemesi icin
  const manualCount = React.useMemo(
    () => lines.filter((l) => l.isManualProduct).length,
    [lines],
  );

  const previewSbseCode = nextSeq !== null ? formatSbse(nextSeq + manualCount) : "";

  const handleProductSelect = (productId) => {
    const p = products.find((item) => item.id === productId);
    if (!p) return;
    setDraft({
      productId: p.id,
      isManualProduct: false,
      image: p.image || "",
      name: p.name || "",
      code: p.code || "",
      salePrice: Number(p.salePrice || 0),
      saleCurrency: p.saleCurrency || "TRY",
      quantity: 1,
    });
  };

  const handleManualNameChange = (value) => {
    setDraft((prev) => ({
      ...prev,
      productId: undefined,
      isManualProduct: Boolean(value),
      name: value,
      image: "",
      // Manuel urun icin SBSE kodu otomatik onizlenir
      code: value ? previewSbseCode : "",
    }));
  };

  const handleAddLine = () => {
    if (!draft.name) { message.warning("Urun adi zorunludur."); return; }
    if (!draft.salePrice || Number(draft.salePrice) <= 0) { message.warning("Satis fiyati giriniz."); return; }
    if (!draft.productId && !draft.image) { message.warning("Manuel urunler icin gorsel zorunludur."); return; }
    lineSeqRef.current += 1;
    setLines((prev) => [
      ...prev,
      {
        ...draft,
        id: `line-${lineSeqRef.current}`,
        isManualProduct: !draft.productId,
        // Manuel satirin kodu onizleme kodu olarak sabitlenir (gercek kod gonderimde rezerve edilir)
        code: draft.productId ? draft.code : previewSbseCode,
      },
    ]);
    setDraft(EMPTY_DRAFT);
    setAddOpen(false);
  };

  const updateLineQty = (index, delta) => {
    setLines((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,
      ),
    );
  };

  const removeLine = (index) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Manuel satir icin SBSE kodlu urun karti payload'i (toplu oluşturmada kullanılır)
  const buildManualProductPayload = (line) => ({
    autoCode: true,
    code: "",
    supplierId: sbseSupplierId || null,
    name: line.name,
    salePrice: Number(line.salePrice || 0),
    saleCurrency: line.saleCurrency || "TRY",
    cost: 0,
    costCurrency: "TRY",
    categoryId: null,
    collectionId: null,
    posCategoryId: null,
    barcode: "",
    supplierCode: "",
    minStock: 0,
    supplierLeadTime: 0,
    stock: 0,
    productType: "kendi",
    salesTax: "%20",
    image: line.image || "/products/baroque-necklace.svg",
    isForSale: true,
    isForPurchase: true,
    useInPos: true,
    trackInventory: true,
    status: "Aktif",
    workflowStatus: "Taslak",
    createdBy: authUser?.id || null,
    notes: "",
    features: [],
  });

  // Gonderi kaydeder (edit modunda PUT, yeni kayitta POST) ve kaydi doner
  const saveShipment = async (status, shipmentLines) => {
    const values = form.getFieldsValue();
    const payload = { ...values, status, lines: shipmentLines, createdBy: authUser?.id || null };
    const response = isEditMode
      ? await requestJson("PUT", `/api/store-shipments/${encodeURIComponent(shipmentId)}`, payload)
      : await requestJson("POST", "/api/store-shipments", payload);
    return response?.item || response;
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      await form.validateFields();
      if (!lines.length) throw new Error("En az bir satir eklenmelidir.");
      await saveShipment("Taslak", lines);
      message.success("Taslak kaydedildi.");
      navigate("/stores/shipments");
    } catch (error) {
      if (!error?.errorFields) message.error(error?.message || "Taslak kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    try {
      setSaving(true);
      await form.validateFields();
      if (!lines.length) throw new Error("En az bir satir eklenmelidir.");

      // Manuel satirlar icin urun kartlari TEK istekte (toplu) olusturulur,
      // sonra donen id/kodlar satirlara sirasiyla eslenir
      const manualLines = lines.filter((line) => !line.productId);
      let createdProducts = [];
      if (manualLines.length) {
        const response = await requestJson("POST", "/api/products/batch", {
          items: manualLines.map((line) => buildManualProductPayload(line)),
        });
        createdProducts = response?.items || [];
        if (createdProducts.length !== manualLines.length) {
          throw new Error("Urun kartlari olusturulamadi.");
        }
      }
      let createdIndex = 0;
      const preparedLines = lines.map((line) => {
        if (line.productId) return line;
        const created = createdProducts[createdIndex++];
        return {
          ...line,
          productId: created.id,
          code: created.code || line.code,
          isManualProduct: false,
        };
      });

      const saved = await saveShipment("Hazirlandi", preparedLines);
      await requestJson("POST", `/api/store-shipments/${encodeURIComponent(saved.id)}/send`, {});
      message.success("Gonderi magazaya aktarildi.");
      navigate("/stores/shipments");
    } catch (error) {
      if (!error?.errorFields) message.error(error?.message || "Gonderi gonderilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setPdfLoading(true);
      const values = form.getFieldsValue();
      const pdfTotal = lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.salePrice || 0), 0);
      await createStoreShipmentPdf({
        ...values,
        id: shipmentId || "preview",
        shipmentNo: values.shipmentNo || "TASLAK",
        storeName: stores.find((s) => s.id === values.storeId)?.name || "-",
        lines,
        lineCount: lines.length,
        totalQuantity: lines.reduce((sum, l) => sum + Number(l.quantity || 0), 0),
        totalAmount: pdfTotal,
        totalAmountDisplay: formatMoney(pdfTotal),
      });
    } catch (error) {
      message.error(error?.message || "PDF olusturulamadi.");
    } finally {
      setPdfLoading(false);
    }
  };

  const totalQty = lines.reduce((sum, l) => sum + Number(l.quantity || 0), 0);
  const totalAmount = lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.salePrice || 0), 0);

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", paddingBottom: lines.length > 0 && !isLocked ? 132 : 24 }}>
      {/* Sticky header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderBottom: "1px solid #f0f0f0",
          background: "#fff",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate("/stores/shipments")} />
        <Text strong style={{ fontSize: 16, flex: 1 }}>{isEditMode ? "Gonderi Detayi" : "Gonderi Olustur"}</Text>
        {isEditMode && lines.length > 0 ? (
          <Button
            type="text"
            icon={<FilePdfOutlined />}
            loading={pdfLoading}
            onClick={() => { void handleDownloadPdf(); }}
          >
            PDF
          </Button>
        ) : null}
        {isEditMode ? (
          <Tag color={isLocked ? "green" : watchedStatus === "Hazirlandi" ? "gold" : "default"} style={{ marginInlineEnd: 0 }}>
            {watchedStatus}
          </Tag>
        ) : null}
      </div>

      <div style={{ padding: 16 }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {/* Panel 1 — Genel Bilgiler */}
          <Card size="small" title="Genel Bilgiler" loading={pageLoading} styles={{ body: { paddingBottom: 4 } }}>
            <Form form={form} layout="vertical">
              <Form.Item label="Gonderi No" style={{ marginBottom: 16 }}>
                <Form.Item name="shipmentNo" noStyle>
                  <Input
                    size="large"
                    disabled
                    readOnly
                    placeholder={isEditMode ? "" : "Magaza secince otomatik olusur"}
                  />
                </Form.Item>
              </Form.Item>

              <Form.Item
                name="storeId"
                label="Magaza"
                rules={[{ required: true, message: "Magaza seciniz." }]}
              >
                <Select
                  size="large"
                  placeholder="Magaza secin"
                  disabled={isLocked}
                  options={stores.map((s) => ({ value: s.id, label: s.isCenter ? `${s.name} (Merkez)` : s.name }))}
                />
              </Form.Item>

              <Form.Item
                name="date"
                label="Tarih"
                rules={[{ required: true, message: "Tarih zorunludur." }]}
                style={{ marginBottom: 16 }}
              >
                <Input type="date" size="large" disabled={isLocked} style={{ width: "100%" }} />
              </Form.Item>

              <Form.Item name="note" label="Not" style={{ marginBottom: 8 }}>
                <Input.TextArea rows={2} disabled={isLocked} placeholder="Takip no vb. ek bilgiler buraya yazilabilir" />
              </Form.Item>

              <Form.Item name="status" hidden><Input /></Form.Item>
            </Form>
          </Card>

          {/* Panel 2 — Urunler */}
          <Card size="small" title={`Urunler (${lines.length})`}>
            {lines.map((line, index) => (
              <div
                key={line.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: 12,
                  marginBottom: 10,
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #f0f0f0",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                }}
              >
                <img
                  src={line.image || "/products/baroque-necklace.svg"}
                  alt=""
                  style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ display: "block", fontSize: 14, lineHeight: "20px" }}>{line.name}</Text>
                  <Space size={6} style={{ marginTop: 2 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{line.code || "—"}</Text>
                    {line.isManualProduct ? <Tag color="gold" style={{ marginInlineEnd: 0, lineHeight: "16px" }}>Yeni</Tag> : null}
                  </Space>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {isLocked ? (
                        <Text type="secondary" style={{ fontSize: 13 }}>{line.quantity} adet</Text>
                      ) : (
                        <>
                          <Button
                            size="small"
                            icon={<MinusOutlined />}
                            onClick={() => updateLineQty(index, -1)}
                            style={{ width: 30, height: 30, padding: 0 }}
                          />
                          <Text strong style={{ minWidth: 20, textAlign: "center" }}>{line.quantity}</Text>
                          <Button
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={() => updateLineQty(index, 1)}
                            style={{ width: 30, height: 30, padding: 0 }}
                          />
                        </>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Text strong style={{ color: "#1677ff", fontSize: 14 }}>
                        {formatMoney(line.salePrice * line.quantity)}
                      </Text>
                      {!isLocked ? (
                        <Button
                          size="small"
                          danger
                          type="text"
                          icon={<DeleteOutlined />}
                          onClick={() => removeLine(index)}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {lines.length === 0 && isLocked ? (
              <Text type="secondary">Urun bulunmuyor.</Text>
            ) : null}
            {!isLocked ? (
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                size="large"
                block
                onClick={() => { setDraft(EMPTY_DRAFT); setAddOpen(true); }}
                style={{ height: 52, borderRadius: 12, fontSize: 15, marginTop: lines.length ? 4 : 0 }}
              >
                Urun Ekle
              </Button>
            ) : null}
          </Card>
        </Space>
      </div>

      {/* Sticky bottom action bar */}
      {lines.length > 0 && !isLocked && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "10px 16px",
            background: "#fff",
            borderTop: "1px solid #f0f0f0",
            boxShadow: "0 -2px 10px rgba(0,0,0,0.07)",
          }}
        >
          <div style={{ maxWidth: 520, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text type="secondary" style={{ fontSize: 13 }}>
                {lines.length} kalem &bull; {totalQty} adet
              </Text>
              <Text strong style={{ fontSize: 15 }}>{formatMoney(totalAmount)}</Text>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button
                icon={<SaveOutlined />}
                size="large"
                loading={saving}
                onClick={() => { void handleSaveDraft(); }}
                style={{ flex: 1, height: 48, fontSize: 14, borderRadius: 10 }}
              >
                Taslak Kaydet
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                size="large"
                loading={saving}
                onClick={() => { void handleSend(); }}
                style={{ flex: 1.4, height: 48, fontSize: 14, borderRadius: 10 }}
              >
                Gonderildi
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add product bottom drawer */}
      <Drawer
        title="Urun Ekle"
        placement="bottom"
        height="82%"
        open={addOpen}
        onClose={() => setAddOpen(false)}
        styles={{ body: { padding: 16, overflowY: "auto" } }}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div>
            <Text strong style={{ display: "block", marginBottom: 6 }}>Urun Ara veya Gir</Text>
            <AutoComplete
              value={draft.name}
              options={productOptions}
              placeholder="Urun kodu veya adini yazin"
              style={{ width: "100%" }}
              size="large"
              filterOption={(input, option) =>
                (option?.label || "").toLowerCase().includes(input.toLowerCase())
              }
              onSelect={(_, option) => {
                if (option?.productId) handleProductSelect(option.productId);
              }}
              onChange={handleManualNameChange}
            />
          </div>

          {draft.productId ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                background: "#f6ffed",
                borderRadius: 10,
                border: "1px solid #b7eb8f",
              }}
            >
              {draft.image && (
                <img
                  src={draft.image}
                  alt=""
                  style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }}
                />
              )}
              <div>
                <Text strong style={{ display: "block" }}>{draft.name}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{draft.code}</Text>
              </div>
            </div>
          ) : draft.name ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  background: "#fffbe6",
                  borderRadius: 10,
                  border: "1px solid #ffe58f",
                }}
              >
                <Text type="secondary" style={{ fontSize: 13 }}>Yeni urun kodu (otomatik)</Text>
                <Text strong style={{ fontSize: 15 }}>{previewSbseCode || "—"}</Text>
              </div>
              <div>
                <Text strong style={{ display: "block", marginBottom: 6 }}>
                  Gorsel <Text type="danger">*</Text>
                </Text>
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  maxCount={1}
                  beforeUpload={(file) => {
                    compressImageFile(file)
                      .then((dataUrl) => setDraft((prev) => ({ ...prev, image: dataUrl })))
                      .catch((err) => message.error(err?.message || "Gorsel islenemedi."));
                    return false;
                  }}
                >
                  {draft.image ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                      <img
                        src={draft.image}
                        alt=""
                        style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, border: "1px solid #d9d9d9" }}
                      />
                      <Text type="secondary">Degistirmek icin dokun</Text>
                    </div>
                  ) : (
                    <Button icon={<CameraOutlined />} size="large" block style={{ height: 52 }}>
                      Fotograf Sec / Kamera
                    </Button>
                  )}
                </Upload>
              </div>
            </>
          ) : null}

          <div>
            <Text strong style={{ display: "block", marginBottom: 6 }}>Satis Fiyati</Text>
            <InputNumber
              size="large"
              style={{ width: "100%" }}
              min={0}
              value={draft.salePrice}
              disabled={Boolean(draft.productId)}
              addonAfter="TRY"
              onChange={(val) => setDraft((prev) => ({ ...prev, salePrice: val || 0 }))}
            />
          </div>

          <div>
            <Text strong style={{ display: "block", marginBottom: 10 }}>Adet</Text>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Button
                size="large"
                icon={<MinusOutlined />}
                onClick={() =>
                  setDraft((prev) => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))
                }
                style={{ width: 52, height: 52, flexShrink: 0 }}
              />
              <InputNumber
                size="large"
                min={1}
                value={draft.quantity}
                controls={false}
                onChange={(val) => setDraft((prev) => ({ ...prev, quantity: val || 1 }))}
                style={{ flex: 1 }}
              />
              <Button
                size="large"
                icon={<PlusOutlined />}
                onClick={() =>
                  setDraft((prev) => ({ ...prev, quantity: prev.quantity + 1 }))
                }
                style={{ width: 52, height: 52, flexShrink: 0 }}
              />
            </div>
          </div>

          <Button
            type="primary"
            size="large"
            block
            icon={<PlusOutlined />}
            onClick={handleAddLine}
            style={{ height: 52, borderRadius: 10, fontSize: 15, marginTop: 4 }}
          >
            Satira Ekle
          </Button>
        </Space>
      </Drawer>
    </div>
  );
}
