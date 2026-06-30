import crypto from "node:crypto";
import { sqlExec, sqlMany, sqlOne } from "./db.js";
import { writeAuditLog } from "./auditLog.js";
import { isSmtpConfigured, sendPasswordResetEmail } from "./mailer.js";
import { sendSupplierLoginNotification } from "./notificationMailer.js";
import { hashPassword, isPasswordHash, verifyPassword } from "./passwords.js";

export const AUTH_COOKIE_NAME = "sibella_erp_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const FAILED_LOGIN_WINDOW_MS = 1000 * 60 * 15;
const FAILED_LOGIN_LIMIT = 5;
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 10;
const VALID_ROLES = new Set(["Yonetici", "Magaza", "Muhasebe", "Tedarikci"]);
const VALID_STATUSES = new Set(["Aktif", "Pasif"]);

const SCREEN_KEYS = [
  "dashboard", "ai_assistant", "products_list", "pos_sessions", "pos_store", "pos_orders", "pos_returns",
  "purchasing_suppliers", "purchasing_contracts", "stores_list", "stores_shipments", "stores_invoices",
  "stock_entry", "stock_list", "stock_locations", "reports_sales", "reports_stock", "reports_consolidated", "reports_supplier",
  "settings_users", "settings_categories", "settings_collections", "settings_pos_categories",
  "settings_barcode", "settings_procurement", "settings_payment_terms", "settings_parameters", "settings_mail", "settings_branding", "settings_audit_log", "settings_ai", "settings_ai_console", "settings_ai_entry_console",
  "supplier_portal_dashboard", "supplier_portal_products", "supplier_portal_deliveries", "supplier_portal_earnings",
];

function buildAllPermissions(allTrue = false) {
  return Object.fromEntries(SCREEN_KEYS.map((key) => [key, { view: allTrue, write: allTrue }]));
}

function mapRoleRow(row) {
  if (!row) return null;
  let permissions = {};
  try {
    permissions = typeof row.permissions === "object" && row.permissions !== null
      ? row.permissions
      : JSON.parse(row.permissions || "{}");
  } catch { permissions = {}; }
  return {
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    permissions,
    isSystem: Boolean(row.is_system),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${value}`];
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }
  parts.push(`Path=${options.path || "/"}`);
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }
  if (options.secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function getCookieValue(req, name) {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }
  const parts = header.split(";").map((item) => item.trim());
  const target = parts.find((item) => item.startsWith(`${name}=`));
  if (!target) {
    return null;
  }
  return decodeURIComponent(target.slice(name.length + 1));
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || null;
}

function mapUserRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    fullName: row.full_name || "",
    email: row.email || "",
    password: row.password || "",
    role: row.role || "Magaza",
    supplierId: row.supplier_id || null,
    status: row.status || "Aktif",
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    fullName: user.fullName || "",
    email: user.email || "",
    role: user.role || "",
    supplierId: user.supplierId || null,
    status: user.status || "",
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
  };
}

function validateRole(role) {
  if (!role || typeof role !== "string" || !role.trim()) {
    throw new Error("Gecersiz kullanici rolu.");
  }
}

function validateStatus(status) {
  if (!VALID_STATUSES.has(status)) {
    throw new Error("Gecersiz kullanici durumu.");
  }
}

function validateSupplierBinding(role, supplierId) {
  if (role === "Tedarikci" && !supplierId) {
    throw new Error("Tedarikci rolunde supplierId zorunludur.");
  }
}

async function listUserRows() {
  return (await sqlMany("SELECT * FROM users ORDER BY created_at DESC, email ASC")).map(mapUserRow);
}

async function findUserByEmail(email) {
  return mapUserRow(await sqlOne("SELECT * FROM users WHERE email = $1", [normalizeEmail(email)]));
}

async function findUserById(userId) {
  return mapUserRow(await sqlOne("SELECT * FROM users WHERE id = $1", [userId]));
}

async function insertUserRow(user) {
  await sqlExec(`
    INSERT INTO users (id, full_name, email, password, role, supplier_id, status, last_login_at, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz, $10::timestamptz)
  `, [
    user.id,
    user.fullName,
    normalizeEmail(user.email),
    user.password,
    user.role,
    user.supplierId || null,
    user.status,
    user.lastLoginAt || null,
    user.createdAt || nowIso(),
    user.updatedAt || nowIso(),
  ]);
}

async function updateUserRow(userId, values) {
  const existingUser = await findUserById(userId);
  if (!existingUser) {
    return null;
  }

  const nextRole = values.role ?? existingUser.role;
  const nextStatus = values.status ?? existingUser.status;
  const nextSupplierId =
    typeof values.supplierId !== "undefined"
      ? (values.supplierId || null)
      : existingUser.supplierId;

  validateRole(nextRole);
  validateStatus(nextStatus);
  validateSupplierBinding(nextRole, nextSupplierId);

  const nextUpdatedAt = values.updatedAt || nowIso();
  await sqlExec(`
    UPDATE users
    SET
      full_name = $2,
      email = $3,
      password = $4,
      role = $5,
      supplier_id = $6,
      status = $7,
      last_login_at = $8::timestamptz,
      updated_at = $9::timestamptz
    WHERE id = $1
  `, [
    userId,
    values.fullName ?? existingUser.fullName,
    normalizeEmail(values.email ?? existingUser.email),
    values.password ?? existingUser.password,
    nextRole,
    nextSupplierId,
    nextStatus,
    values.lastLoginAt ?? existingUser.lastLoginAt,
    nextUpdatedAt,
  ]);

  return findUserById(userId);
}

async function createUserRow(values) {
  const email = normalizeEmail(values.email);
  const role = values.role || "Magaza";
  const status = values.status || "Aktif";
  const supplierId = values.role === "Tedarikci" ? values.supplierId || null : null;

  if (!values.fullName || !email || !values.password) {
    throw new Error("Ad soyad, e-posta ve sifre zorunludur.");
  }

  validateRole(role);
  validateStatus(status);
  validateSupplierBinding(role, supplierId);

  const duplicate = await findUserByEmail(email);
  if (duplicate) {
    const error = new Error("Bu e-posta adresi zaten kullaniliyor.");
    error.code = "EMAIL_ALREADY_EXISTS";
    throw error;
  }

  const createdAt = nowIso();
  const user = {
    id: createId("usr"),
    fullName: values.fullName,
    email,
    password: isPasswordHash(values.password) ? values.password : hashPassword(values.password),
    role,
    supplierId,
    status,
    lastLoginAt: null,
    createdAt,
    updatedAt: createdAt,
  };

  await insertUserRow(user);
  return findUserById(user.id);
}

async function deleteUserRow(userId) {
  await sqlExec("DELETE FROM auth_sessions WHERE user_id = $1", [userId]);
  await sqlExec("DELETE FROM password_reset_tokens WHERE user_id = $1", [userId]);
  await sqlExec("DELETE FROM users WHERE id = $1", [userId]);
}

async function countRecentFailedAttempts(email, ipAddress) {
  const cutoff = new Date(Date.now() - FAILED_LOGIN_WINDOW_MS).toISOString();
  const row = await sqlOne(`
    SELECT COUNT(*)::int AS attempt_count
    FROM login_attempts
    WHERE email = $1
      AND COALESCE(ip_address, '') = COALESCE($2, '')
      AND success = FALSE
      AND attempted_at >= $3::timestamptz
  `, [normalizeEmail(email), ipAddress, cutoff]);
  return Number(row?.attempt_count || 0);
}

async function recordLoginAttempt({ email, success, failureReason = null, userId = null, ipAddress = null }) {
  await sqlExec(`
    INSERT INTO login_attempts (id, email, ip_address, attempted_at, success, failure_reason, user_id)
    VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7)
  `, [createId("login"), normalizeEmail(email), ipAddress, nowIso(), Boolean(success), failureReason, userId]);
}

async function clearExpiredPasswordResetTokens() {
  await sqlExec(`
    DELETE FROM password_reset_tokens
    WHERE expires_at < $1::timestamptz
       OR used_at IS NOT NULL
  `, [nowIso()]);
}

async function createSessionForUser(user, req, res) {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha256(rawToken);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await sqlExec(`
    INSERT INTO auth_sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, user_agent, ip_address)
    VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6::timestamptz, $7, $8)
  `, [
    createId("sess"),
    user.id,
    tokenHash,
    createdAt,
    expiresAt,
    createdAt,
    req.headers["user-agent"] || "",
    getClientIp(req),
  ]);

  res.setHeader("Set-Cookie", serializeCookie(AUTH_COOKIE_NAME, encodeURIComponent(rawToken), {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    secure: process.env.NODE_ENV === "production",
  }));
}

async function deleteSessionByToken(rawToken) {
  if (!rawToken) {
    return;
  }
  await sqlExec("DELETE FROM auth_sessions WHERE token_hash = $1", [sha256(rawToken)]);
}

export async function migrateLegacyPasswords() {
  const users = await listUserRows();
  for (const user of users) {
    if (!user?.password || isPasswordHash(user.password)) {
      continue;
    }
    await updateUserRow(user.id, {
      password: hashPassword(user.password),
      updatedAt: nowIso(),
    });
  }
}

export async function getAuthenticatedUser(req) {
  const rawToken = getCookieValue(req, AUTH_COOKIE_NAME);
  if (!rawToken) {
    return null;
  }

  const session = await sqlOne(`
    SELECT *
    FROM auth_sessions
    WHERE token_hash = $1
  `, [sha256(rawToken)]);

  if (!session) {
    return null;
  }

  const user = await findUserById(session.user_id);
  if (!user || user.status !== "Aktif" || session.expires_at <= nowIso()) {
    await deleteSessionByToken(rawToken);
    return null;
  }

  await sqlExec(`
    UPDATE auth_sessions
    SET last_seen_at = $1::timestamptz
    WHERE id = $2
  `, [nowIso(), session.id]);

  return sanitizeUser(user);
}

export function requireAuth(req, res, next) {
  void (async () => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.setHeader("Set-Cookie", serializeCookie(AUTH_COOKIE_NAME, "", {
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
        maxAge: 0,
        secure: process.env.NODE_ENV === "production",
      }));
      return res.status(401).json({
        ok: false,
        code: "AUTH_REQUIRED",
        message: "Oturum bulunamadi veya suresi doldu.",
      });
    }
    req.authUser = user;
    return next();
  })().catch(next);
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    void (async () => {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        res.setHeader("Set-Cookie", serializeCookie(AUTH_COOKIE_NAME, "", {
          httpOnly: true,
          sameSite: "Lax",
          path: "/",
          maxAge: 0,
          secure: process.env.NODE_ENV === "production",
        }));
        return res.status(401).json({
          ok: false,
          code: "AUTH_REQUIRED",
          message: "Oturum bulunamadi veya suresi doldu.",
        });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          ok: false,
          code: "FORBIDDEN",
          message: "Bu kaynaga erisim yetkiniz bulunmuyor.",
        });
      }

      req.authUser = user;
      return next();
    })().catch(next);
  };
}

export async function handleLogin(req, res) {
  const email = normalizeEmail(req.body?.email || "");
  const password = String(req.body?.password || "");
  const ipAddress = getClientIp(req);

  if (!email || !password) {
    return res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "E-posta ve sifre zorunludur.",
    });
  }

  if ((await countRecentFailedAttempts(email, ipAddress)) >= FAILED_LOGIN_LIMIT) {
    return res.status(429).json({
      ok: false,
      code: "TOO_MANY_ATTEMPTS",
      message: "Hesap gecici olarak kilitlendi. Lutfen 15 dakika sonra tekrar deneyin.",
    });
  }

  let user = await findUserByEmail(email);
  if (!user) {
    await recordLoginAttempt({ email, success: false, failureReason: "USER_NOT_FOUND", ipAddress });
    return res.status(401).json({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "E-posta veya sifre hatali.",
    });
  }

  if (user.status !== "Aktif") {
    await recordLoginAttempt({ email, success: false, failureReason: "USER_PASSIVE", userId: user.id, ipAddress });
    return res.status(403).json({
      ok: false,
      code: "USER_PASSIVE",
      message: "Bu hesap pasif durumda. Lutfen yoneticiniz ile iletisime gecin.",
    });
  }

  const passwordMatches = verifyPassword(password, user.password);
  if (!passwordMatches) {
    await recordLoginAttempt({ email, success: false, failureReason: "INVALID_PASSWORD", userId: user.id, ipAddress });
    return res.status(401).json({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "E-posta veya sifre hatali.",
    });
  }

  if (!isPasswordHash(user.password)) {
    user = await updateUserRow(user.id, {
      password: hashPassword(user.password),
      updatedAt: nowIso(),
    });
  }

  await createSessionForUser(user, req, res);
  const loginAt = nowIso();
  user = await updateUserRow(user.id, {
    lastLoginAt: loginAt,
    updatedAt: loginAt,
  });

  await recordLoginAttempt({ email, success: true, userId: user.id, ipAddress });

  if (user.role === "Tedarikci") {
    void sendSupplierLoginNotification({
      supplierName: user.fullName || user.email,
      supplierEmail: user.email,
      ipAddress,
    });
  }

  writeAuditLog({
    userId: user.id,
    userName: user.fullName || user.email,
    userRole: user.role,
    actionType: "LOGIN",
    resource: "Auth",
    description: `Giriş yapıldı: ${user.email}`,
    ipAddress,
    userAgent: req.headers["user-agent"] || null,
    statusCode: 200,
  });

  return res.json({
    ok: true,
    user: {
      ...sanitizeUser(user),
      loggedInAt: loginAt,
    },
  });
}

export async function handleSession(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.setHeader("Set-Cookie", serializeCookie(AUTH_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 0,
      secure: process.env.NODE_ENV === "production",
    }));
    return res.status(401).json({
      ok: false,
      code: "NO_SESSION",
      message: "Aktif oturum bulunamadi.",
    });
  }

  // Rolün yetkilerini DB'den çek ve oturum yanıtına ekle
  let permissions = {};
  try {
    const roleRow = await sqlOne("SELECT permissions FROM roles WHERE name = $1", [user.role]);
    if (roleRow?.permissions) {
      permissions = typeof roleRow.permissions === "object"
        ? roleRow.permissions
        : JSON.parse(roleRow.permissions || "{}");
    }
  } catch { permissions = {}; }

  return res.json({ ok: true, user: { ...user, permissions } });
}

export async function handleLogout(req, res) {
  const rawToken = getCookieValue(req, AUTH_COOKIE_NAME);
  const logoutUser = await getAuthenticatedUser(req);
  if (logoutUser) {
    writeAuditLog({
      userId: logoutUser.id,
      userName: logoutUser.fullName || logoutUser.email,
      userRole: logoutUser.role,
      actionType: "LOGOUT",
      resource: "Auth",
      description: `Çıkış yapıldı: ${logoutUser.email}`,
      ipAddress: String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
      userAgent: req.headers["user-agent"] || null,
      statusCode: 200,
    });
  }
  await deleteSessionByToken(rawToken);
  res.setHeader("Set-Cookie", serializeCookie(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  }));
  return res.json({ ok: true });
}

export async function handleForgotPasswordRequest(req, res) {
  const email = normalizeEmail(req.body?.email || "");
  const ipAddress = getClientIp(req);

  if (!email) {
    return res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "E-posta zorunludur.",
    });
  }

  await clearExpiredPasswordResetTokens();
  const user = await findUserByEmail(email);

  if (!user || user.status !== "Aktif") {
    return res.json({
      ok: true,
      message: "Hesap bulunduysa sifre yenileme kodu olusturuldu.",
    });
  }

  await sqlExec("DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL", [user.id]);

  const resetCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  const tokenHash = sha256(resetCode);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();

  await sqlExec(`
    INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at, used_at, requested_ip)
    VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, NULL, $6)
  `, [createId("reset"), user.id, tokenHash, createdAt, expiresAt, ipAddress]);

  const smtpEnabled = await isSmtpConfigured();
  if (!smtpEnabled) {
    return res.json({
      ok: true,
      message: "SMTP ayari olmadigi icin kod ekranda gosterildi.",
      delivery: "onscreen",
      resetCode,
      expiresAt,
    });
  }

  try {
    const result = await sendPasswordResetEmail({
      toEmail: user.email,
      role: user.role,
      resetCode,
      expiresAt,
    });

    if (!result?.sent) {
      return res.status(500).json({
        ok: false,
        code: "EMAIL_REJECTED",
        message: "Sifre yenileme e-postasi kabul edilmedi. SMTP ayarlarinizi kontrol edin.",
      });
    }

    return res.json({
      ok: true,
      message: "Sifre yenileme kodu e-posta adresinize gonderildi.",
      delivery: "email",
      expiresAt,
    });
  } catch {
    return res.status(500).json({
      ok: false,
      code: "EMAIL_SEND_FAILED",
      message: "Sifre yenileme e-postasi gonderilemedi. SMTP ayarlarinizi kontrol edin.",
    });
  }
}

export async function handleForgotPasswordConfirm(req, res) {
  const email = normalizeEmail(req.body?.email || "");
  const resetCode = String(req.body?.resetCode || "").trim().toUpperCase();
  const nextPassword = String(req.body?.nextPassword || "");

  if (!email || !resetCode || !nextPassword) {
    return res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "E-posta, kod ve yeni sifre zorunludur.",
    });
  }

  if (nextPassword.length < 8) {
    return res.status(400).json({
      ok: false,
      code: "WEAK_PASSWORD",
      message: "Yeni sifre en az 8 karakter olmali.",
    });
  }

  await clearExpiredPasswordResetTokens();
  const user = await findUserByEmail(email);
  if (!user || user.status !== "Aktif") {
    return res.status(400).json({
      ok: false,
      code: "INVALID_RESET_REQUEST",
      message: "Sifre yenileme istegi dogrulanamadi.",
    });
  }

  const resetRecord = await sqlOne(`
    SELECT *
    FROM password_reset_tokens
    WHERE user_id = $1
      AND token_hash = $2
      AND used_at IS NULL
      AND expires_at >= $3::timestamptz
  `, [user.id, sha256(resetCode), nowIso()]);

  if (!resetRecord) {
    return res.status(400).json({
      ok: false,
      code: "INVALID_RESET_CODE",
      message: "Sifre yenileme kodu gecersiz veya suresi dolmus.",
    });
  }

  const updatedAt = nowIso();
  await updateUserRow(user.id, {
    password: hashPassword(nextPassword),
    updatedAt,
  });

  await sqlExec(`
    UPDATE password_reset_tokens
    SET used_at = $1::timestamptz
    WHERE id = $2
  `, [updatedAt, resetRecord.id]);

  await sqlExec("DELETE FROM auth_sessions WHERE user_id = $1", [user.id]);

  return res.json({
    ok: true,
    message: "Sifreniz basariyla yenilendi. Yeni sifreniz ile giris yapabilirsiniz.",
  });
}

export async function handleUsersList(_req, res) {
  const users = await listUserRows();
  return res.json({
    ok: true,
    items: users.map(sanitizeUser),
  });
}

// Sistemde su an aktif (oturumu canli ve son N dakikada gorulmus) kullanicilar.
export async function handleOnlineUsers(req, res) {
  const windowMinutes = Math.min(60, Math.max(1, Number(req.query?.windowMinutes || 5)));
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const rows = await sqlMany(`
    SELECT u.id, u.full_name, u.email, u.role, MAX(s.last_seen_at) AS last_seen_at
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.expires_at > $1::timestamptz
      AND s.last_seen_at >= $2::timestamptz
      AND u.status = 'Aktif'
    GROUP BY u.id, u.full_name, u.email, u.role
    ORDER BY MAX(s.last_seen_at) DESC
  `, [nowIso(), cutoff]);

  return res.json({
    ok: true,
    windowMinutes,
    items: rows.map((row) => ({
      id: row.id,
      fullName: row.full_name || "",
      email: row.email || "",
      role: row.role || "",
      lastSeenAt: row.last_seen_at || null,
    })),
  });
}

export async function handleUsersCreate(req, res) {
  try {
    const user = await createUserRow(req.body || {});
    return res.status(201).json({
      ok: true,
      item: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(error?.code === "EMAIL_ALREADY_EXISTS" ? 409 : 400).json({
      ok: false,
      code: error?.code || "VALIDATION_ERROR",
      message: error?.message || "Kullanici olusturulamadi.",
    });
  }
}

export async function handleUsersUpdate(req, res) {
  const userId = req.params.id;
  const existingUser = await findUserById(userId);
  if (!existingUser) {
    return res.status(404).json({
      ok: false,
      code: "USER_NOT_FOUND",
      message: "Kullanici bulunamadi.",
    });
  }

  const nextEmail = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : existingUser.email;
  const duplicate = await findUserByEmail(nextEmail);
  if (duplicate && duplicate.id !== userId) {
    return res.status(409).json({
      ok: false,
      code: "EMAIL_ALREADY_EXISTS",
      message: "Bu e-posta adresi zaten kullaniliyor.",
    });
  }

  const nextPassword = req.body?.password
    ? (isPasswordHash(req.body.password) ? req.body.password : hashPassword(req.body.password))
    : existingUser.password;

  try {
    const user = await updateUserRow(userId, {
      fullName: req.body?.fullName,
      email: nextEmail,
      password: nextPassword,
      role: req.body?.role,
      supplierId: typeof req.body?.supplierId !== "undefined" ? req.body.supplierId : existingUser.supplierId,
      status: req.body?.status,
      updatedAt: nowIso(),
    });

    return res.json({
      ok: true,
      item: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: error?.message || "Kullanici guncellenemedi.",
    });
  }
}

export async function handleUsersDelete(req, res) {
  const userId = req.params.id;
  const existingUser = await findUserById(userId);
  if (!existingUser) {
    return res.status(404).json({
      ok: false,
      code: "USER_NOT_FOUND",
      message: "Kullanici bulunamadi.",
    });
  }

  await deleteUserRow(userId);
  return res.json({ ok: true });
}

// ─── Rol Yönetimi ────────────────────────────────────────────────────────────

export async function ensureRolesTable() {
  await sqlExec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      permissions JSONB,
      is_system BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    )
  `);

  const defaultRoles = [
    {
      id: "role-yonetici",
      name: "Yonetici",
      description: "Tüm ekranlar ve işlemler",
      permissions: buildAllPermissions(true),
      isSystem: true,
    },
    {
      id: "role-tedarikci",
      name: "Tedarikci",
      description: "Tedarikçi portalı",
      permissions: {},
      isSystem: true,
    },
  ];

  for (const role of defaultRoles) {
    await sqlExec(`
      INSERT INTO roles (id, name, description, permissions, is_system, created_at, updated_at)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6::timestamptz, $6::timestamptz)
      ON CONFLICT (name) DO NOTHING
    `, [role.id, role.name, role.description, JSON.stringify(role.permissions), role.isSystem, nowIso()]);
  }

  // Yonetici sistem rolünün permissions alanını güncel SCREEN_KEYS ile senkronize et.
  // Yeni eklenen ekran anahtarları mevcut role merge edilir; eski anahtarlar korunur.
  await sqlExec(
    `UPDATE roles
     SET permissions = $1::jsonb || permissions,
         updated_at  = $2::timestamptz
     WHERE name = 'Yonetici' AND is_system = TRUE`,
    [JSON.stringify(buildAllPermissions(true)), nowIso()],
  );
}

export async function handleRolesList(_req, res) {
  const rows = await sqlMany("SELECT * FROM roles ORDER BY is_system DESC, created_at ASC");
  return res.json({ ok: true, items: rows.map(mapRoleRow) });
}

export async function handleRolesCreate(req, res) {
  try {
    const { name, description = "", permissions = {} } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ ok: false, code: "VALIDATION_ERROR", message: "Rol adı zorunludur." });
    }
    const id = createId("role");
    const now = nowIso();
    await sqlExec(
      `INSERT INTO roles (id, name, description, permissions, is_system, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, FALSE, $5::timestamptz, $5::timestamptz)`,
      [id, name.trim(), String(description || ""), JSON.stringify(permissions || {}), now],
    );
    const row = await sqlOne("SELECT * FROM roles WHERE id = $1", [id]);
    return res.status(201).json({ ok: true, item: mapRoleRow(row) });
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("unique")) {
      return res.status(409).json({ ok: false, code: "DUPLICATE_NAME", message: "Bu rol adı zaten kullanılıyor." });
    }
    return res.status(400).json({ ok: false, code: "VALIDATION_ERROR", message: error?.message || "Rol oluşturulamadı." });
  }
}

export async function handleRolesUpdate(req, res) {
  const roleId = req.params.id;
  const existingRow = await sqlOne("SELECT * FROM roles WHERE id = $1", [roleId]);
  if (!existingRow) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Rol bulunamadı." });
  }
  const existing = mapRoleRow(existingRow);
  try {
    const { name, description, permissions } = req.body || {};
    const nextName = existing.isSystem ? existing.name : (name?.trim() || existing.name);
    const nextDesc = typeof description !== "undefined" ? String(description) : existing.description;
    const nextPerms = typeof permissions !== "undefined" ? permissions : existing.permissions;
    const now = nowIso();
    await sqlExec(
      "UPDATE roles SET name = $2, description = $3, permissions = $4::jsonb, updated_at = $5::timestamptz WHERE id = $1",
      [roleId, nextName, nextDesc, JSON.stringify(nextPerms), now],
    );
    const row = await sqlOne("SELECT * FROM roles WHERE id = $1", [roleId]);
    return res.json({ ok: true, item: mapRoleRow(row) });
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("unique")) {
      return res.status(409).json({ ok: false, code: "DUPLICATE_NAME", message: "Bu rol adı zaten kullanılıyor." });
    }
    return res.status(400).json({ ok: false, code: "VALIDATION_ERROR", message: error?.message || "Rol güncellenemedi." });
  }
}

export async function handleRolesDelete(req, res) {
  const roleId = req.params.id;
  const existingRow = await sqlOne("SELECT * FROM roles WHERE id = $1", [roleId]);
  if (!existingRow) {
    return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Rol bulunamadı." });
  }
  if (existingRow.is_system) {
    return res.status(400).json({ ok: false, code: "SYSTEM_ROLE", message: "Sistem rolleri silinemez." });
  }
  await sqlExec("DELETE FROM roles WHERE id = $1", [roleId]);
  return res.json({ ok: true });
}
