import React from "react";
import { useNavigate } from "react-router-dom";
import { AutoComplete, Button, Drawer, Form, Input, InputNumber, Select, Space, Typography, Upload, message, Dropdown } from "antd";
import { ArrowLeftOutlined, CameraOutlined, DeleteOutlined, EllipsisOutlined, MinusOutlined, PlusOutlined, SendOutlined } from "@ant-design/icons";
import { getAuthUser } from "../../auth";
import { requestJson } from "../apiClient";
import { listProductsRawFresh } from "../productsData";
import { createStoreShipmentPdf, getNextStoreShipmentNoPreviewFresh } from "../storeShipmentsData";
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

export function StoreShipmentMobileEditorPage() {
  const navigate = useNavigate();
  const authUser = getAuthUser();
  const [form] = Form.useForm();

  const [stores, setStores] = React.useState([]);
  const [products, setProducts] = React.useState([]);
  const [pageLoading, setPageLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [lines, setLines] = React.useState([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(EMPTY_DRAFT);

  const watchedStoreId = Form.useWatch("storeId", form);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setPageLoading(true);
        const [storeRows, productRows] = await Promise.all([
          listStoresFresh(),
          listProductsRawFresh({ productType: "kendi" }),
        ]);
        if (cancelled) return;
        setStores(storeRows);
        setProducts(productRows);
        form.setFieldsValue({
          storeId: undefined,
          date: new Date().toISOString().slice(0, 10),
          shippingMethod: "Kargo",
          trackingNo: "",
          note: "",
          status: "Taslak",
          shipmentNo: "",
        });
      } catch (error) {
        if (!cancelled) message.error(error?.message || "Veriler yuklenemedi.");
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [form]);

  React.useEffect(() => {
    if (!watchedStoreId) return;
    getNextStoreShipmentNoPreviewFresh(watchedStoreId)
      .then((nextNo) => form.setFieldValue("shipmentNo", nextNo))
      .catch(() => {});
  }, [form, watchedStoreId]);

  const productOptions = React.useMemo(
    () => products.map((item) => ({
      value: `${item.code} - ${item.name}`,
      label: `${item.code} - ${item.name}`,
      productId: item.id,
    })),
    [products],
  );

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

  const handleAddLine = () => {
    if (!draft.name) { message.warning("Urun adi zorunludur."); return; }
    if (!draft.salePrice || Number(draft.salePrice) <= 0) { message.warning("Satis fiyati giriniz."); return; }
    if (!draft.productId && !draft.image) { message.warning("Manuel urunler icin gorsel zorunludur."); return; }
    setLines((prev) => [
      ...prev,
      { ...draft, id: `line-${Date.now()}`, isManualProduct: !draft.productId },
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

  const buildPayload = async (status) => {
    const values = await form.validateFields();
    if (!lines.length) throw new Error("En az bir satir eklenmelidir.");
    return { ...values, status, lines, createdBy: authUser?.id || null };
  };

  const handleSave = async (status) => {
    try {
      setSaving(true);
      const payload = await buildPayload(status || "Taslak");
      const response = await requestJson("POST", "/api/store-shipments", payload);
      const saved = response?.item || response;
      message.success("Gonderi kaydedildi.");
      navigate(`/stores/shipments/${saved.id}`);
    } catch (error) {
      if (!error?.errorFields) message.error(error?.message || "Gonderi kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrepare = async () => {
    try {
      setSaving(true);
      const payload = await buildPayload("Hazirlandi");
      const response = await requestJson("POST", "/api/store-shipments", payload);
      const saved = response?.item || response;
      await createStoreShipmentPdf(saved);
      message.success("Gonderi hazirlandi, PDF olusturuldu.");
      navigate(`/stores/shipments/${saved.id}`);
    } catch (error) {
      if (!error?.errorFields) message.error(error?.message || "Hazirlanamadi.");
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    try {
      setSaving(true);
      const payload = await buildPayload("Hazirlandi");
      const createRes = await requestJson("POST", "/api/store-shipments", payload);
      const created = createRes?.item || createRes;
      const sendRes = await requestJson("POST", `/api/store-shipments/${encodeURIComponent(created.id)}/send`, {});
      const sent = sendRes?.item || sendRes;
      message.success("Gonderi magazaya aktarildi.");
      navigate(`/stores/shipments/${sent.id}`);
    } catch (error) {
      if (!error?.errorFields) message.error(error?.message || "Gonderilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const totalQty = lines.reduce((sum, l) => sum + Number(l.quantity || 0), 0);
  const totalAmount = lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.salePrice || 0), 0);

  const overflowItems = [
    {
      key: "draft",
      label: "Taslak Kaydet",
      onClick: () => { void handleSave("Taslak"); },
    },
    {
      key: "prepare",
      label: "Hazirla + PDF",
      onClick: () => { void handlePrepare(); },
    },
  ];

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", paddingBottom: lines.length > 0 ? 110 : 24 }}>
      {/* Sticky header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid #f0f0f0",
          background: "#fff",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate("/stores/shipments")} />
        <Text strong style={{ fontSize: 16 }}>Gonderi Olustur</Text>
        <Dropdown menu={{ items: overflowItems }} placement="bottomRight" trigger={["click"]}>
          <Button type="text" icon={<EllipsisOutlined style={{ fontSize: 20 }} />} />
        </Dropdown>
      </div>

      {/* Form fields */}
      <div style={{ padding: "16px 16px 0" }}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="storeId"
            label="Magaza"
            rules={[{ required: true, message: "Magaza seciniz." }]}
          >
            <Select
              loading={pageLoading}
              size="large"
              placeholder="Magaza secin"
              options={stores.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>

          <div style={{ display: "flex", gap: 12 }}>
            <Form.Item
              name="date"
              label="Tarih"
              rules={[{ required: true, message: "Tarih zorunludur." }]}
              style={{ flex: 1 }}
            >
              <Input type="date" size="large" />
            </Form.Item>
            <Form.Item name="shippingMethod" label="Gonderim" style={{ flex: 1 }}>
              <Select
                size="large"
                options={["Kargo", "Elden Teslim"].map((v) => ({ value: v, label: v }))}
              />
            </Form.Item>
          </div>

          <Form.Item name="trackingNo" label="Takip No">
            <Input size="large" placeholder="Opsiyonel" />
          </Form.Item>

          <Form.Item name="note" label="Not">
            <Input.TextArea rows={2} placeholder="Opsiyonel" />
          </Form.Item>

          <Form.Item name="shipmentNo" hidden><Input /></Form.Item>
          <Form.Item name="status" hidden><Input /></Form.Item>
        </Form>
      </div>

      {/* Lines section */}
      <div style={{ padding: "0 16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text strong>Urunler ({lines.length})</Text>
          {lines.length > 0 && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              {totalQty} adet &bull; {formatMoney(totalAmount)}
            </Text>
          )}
        </div>

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
              style={{
                width: 60,
                height: 60,
                objectFit: "cover",
                borderRadius: 8,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text strong style={{ display: "block", fontSize: 14, lineHeight: "20px" }}>{line.name}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{line.code || "—"}</Text>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Text strong style={{ color: "#1677ff", fontSize: 14 }}>
                    {formatMoney(line.salePrice * line.quantity)}
                  </Text>
                  <Button
                    size="small"
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => removeLine(index)}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        <Button
          type="dashed"
          icon={<PlusOutlined />}
          size="large"
          block
          onClick={() => { setDraft(EMPTY_DRAFT); setAddOpen(true); }}
          style={{ marginTop: 4, height: 52, borderRadius: 12, fontSize: 15 }}
        >
          Urun Ekle
        </Button>
      </div>

      {/* Sticky bottom action bar */}
      {lines.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "12px 16px",
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
                marginBottom: 10,
              }}
            >
              <Text type="secondary" style={{ fontSize: 13 }}>
                {lines.length} kalem &bull; {totalQty} adet
              </Text>
              <Text strong style={{ fontSize: 15 }}>{formatMoney(totalAmount)}</Text>
            </div>
            <Button
              type="primary"
              icon={<SendOutlined />}
              size="large"
              block
              loading={saving}
              onClick={() => { void handleSend(); }}
              style={{ height: 48, fontSize: 15, borderRadius: 10 }}
            >
              Gonderildi Olarak Isle
            </Button>
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
        styles={{ body: { padding: "16px", overflowY: "auto" } }}
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
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  productId: undefined,
                  isManualProduct: true,
                  name: value,
                  image: "",
                }))
              }
            />
          </div>

          {draft.productId && (
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
          )}

          {!draft.productId && (
            <>
              <div>
                <Text strong style={{ display: "block", marginBottom: 6 }}>Urun Kodu</Text>
                <Input
                  size="large"
                  value={draft.code}
                  placeholder="Opsiyonel"
                  onChange={(e) => setDraft((prev) => ({ ...prev, code: e.target.value }))}
                />
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
                    const reader = new FileReader();
                    reader.onload = (e) =>
                      setDraft((prev) => ({ ...prev, image: e.target.result }));
                    reader.readAsDataURL(file);
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
          )}

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
