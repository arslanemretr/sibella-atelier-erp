/* global process */
import { sqlExec, sqlMany } from "./db.js";

const RESOURCE_LABELS = {
  "products": "Ürünler",
  "suppliers": "Tedarikçiler",
  "pos-sessions": "POS Oturumları",
  "pos-sales": "POS Satışlar",
  "pos-returns": "POS İadeler",
  "stock-entries": "Stok Girişleri",
  "stock-movements": "Stok Hareketleri",
  "stock-locations": "Stok Yerleri",
  "stock-location-balances": "Stok Bakiyeleri",
  "delivery-lists": "Teslimat Listeleri",
  "earnings-records": "Hakediş Kayıtları",
  "stores": "Mağazalar",
  "store-shipments": "Mağaza Gönderileri",
  "purchases": "Satınalma",
  "contracts": "Sözleşmeler",
  "users": "Kullanıcılar",
  "roles": "Roller",
  "master-data": "Tanımlar",
  "settings": "Ayarlar",
  "dashboard": "Dashboard",
  "reports": "Raporlar",
};

const SUB_RESOURCE_SKIP = new Set(["lines", "close", "complete", "send", "page-view", "balances"]);

function getResourceFromUrl(url) {
  const match = url.match(/^\/api\/([^/?]+)/);
  if (!match) return null;
  const segment = match[1];
  return RESOURCE_LABELS[segment] || segment;
}

function getResourceId(url) {
  const match = url.match(/^\/api\/[^/]+\/([^/?]+)/);
  if (!match) return null;
  const id = match[1];
  if (SUB_RESOURCE_SKIP.has(id)) return null;
  return id;
}

function getActionType(method, url) {
  const hasId = /^\/api\/[^/]+\/[^/?]+/.test(url);
  switch (method.toUpperCase()) {
    case "GET": return hasId ? "GET" : "LIST";
    case "POST": return "CREATE";
    case "PUT": return "UPDATE";
    case "DELETE": return "DELETE";
    default: return method.toUpperCase();
  }
}

function getClientIp(req) {
  return (
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    ""
  );
}

function generateId() {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Fire-and-forget — hata olursa sessizce geçer
export function writeAuditLog(entry) {
  const {
    userId = null,
    userName = null,
    userRole = null,
    actionType,
    resource = null,
    resourceId = null,
    description = null,
    ipAddress = null,
    userAgent = null,
    statusCode = null,
  } = entry;

  const id = generateId();
  const createdAt = new Date().toISOString();

  sqlExec(
    `INSERT INTO audit_logs
       (id, user_id, user_name, user_role, action_type, resource, resource_id,
        description, ip_address, user_agent, status_code, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz)`,
    [id, userId, userName, userRole, actionType, resource, resourceId,
     description, ipAddress, userAgent, statusCode, createdAt],
  ).catch(() => {});
}

export async function ensureAuditLogTable() {
  await sqlExec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          TEXT PRIMARY KEY,
      user_id     TEXT,
      user_name   TEXT,
      user_role   TEXT,
      action_type TEXT NOT NULL,
      resource    TEXT,
      resource_id TEXT,
      description TEXT,
      ip_address  TEXT,
      user_agent  TEXT,
      status_code INT,
      created_at  TIMESTAMPTZ NOT NULL
    )
  `);
  await sqlExec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC)`);
  await sqlExec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs (user_id)`);
  await sqlExec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs (action_type)`);
}

export async function cleanupOldAuditLogs() {
  const pageViewCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const crudCutoff     = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  await sqlExec(
    `DELETE FROM audit_logs
     WHERE (action_type IN ('PAGE_VIEW','LIST','GET') AND created_at < $1::timestamptz)
        OR (action_type NOT IN ('PAGE_VIEW','LIST','GET') AND created_at < $2::timestamptz)`,
    [pageViewCutoff, crudCutoff],
  );
}

// Express middleware — tüm /api/* isteklerini loglar
const SKIP_EXACT   = new Set(["/api/health", "/api/auth/session"]);
const SKIP_PREFIXES = ["/api/audit-logs", "/api/assets"];

export function auditMiddleware(req, res, next) {
  if (!req.path.startsWith("/api/")) return next();
  if (SKIP_EXACT.has(req.path)) return next();
  if (SKIP_PREFIXES.some((p) => req.path.startsWith(p))) return next();

  const origEnd = res.end.bind(res);
  res.end = function (...args) {
    origEnd(...args);
    const user = req.authUser || null;
    writeAuditLog({
      userId:     user?.id   || null,
      userName:   user?.fullName || null,
      userRole:   user?.role || null,
      actionType: getActionType(req.method, req.path),
      resource:   getResourceFromUrl(req.path),
      resourceId: getResourceId(req.path),
      ipAddress:  getClientIp(req),
      userAgent:  req.headers["user-agent"] || null,
      statusCode: res.statusCode,
    });
  };
  next();
}

// POST /api/audit-logs/page-view — frontend sayfa ziyaretleri
export function handlePageViewLog(req, res) {
  const user = req.authUser || null;
  const { path: pagePath, title } = req.body || {};
  writeAuditLog({
    userId:     user?.id || null,
    userName:   user?.fullName || null,
    userRole:   user?.role || null,
    actionType: "PAGE_VIEW",
    resource:   pagePath || null,
    description: title || pagePath || null,
    ipAddress:  String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
    userAgent:  req.headers["user-agent"] || null,
    statusCode: 200,
  });
  return res.json({ ok: true });
}

// GET /api/audit-logs — Yönetici listesi
export async function handleAuditLogsList(req, res) {
  const { userId, actionType, resource, dateFrom, dateTo, page = "1", limit = "100" } = req.query;

  const conds  = [];
  const params = [];
  let   idx    = 1;

  if (userId)     { conds.push(`user_id = $${idx++}`);                     params.push(userId); }
  if (actionType) { conds.push(`action_type = $${idx++}`);                 params.push(actionType); }
  if (resource)   { conds.push(`resource = $${idx++}`);                    params.push(resource); }
  if (dateFrom)   { conds.push(`created_at >= $${idx++}::timestamptz`);    params.push(dateFrom); }
  if (dateTo)     { conds.push(`created_at <= $${idx++}::timestamptz`);    params.push(dateTo + "T23:59:59Z"); }

  const where    = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const pageNum  = Math.max(1, Number(page));
  const pageSize = Math.min(500, Math.max(1, Number(limit)));
  const offset   = (pageNum - 1) * pageSize;

  const dataParams  = [...params, pageSize, offset];
  const countParams = [...params];

  const [rows, countRows] = await Promise.all([
    sqlMany(
      `SELECT id, user_id, user_name, user_role, action_type, resource, resource_id,
              description, ip_address, user_agent, status_code, created_at
       FROM audit_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      dataParams,
    ),
    sqlMany(`SELECT COUNT(*)::int AS total FROM audit_logs ${where}`, countParams),
  ]);

  return res.json({ ok: true, items: rows, total: countRows[0]?.total || 0, page: pageNum, limit: pageSize });
}

// GET /api/audit-logs/analytics — Grafik verisi (Yönetici)
export async function handleAuditLogAnalytics(req, res) {
  const days     = Math.min(90, Math.max(7, Number(req.query.days || 30)));
  const userId   = req.query.userId   || null;
  const userRole = req.query.userRole || null;

  // Dinamik WHERE koşulları
  const extraConds = [];
  const extraParams = [];
  let   pIdx = 2; // $1 = days

  if (userId) {
    extraConds.push(`user_id = $${pIdx++}`);
    extraParams.push(userId);
  }
  if (userRole) {
    extraConds.push(`user_role = $${pIdx++}`);
    extraParams.push(userRole);
  }

  const extraWhere = extraConds.length ? ` AND ${extraConds.join(" AND ")}` : "";
  const baseParams = [String(days), ...extraParams];

  // Kullanıcı listesi (filtre seçenekleri için) — tüm dönem, filtresiz
  const allUsersPromise = sqlMany(
    `SELECT DISTINCT user_id, user_name, user_role
     FROM audit_logs
     WHERE created_at > NOW() - ($1 || ' days')::interval
       AND user_name IS NOT NULL
     ORDER BY user_name`,
    [String(days)],
  );

  const [dailyRows, actionRows, userRows, resourceRows, hourRows, summaryRows, allUsers] = await Promise.all([
    sqlMany(
      `SELECT TO_CHAR(created_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS day,
              action_type, COUNT(*)::int AS count
       FROM audit_logs
       WHERE created_at > NOW() - ($1 || ' days')::interval${extraWhere}
       GROUP BY day, action_type
       ORDER BY day`,
      baseParams,
    ),
    sqlMany(
      `SELECT action_type, COUNT(*)::int AS count
       FROM audit_logs
       WHERE created_at > NOW() - ($1 || ' days')::interval${extraWhere}
       GROUP BY action_type
       ORDER BY count DESC`,
      baseParams,
    ),
    sqlMany(
      `SELECT user_name, user_role, COUNT(*)::int AS count
       FROM audit_logs
       WHERE created_at > NOW() - ($1 || ' days')::interval${extraWhere}
         AND user_name IS NOT NULL
       GROUP BY user_name, user_role
       ORDER BY count DESC
       LIMIT 10`,
      baseParams,
    ),
    sqlMany(
      `SELECT resource, COUNT(*)::int AS count
       FROM audit_logs
       WHERE created_at > NOW() - ($1 || ' days')::interval${extraWhere}
         AND resource IS NOT NULL
       GROUP BY resource
       ORDER BY count DESC
       LIMIT 10`,
      baseParams,
    ),
    sqlMany(
      `SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Istanbul')::int AS hour,
              COUNT(*)::int AS count
       FROM audit_logs
       WHERE created_at > NOW() - ($1 || ' days')::interval${extraWhere}
       GROUP BY hour
       ORDER BY hour`,
      baseParams,
    ),
    sqlMany(
      `SELECT
         COUNT(*)::int AS total_events,
         COUNT(DISTINCT user_id)::int AS unique_users,
         COUNT(*) FILTER (WHERE action_type = 'LOGIN')::int AS total_logins,
         COUNT(*) FILTER (WHERE action_type IN ('CREATE','UPDATE','DELETE'))::int AS total_mutations
       FROM audit_logs
       WHERE created_at > NOW() - ($1 || ' days')::interval${extraWhere}`,
      baseParams,
    ),
    allUsersPromise,
  ]);

  return res.json({
    ok: true,
    days,
    userId,
    userRole,
    summary:   summaryRows[0] || {},
    daily:     dailyRows,
    actions:   actionRows,
    users:     userRows,
    resources: resourceRows,
    hourly:    hourRows,
    allUsers,
  });
}
