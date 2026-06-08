import React from "react";
import { Card, Descriptions, Drawer, Space, Table, Tag, Typography, message } from "antd";
import { listStockLocationBalancesFresh, listStockLocationsFresh } from "../stockLocationsData";

const { Title, Text } = Typography;

export function StockLocationListPage() {
  const [locations, setLocations] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedLocation, setSelectedLocation] = React.useState(null);
  const [balances, setBalances] = React.useState([]);
  const [drawerLoading, setDrawerLoading] = React.useState(false);

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

  const openDrawer = async (record) => {
    try {
      setSelectedLocation(record);
      setDrawerOpen(true);
      setDrawerLoading(true);
      setBalances(await listStockLocationBalancesFresh(record.id));
    } catch (error) {
      message.error(error?.message || "Stok yeri bakiyeleri yuklenemedi.");
    } finally {
      setDrawerLoading(false);
    }
  };

  const columns = [
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
      sorter: (a, b) => String(a.isDefaultMain || "").localeCompare(String(b.isDefaultMain || ""), "tr"),
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
  ];

  return (
    <Space vertical size={20} style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 6 }}>Stok Yerleri</Title>
        <Text type="secondary">Merkez ve magaza bazli stok gorunumu burada izlenir.</Text>
      </div>

      <Card title="Stok Yeri Listesi" className="erp-list-table-card">
        <Table
          size="small"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={locations}
          pagination={false}
          scroll={{ x: 'max-content' }}
          onRow={(record) => ({
            onClick: () => {
              void openDrawer(record);
            },
          })}
          rowClassName={() => "erp-clickable-row"}
        />
      </Card>

      <Drawer
        title={selectedLocation ? `${selectedLocation.name} Bakiyeleri` : "Stok Yeri Detayi"}
        placement="right"
        width={520}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {selectedLocation ? (
          <Space vertical size={16} style={{ width: "100%" }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Stok Yeri">{selectedLocation.name}</Descriptions.Item>
              <Descriptions.Item label="Bagli Magaza">{selectedLocation.storeName || "-"}</Descriptions.Item>
              <Descriptions.Item label="Merkez Yeri">{selectedLocation.isDefaultMain ? "Evet" : "Hayir"}</Descriptions.Item>
              <Descriptions.Item label="Urun Cesidi">{selectedLocation.productVariety}</Descriptions.Item>
              <Descriptions.Item label="Toplam Adet">{selectedLocation.totalQuantity}</Descriptions.Item>
            </Descriptions>

            <Table
          size="small"
              rowKey={(record) => `${record.stockLocationId}-${record.productId}`}
              loading={drawerLoading}
              pagination={false}
              dataSource={balances}
              locale={{ emptyText: "Pozitif bakiye yok." }}
              columns={[
                { title: "Urun Kodu", dataIndex: "productCode", key: "productCode", width: 120,
                  sorter: (a, b) => String(a.productCode || "").localeCompare(String(b.productCode || ""), "tr") },
                { title: "Urun Adi", dataIndex: "productName", key: "productName", width: 200,
                  sorter: (a, b) => String(a.productName || "").localeCompare(String(b.productName || ""), "tr") },
                { title: "Adet", dataIndex: "quantity", key: "quantity", width: 100,
                  sorter: (a, b) => Number(a.quantity || 0) - Number(b.quantity || 0) },
              ]}
            />
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}
