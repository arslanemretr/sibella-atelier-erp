import React from "react";
import { Button, Card, Descriptions, Drawer, Grid, InputNumber, Modal, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import { AimOutlined } from "@ant-design/icons";
import { correctStockLocation, listStockLocationBalancesFresh, listStockLocationsFresh } from "../stockLocationsData";

const { Title, Text } = Typography;

const EMPTY_CORRECTION = { productId: null, productName: "", productCode: "", currentQty: 0, actualQty: null, note: "" };

export function StockLocationListPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [locations, setLocations] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedLocation, setSelectedLocation] = React.useState(null);
  const [balances, setBalances] = React.useState([]);
  const [drawerLoading, setDrawerLoading] = React.useState(false);

  // Düzeltme modal state
  const [correction, setCorrection] = React.useState(EMPTY_CORRECTION);
  const [correctionOpen, setCorrectionOpen] = React.useState(false);
  const [correctionLoading, setCorrectionLoading] = React.useState(false);

  const refreshLocations = React.useCallback(async () => {
    try {
      setLoading(true);
      setLocations(await listStockLocationsFresh());
    } catch (error) {
      message.error(error?.message || "Stok yerleri yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshLocations();
  }, [refreshLocations]);

  const openDrawer = React.useCallback(async (record) => {
    setSelectedLocation(record);
    setBalances([]);
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      setBalances(await listStockLocationBalancesFresh(record.id));
    } catch (error) {
      message.error(error?.message || "Stok yeri bakiyeleri yuklenemedi.");
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const openCorrectionModal = React.useCallback((balance) => {
    setCorrection({
      productId: balance.productId,
      productName: balance.productName,
      productCode: balance.productCode,
      currentQty: balance.quantity,
      actualQty: balance.quantity,
      note: "",
    });
    setCorrectionOpen(true);
  }, []);

  const handleCorrectionSave = async () => {
    if (correction.actualQty === null || correction.actualQty === undefined) {
      message.warning("Gerçek miktar giriniz.");
      return;
    }
    const delta = Number(correction.actualQty) - correction.currentQty;
    if (Math.abs(delta) < 0.0001) {
      message.info("Miktar değişmedi, düzeltme yapılmadı.");
      setCorrectionOpen(false);
      return;
    }
    try {
      setCorrectionLoading(true);
      await correctStockLocation(selectedLocation.id, {
        productId: correction.productId,
        actualQty: Number(correction.actualQty),
        note: correction.note,
      });
      message.success("Stok düzeltmesi kaydedildi.");
      setCorrectionOpen(false);
      // Bakiyeleri ve lokasyon özetini yenile
      const [newBalances] = await Promise.all([
        listStockLocationBalancesFresh(selectedLocation.id),
        refreshLocations(),
      ]);
      setBalances(newBalances);
    } catch (error) {
      message.error(error?.message || "Stok düzeltmesi kaydedilemedi.");
    } finally {
      setCorrectionLoading(false);
    }
  };

  const locationColumns = React.useMemo(() => [
    {
      title: "Stok Yeri",
      dataIndex: "name",
      key: "name",
      width: 180,
      sorter: (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "tr"),
      render: (value) => <Text strong>{value}</Text>,
    },
    {
      title: "Bagli Magaza",
      dataIndex: "storeName",
      key: "storeName",
      width: 160,
      sorter: (a, b) => String(a.storeName || "").localeCompare(String(b.storeName || ""), "tr"),
      render: (value) => value || "-",
    },
    {
      title: "Merkez",
      dataIndex: "isDefaultMain",
      key: "isDefaultMain",
      width: 90,
      render: (value) => <Tag color={value ? "blue" : "default"}>{value ? "Evet" : "Hayir"}</Tag>,
    },
    {
      title: "Urun Cesidi",
      dataIndex: "productVariety",
      key: "productVariety",
      width: 110,
      sorter: (a, b) => Number(a.productVariety || 0) - Number(b.productVariety || 0),
    },
    {
      title: "Toplam Adet",
      dataIndex: "totalQuantity",
      key: "totalQuantity",
      width: 110,
      sorter: (a, b) => Number(a.totalQuantity || 0) - Number(b.totalQuantity || 0),
    },
  ], []);

  const balanceColumns = React.useMemo(() => [
    {
      title: "Urun Kodu",
      dataIndex: "productCode",
      key: "productCode",
      width: 110,
      sorter: (a, b) => String(a.productCode || "").localeCompare(String(b.productCode || ""), "tr"),
    },
    {
      title: "Urun Adi",
      dataIndex: "productName",
      key: "productName",
      sorter: (a, b) => String(a.productName || "").localeCompare(String(b.productName || ""), "tr"),
    },
    {
      title: "Adet",
      dataIndex: "quantity",
      key: "quantity",
      width: 80,
      align: "right",
      sorter: (a, b) => Number(a.quantity || 0) - Number(b.quantity || 0),
    },
    {
      title: "",
      key: "actions",
      width: 60,
      render: (_, record) => (
        <Tooltip title="Stok Düzelt">
          <Button
            size="small"
            icon={<AimOutlined />}
            className="erp-icon-btn"
            onClick={(e) => { e.stopPropagation(); openCorrectionModal(record); }}
          />
        </Tooltip>
      ),
    },
  ], [openCorrectionModal]);

  const correctionDelta = correction.actualQty !== null && correction.actualQty !== undefined
    ? Number(correction.actualQty) - correction.currentQty
    : 0;

  return (
    <Space vertical size={20} style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 6 }}>Stok Yerleri</Title>
      </div>

      <Card title="Stok Yeri Listesi" className="erp-list-table-card" styles={isMobile ? { body: { padding: 12 } } : undefined}>
        {isMobile ? (
          locations.length === 0 ? (
            <Text type="secondary">Stok yeri bulunamadı.</Text>
          ) : (
            <Space direction="vertical" size={10} style={{ width: "100%" }}>
              {locations.map((record) => (
                <div
                  key={record.id}
                  onClick={() => { void openDrawer(record); }}
                  style={{ padding: 14, borderRadius: 12, border: "1px solid #f0f0f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 15 }}>{record.name}</Text>
                    {record.isDefaultMain ? <Tag color="blue" style={{ marginInlineEnd: 0 }}>Merkez</Tag> : null}
                  </div>
                  <Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 6 }}>{record.storeName || "-"}</Text>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <Text type="secondary">{record.productVariety} çeşit</Text>
                    <Text strong>{record.totalQuantity} adet</Text>
                  </div>
                </div>
              ))}
            </Space>
          )
        ) : (
        <Table
          size="small"
          rowKey="id"
          loading={loading}
          columns={locationColumns}
          dataSource={locations}
          pagination={false}
          scroll={{ x: "max-content" }}
          onRow={(record) => ({ onClick: () => { void openDrawer(record); } })}
          rowClassName={() => "erp-clickable-row"}
        />
        )}
      </Card>

      <Drawer
        title={selectedLocation ? `${selectedLocation.name} — Bakiyeler` : "Stok Yeri Detayi"}
        placement="right"
        width={isMobile ? "100%" : 560}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {selectedLocation ? (
          <Space vertical size={16} style={{ width: "100%" }}>
            <Descriptions column={isMobile ? 1 : 2} size="small" bordered>
              <Descriptions.Item label="Stok Yeri" span={2}>{selectedLocation.name}</Descriptions.Item>
              <Descriptions.Item label="Bagli Magaza">{selectedLocation.storeName || "-"}</Descriptions.Item>
              <Descriptions.Item label="Merkez">{selectedLocation.isDefaultMain ? "Evet" : "Hayir"}</Descriptions.Item>
              <Descriptions.Item label="Urun Cesidi">{selectedLocation.productVariety}</Descriptions.Item>
              <Descriptions.Item label="Toplam Adet">{selectedLocation.totalQuantity}</Descriptions.Item>
            </Descriptions>

            <Table
              size="small"
              rowKey={(record) => `${record.stockLocationId}-${record.productId}`}
              loading={drawerLoading}
              dataSource={balances}
              columns={balanceColumns}
              pagination={{ pageSize: 20, showSizeChanger: false, hideOnSinglePage: true }}
              locale={{ emptyText: "Pozitif bakiye yok." }}
            />
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title={`Stok Düzelt — ${correction.productCode} ${correction.productName}`}
        open={correctionOpen}
        onCancel={() => { if (!correctionLoading) setCorrectionOpen(false); }}
        onOk={handleCorrectionSave}
        okText="Düzeltmeyi Kaydet"
        cancelText="Vazgeç"
        confirmLoading={correctionLoading}
        destroyOnHidden
      >
        <Space vertical size={16} style={{ width: "100%" }}>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Mevcut Miktar">
              <Text strong>{correction.currentQty}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Fark">
              {correctionDelta === 0 ? (
                <Text type="secondary">—</Text>
              ) : (
                <Text strong type={correctionDelta > 0 ? "success" : "danger"}>
                  {correctionDelta > 0 ? `+${correctionDelta}` : correctionDelta}
                </Text>
              )}
            </Descriptions.Item>
          </Descriptions>

          <div>
            <Text type="secondary" style={{ display: "block", marginBottom: 6 }}>Gerçek (Sayılan) Miktar</Text>
            <InputNumber
              min={0}
              precision={0}
              value={correction.actualQty}
              onChange={(val) => setCorrection((prev) => ({ ...prev, actualQty: val }))}
              style={{ width: "100%" }}
              autoFocus
            />
          </div>

          <div>
            <Text type="secondary" style={{ display: "block", marginBottom: 6 }}>Not (isteğe bağlı)</Text>
            <input
              className="ant-input"
              placeholder="Sayım notunu girin"
              value={correction.note}
              onChange={(e) => setCorrection((prev) => ({ ...prev, note: e.target.value }))}
              style={{ width: "100%", padding: "4px 11px", borderRadius: 6, border: "1px solid #d9d9d9" }}
            />
          </div>
        </Space>
      </Modal>
    </Space>
  );
}
