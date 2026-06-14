import React from "react";
import { Button, Card, Col, Grid, Row, Select, Space, Statistic, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { requestJson } from "../apiClient";

const { Title, Text } = Typography;

const ACTION_COLORS = {
  LOGIN:     "#52c41a",
  LOGOUT:    "#8c8c8c",
  PAGE_VIEW: "#1677ff",
  LIST:      "#13c2c2",
  GET:       "#40a9ff",
  CREATE:    "#73d13d",
  UPDATE:    "#fa8c16",
  DELETE:    "#ff4d4f",
};

const ACTION_LABELS = {
  LOGIN: "Giriş", LOGOUT: "Çıkış", PAGE_VIEW: "Sayfa",
  LIST: "Liste", GET: "Görüntüle", CREATE: "Oluştur",
  UPDATE: "Güncelle", DELETE: "Sil",
};

const PALETTE = ["#d86d5b","#1677ff","#52c41a","#fa8c16","#722ed1","#13c2c2","#eb2f96","#faad14","#2f54eb","#a0d911"];

function fmtMoney(v) {
  return new Intl.NumberFormat("tr-TR").format(Number(v || 0));
}

function buildDailyChart(daily, days) {
  // Boş günleri de dahil et
  const map = {};
  daily.forEach((r) => {
    if (!map[r.day]) map[r.day] = { day: r.day };
    map[r.day][r.action_type] = (map[r.day][r.action_type] || 0) + r.count;
  });

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}`;
    result.push({ day: label, ...(map[key] || {}) });
  }
  return result;
}

const DAY_OPTIONS = [
  { value: 7,  label: "Son 7 Gün" },
  { value: 14, label: "Son 14 Gün" },
  { value: 30, label: "Son 30 Gün" },
  { value: 90, label: "Son 90 Gün" },
];

const ROLE_OPTIONS = [
  { value: "Yonetici",  label: "Yönetici" },
  { value: "Muhasebe",  label: "Muhasebe" },
  { value: "Magaza",    label: "Mağaza" },
  { value: "Kasiyer",   label: "Kasiyer" },
  { value: "Tedarikci", label: "Tedarikçi" },
];

export default function ActivityReportPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [data, setData]       = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [days, setDays]       = React.useState(30);
  const [userRole, setUserRole] = React.useState(undefined);
  const [userId, setUserId]     = React.useState(undefined);

  const fetchData = React.useCallback(async (d, role, uid) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ days: String(d) });
      if (role) params.set("userRole", role);
      if (uid)  params.set("userId",   uid);
      const result = await requestJson("GET", `/api/audit-logs/analytics?${params.toString()}`);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void fetchData(days, userRole, userId); }, [fetchData, days, userRole, userId]);

  const userOptions = React.useMemo(
    () => (data?.allUsers || []).map((u) => ({ value: u.user_id, label: `${u.user_name} (${u.user_role || "-"})` })),
    [data?.allUsers],
  );

  const dailyChart    = data ? buildDailyChart(data.daily, days) : [];
  const actionChart   = (data?.actions || []).map((r) => ({
    name: ACTION_LABELS[r.action_type] || r.action_type,
    value: r.count,
    color: ACTION_COLORS[r.action_type] || "#8884d8",
  }));
  const userChart     = (data?.users     || []).map((r) => ({ name: r.user_name || "?", count: r.count, role: r.user_role }));
  const resourceChart = (data?.resources || []).slice(0, 8).map((r) => ({ name: r.resource || "?", count: r.count }));
  const hourChart     = Array.from({ length: 24 }, (_, i) => {
    const found = (data?.hourly || []).find((h) => h.hour === i);
    return { hour: `${String(i).padStart(2,"0")}:00`, count: found?.count || 0 };
  });

  const summary = data?.summary || {};

  const activeTypes = [...new Set((data?.daily || []).map((r) => r.action_type))];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div className="erp-page-intro">
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Aktivite Raporu</Title>
        </div>
        <Space wrap className="erp-page-intro-actions" style={isMobile ? { width: "100%" } : undefined}>
          <Select
            value={days}
            onChange={(v) => { setDays(v); setUserId(undefined); }}
            options={DAY_OPTIONS}
            style={{ width: isMobile ? "calc(50% - 4px)" : 140 }}
          />
          <Select
            placeholder="Kullanıcı Rolü"
            allowClear
            value={userRole}
            onChange={(v) => { setUserRole(v); setUserId(undefined); }}
            options={ROLE_OPTIONS}
            style={{ width: isMobile ? "calc(50% - 4px)" : 150 }}
          />
          <Select
            placeholder="Kullanıcı"
            allowClear
            value={userId}
            onChange={(v) => setUserId(v)}
            options={userOptions}
            style={{ width: isMobile ? "100%" : 220 }}
            showSearch
            optionFilterProp="label"
            disabled={!userOptions.length}
          />
          <Button
            onClick={() => { setUserRole(undefined); setUserId(undefined); }}
            disabled={!userRole && !userId}
          >
            Temizle
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => void fetchData(days, userRole, userId)} loading={loading}>Yenile</Button>
        </Space>
      </div>

      {/* Özet Kartlar */}
      <Row gutter={[16, 16]}>
        {[
          { title: "Toplam Olay",   value: fmtMoney(summary.total_events),   color: "#1677ff" },
          { title: "Tekil Kullanıcı", value: fmtMoney(summary.unique_users), color: "#52c41a" },
          { title: "Toplam Giriş",  value: fmtMoney(summary.total_logins),   color: "#d86d5b" },
          { title: "Değişiklik",    value: fmtMoney(summary.total_mutations), color: "#fa8c16" },
        ].map((card) => (
          <Col xs={12} md={6} key={card.title}>
            <Card bordered={false} loading={loading}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>{card.title}</Text>}
                value={card.value}
                valueStyle={{ color: card.color, fontSize: 26, fontWeight: 700 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Günlük Aktivite Trendi */}
      <Card title="Günlük Aktivite Trendi" bordered={false} className="erp-card-logo-divider" loading={loading}>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={dailyChart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              {activeTypes.map((type) => (
                <linearGradient key={type} id={`grad-${type}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={ACTION_COLORS[type] || "#8884d8"} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={ACTION_COLORS[type] || "#8884d8"} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={Math.floor(days / 7)} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend formatter={(v) => ACTION_LABELS[v] || v} />
            {activeTypes.map((type) => (
              <Area
                key={type}
                type="monotone"
                dataKey={type}
                stroke={ACTION_COLORS[type] || "#8884d8"}
                fill={`url(#grad-${type})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Row gutter={[16, 16]}>
        {/* Aksiyon Dağılımı */}
        <Col xs={24} lg={10}>
          <Card title="Aksiyon Dağılımı" bordered={false} className="erp-card-logo-divider" loading={loading}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={actionChart}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {actionChart.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [fmtMoney(v), n]} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Saatlik Yoğunluk */}
        <Col xs={24} lg={14}>
          <Card title="Saatlik Yoğunluk" bordered={false} className="erp-card-logo-divider" loading={loading}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourChart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="İşlem" radius={[4,4,0,0]}>
                  {hourChart.map((_, i) => (
                    <Cell key={i} fill={i >= 9 && i <= 18 ? "#d86d5b" : "#e8d5d1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* En Aktif Kullanıcılar */}
        <Col xs={24} lg={12}>
          <Card title="En Aktif Kullanıcılar" bordered={false} className="erp-card-logo-divider" loading={loading}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={userChart} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
                <Tooltip
                  formatter={(v, _, { payload }) => [fmtMoney(v), payload?.role || "İşlem"]}
                />
                <Bar dataKey="count" name="İşlem" radius={[0,4,4,0]}>
                  {userChart.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* En Çok Erişilen Kaynaklar */}
        <Col xs={24} lg={12}>
          <Card title="En Çok Erişilen Kaynaklar" bordered={false} className="erp-card-logo-divider" loading={loading}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={resourceChart} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                <Tooltip />
                <Bar dataKey="count" name="Erişim" radius={[0,4,4,0]}>
                  {resourceChart.map((_, i) => (
                    <Cell key={i} fill={PALETTE[(i + 4) % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Aksiyon Renk Açıklaması */}
      <Card bordered={false} size="small">
        <Space wrap size={8}>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <Tag key={k} color={ACTION_COLORS[k]}>{v}</Tag>
          ))}
        </Space>
      </Card>
    </Space>
  );
}
