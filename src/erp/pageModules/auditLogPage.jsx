import React from "react";
import { Button, Card, DatePicker, Select, Space, Table, Tag, Typography } from "antd";
import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { requestJson } from "../apiClient";

const { Title, Text } = Typography;

const ACTION_META = {
  LOGIN:     { color: "green",   label: "Giriş" },
  LOGOUT:    { color: "default", label: "Çıkış" },
  PAGE_VIEW: { color: "blue",    label: "Sayfa" },
  LIST:      { color: "cyan",    label: "Liste" },
  GET:       { color: "cyan",    label: "Görüntüle" },
  CREATE:    { color: "green",   label: "Oluştur" },
  UPDATE:    { color: "orange",  label: "Güncelle" },
  DELETE:    { color: "red",     label: "Sil" },
};

const ACTION_OPTIONS = Object.entries(ACTION_META).map(([value, { label }]) => ({ value, label }));

function formatUserAgent(ua) {
  if (!ua) return "-";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "📱 iOS";
  if (ua.includes("Android")) return "📱 Android";
  if (ua.includes("Chrome")) return "🌐 Chrome";
  if (ua.includes("Firefox")) return "🌐 Firefox";
  if (ua.includes("Safari")) return "🌐 Safari";
  if (ua.includes("Edge")) return "🌐 Edge";
  return ua.slice(0, 30);
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(new Date(value));
}

export default function AuditLogPage() {
  const [records, setRecords]     = React.useState([]);
  const [total, setTotal]         = React.useState(0);
  const [loading, setLoading]     = React.useState(false);
  const [userOptions, setUserOptions] = React.useState([]);
  const [resourceOptions, setResourceOptions] = React.useState([]);

  const [filters, setFilters] = React.useState({
    userId: undefined,
    actionType: undefined,
    resource: undefined,
    dateFrom: null,
    dateTo: null,
  });
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 100;

  const fetchLogs = React.useCallback(async (currentFilters, currentPage) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", String(PAGE_SIZE));
      if (currentFilters.userId)     params.set("userId",     currentFilters.userId);
      if (currentFilters.actionType) params.set("actionType", currentFilters.actionType);
      if (currentFilters.resource)   params.set("resource",   currentFilters.resource);
      if (currentFilters.dateFrom)   params.set("dateFrom",   currentFilters.dateFrom);
      if (currentFilters.dateTo)     params.set("dateTo",     currentFilters.dateTo);

      const data = await requestJson("GET", `/api/audit-logs?${params.toString()}`);
      setRecords(data?.items || []);
      setTotal(data?.total || 0);

      // Dinamik filtre seçenekleri — ilk yüklemede doldur
      if (currentPage === 1 && !currentFilters.userId && !currentFilters.actionType) {
        const uniqueUsers = [];
        const seenUsers   = new Set();
        const uniqueRes   = new Set();
        (data?.items || []).forEach((r) => {
          if (r.user_id && !seenUsers.has(r.user_id)) {
            seenUsers.add(r.user_id);
            uniqueUsers.push({ value: r.user_id, label: r.user_name || r.user_id });
          }
          if (r.resource) uniqueRes.add(r.resource);
        });
        if (uniqueUsers.length) setUserOptions(uniqueUsers);
        if (uniqueRes.size)     setResourceOptions([...uniqueRes].sort().map((v) => ({ value: v, label: v })));
      }
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchLogs(filters, page);
  }, [fetchLogs, filters, page]);

  const handleFilterChange = (key, value) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setPage(1);
    setFilters({ userId: undefined, actionType: undefined, resource: undefined, dateFrom: null, dateTo: null });
  };

  const handleExport = () => {
    const header = ["Tarih/Saat", "Kullanıcı", "Rol", "Aksiyon", "Kaynak", "Kaynak ID", "Açıklama", "IP", "Tarayıcı", "Status"];
    const rows = records.map((r) => [
      formatDate(r.created_at),
      r.user_name || "-",
      r.user_role || "-",
      ACTION_META[r.action_type]?.label || r.action_type,
      r.resource || "-",
      r.resource_id || "-",
      r.description || "-",
      r.ip_address || "-",
      formatUserAgent(r.user_agent),
      r.status_code || "-",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AktiviteGunlugu");
    XLSX.writeFile(wb, `aktivite-gunlugu-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const columns = [
    {
      title: "Tarih/Saat",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (v) => <Text style={{ fontSize: 12 }}>{formatDate(v)}</Text>,
    },
    {
      title: "Kullanıcı",
      dataIndex: "user_name",
      key: "user_name",
      width: 150,
      render: (v, r) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{v || "-"}</Text>
          {r.user_role ? <div><Tag color="default" style={{ fontSize: 10 }}>{r.user_role}</Tag></div> : null}
        </div>
      ),
    },
    {
      title: "Aksiyon",
      dataIndex: "action_type",
      key: "action_type",
      width: 110,
      render: (v) => {
        const meta = ACTION_META[v] || { color: "default", label: v };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "Kaynak",
      dataIndex: "resource",
      key: "resource",
      width: 160,
      render: (v) => v || "-",
    },
    {
      title: "Açıklama / ID",
      key: "desc",
      width: 200,
      render: (_, r) => (
        <div>
          {r.description ? <Text style={{ fontSize: 12 }}>{r.description}</Text> : null}
          {r.resource_id ? <Text type="secondary" style={{ fontSize: 11, display: "block" }}>{r.resource_id}</Text> : null}
          {!r.description && !r.resource_id ? <Text type="secondary">-</Text> : null}
        </div>
      ),
    },
    {
      title: "IP",
      dataIndex: "ip_address",
      key: "ip_address",
      width: 130,
      render: (v) => <Text style={{ fontSize: 12 }}>{v || "-"}</Text>,
    },
    {
      title: "Tarayıcı",
      dataIndex: "user_agent",
      key: "user_agent",
      width: 110,
      render: (v) => <Text style={{ fontSize: 12 }}>{formatUserAgent(v)}</Text>,
    },
    {
      title: "Status",
      dataIndex: "status_code",
      key: "status_code",
      width: 80,
      align: "center",
      render: (v) => {
        if (!v) return "-";
        const color = v < 300 ? "green" : v < 400 ? "blue" : v < 500 ? "orange" : "red";
        return <Tag color={color}>{v}</Tag>;
      },
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div className="erp-page-intro">
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Aktivite Günlüğü</Title>
        </div>
        <Space wrap className="erp-page-intro-actions">
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          <Button icon={<ReloadOutlined />} onClick={() => void fetchLogs(filters, page)}>Yenile</Button>
        </Space>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <Space wrap size={12}>
          <Select
            placeholder="Kullanıcı"
            allowClear
            style={{ width: 180 }}
            options={userOptions}
            value={filters.userId}
            onChange={(v) => handleFilterChange("userId", v)}
            showSearch
            optionFilterProp="label"
          />
          <Select
            placeholder="Aksiyon Tipi"
            allowClear
            style={{ width: 150 }}
            options={ACTION_OPTIONS}
            value={filters.actionType}
            onChange={(v) => handleFilterChange("actionType", v)}
          />
          <Select
            placeholder="Kaynak"
            allowClear
            style={{ width: 180 }}
            options={resourceOptions}
            value={filters.resource}
            onChange={(v) => handleFilterChange("resource", v)}
            showSearch
            optionFilterProp="label"
          />
          <DatePicker
            placeholder="Başlangıç"
            format="DD.MM.YYYY"
            value={filters.dateFrom ? dayjs(filters.dateFrom) : null}
            onChange={(d) => handleFilterChange("dateFrom", d ? d.format("YYYY-MM-DD") : null)}
          />
          <DatePicker
            placeholder="Bitiş"
            format="DD.MM.YYYY"
            value={filters.dateTo ? dayjs(filters.dateTo) : null}
            onChange={(d) => handleFilterChange("dateTo", d ? d.format("YYYY-MM-DD") : null)}
          />
          <Button onClick={handleReset}>Temizle</Button>
        </Space>
      </Card>

      <Card bordered={false} className="erp-list-table-card erp-card-logo-divider">
        <Table
          size="small"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={records}
          scroll={{ x: "max-content" }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            showTotal: (t, r) => `${r[0]}–${r[1]} / ${t}`,
            onChange: (p) => setPage(p),
          }}
          locale={{ emptyText: "Kayıt bulunamadı." }}
        />
      </Card>
    </Space>
  );
}
