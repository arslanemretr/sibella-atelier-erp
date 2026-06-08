import React from "react";
import dayjs from "dayjs";
import { Button, Card, Col, DatePicker, Row, Select, Space, Table, Tag, Typography, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { requestCollection } from "../apiClient";

const { Title, Text } = Typography;

function money(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function SummaryCard({ title, value, color }) {
  return (
    <Card size="small" style={{ height: "100%" }}>
      <Text type="secondary" style={{ fontSize: 12, display: "block" }}>{title}</Text>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "inherit", marginTop: 4 }}>{value}</div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// SATIŞ RAPORU
// ─────────────────────────────────────────────────────────────────

export function SalesReportPage() {
  const [loading, setLoading] = React.useState(false);
  const [sales, setSales] = React.useState([]);
  const [products, setProducts] = React.useState([]);
  const [suppliers, setSuppliers] = React.useState([]);
  const [dateRange, setDateRange] = React.useState([dayjs().startOf("month"), dayjs().endOf("day")]);
  const [supplierFilter, setSupplierFilter] = React.useState(null);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const [salesData, productsData, suppliersData] = await Promise.all([
        requestCollection("/api/pos-sales", []),
        requestCollection("/api/products", []),
        requestCollection("/api/suppliers", []),
      ]);
      setSales(salesData);
      setProducts(productsData);
      setSuppliers(suppliersData);
    } catch (err) {
      message.error(err?.message || "Veriler yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const productMap = React.useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const filteredSales = React.useMemo(() => {
    const [from, to] = dateRange || [];
    return sales.filter((sale) => {
      const t = dayjs(sale.soldAt).valueOf();
      if (from && t < from.startOf("day").valueOf()) return false;
      if (to && t > to.endOf("day").valueOf()) return false;
      if (supplierFilter) {
        const hasSupplier = (sale.lines || []).some(
          (line) => productMap.get(line.productId)?.supplierId === supplierFilter,
        );
        if (!hasSupplier) return false;
      }
      return true;
    });
  }, [sales, dateRange, supplierFilter, productMap]);

  const summary = React.useMemo(() => {
    const total = filteredSales.reduce((s, x) => s + Number(x.grandTotal || 0), 0);
    const discount = filteredSales.reduce((s, x) => s + Number(x.discountAmount || 0), 0);
    const count = filteredSales.length;
    const avg = count > 0 ? total / count : 0;
    return { total, discount, count, avg };
  }, [filteredSales]);

  const supplierRows = React.useMemo(() => {
    const map = new Map();
    for (const sale of filteredSales) {
      for (const line of (sale.lines || [])) {
        const product = productMap.get(line.productId);
        const sid = product?.supplierId || "__none__";
        const sname = suppliers.find((s) => s.id === sid)?.company || "Tedarikci Yok";
        const row = map.get(sid) || { supplierId: sid, supplierName: sname, qty: 0, total: 0 };
        row.qty += Number(line.quantity || 0);
        row.total += Number(line.lineTotal || 0);
        map.set(sid, row);
      }
    }
    const rows = [...map.values()].sort((a, b) => b.total - a.total);
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);
    return rows.map((r) => ({
      ...r,
      share: grandTotal > 0 ? ((r.total / grandTotal) * 100).toFixed(1) : "0.0",
    }));
  }, [filteredSales, productMap, suppliers]);

  const productRows = React.useMemo(() => {
    const map = new Map();
    for (const sale of filteredSales) {
      for (const line of (sale.lines || [])) {
        const product = productMap.get(line.productId);
        if (supplierFilter && product?.supplierId !== supplierFilter) continue;
        const row = map.get(line.productId) || {
          productId: line.productId,
          code: product?.code || line.productCode || "-",
          name: product?.name || line.productName || "-",
          supplierName: suppliers.find((s) => s.id === product?.supplierId)?.company || "-",
          qty: 0,
          total: 0,
        };
        row.qty += Number(line.quantity || 0);
        row.total += Number(line.lineTotal || 0);
        map.set(line.productId, row);
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [filteredSales, productMap, suppliers, supplierFilter]);

  const paymentRows = React.useMemo(() => {
    const map = new Map();
    for (const sale of filteredSales) {
      const m = sale.paymentMethod || "Diger";
      const row = map.get(m) || { method: m, count: 0, total: 0 };
      row.count += 1;
      row.total += Number(sale.grandTotal || 0);
      map.set(m, row);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Title level={4} style={{ margin: 0 }}>Satış Raporu</Title>

      <Card size="small">
        <Space wrap>
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(v) => setDateRange(v || [dayjs().startOf("month"), dayjs()])}
            allowClear={false}
            style={{ width: 290 }}
          />
          <Select
            placeholder="Tüm Tedarikçiler"
            allowClear
            style={{ width: 220 }}
            value={supplierFilter}
            onChange={setSupplierFilter}
            options={suppliers.map((s) => ({ value: s.id, label: s.company }))}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Yenile</Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        {[
          { title: "Toplam Ciro", value: money(summary.total), color: "#389e0d" },
          { title: "Satış Adedi", value: summary.count, color: "#1677ff" },
          { title: "Ortalama Sepet", value: money(summary.avg), color: "#722ed1" },
          { title: "Toplam İndirim", value: money(summary.discount), color: "#d46b08" },
        ].map((item) => (
          <Col key={item.title} xs={24} sm={12} lg={6}>
            <SummaryCard {...item} />
          </Col>
        ))}
      </Row>

      <Card size="small" title="Tedarikçi Bazlı Satış">
        <Table
          rowKey="supplierId"
          size="small"
          loading={loading}
          dataSource={supplierRows}
          pagination={false}
          locale={{ emptyText: "Veri bulunamadi." }}
          columns={[
            { title: "Tedarikçi", dataIndex: "supplierName", key: "supplierName", width: 200,
              sorter: (a, b) => String(a.supplierName || "").localeCompare(String(b.supplierName || ""), "tr") },
            { title: "Satılan Adet", dataIndex: "qty", key: "qty", align: "right", width: 120,
              sorter: (a, b) => Number(a.qty || 0) - Number(b.qty || 0) },
            { title: "Toplam Tutar", dataIndex: "total", key: "total", align: "right", width: 150,
              sorter: (a, b) => Number(a.total || 0) - Number(b.total || 0),
              render: (v) => money(v) },
            { title: "% Pay", dataIndex: "share", key: "share", align: "right", width: 80,
              sorter: (a, b) => Number(a.share || 0) - Number(b.share || 0),
              render: (v) => `%${v}` },
          ]}
          summary={(data) => {
            const totalQty = data.reduce((s, r) => s + r.qty, 0);
            const totalAmt = data.reduce((s, r) => s + r.total, 0);
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}><Text strong>Toplam</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right"><Text strong>{totalQty}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right"><Text strong>{money(totalAmt)}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right"><Text strong>%100</Text></Table.Summary.Cell>
              </Table.Summary.Row>
            );
          }}
        />
      </Card>

      <Card size="small" title="Ürün Bazlı Satış (En Çok Satılanlar)">
        <Table
          rowKey="productId"
          size="small"
          loading={loading}
          dataSource={productRows}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: "Veri bulunamadi." }}
          columns={[
            { title: "Kod", dataIndex: "code", key: "code", width: 110,
              sorter: (a, b) => String(a.code || "").localeCompare(String(b.code || ""), "tr") },
            { title: "Ürün Adı", dataIndex: "name", key: "name", width: 200,
              sorter: (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "tr") },
            { title: "Tedarikçi", dataIndex: "supplierName", key: "supplierName", width: 180,
              sorter: (a, b) => String(a.supplierName || "").localeCompare(String(b.supplierName || ""), "tr") },
            { title: "Satılan Adet", dataIndex: "qty", key: "qty", align: "right", width: 110,
              sorter: (a, b) => Number(a.qty || 0) - Number(b.qty || 0) },
            { title: "Toplam Tutar", dataIndex: "total", key: "total", align: "right", width: 140,
              sorter: (a, b) => Number(a.total || 0) - Number(b.total || 0),
              render: (v) => money(v) },
          ]}
        />
      </Card>

      <Card size="small" title="Ödeme Yöntemi Dağılımı">
        <Table
          rowKey="method"
          size="small"
          loading={loading}
          dataSource={paymentRows}
          pagination={false}
          locale={{ emptyText: "Veri bulunamadi." }}
          columns={[
            { title: "Ödeme Yöntemi", dataIndex: "method", key: "method", width: 160,
              sorter: (a, b) => String(a.method || "").localeCompare(String(b.method || ""), "tr") },
            { title: "İşlem Sayısı", dataIndex: "count", key: "count", align: "right", width: 120,
              sorter: (a, b) => Number(a.count || 0) - Number(b.count || 0) },
            { title: "Toplam Tutar", dataIndex: "total", key: "total", align: "right", width: 150,
              sorter: (a, b) => Number(a.total || 0) - Number(b.total || 0),
              render: (v) => money(v) },
          ]}
        />
      </Card>
    </Space>
  );
}

// ─────────────────────────────────────────────────────────────────
// STOK RAPORU
// ─────────────────────────────────────────────────────────────────

function stockStatusTag(status) {
  if (status === "empty") return <Tag color="red">Stokta Yok</Tag>;
  if (status === "critical") return <Tag color="orange">Kritik</Tag>;
  return <Tag color="green">Yeterli</Tag>;
}

export function StockReportPage() {
  const [loading, setLoading] = React.useState(false);
  const [products, setProducts] = React.useState([]);
  const [suppliers, setSuppliers] = React.useState([]);
  const [supplierFilter, setSupplierFilter] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState("all");

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const [productsData, suppliersData] = await Promise.all([
        requestCollection("/api/products", []),
        requestCollection("/api/suppliers", []),
      ]);
      setProducts(productsData);
      setSuppliers(suppliersData);
    } catch (err) {
      message.error(err?.message || "Veriler yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const supplierMap = React.useMemo(
    () => new Map(suppliers.map((s) => [s.id, s.company])),
    [suppliers],
  );

  const enrichedProducts = React.useMemo(() => {
    return products
      .filter((p) => p.status === "Aktif")
      .map((p) => {
        const stock = Number(p.stock || 0);
        const cost = Number(p.cost || 0);
        const stockValue = stock * cost;
        const status = stock <= 0 ? "empty" : stock <= 5 ? "critical" : "ok";
        return {
          ...p,
          supplierName: supplierMap.get(p.supplierId) || "Tedarikci Yok",
          stockValue,
          status,
        };
      });
  }, [products, supplierMap]);

  const filteredProducts = React.useMemo(() => {
    return enrichedProducts.filter((p) => {
      if (supplierFilter && p.supplierId !== supplierFilter) return false;
      if (statusFilter === "critical") return p.status === "critical" || p.status === "empty";
      if (statusFilter === "empty") return p.status === "empty";
      return true;
    });
  }, [enrichedProducts, supplierFilter, statusFilter]);

  const summary = React.useMemo(() => {
    const totalSku = filteredProducts.length;
    const totalStock = filteredProducts.reduce((s, p) => s + Number(p.stock || 0), 0);
    const totalValue = filteredProducts.reduce((s, p) => s + p.stockValue, 0);
    const criticalCount = filteredProducts.filter((p) => p.status !== "ok").length;
    return { totalSku, totalStock, totalValue, criticalCount };
  }, [filteredProducts]);

  const sortedProducts = React.useMemo(
    () => [...filteredProducts].sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0)),
    [filteredProducts],
  );

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Title level={4} style={{ margin: 0 }}>Stok Raporu</Title>

      <Card size="small">
        <Space wrap>
          <Select
            placeholder="Tüm Tedarikçiler"
            allowClear
            style={{ width: 220 }}
            value={supplierFilter}
            onChange={setSupplierFilter}
            options={suppliers.map((s) => ({ value: s.id, label: s.company }))}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 180 }}
            options={[
              { value: "all", label: "Tüm Ürünler" },
              { value: "critical", label: "Kritik ve Stoksuz" },
              { value: "empty", label: "Yalnızca Stoksuz" },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Yenile</Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        {[
          { title: "Toplam SKU (Aktif)", value: summary.totalSku, color: "#1677ff" },
          { title: "Toplam Stok Adedi", value: summary.totalStock, color: "#389e0d" },
          { title: "Stok Değeri", value: money(summary.totalValue), color: "#722ed1" },
          { title: "Kritik / Stoksuz", value: summary.criticalCount, color: "#d4380d" },
        ].map((item) => (
          <Col key={item.title} xs={24} sm={12} lg={6}>
            <SummaryCard {...item} />
          </Col>
        ))}
      </Row>

      <Card size="small" title="Ürün Stok Durumu">
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={sortedProducts}
          pagination={{ pageSize: 50, showSizeChanger: false }}
          locale={{ emptyText: "Filtrelere uygun urun bulunamadi." }}
          columns={[
            { title: "Kod", dataIndex: "code", key: "code", width: 110,
              sorter: (a, b) => String(a.code || "").localeCompare(String(b.code || ""), "tr") },
            { title: "Ürün Adı", dataIndex: "name", key: "name", width: 200,
              sorter: (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "tr") },
            { title: "Tedarikçi", dataIndex: "supplierName", key: "supplierName", width: 180,
              sorter: (a, b) => String(a.supplierName || "").localeCompare(String(b.supplierName || ""), "tr") },
            {
              title: "Mevcut Stok",
              dataIndex: "stock",
              key: "stock",
              align: "right",
              width: 120,
              sorter: (a, b) => Number(a.stock || 0) - Number(b.stock || 0),
              render: (v) => Number(v || 0),
            },
            {
              title: "Birim Maliyet",
              dataIndex: "cost",
              key: "cost",
              align: "right",
              width: 130,
              sorter: (a, b) => Number(a.cost || 0) - Number(b.cost || 0),
              render: (v) => money(v),
            },
            {
              title: "Stok Değeri",
              dataIndex: "stockValue",
              key: "stockValue",
              align: "right",
              width: 140,
              sorter: (a, b) => Number(a.stockValue || 0) - Number(b.stockValue || 0),
              render: (v) => money(v),
            },
            {
              title: "Durum",
              dataIndex: "status",
              key: "status",
              align: "center",
              width: 110,
              sorter: (a, b) => String(a.status || "").localeCompare(String(b.status || ""), "tr"),
              render: (v) => stockStatusTag(v),
            },
          ]}
          summary={(data) => {
            const totalStock = data.reduce((s, r) => s + Number(r.stock || 0), 0);
            const totalValue = data.reduce((s, r) => s + r.stockValue, 0);
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}><Text strong>Toplam</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right"><Text strong>{totalStock}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={4} />
                <Table.Summary.Cell index={5} align="right"><Text strong>{money(totalValue)}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={6} />
              </Table.Summary.Row>
            );
          }}
        />
      </Card>
    </Space>
  );
}
