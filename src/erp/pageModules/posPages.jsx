import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, Badge, Button, Card, Col, DatePicker, Descriptions, Drawer, Dropdown, Empty, Form, Input, InputNumber, Modal, Popconfirm, Radio, Row, Select, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import { BarcodeOutlined, CloseCircleOutlined, CloseOutlined, DeleteOutlined, EditOutlined, FilterOutlined, MenuOutlined, PlusCircleOutlined, PlusOutlined, ReloadOutlined, RollbackOutlined, SearchOutlined, UserOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { requestJson } from "../apiClient";
import { listMasterDataFresh } from "../masterData";
import { buildPosProductCatalogFresh, closePosSession, createPosSale, createPosSession, createPosReturn, findProductByBarcode, getOpenPosSessionsFresh, listPosSalesFresh, listPosReturnsFresh, listPosSessionsFresh } from "../posData";
import { listStockLocationBalancesFresh, listStockLocationsFresh } from "../stockLocationsData";

const { Title, Text } = Typography;

function openDetailFromRow(setSelected, setOpen, record) {
  setSelected(record);
  setOpen(true);
}

function preventRowClick(event) {
  event.stopPropagation();
}

function formatMovementMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}
export function PosSessionsPage() {
  const navigate = useNavigate();
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedSession, setSelectedSession] = React.useState(null);
  const [sessions, setSessions] = React.useState([]);
  const [sales, setSales] = React.useState([]);
  const [salesLoading, setSalesLoading] = React.useState(false);
  const [stockLocations, setStockLocations] = React.useState([]);
  const [tableLoading, setTableLoading] = React.useState(false);
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [form] = Form.useForm();

  const refreshSessions = React.useCallback(async () => {
    try {
      setTableLoading(true);
      const [nextSessions, nextLocations] = await Promise.all([
        listPosSessionsFresh(),
        listStockLocationsFresh(),
      ]);
      setSessions(nextSessions);
      setStockLocations(nextLocations);
    } catch (error) {
      message.error(error?.message || "POS oturumlari yuklenemedi.");
    } finally {
      setTableLoading(false);
    }
  }, []);

  const openSessionDetail = React.useCallback(async (record) => {
    setSelectedSession(record);
    setDetailOpen(true);
    setSalesLoading(true);
    try {
      const sessionSales = await listPosSalesFresh();
      setSales(sessionSales.filter((s) => s.sessionId === record.id));
    } catch {
      setSales([]);
    } finally {
      setSalesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const stockLocationMap = React.useMemo(
    () => new Map(stockLocations.map((item) => [item.id, item.name])),
    [stockLocations],
  );

  const stockLocationOptions = React.useMemo(
    () => stockLocations.map((item) => ({ value: item.id, label: item.isDefaultMain ? `${item.name} (Merkez)` : item.name })),
    [stockLocations],
  );

  const openCreateModal = () => {
    const lastSession = sessions[0];
    const devirBalance = lastSession ? Number(lastSession.openingBalance || 0) + Number(lastSession.totalSales || 0) : 0;
    form.setFieldsValue({
      openingBalance: devirBalance,
      openedAt: dayjs(),
    });
    setCreateModalOpen(true);
  };

  const handleCreateSession = async () => {
    try {
      const values = await form.validateFields();
      await requestJson("POST", "/api/pos-sessions", {
        ...values,
        openedAt: values.openedAt ? values.openedAt.toISOString() : new Date().toISOString(),
      });
      form.resetFields();
      setCreateModalOpen(false);
      await refreshSessions();
      message.success("POS oturumu açıldı.");
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error?.message || "Oturum açılamadı.");
    }
  };

  const handleCloseSession = async (sessionId) => {
    try {
      await requestJson("POST", `/api/pos-sessions/${encodeURIComponent(sessionId)}/close`, {});
      await refreshSessions();
      message.success("POS oturumu kapatıldı.");
    } catch (error) {
      message.error(error?.message || "Oturum kapatılamadı.");
    }
  };

  const columns = [
    {
      title: "Oturum No",
      dataIndex: "sessionNo",
      key: "sessionNo",
      sorter: (a, b) => a.sessionNo.localeCompare(b.sessionNo, "tr"),
      render: (value, record) => (
        <button
          type="button"
          className="erp-link-button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/pos/store?session=${record.id}`);
          }}
        >
          {value}
        </button>
      ),
    },
    {
      title: "Depo Yeri",
      dataIndex: "stockLocationId",
      key: "stockLocationId",
      render: (value) => stockLocationMap.get(value) || "-",
    },
    { title: "Kasiyer", dataIndex: "cashierName", key: "cashierName", sorter: (a, b) => (a.cashierName || "").localeCompare(b.cashierName || "", "tr") },
    { title: "Açılış Tarihi", dataIndex: "openedAt", key: "openedAt", sorter: (a, b) => (a.openedAt || "").localeCompare(b.openedAt || "", "tr"), render: (value) => value ? new Date(value).toLocaleString("tr-TR") : "-" },
    { title: "Kapanış Tarihi", dataIndex: "closedAt", key: "closedAt", render: (value) => value ? new Date(value).toLocaleString("tr-TR") : "-" },
    { title: "Açılış Bakiye", dataIndex: "openingBalanceDisplay", key: "openingBalanceDisplay", sorter: (a, b) => a.openingBalance - b.openingBalance },
    { title: "Satış", dataIndex: "totalSalesDisplay", key: "totalSalesDisplay", sorter: (a, b) => a.totalSales - b.totalSales },
    { title: "Fiş", dataIndex: "salesCount", key: "salesCount", sorter: (a, b) => a.salesCount - b.salesCount },
    { title: "Durum", dataIndex: "status", key: "status", sorter: (a, b) => (a.status || "").localeCompare(b.status || "", "tr"), render: (value) => <Tag color={value === "Açık" ? "green" : "default"}>{value}</Tag> },
    {
      title: "İşlemler",
      key: "actions",
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Oturuma Gir">
            <Button size="small" className="erp-icon-btn erp-icon-btn-view" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); navigate(`/pos/store?session=${record.id}`); }} />
          </Tooltip>
          {record.status === "Açık" ? (
            <Popconfirm title="Oturum kapatılsın mı?" okText="Kapat" cancelText="Vazgeç" onConfirm={() => handleCloseSession(record.id)} onClick={preventRowClick}>
              <Tooltip title="Kapat">
                <Button size="small" className="erp-icon-btn erp-icon-btn-edit" icon={<CloseCircleOutlined />} />
              </Tooltip>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>POS Oturumları</Title>
          <Text type="secondary">Açılan kasa oturumları, satış toplamları ve açık/kapalı durumları burada tutulur.</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { void refreshSessions(); message.success("Oturumlar yenilendi."); }}>Yenile</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>Oturum Aç</Button>
        </Space>
      </div>

      <Card title="POS Oturum Listesi" className="erp-list-table-card">
        <Table
          loading={tableLoading}
          columns={columns}
          dataSource={sessions.map((item) => ({ key: item.id, ...item }))}
          pagination={false}
          onRow={(record) => ({
            onClick: () => openSessionDetail(record),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
        <div className="erp-table-footer">
          <Space>
            <span>Sayfa Boyutu:</span>
            <Select defaultValue="100" size="small" style={{ width: 84 }} options={["25", "50", "100"].map((value) => ({ value, label: value }))} />
          </Space>
          <Space size={18}>
            <span>1 - {sessions.length} / {sessions.length}</span>
            <span>Sayfa 1 / 1</span>
          </Space>
        </div>
      </Card>

      <Drawer title="Oturum Detayı" placement="right" width={520} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {selectedSession ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Oturum No">{selectedSession.sessionNo}</Descriptions.Item>
              <Descriptions.Item label="Kasa">{selectedSession.registerName}</Descriptions.Item>
              <Descriptions.Item label="Kasiyer">{selectedSession.cashierName}</Descriptions.Item>
              <Descriptions.Item label="Açılış">{new Date(selectedSession.openedAt).toLocaleString("tr-TR")}</Descriptions.Item>
              <Descriptions.Item label="Kapanış">{selectedSession.closedAt ? new Date(selectedSession.closedAt).toLocaleString("tr-TR") : "-"}</Descriptions.Item>
              <Descriptions.Item label="Açılış Bakiye">{selectedSession.openingBalanceDisplay}</Descriptions.Item>
              <Descriptions.Item label="Satış">{selectedSession.totalSalesDisplay}</Descriptions.Item>
              <Descriptions.Item label="Sipariş Adedi">{selectedSession.salesCount}</Descriptions.Item>
              <Descriptions.Item label="Durum">{selectedSession.status}</Descriptions.Item>
              <Descriptions.Item label="Not">{selectedSession.note || "-"}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Bu Oturuma Ait Siparişler">
              <Table
                rowKey="id"
                pagination={false}
                size="small"
                loading={salesLoading}
                dataSource={sales}
                columns={[
                  { title: "Fiş", dataIndex: "receiptNo", key: "receiptNo" },
                  { title: "Müşteri", dataIndex: "customerName", key: "customerName" },
                  { title: "Tarih", dataIndex: "soldAt", key: "soldAt", render: (value) => new Date(value).toLocaleString("tr-TR") },
                  { title: "Toplam", dataIndex: "grandTotalDisplay", key: "grandTotalDisplay" },
                ]}
              />
            </Card>
          </Space>
        ) : null}
      </Drawer>

      <Modal title="Yeni POS Oturumu" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={handleCreateSession} okText="Aç" cancelText="Vazgeç">
        <Form form={form} layout="vertical" initialValues={{ cashierName: "Sibel Ersoy Arslan", openingBalance: 0 }}>
          <Row gutter={[12, 12]}>
            <Col span={24}>
              <Form.Item name="stockLocationId" label="Depo Yeri" rules={[{ required: true, message: "Depo yeri zorunludur." }]}>
                <Select options={stockLocationOptions} placeholder="Depo yeri seçin" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="cashierName" label="Kasiyer" rules={[{ required: true, message: "Kasiyer adı zorunludur." }]}>
                <Input placeholder="Kasiyer adı" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="openedAt" label="Açılış Tarihi">
                <DatePicker showTime style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="openingBalance" label="Açılış Bakiyesi">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="note" label="Not">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Space>
  );
}

export function PosScreenPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const DRAFT_STORAGE_KEY = "sibella.erp.posDraftOrders.v1";
  const [catalog, setCatalog] = React.useState([]);
  const [stockLocations, setStockLocations] = React.useState([]);
  const [stockBalancesByLocation, setStockBalancesByLocation] = React.useState({});
  const [sessions, setSessions] = React.useState([]);
  const [posSales, setPosSales] = React.useState([]);
  const [posCategoryStateOptions, setPosCategoryStateOptions] = React.useState([{ id: "all", name: "Tumu", color: "#fee89a" }]);
  const [pageLoading, setPageLoading] = React.useState(false);
  const [activeSessionId, setActiveSessionId] = React.useState();
  const [orderDraftsBySession, setOrderDraftsBySession] = React.useState(() => {
    if (typeof window === "undefined") {
      return {};
    }

    try {
      return JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  });
  const [activeOrderIdBySession, setActiveOrderIdBySession] = React.useState({});
  const [search, setSearch] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState("all");
  const [paymentModalOpen, setPaymentModalOpen] = React.useState(false);
  const [openSessionModalOpen, setOpenSessionModalOpen] = React.useState(false);
  const [ordersDrawerOpen, setOrdersDrawerOpen] = React.useState(false);
  const [customerModalOpen, setCustomerModalOpen] = React.useState(false);
  const [noteModalOpen, setNoteModalOpen] = React.useState(false);
  const [discountModalOpen, setDiscountModalOpen] = React.useState(false);
  const [selectedCartLineId, setSelectedCartLineId] = React.useState(null);
  const [keypadMode, setKeypadMode] = React.useState("quantity");
  const [keypadInput, setKeypadInput] = React.useState("");
  const [sessionForm] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [customerForm] = Form.useForm();
  const [noteForm] = Form.useForm();
  const [discountForm] = Form.useForm();
  const [barcodeValue, setBarcodeValue] = React.useState("");

  const persistDraftOrders = React.useCallback((nextValue) => {
    setOrderDraftsBySession(nextValue);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(nextValue));
    }
  }, []);

  const buildEmptyOrder = React.useCallback((sessionId, index = 1, sessionNo = null) => ({
    id: `draft-${sessionId}-${Date.now()}-${index}`,
    title: sessionNo ? `${sessionNo}-${1000 + index}` : `${1000 + index}`,
    customerName: "",
    note: "",
    discountType: "amount",
    discountValue: 0,
    lines: [],
    status: "open",
    closedAt: null,
  }), []);

  React.useEffect(() => {
    if (!activeSessionId && sessions.length) {
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  React.useEffect(() => {
    const sessionIdFromQuery = new URLSearchParams(location.search).get("session");
    if (sessionIdFromQuery) {
      setActiveSessionId(sessionIdFromQuery);
    }
  }, [location.search]);

  React.useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    const sessionNo = sessions.find((s) => s.id === activeSessionId)?.sessionNo || null;
    const existingOrders = orderDraftsBySession[activeSessionId];
    if (sessionNo && existingOrders?.length > 0) {
      const fixed = existingOrders.map((o) => /^\d{4}$/.test(o.title) ? { ...o, title: `${sessionNo}-${o.title}` } : o);
      if (fixed.some((o, i) => o.title !== existingOrders[i].title)) {
        persistDraftOrders({ ...orderDraftsBySession, [activeSessionId]: fixed });
      }
    }
    if (!existingOrders || existingOrders.length === 0) {
      const firstOrder = buildEmptyOrder(activeSessionId, 1, sessionNo);
      persistDraftOrders({
        ...orderDraftsBySession,
        [activeSessionId]: [firstOrder],
      });
      setActiveOrderIdBySession((prev) => ({
        ...prev,
        [activeSessionId]: prev[activeSessionId] || firstOrder.id,
      }));
      return;
    }

    setActiveOrderIdBySession((prev) => {
      const currentActiveId = prev[activeSessionId];
      const currentStillOpen = existingOrders.some((item) => item.id === currentActiveId && item.status === "open");
      const firstOpenOrder = existingOrders.find((item) => item.status === "open");

      return {
        ...prev,
        [activeSessionId]: currentStillOpen ? currentActiveId : firstOpenOrder?.id,
      };
    });
  }, [activeSessionId, buildEmptyOrder, orderDraftsBySession, persistDraftOrders, sessions]);

  const refreshPosContext = React.useCallback(async () => {
    try {
      setPageLoading(true);
      const [nextCatalog, nextSessions, nextSales, posCategories, nextStockLocations] = await Promise.all([
        buildPosProductCatalogFresh(),
        getOpenPosSessionsFresh(),
        listPosSalesFresh(),
        listMasterDataFresh("pos-categories"),
        listStockLocationsFresh(),
      ]);
      setCatalog(nextCatalog);
      setSessions(nextSessions);
      setPosSales(nextSales);
      setStockLocations(nextStockLocations);
      setStockBalancesByLocation({});
      setPosCategoryStateOptions([
        { id: "all", name: "Tumu", color: "#fee89a" },
        ...posCategories
          .filter((item) => item.status === "Aktif")
          .map((item, index) => ({
            id: item.id,
            name: item.name,
            color: ["#fac898", "#f99aa0", "#ffd59e", "#b9edbe", "#ffe68f", "#b9ddff"][index % 6],
          })),
      ]);
      setActiveSessionId((prev) => prev || nextSessions[0]?.id);
    } catch (error) {
      message.error(error?.message || "POS verileri yuklenemedi.");
    } finally {
      setPageLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshPosContext();
  }, [refreshPosContext]);

  const activeSession = sessions.find((item) => item.id === activeSessionId);
  const draftOrders = orderDraftsBySession[activeSessionId] || [];
  const openDraftOrders = draftOrders.filter((item) => item.status === "open");
  const closedDraftOrders = draftOrders.filter((item) => item.status === "closed");
  const activeOrderId = activeOrderIdBySession[activeSessionId];
  const activeOrder = openDraftOrders.find((item) => item.id === activeOrderId) || openDraftOrders[0];
  const activeOrderStockLocationId = activeSession?.stockLocationId || null;
  const activeOrderLines = activeOrder?.lines;
  const cart = activeOrderLines || [];
  const sessionOrders = posSales.filter((sale) => sale.sessionId === activeSessionId);
  const posCategoryOptions = posCategoryStateOptions;
  /*
    { id: "all", name: "Tümü", color: "#fee89a" },
    ...listMasterData("pos-categories")
      .filter((item) => item.status === "Aktif")
      .map((item, index) => ({
        id: item.id,
        name: item.name,
        color: ["#fac898", "#f99aa0", "#ffd59e", "#b9edbe", "#ffe68f", "#b9ddff"][index % 6],
      })),
  ];

  */
  React.useEffect(() => {
    if (!activeOrderStockLocationId || stockBalancesByLocation[activeOrderStockLocationId]) {
      return;
    }

    let ignore = false;
    void listStockLocationBalancesFresh(activeOrderStockLocationId)
      .then((items) => {
        if (ignore) {
          return;
        }
        setStockBalancesByLocation((prev) => ({
          ...prev,
          [activeOrderStockLocationId]: items,
        }));
      })
      .catch((error) => {
        if (!ignore) {
          message.error(error?.message || "Stok yeri bakiyeleri yuklenemedi.");
        }
      });

    return () => {
      ignore = true;
    };
  }, [activeOrderStockLocationId, stockBalancesByLocation]);

  const stockLocationOptions = React.useMemo(
    () =>
      stockLocations.map((item) => ({
        value: item.id,
        label: item.isDefaultMain ? `${item.name} (Merkez)` : item.name,
      })),
    [stockLocations],
  );

  const currentStockBalanceMap = React.useMemo(
    () =>
      new Map(
        (stockBalancesByLocation[activeOrderStockLocationId] || []).map((item) => [item.productId, Number(item.quantity || 0)]),
      ),
    [activeOrderStockLocationId, stockBalancesByLocation],
  );

  const catalogWithAvailability = React.useMemo(
    () =>
      catalog.map((product) => ({
        ...product,
        quantityAvailable: activeOrderStockLocationId
          ? Number(currentStockBalanceMap.get(product.id) || 0)
          : 0,
      })),
    [activeOrderStockLocationId, catalog, currentStockBalanceMap],
  );

  const filteredCatalog = catalogWithAvailability.filter((product) => {
    const matchesSearch =
      !search.trim() ||
      [product.name, product.code, product.barcode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search.trim().toLowerCase()));
    const matchesCategory = activeCategory === "all" || product.posCategoryId === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const calculateOrderTotals = React.useCallback((order) => {
    const grossTotal = (order?.lines || []).reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    const discountType = order?.discountType || "amount";
    const discountValue = Number(order?.discountValue || 0);
    const discountAmount = discountType === "percent" ? (grossTotal * discountValue) / 100 : discountValue;
    const normalizedDiscountAmount = Math.min(Math.max(discountAmount, 0), grossTotal);
    const grandTotal = Math.max(grossTotal - normalizedDiscountAmount, 0);
    const subtotal = grandTotal / 1.2;
    const tax = grandTotal - subtotal;

    return {
      grossTotal,
      discountAmount: normalizedDiscountAmount,
      subtotal,
      tax,
      grandTotal,
    };
  }, []);

  const orderTotals = calculateOrderTotals(activeOrder);
  const cartTax = orderTotals.tax;
  const cartGrandTotal = orderTotals.grandTotal;

  React.useEffect(() => {
    const currentCart = activeOrderLines || [];

    if (!currentCart.length) {
      setSelectedCartLineId(null);
      setKeypadInput("");
      return;
    }

    if (!selectedCartLineId || !currentCart.some((item) => item.productId === selectedCartLineId)) {
      setSelectedCartLineId(currentCart[0].productId);
      setKeypadInput("");
    }
  }, [activeOrderLines, selectedCartLineId]);

  const updateActiveOrder = (updater) => {
    if (!activeSessionId || !activeOrder) {
      return;
    }

    const nextOrders = draftOrders.map((order) => (
      order.id === activeOrder.id ? updater(order) : order
    ));
    persistDraftOrders({
      ...orderDraftsBySession,
      [activeSessionId]: nextOrders,
    });
  };

  const createDraftOrder = (sessionIdOverride) => {
    const normalizedSessionId =
      typeof sessionIdOverride === "string"
        ? sessionIdOverride
        : activeSessionId;
    const targetSessionId = normalizedSessionId || activeSessionId;
    const targetOrders = orderDraftsBySession[targetSessionId] || [];

    if (!targetSessionId) {
      message.warning("Önce bir oturum açın.");
      return;
    }

    const targetSession = sessions.find((s) => s.id === targetSessionId);
    const nextOrder = buildEmptyOrder(targetSessionId, targetOrders.length + 1, targetSession?.sessionNo || null);
    const nextOrders = [...targetOrders, nextOrder];
    persistDraftOrders({
      ...orderDraftsBySession,
      [targetSessionId]: nextOrders,
    });
    setActiveOrderIdBySession((prev) => ({
      ...prev,
      [targetSessionId]: nextOrder.id,
    }));
    setOrdersDrawerOpen(false);
    message.success(`Yeni siparis acildi: ${nextOrder.title}`);
  };

  const removeOrderDraft = (orderId) => {
    if (!activeSessionId) {
      return;
    }

    if (orderId === openDraftOrders[0]?.id) {
      message.warning("İlk sipariş silinemez.");
      return;
    }

    const remainingOrders = draftOrders.filter((item) => item.id !== orderId);
    const nextOrders = remainingOrders.length > 0 ? remainingOrders : [buildEmptyOrder(activeSessionId, 1, activeSession?.sessionNo)];
    persistDraftOrders({
      ...orderDraftsBySession,
      [activeSessionId]: nextOrders,
    });
    setActiveOrderIdBySession((prev) => ({
      ...prev,
      [activeSessionId]: nextOrders[0].id,
    }));
  };

  const closeActiveOrder = () => {
    if (!activeOrder) {
      message.warning("Kapatilacak siparis bulunmuyor.");
      return;
    }

    const nextOpenOrder = draftOrders.find((item) => item.id !== activeOrder.id && item.status === "open");

    updateActiveOrder((order) => ({
      ...order,
      status: "closed",
      closedAt: new Date().toISOString(),
    }));

    setActiveOrderIdBySession((prev) => ({
      ...prev,
      [activeSessionId]: nextOpenOrder?.id,
    }));
    message.success("Siparis kapatildi.");
  };

  const handleCloseOrderButton = () => {
    if (!activeOrder) return;
    const isBase = activeOrder.id === openDraftOrders[0]?.id;
    if (isBase) return;
    if ((activeOrder.lines || []).length > 0) {
      Modal.confirm({
        title: "Siparişi Kapat",
        content: "Bu siparişi kapatmak istediğinize emin misiniz? Ürünler silinecektir.",
        okText: "Kapat",
        cancelText: "Vazgeç",
        okType: "danger",
        onOk: closeActiveOrder,
      });
    } else {
      closeActiveOrder();
    }
  };

  const reopenDraftOrder = (orderId) => {
    if (!activeSessionId) {
      return;
    }

    const nextOrders = draftOrders.map((order) =>
      order.id === orderId
        ? {
            ...order,
            status: "open",
            closedAt: null,
          }
        : order,
    );

    persistDraftOrders({
      ...orderDraftsBySession,
      [activeSessionId]: nextOrders,
    });
    setActiveOrderIdBySession((prev) => ({
      ...prev,
      [activeSessionId]: orderId,
    }));
    setOrdersDrawerOpen(false);
  };

  const getOrderDisplayTitle = (order) => {
    if (!order) {
      return "Yeni Siparis";
    }

    return order.customerName?.trim()
      ? `${order.title} - ${order.customerName}`
      : `${order.title} Yeni Siparis`;
  };

  const addProductToCart = (product) => {
    if (!activeSession?.stockLocationId) {
      message.warning("Oturumun depo yeri tanımlı değil.");
      return;
    }

    if (!product || product.quantityAvailable <= 0) {
      message.warning("Seçilen ürün için stok bulunmuyor.");
      return;
    }

    const existingQuantity = Number(activeOrder.lines.find((item) => item.productId === product.id)?.quantity || 0);
    if (existingQuantity >= Number(product.quantityAvailable || 0)) {
      message.warning("Secilen stok yerindeki mevcut adet asiliyor.");
      return;
    }

    updateActiveOrder((order) => {
      const existing = order.lines.find((item) => item.productId === product.id);
      if (existing) {
        return {
          ...order,
          lines: order.lines.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                lineTotal: (item.quantity + 1) * item.unitPrice,
              }
            : item,
          ),
        };
      }

      return {
        ...order,
        lines: [
          ...order.lines,
          {
          productId: product.id,
          code: product.code,
          name: product.name,
          quantity: 1,
          unitPrice: Number(product.salePrice || 0),
          lineTotal: Number(product.salePrice || 0),
          },
        ],
      };
    });
  };

  const handleBarcodeSubmit = () => {
    const foundProduct = findProductByBarcode(barcodeValue);
    if (!foundProduct) {
      message.warning("Barkoda ait ürün bulunamadı.");
      return;
    }

    const product = catalogWithAvailability.find((item) => item.id === foundProduct.id) || foundProduct;
    addProductToCart(product);
    setBarcodeValue("");
  };

  const updateCartQuantity = (productId, delta) => {
    updateActiveOrder((order) => ({
      ...order,
      lines: order.lines
        .map((item) => {
          if (item.productId !== productId) {
            return item;
          }

          const nextQuantity = item.quantity + delta;
          if (nextQuantity <= 0) {
            return null;
          }
          const availableQuantity = Number(currentStockBalanceMap.get(productId) || 0);
          if (nextQuantity > availableQuantity) {
            message.warning("Secilen stok yerindeki mevcut adet asiliyor.");
            return item;
          }

          return {
            ...item,
            quantity: nextQuantity,
            lineTotal: nextQuantity * item.unitPrice,
          };
        })
        .filter(Boolean),
    }));
  };

  const updateCartLineValue = (productId, nextValue, mode = "quantity") => {
    updateActiveOrder((order) => ({
      ...order,
      lines: order.lines
        .map((item) => {
          if (item.productId !== productId) {
            return item;
          }

          if (mode === "price") {
            const unitPrice = Number(nextValue || 0);
            return {
              ...item,
              unitPrice,
              lineTotal: unitPrice * item.quantity,
            };
          }

          const quantity = Number(nextValue || 0);
          if (quantity <= 0) {
            return null;
          }
          const availableQuantity = Number(currentStockBalanceMap.get(productId) || 0);
          if (quantity > availableQuantity) {
            message.warning("Secilen stok yerindeki mevcut adet asiliyor.");
            return item;
          }

          return {
            ...item,
            quantity,
            lineTotal: quantity * item.unitPrice,
          };
        })
        .filter(Boolean),
    }));
  };

  const handleKeypadPress = (label) => {
    if (!selectedCartLineId && !["Miktar", "Fiyat", "%"].includes(label)) {
      message.warning("Once bir urun satiri secin.");
      return;
    }

    if (label === "Miktar") {
      setKeypadMode("quantity");
      setKeypadInput("");
      return;
    }

    if (label === "Fiyat") {
      setKeypadMode("price");
      setKeypadInput("");
      return;
    }

    if (label === "%") {
      if (activeOrder) {
        discountForm.setFieldsValue({
          discountType: activeOrder.discountType || "percent",
          discountValue: activeOrder.discountValue || 0,
        });
        setDiscountModalOpen(true);
      }
      return;
    }

    if (label === "⌫") {
      const nextInput = keypadInput.slice(0, -1);
      setKeypadInput(nextInput);
      if (!nextInput) {
        return;
      }
      updateCartLineValue(selectedCartLineId, nextInput.replace(",", "."), keypadMode);
      return;
    }

    if (label === "+/-") {
      const selectedLine = cart.find((item) => item.productId === selectedCartLineId);
      if (!selectedLine) {
        return;
      }
      if (keypadMode === "price") {
        const nextValue = selectedLine.unitPrice > 0 ? 0 : Number(selectedLine.unitPrice || 0);
        updateCartLineValue(selectedCartLineId, nextValue, "price");
        setKeypadInput(String(nextValue || ""));
      } else {
        updateCartQuantity(selectedCartLineId, selectedLine.quantity > 1 ? -1 : 1);
      }
      return;
    }

    const nextInput = `${keypadInput}${label === "," ? "." : label}`;
    setKeypadInput(nextInput);
    updateCartLineValue(selectedCartLineId, nextInput, keypadMode);
  };

  const handleCreateSession = async () => {
    try {
      const values = await sessionForm.validateFields();
      const created = createPosSession({
        ...values,
        openedAt: values.openedAt ? values.openedAt.toISOString() : new Date().toISOString(),
      });
      setOpenSessionModalOpen(false);
      sessionForm.resetFields();
      await refreshPosContext();
      setActiveSessionId(created.id);
      const firstOrder = buildEmptyOrder(created.id, 1, created.sessionNo);
      persistDraftOrders({
        ...orderDraftsBySession,
        [created.id]: [firstOrder],
      });
      setActiveOrderIdBySession((prev) => ({ ...prev, [created.id]: firstOrder.id }));
      message.success("Yeni POS oturumu açıldı.");
    } catch {
      // validation handled by form
    }
  };

  const handlePayment = async () => {
    if (!activeSessionId) {
      message.warning("Önce açık bir POS oturumu seçin.");
      return;
    }

    if (!activeOrder || cart.length === 0) {
      message.warning("Sepette ürün bulunmuyor.");
      return;
    }

    try {
      const values = await paymentForm.validateFields();
      await requestJson("POST", "/api/pos-sales", {
        sessionId: activeSessionId,
        stockLocationId: activeSession?.stockLocationId,
        receiptNo: activeOrder?.title || undefined,
        soldAt: new Date().toISOString(),
        customerName: values.customerName || activeOrder.customerName,
        paymentMethod: values.paymentMethod,
        note: values.note || activeOrder.note,
        discountType: activeOrder.discountType,
        discountValue: activeOrder.discountValue,
        lines: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });
      setPaymentModalOpen(false);
      paymentForm.resetFields();
      const remainingOrders = draftOrders.filter((item) => item.id !== activeOrder.id);
      const newOrder = buildEmptyOrder(activeSessionId, remainingOrders.length + 1, activeSession?.sessionNo || null);
      const nextOrders = [...remainingOrders, newOrder];
      persistDraftOrders({
        ...orderDraftsBySession,
        [activeSessionId]: nextOrders,
      });
      setActiveOrderIdBySession((prev) => ({
        ...prev,
        [activeSessionId]: newOrder.id,
      }));
      void refreshPosContext();
      message.success("Satış tamamlandı.");
    } catch (error) {
      if (error?.errorFields) return;
      if (error?.message) {
        message.error(error.message);
      }
    }
  };

  const openPaymentModal = () => {
    if (!activeOrder) {
      message.warning("Aktif sipariş bulunmuyor.");
      return;
    }

    if (!activeSession?.stockLocationId) {
      message.warning("Oturumun depo yeri tanımlı değil.");
      return;
    }

    paymentForm.setFieldsValue({
      customerName: activeOrder.customerName || "Magaza Musterisi",
      paymentMethod: "Nakit",
      note: activeOrder.note || "",
    });
    setPaymentModalOpen(true);
  };

  const handleCloseSessionFromStore = () => {
    const hasOpenOrders = openDraftOrders.some((o) => o.lines.length > 0);
    Modal.confirm({
      title: "Oturumu Kapat",
      content: hasOpenOrders
        ? "Kaydedilmemiş siparişler iptal edilecektir. Oturumu kapatmak istediğinize emin misiniz?"
        : "Oturumu kapatmak istediğinize emin misiniz?",
      okText: "Kapat",
      cancelText: "Vazgeç",
      okType: "danger",
      onOk: async () => {
        try {
          await requestJson("POST", `/api/pos-sessions/${encodeURIComponent(activeSessionId)}/close`, {});
          persistDraftOrders({ ...orderDraftsBySession, [activeSessionId]: [] });
          navigate("/pos/sessions");
          message.success("POS oturumu kapatıldı.");
        } catch (error) {
          message.error(error?.message || "Oturum kapatılamadı.");
        }
      },
    });
  };

  const actionMenu = {
    items: [
      { key: "sessions", label: "Oturumlara Git" },
      { key: "reload", label: "Verileri Yeniden Yükle" },
      { key: "exit", label: "Oturumdan Çık" },
      { key: "close", label: "Oturumu Kapat", danger: true },
    ],
    onClick: ({ key }) => {
      if (key === "sessions") {
        navigate("/pos/sessions");
      }
      if (key === "reload") {
        void refreshPosContext();
        message.success("POS verileri yenilendi.");
      }
      if (key === "exit") {
        navigate("/pos/sessions");
      }
      if (key === "close") {
        handleCloseSessionFromStore();
      }
    },
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {!activeSession ? (
        <Card className="erp-pos-opening-card" bordered={false}>
          <Space direction="vertical" size={18} style={{ width: "100%", textAlign: "center" }}>
            <div>
              <Title level={2} style={{ marginBottom: 6 }}>POS Oturumu Kapali</Title>
              <Text type="secondary">Kasa acilmadan urun satisina gecilmez. Oturum acilis ve kapanis tarihleri kayit altina alinir.</Text>
            </div>
            <div className="erp-pos-opening-meta">
              <div>
                <Text type="secondary">Bugun</Text>
                <Title level={4} style={{ margin: 0 }}>{new Date().toLocaleDateString("tr-TR")}</Title>
              </div>
              <div>
                <Text type="secondary">Saat</Text>
                <Title level={4} style={{ margin: 0 }}>{new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</Title>
              </div>
            </div>
            <Space wrap style={{ justifyContent: "center" }}>
              <Button type="primary" size="large" className="erp-pos-open-session-btn" onClick={() => setOpenSessionModalOpen(true)}>Kasayi Acin</Button>
              <Button size="large" onClick={() => navigate("/pos/sessions")}>Oturumlari Gor</Button>
            </Space>
          </Space>
        </Card>
      ) : null}

      {activeSession ? (
      <div className="erp-pos-shell">
        <div className="erp-pos-left">
          <div className="erp-pos-order-header">
            <div className="erp-pos-order-header-main">
              <div className="erp-pos-session-info">
                <Text strong style={{ fontSize: 13 }}>Pos Oturum Kodu: {activeSession?.sessionNo || "-"}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>Stok Yeri: {stockLocations.find((x) => x.id === activeSession?.stockLocationId)?.name || "-"}</Text>
              </div>
              <Button className="erp-pos-orders-title-btn" onClick={() => setOrdersDrawerOpen(true)}>Siparişler</Button>
              <Button icon={<PlusCircleOutlined />} onClick={() => createDraftOrder()}>Yeni</Button>
            </div>
            <div className="erp-pos-session-tabs">
              {openDraftOrders.length > 0 ? openDraftOrders.map((order) => (
                <Button
                  key={order.id}
                  type={activeOrder?.id === order.id ? "primary" : "default"}
                  onClick={() => setActiveOrderIdBySession((prev) => ({ ...prev, [activeSessionId]: order.id }))}
                >
                  {order.title}
                </Button>
              )) : (
                <Button type="primary" onClick={() => setOpenSessionModalOpen(true)}>Sipariş Aç</Button>
              )}
            </div>
          </div>

          <div className="erp-pos-order-list">
            {activeOrder ? (
              <div className="erp-pos-active-order-banner">
                <div className="erp-pos-active-order-banner-row">
                  <div>
                    <Text strong>{getOrderDisplayTitle(activeOrder)}</Text>
                    <Text type="secondary">{activeOrder.note || "Siparis acik, urun eklemeye hazir."}</Text>
                  </div>
                  <Space wrap>
                    <Button onClick={() => {
                      discountForm.setFieldsValue({
                        discountType: activeOrder.discountType || "amount",
                        discountValue: activeOrder.discountValue || 0,
                      });
                      setDiscountModalOpen(true);
                    }}
                    >
                      İndirim
                    </Button>
                    <Button
                      onClick={handleCloseOrderButton}
                      disabled={activeOrder?.id === openDraftOrders[0]?.id}
                    >
                      Sipariş Kapat
                    </Button>
                  </Space>
                </div>
              </div>
            ) : null}
            {cart.length === 0 ? (
              <Empty description="Sepette ürün bulunmuyor" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              cart.map((item, index) => (
                <div
                  key={item.productId}
                  className={`erp-pos-order-item ${selectedCartLineId === item.productId ? "is-selected" : ""}`}
                  onClick={() => {
                    setSelectedCartLineId(item.productId);
                    setKeypadInput(String(keypadMode === "price" ? item.unitPrice : item.quantity));
                  }}
                >
                  <div className="erp-pos-order-item-head">
                    <span className="erp-pos-order-index">{index + 1}</span>
                    <Text>{item.code}-{item.name}</Text>
                  </div>
                  <div className="erp-pos-order-item-actions">
                    <Button size="small" onClick={() => updateCartQuantity(item.productId, -1)}>-</Button>
                    <Text strong>{item.quantity}</Text>
                    <Button size="small" onClick={() => updateCartQuantity(item.productId, 1)}>+</Button>
                    <Text strong>{formatMovementMoney(item.lineTotal)}</Text>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="erp-pos-summary">
            <div className="erp-pos-summary-row">
              <Text>Ara Toplam</Text>
              <Text strong>{formatMovementMoney(orderTotals.grossTotal)}</Text>
            </div>
            <div className="erp-pos-summary-row">
              <Text>Indirim</Text>
              <Text strong>{formatMovementMoney(orderTotals.discountAmount)}</Text>
            </div>
            <div className="erp-pos-summary-row">
              <Text>Vergiler</Text>
              <Text strong>{formatMovementMoney(cartTax)}</Text>
            </div>
            <div className="erp-pos-summary-row erp-pos-summary-total">
              <Text strong>Toplam</Text>
              <Text strong>{formatMovementMoney(cartGrandTotal)}</Text>
            </div>
          </div>

          <div className="erp-pos-bottom-actions">
            <Space className="erp-pos-mini-actions">
              <Button onClick={() => {
                customerForm.setFieldsValue({ customerName: activeOrder?.customerName || "" });
                setCustomerModalOpen(true);
              }}
              >
                Musteri
              </Button>
              <Button onClick={() => {
                noteForm.setFieldsValue({ note: activeOrder?.note || "" });
                setNoteModalOpen(true);
              }}
              >
                Not
              </Button>
            </Space>

            <div className="erp-pos-keypad-display">
              <Text type="secondary">
                {selectedCartLineId
                  ? `Secili satir: ${(cart.find((item) => item.productId === selectedCartLineId)?.name) || "-"}`
                  : "Secili satir yok"}
              </Text>
              <Text strong>{keypadMode === "price" ? "Fiyat" : "Miktar"}: {keypadInput || "-"}</Text>
            </div>

            <div className="erp-pos-keypad">
              {["1", "2", "3", "Miktar", "4", "5", "6", "%", "7", "8", "9", "Fiyat", "+/-", "0", ",", "?"].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleKeypadPress(label)}
                  className={`erp-pos-key ${(label === "Miktar" && keypadMode === "quantity") || (label === "Fiyat" && keypadMode === "price") ? "is-active" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <Button type="primary" size="large" className="erp-pos-pay-btn" onClick={openPaymentModal}>
              Odeme
            </Button>
          </div>
        </div>

        <div className="erp-pos-right">
          <div className="erp-pos-toolbar">
            <Input
              prefix={<SearchOutlined />}
              placeholder="Ürün ara..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="erp-pos-search"
            />
            <Input
              prefix={<BarcodeOutlined />}
              placeholder="Barkod"
              value={barcodeValue}
              onChange={(event) => setBarcodeValue(event.target.value)}
              onPressEnter={handleBarcodeSubmit}
              className="erp-pos-barcode"
            />
            <Avatar className="erp-pos-user-avatar" icon={<UserOutlined />} />
            <Dropdown menu={actionMenu} trigger={["click"]} placement="bottomRight">
              <Button icon={<MenuOutlined />} className="erp-pos-menu-btn" />
            </Dropdown>
          </div>

          <div className="erp-pos-category-row">
            {posCategoryStateOptions.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`erp-pos-category-chip ${activeCategory === category.id ? "is-selected" : ""}`}
                style={{ background: category.color }}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

            <div className="erp-pos-product-grid">
              {filteredCatalog.map((product) => (
                <button key={product.id} type="button" className="erp-pos-product-card" onClick={() => addProductToCart(product)}>
                  <div className="erp-pos-product-image-wrap">
                    <img src={product.imageUrl} alt={product.name} className="erp-pos-product-image" />
                  </div>
                  <div className="erp-pos-product-name">{product.code}-{product.name}</div>
                  <div className="erp-pos-product-name" style={{ fontSize: 12, opacity: 0.75 }}>
                    {activeOrderStockLocationId ? `Stok: ${product.quantityAvailable}` : "Depo yeri yok"}
                  </div>
                </button>
              ))}
            </div>
        </div>
      </div>
      ) : null}
      <Modal title="Satışı Tamamla" open={paymentModalOpen} onCancel={() => setPaymentModalOpen(false)} onOk={handlePayment} okText="Satışı Kaydet" cancelText="Vazgeç">
        <Form form={paymentForm} layout="vertical" initialValues={{ customerName: activeOrder?.customerName || "Magaza Musterisi", paymentMethod: "Nakit", note: activeOrder?.note || "" }}>
          <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Oturum">{activeSession?.sessionNo || "-"}</Descriptions.Item>
            <Descriptions.Item label="Satış Tarihi">{activeSession?.openedAt ? new Date(activeSession.openedAt).toLocaleString("tr-TR") : "-"}</Descriptions.Item>
            <Descriptions.Item label="Stok Yeri">{stockLocations.find((item) => item.id === activeSession?.stockLocationId)?.name || "-"}</Descriptions.Item>
          </Descriptions>
          <Form.Item name="customerName" label="Müşteri">
            <Input />
          </Form.Item>
          <Form.Item name="paymentMethod" label="Ödeme Tipi" rules={[{ required: true, message: "Ödeme tipi seçin." }]}>
            <Select options={["Nakit", "Kart", "Havale"].map((item) => ({ value: item, label: item }))} />
          </Form.Item>
          <Form.Item name="note" label="Not">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Ara Toplam">{formatMovementMoney(orderTotals.grossTotal)}</Descriptions.Item>
            <Descriptions.Item label="İndirim">{formatMovementMoney(orderTotals.discountAmount)}</Descriptions.Item>
            <Descriptions.Item label="Vergi">{formatMovementMoney(cartTax)}</Descriptions.Item>
            <Descriptions.Item label="Genel Toplam">{formatMovementMoney(cartGrandTotal)}</Descriptions.Item>
          </Descriptions>
        </Form>
      </Modal>

      <Modal title="Musteri Bilgisi" open={customerModalOpen} onCancel={() => setCustomerModalOpen(false)} onOk={async () => {
        const values = await customerForm.validateFields();
        updateActiveOrder((order) => ({ ...order, customerName: values.customerName || "" }));
        setCustomerModalOpen(false);
      }} okText="Kaydet" cancelText="Vazgeç">
        <Form form={customerForm} layout="vertical">
          <Form.Item name="customerName" label="Müşteri">
            <Input placeholder="Musteri adi" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Siparis Notu" open={noteModalOpen} onCancel={() => setNoteModalOpen(false)} onOk={async () => {
        const values = await noteForm.validateFields();
        updateActiveOrder((order) => ({ ...order, note: values.note || "" }));
        setNoteModalOpen(false);
      }} okText="Kaydet" cancelText="Vazgeç">
        <Form form={noteForm} layout="vertical">
          <Form.Item name="note" label="Not">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Siparise Ozel Indirim" open={discountModalOpen} onCancel={() => setDiscountModalOpen(false)} onOk={async () => {
        const values = await discountForm.validateFields();
        updateActiveOrder((order) => ({
          ...order,
          discountType: values.discountType,
          discountValue: Number(values.discountValue || 0),
        }));
        setDiscountModalOpen(false);
      }} okText="Uygula" cancelText="Vazgeç">
        <Form form={discountForm} layout="vertical" initialValues={{ discountType: "amount", discountValue: 0 }}>
          <Form.Item name="discountType" label="Indirim Tipi" rules={[{ required: true, message: "Indirim tipi secin." }]}>
            <Radio.Group
              options={[
                { label: "Tutar", value: "amount" },
                { label: "Yuzde", value: "percent" },
              ]}
            />
          </Form.Item>
          <Form.Item name="discountValue" label="Indirim Degeri">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Yeni POS Oturumu" open={openSessionModalOpen} onCancel={() => setOpenSessionModalOpen(false)} onOk={handleCreateSession} okText="Aç" cancelText="Vazgeç">
        <Form form={sessionForm} layout="vertical" initialValues={{ cashierName: "Sibel Ersoy Arslan", openingBalance: 0 }}>
          <Form.Item name="stockLocationId" label="Depo Yeri" rules={[{ required: true, message: "Depo yeri zorunludur." }]}>
            <Select options={stockLocationOptions} placeholder="Depo yeri seçin" />
          </Form.Item>
          <Form.Item name="cashierName" label="Kasiyer" rules={[{ required: true, message: "Kasiyer adı zorunludur." }]}>
            <Input />
          </Form.Item>
          <Form.Item name="openedAt" label="Açılış Tarihi">
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="openingBalance" label="Açılış Bakiyesi">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="note" label="Not">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title="Siparisler" placement="right" width={620} open={ordersDrawerOpen} onClose={() => setOrdersDrawerOpen(false)}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Card size="small" title="Acik ve Kapali Siparisler">
            <Table
              rowKey="id"
              pagination={false}
              size="small"
              dataSource={[...openDraftOrders, ...closedDraftOrders]}
              locale={{ emptyText: "Oturuma ait siparis bulunmuyor." }}
              columns={[
                { title: "Siparis", dataIndex: "title", key: "title" },
                { title: "Durum", key: "status", render: (_, record) => record.status === "open" ? "Devam Ediyor" : "Kapali" },
                { title: "Musteri", dataIndex: "customerName", key: "customerName", render: (value) => value || "-" },
                { title: "Indirim", key: "discount", render: (_, record) => formatMovementMoney(calculateOrderTotals(record).discountAmount) },
                {
                  title: "Islemler",
                  key: "actions",
                  render: (_, record) => (
                    <Space size={8}>
                      <Button size="small" onClick={() => record.status === "open" ? setActiveOrderIdBySession((prev) => ({ ...prev, [activeSessionId]: record.id })) : reopenDraftOrder(record.id)}>{record.status === "open" ? "Yukle" : "Ac"}</Button>
                      {record.id !== openDraftOrders[0]?.id && (
                        <Popconfirm title="Siparis silinsin mi?" okText="Sil" cancelText="Vazgec" onConfirm={() => removeOrderDraft(record.id)}>
                          <Button size="small" danger>Sil</Button>
                        </Popconfirm>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          </Card>

          <Card size="small" title="Tamamlanan Siparisler">
            <Table
              rowKey="id"
              pagination={false}
              size="small"
              dataSource={sessionOrders}
              columns={[
                { title: "Sipariş No", dataIndex: "receiptNo", key: "receiptNo" },
                { title: "Musteri", dataIndex: "customerName", key: "customerName" },
                { title: "Tarih", dataIndex: "soldAt", key: "soldAt", render: (value) => new Date(value).toLocaleString("tr-TR") },
                { title: "Indirim", dataIndex: "discountAmountDisplay", key: "discountAmountDisplay" },
                { title: "Toplam", dataIndex: "grandTotalDisplay", key: "grandTotalDisplay" },
              ]}
            />
          </Card>
        </Space>
      </Drawer>
    </Space>
  );
}

const POS_ORDERS_SAVED_FILTERS_KEY = "sibella.erp.posOrderFilters.v1";

const EMPTY_POS_FILTERS = {
  search: "",
  productSearch: "",
  paymentMethod: undefined,
  dateFrom: null,
  dateTo: null,
};

export function PosOrdersPage() {
  const navigate = useNavigate();
  const [sales, setSales] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [savedFilterName, setSavedFilterName] = React.useState("");
  const [filters, setFilters] = React.useState(EMPTY_POS_FILTERS);
  const [savedFilters, setSavedFilters] = React.useState(() => {
    try { return JSON.parse(window.localStorage.getItem(POS_ORDERS_SAVED_FILTERS_KEY) || "[]"); }
    catch { return []; }
  });

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await listPosSalesFresh();
      setSales(data);
    } catch (error) {
      message.error(error?.message || "Siparişler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const paymentOptions = React.useMemo(() => {
    const methods = [...new Set(sales.map((s) => s.paymentMethod).filter(Boolean))];
    return methods.map((m) => ({ value: m, label: m }));
  }, [sales]);

  const persistSavedFilters = (next) => {
    setSavedFilters(next);
    window.localStorage.setItem(POS_ORDERS_SAVED_FILTERS_KEY, JSON.stringify(next));
  };

  const handleFilterChange = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const handleResetFilters = () => setFilters(EMPTY_POS_FILTERS);

  const handleSaveFilterPreset = () => {
    if (!savedFilterName.trim()) { message.warning("Filtre adını girin."); return; }
    const next = [
      { name: savedFilterName.trim(), filters },
      ...savedFilters.filter((f) => f.name !== savedFilterName.trim()),
    ];
    persistSavedFilters(next);
    setSavedFilterName("");
    message.success("Filtre kaydedildi.");
  };

  const applySavedFilter = (saved) => {
    setFilters(saved.filters);
    setFilterModalOpen(false);
    message.success(`${saved.name} filtresi uygulandı.`);
  };

  const activeFilterCount = Object.entries(filters).filter(([, v]) => v).length;

  const filteredSales = React.useMemo(() => {
    return sales.filter((sale) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const inHeader =
          String(sale.receiptNo || "").toLowerCase().includes(q) ||
          String(sale.customerName || "").toLowerCase().includes(q);
        if (!inHeader) return false;
      }
      if (filters.productSearch) {
        const q = filters.productSearch.toLowerCase();
        const hasMatch = (sale.lines || []).some(
          (l) =>
            String(l.productCode || "").toLowerCase().includes(q) ||
            String(l.productName || "").toLowerCase().includes(q)
        );
        if (!hasMatch) return false;
      }
      if (filters.paymentMethod && sale.paymentMethod !== filters.paymentMethod) return false;
      if (filters.dateFrom && dayjs(sale.soldAt).isBefore(dayjs(filters.dateFrom).startOf("day"))) return false;
      if (filters.dateTo && dayjs(sale.soldAt).isAfter(dayjs(filters.dateTo).endOf("day"))) return false;
      return true;
    });
  }, [sales, filters]);

  const [detailSale, setDetailSale] = React.useState(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  // Satışları düz satır listesine çevir (her line → bir satır)
  const flatRows = React.useMemo(() => {
    const q = (filters.productSearch || "").toLowerCase();
    return filteredSales.flatMap((sale) =>
      (sale.lines || [])
        .filter((line) => {
          if (!q) return true;
          return (
            String(line.productCode || "").toLowerCase().includes(q) ||
            String(line.productName || "").toLowerCase().includes(q)
          );
        })
        .map((line) => ({
          key: `${sale.id}-${line.id}`,
          saleId: sale.id,
          soldAt: sale.soldAt,
          receiptNo: sale.receiptNo,
          paymentMethod: sale.paymentMethod,
          customerName: sale.customerName,
          productCode: line.productCode,
          productName: line.productName,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          unitPriceDisplay: line.unitPriceDisplay,
          lineTotal: line.lineTotal,
          lineTotalDisplay: line.lineTotalDisplay,
          _sale: sale,
        }))
    );
  }, [filteredSales, filters.productSearch]);

  const columns = [
    {
      title: "Tarih",
      dataIndex: "soldAt",
      key: "soldAt",
      width: 110,
      defaultSortOrder: "descend",
      sorter: (a, b) => new Date(a.soldAt || 0) - new Date(b.soldAt || 0),
      render: (v) => v ? new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(v)) : "-",
    },
    {
      title: "Fiş No",
      dataIndex: "receiptNo",
      key: "receiptNo",
      width: 100,
      sorter: (a, b) => (a.receiptNo || "").localeCompare(b.receiptNo || "", "tr"),
    },
    {
      title: "Ödeme Tipi",
      dataIndex: "paymentMethod",
      key: "paymentMethod",
      width: 110,
      render: (v) => v ? <Tag>{v}</Tag> : "-",
    },
    {
      title: "Ürün Kodu",
      dataIndex: "productCode",
      key: "productCode",
      width: 120,
    },
    {
      title: "Ürün Adı",
      dataIndex: "productName",
      key: "productName",
      ellipsis: true,
    },
    {
      title: "Satış Adet",
      dataIndex: "quantity",
      key: "quantity",
      width: 90,
      align: "right",
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: "Birim Fiyat",
      dataIndex: "unitPriceDisplay",
      key: "unitPriceDisplay",
      width: 120,
      align: "right",
    },
    {
      title: "Toplam Fiyat",
      dataIndex: "lineTotalDisplay",
      key: "lineTotalDisplay",
      width: 120,
      align: "right",
      render: (v) => <Text strong>{v}</Text>,
    },
    {
      title: "İşlemler",
      key: "actions",
      width: 100,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Görüntüle">
            <Button
              size="small"
              className="erp-icon-btn erp-icon-btn-view"
              icon={<SearchOutlined />}
              onClick={(e) => { e.stopPropagation(); setDetailSale(record._sale); setDetailOpen(true); }}
            />
          </Tooltip>
          <Tooltip title="İade Yap">
            <Button
              size="small"
              className="erp-icon-btn"
              icon={<RollbackOutlined />}
              onClick={(e) => { e.stopPropagation(); navigate(`/pos/returns/new?saleId=${record.saleId}`); }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>

      {/* Başlık */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>POS Siparişleri</Title>
          <Text type="secondary">Tüm POS satışları. İade işlemi için ilgili siparişi seçin.</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => void refresh()}>Yenile</Button>
      </div>

      {/* Arama + Filtre Toolbar */}
      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar">
          <div style={{ flex: 1 }} />
          <div className="erp-product-toolbar-search">
            <Input
              prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
              placeholder="Fiş no veya müşteri ara..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              allowClear
            />
            <Badge count={activeFilterCount} size="small">
              <Button icon={<FilterOutlined />} onClick={() => setFilterModalOpen(true)} />
            </Badge>
          </div>
        </div>
      </Card>

      {/* Tablo */}
      <Card
        title={`Sipariş Listesi${activeFilterCount > 0 ? ` (${flatRows.length} satır / ${filteredSales.length} fiş)` : ` (${flatRows.length} satır)`}`}
        className="erp-list-table-card"
      >
        <Table
          loading={loading}
          columns={columns}
          dataSource={flatRows}
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (total, range) => `${range[0]}-${range[1]} / ${total}` }}
        />
      </Card>

      {/* Satış Detay Drawer */}
      <Drawer
        title={detailSale ? `Fiş: ${detailSale.receiptNo} — ${detailSale.customerName || "Misafir"}` : "Satış Detayı"}
        placement="right"
        width={480}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      >
        {detailSale ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Fiş No">{detailSale.receiptNo}</Descriptions.Item>
              <Descriptions.Item label="Müşteri">{detailSale.customerName || "Misafir"}</Descriptions.Item>
              <Descriptions.Item label="Tarih">{detailSale.soldAt ? new Date(detailSale.soldAt).toLocaleString("tr-TR") : "-"}</Descriptions.Item>
              <Descriptions.Item label="Ödeme">{detailSale.paymentMethod || "-"}</Descriptions.Item>
              <Descriptions.Item label="Genel Toplam"><Text strong>{detailSale.grandTotalDisplay}</Text></Descriptions.Item>
            </Descriptions>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={(detailSale.lines || []).map((l) => ({ key: l.id, ...l }))}
              columns={[
                { title: "Ürün Kodu", dataIndex: "productCode", key: "productCode", width: 110 },
                { title: "Ürün Adı", dataIndex: "productName", key: "productName", ellipsis: true },
                { title: "Adet", dataIndex: "quantity", key: "quantity", width: 60, align: "right" },
                { title: "Toplam", dataIndex: "lineTotalDisplay", key: "lineTotalDisplay", width: 100, align: "right" },
              ]}
            />
            <Button
              type="primary"
              icon={<RollbackOutlined />}
              block
              onClick={() => { setDetailOpen(false); navigate(`/pos/returns/new?saleId=${detailSale.id}`); }}
            >
              Bu Fişe İade Yap
            </Button>
          </Space>
        ) : null}
      </Drawer>

      {/* Gelişmiş Filtreler Modal */}
      <Modal
        title="Gelişmiş Filtreler"
        open={filterModalOpen}
        onCancel={() => setFilterModalOpen(false)}
        footer={null}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={[12, 12]}>
            <Col span={24}>
              <Form.Item label="Ürün Kodu / Adı">
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Ürün kodu veya adı..."
                  value={filters.productSearch}
                  onChange={(e) => handleFilterChange("productSearch", e.target.value)}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Ödeme Yöntemi">
                <Select
                  placeholder="Tümü"
                  value={filters.paymentMethod}
                  onChange={(v) => handleFilterChange("paymentMethod", v)}
                  options={paymentOptions}
                  allowClear
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Başlangıç Tarihi">
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD.MM.YYYY"
                  value={filters.dateFrom ? dayjs(filters.dateFrom) : null}
                  onChange={(d) => handleFilterChange("dateFrom", d ? d.format("YYYY-MM-DD") : null)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Bitiş Tarihi">
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD.MM.YYYY"
                  value={filters.dateTo ? dayjs(filters.dateTo) : null}
                  onChange={(d) => handleFilterChange("dateTo", d ? d.format("YYYY-MM-DD") : null)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" title="Filtreyi Kaydet">
            <Space.Compact style={{ width: "100%" }}>
              <Input
                value={savedFilterName}
                onChange={(e) => setSavedFilterName(e.target.value)}
                placeholder="Filtre adı"
                onPressEnter={handleSaveFilterPreset}
              />
              <Button type="primary" onClick={handleSaveFilterPreset}>Kaydet</Button>
            </Space.Compact>
          </Card>

          <Card size="small" title="Kayıtlı Filtreler">
            {savedFilters.length === 0 ? (
              <Text type="secondary">Henüz kayıtlı filtre yok.</Text>
            ) : (
              <Space direction="vertical" size={6} style={{ width: "100%" }}>
                {savedFilters.map((item) => (
                  <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Button style={{ flex: 1, textAlign: "left" }} onClick={() => applySavedFilter(item)}>
                      {item.name}
                    </Button>
                    <Popconfirm
                      title="Bu filtre silinsin mi?"
                      okText="Sil"
                      cancelText="Vazgeç"
                      onConfirm={() => persistSavedFilters(savedFilters.filter((f) => f.name !== item.name))}
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                ))}
              </Space>
            )}
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

export function PosReturnEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const saleId = new URLSearchParams(location.search).get("saleId");
  const [sale, setSale] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [returnedQtyMap, setReturnedQtyMap] = React.useState({});
  const [quantities, setQuantities] = React.useState({});
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (!saleId) { setLoading(false); return; }
    void (async () => {
      try {
        const [salesList, returnsData] = await Promise.all([
          listPosSalesFresh(),
          listPosReturnsFresh(),
        ]);
        const found = salesList.find((s) => s.id === saleId);
        setSale(found || null);

        const alreadyReturned = {};
        returnsData.forEach((ret) => {
          if (ret.originalSaleId === saleId) {
            (ret.lines || []).forEach((l) => {
              alreadyReturned[l.originalSaleLineId] = (alreadyReturned[l.originalSaleLineId] || 0) + Number(l.quantity || 0);
            });
          }
        });
        setReturnedQtyMap(alreadyReturned);

        const initQty = {};
        (found?.lines || []).forEach((l) => { initQty[l.id] = 0; });
        setQuantities(initQty);
      } catch (error) {
        message.error(error?.message || "Satış yüklenemedi.");
      } finally {
        setLoading(false);
      }
    })();
  }, [saleId]);

  const handleSubmit = async () => {
    const returnLines = (sale?.lines || [])
      .filter((l) => Number(quantities[l.id] || 0) > 0)
      .map((l) => ({
        originalSaleLineId: l.id,
        productId: l.productId,
        quantity: Number(quantities[l.id] || 0),
        unitPrice: l.unitPrice,
      }));

    if (returnLines.length === 0) {
      message.warning("En az bir ürün için iade miktarı girin.");
      return;
    }

    try {
      setSubmitting(true);
      await createPosReturn({
        originalSaleId: saleId,
        stockLocationId: sale?.stockLocationId || null,
        returnDate: new Date().toISOString(),
        note,
        lines: returnLines,
      });
      message.success("İade başarıyla oluşturuldu.");
      navigate("/pos/returns");
    } catch (error) {
      message.error(error?.message || "İade oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 32 }}>Yükleniyor...</div>;
  if (!sale) return <div style={{ padding: 32 }}>Satış bulunamadı.</div>;

  const columns = [
    { title: "Ürün Kodu", dataIndex: "productCode", key: "productCode" },
    { title: "Ürün Adı", dataIndex: "productName", key: "productName" },
    { title: "Satış Adedi", dataIndex: "quantity", key: "quantity" },
    { title: "Birim Fiyat", dataIndex: "unitPriceDisplay", key: "unitPriceDisplay" },
    {
      title: "Daha Önce İade",
      key: "alreadyReturned",
      render: (_, record) => returnedQtyMap[record.id] || 0,
    },
    {
      title: "İade Edilebilir",
      key: "maxReturnable",
      render: (_, record) => Math.max(0, record.quantity - (returnedQtyMap[record.id] || 0)),
    },
    {
      title: "İade Miktarı",
      key: "returnQty",
      render: (_, record) => {
        const max = Math.max(0, record.quantity - (returnedQtyMap[record.id] || 0));
        return (
          <InputNumber
            min={0}
            max={max}
            value={quantities[record.id] || 0}
            onChange={(val) => setQuantities((prev) => ({ ...prev, [record.id]: val || 0 }))}
            disabled={max === 0}
            style={{ width: 80 }}
          />
        );
      },
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>İade Oluştur</Title>
          <Text type="secondary">Fiş: {sale.receiptNo} — {sale.customerName} — {sale.soldAt ? new Date(sale.soldAt).toLocaleString("tr-TR") : "-"}</Text>
        </div>
        <Space>
          <Button onClick={() => navigate("/pos/orders")}>Geri</Button>
          <Button type="primary" icon={<RollbackOutlined />} loading={submitting} onClick={handleSubmit}>İadeyi Kaydet</Button>
        </Space>
      </div>

      <Card title="İade Edilecek Ürünler" className="erp-list-table-card" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={(sale.lines || []).map((l) => ({ key: l.id, ...l }))}
          pagination={false}
          scroll={{ x: 700 }}
        />
      </Card>

      <Card title="İade Notu">
        <Input.TextArea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Varsa iade nedeni..."
        />
      </Card>

      <Card title="Özet">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Toplam İade Adedi">
            {(sale.lines || []).reduce((sum, l) => sum + Number(quantities[l.id] || 0), 0)}
          </Descriptions.Item>
          <Descriptions.Item label="Toplam İade Tutarı">
            {formatMovementMoney((sale.lines || []).reduce((sum, l) => sum + Number(quantities[l.id] || 0) * l.unitPrice, 0))}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );
}

const POS_RETURNS_SAVED_FILTERS_KEY = "sibella.erp.posReturnFilters.v1";

const EMPTY_RETURN_FILTERS = {
  search: "",
  productSearch: "",
  dateFrom: null,
  dateTo: null,
};

export function PosReturnListPage() {
  const [returns, setReturns] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [savedFilterName, setSavedFilterName] = React.useState("");
  const [filters, setFilters] = React.useState(EMPTY_RETURN_FILTERS);
  const [savedFilters, setSavedFilters] = React.useState(() => {
    try { return JSON.parse(window.localStorage.getItem(POS_RETURNS_SAVED_FILTERS_KEY) || "[]"); }
    catch { return []; }
  });

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await listPosReturnsFresh();
      setReturns(data);
    } catch (error) {
      message.error(error?.message || "İadeler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const persistSavedFilters = (next) => {
    setSavedFilters(next);
    window.localStorage.setItem(POS_RETURNS_SAVED_FILTERS_KEY, JSON.stringify(next));
  };

  const handleFilterChange = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const handleResetFilters = () => setFilters(EMPTY_RETURN_FILTERS);

  const handleSaveFilterPreset = () => {
    if (!savedFilterName.trim()) { message.warning("Filtre adını girin."); return; }
    const next = [
      { name: savedFilterName.trim(), filters },
      ...savedFilters.filter((f) => f.name !== savedFilterName.trim()),
    ];
    persistSavedFilters(next);
    setSavedFilterName("");
    message.success("Filtre kaydedildi.");
  };

  const applySavedFilter = (saved) => {
    setFilters(saved.filters);
    setFilterModalOpen(false);
    message.success(`${saved.name} filtresi uygulandı.`);
  };

  const activeFilterCount = Object.entries(filters).filter(([, v]) => v).length;

  // Düz satır: her iade kalemi ayrı satır
  const flatRows = React.useMemo(() => {
    const pq = (filters.productSearch || "").toLowerCase();
    return returns
      .filter((ret) => {
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const match =
            String(ret.returnNo || "").toLowerCase().includes(q) ||
            String(ret.receiptNo || "").toLowerCase().includes(q);
          if (!match) return false;
        }
        if (filters.dateFrom && dayjs(ret.returnDate).isBefore(dayjs(filters.dateFrom).startOf("day"))) return false;
        if (filters.dateTo && dayjs(ret.returnDate).isAfter(dayjs(filters.dateTo).endOf("day"))) return false;
        return true;
      })
      .flatMap((ret) =>
        (ret.lines || [])
          .filter((line) => {
            if (!pq) return true;
            return (
              String(line.productCode || "").toLowerCase().includes(pq) ||
              String(line.productName || "").toLowerCase().includes(pq)
            );
          })
          .map((line) => ({
            key: `${ret.id}-${line.id}`,
            returnId: ret.id,
            returnNo: ret.returnNo,
            receiptNo: ret.receiptNo,
            returnDate: ret.returnDate,
            productCode: line.productCode,
            productName: line.productName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
          }))
      );
  }, [returns, filters]);

  const columns = [
    {
      title: "İade Tarihi",
      dataIndex: "returnDate",
      key: "returnDate",
      width: 110,
      defaultSortOrder: "descend",
      sorter: (a, b) => new Date(a.returnDate || 0) - new Date(b.returnDate || 0),
      render: (v) => v ? new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(v)) : "-",
    },
    {
      title: "İade Kodu",
      dataIndex: "returnNo",
      key: "returnNo",
      width: 110,
      sorter: (a, b) => (a.returnNo || "").localeCompare(b.returnNo || "", "tr"),
    },
    {
      title: "Fiş Kodu",
      dataIndex: "receiptNo",
      key: "receiptNo",
      width: 110,
      sorter: (a, b) => (a.receiptNo || "").localeCompare(b.receiptNo || "", "tr"),
    },
    {
      title: "Ürün Kodu",
      dataIndex: "productCode",
      key: "productCode",
      width: 120,
    },
    {
      title: "Ürün Adı",
      dataIndex: "productName",
      key: "productName",
      ellipsis: true,
    },
    {
      title: "İade Adet",
      dataIndex: "quantity",
      key: "quantity",
      width: 90,
      align: "right",
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: "İade Tutar",
      dataIndex: "lineTotal",
      key: "lineTotal",
      width: 120,
      align: "right",
      sorter: (a, b) => a.lineTotal - b.lineTotal,
      render: (v) => <Text strong>{formatMovementMoney(v)}</Text>,
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>

      {/* Başlık */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>İade Listesi</Title>
          <Text type="secondary">POS üzerinden gerçekleştirilen müşteri iadeleri.</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => void refresh()}>Yenile</Button>
      </div>

      {/* Toolbar */}
      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar">
          <div style={{ flex: 1 }} />
          <div className="erp-product-toolbar-search">
            <Input
              prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
              placeholder="İade kodu veya fiş kodu ara..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              allowClear
            />
            <Badge count={activeFilterCount} size="small">
              <Button icon={<FilterOutlined />} onClick={() => setFilterModalOpen(true)} />
            </Badge>
          </div>
        </div>
      </Card>

      {/* Tablo */}
      <Card
        title={`İade Listesi${activeFilterCount > 0 ? ` (${flatRows.length} / ${returns.reduce((s, r) => s + (r.lines || []).length, 0)})` : ` (${flatRows.length} satır)`}`}
        className="erp-list-table-card"
      >
        <Table
          loading={loading}
          columns={columns}
          dataSource={flatRows}
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (total, range) => `${range[0]}-${range[1]} / ${total}` }}
        />
      </Card>

      {/* Gelişmiş Filtreler Modal */}
      <Modal
        title="Gelişmiş Filtreler"
        open={filterModalOpen}
        onCancel={() => setFilterModalOpen(false)}
        footer={null}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={[12, 12]}>
            <Col span={24}>
              <Form.Item label="Ürün Kodu / Adı">
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Ürün kodu veya adı..."
                  value={filters.productSearch}
                  onChange={(e) => handleFilterChange("productSearch", e.target.value)}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Başlangıç Tarihi">
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD.MM.YYYY"
                  value={filters.dateFrom ? dayjs(filters.dateFrom) : null}
                  onChange={(d) => handleFilterChange("dateFrom", d ? d.format("YYYY-MM-DD") : null)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Bitiş Tarihi">
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD.MM.YYYY"
                  value={filters.dateTo ? dayjs(filters.dateTo) : null}
                  onChange={(d) => handleFilterChange("dateTo", d ? d.format("YYYY-MM-DD") : null)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" title="Filtreyi Kaydet">
            <Space.Compact style={{ width: "100%" }}>
              <Input
                value={savedFilterName}
                onChange={(e) => setSavedFilterName(e.target.value)}
                placeholder="Filtre adı"
                onPressEnter={handleSaveFilterPreset}
              />
              <Button type="primary" onClick={handleSaveFilterPreset}>Kaydet</Button>
            </Space.Compact>
          </Card>

          <Card size="small" title="Kayıtlı Filtreler">
            {savedFilters.length === 0 ? (
              <Text type="secondary">Henüz kayıtlı filtre yok.</Text>
            ) : (
              <Space direction="vertical" size={6} style={{ width: "100%" }}>
                {savedFilters.map((item) => (
                  <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Button style={{ flex: 1, textAlign: "left" }} onClick={() => applySavedFilter(item)}>
                      {item.name}
                    </Button>
                    <Popconfirm
                      title="Bu filtre silinsin mi?"
                      okText="Sil"
                      cancelText="Vazgeç"
                      onConfirm={() => persistSavedFilters(savedFilters.filter((f) => f.name !== item.name))}
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                ))}
              </Space>
            )}
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


