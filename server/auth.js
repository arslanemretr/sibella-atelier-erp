import crypto from "node:crypto";
import { db } from "./db.js";
import { isSmtpConfigured, sendPasswordResetEmail } from "./mailer.js";
import { hashPassword, isPasswordHash, verifyPassword } from "./passwords.js";

export const AUTH_COOKIE_NAME = "sibella_erp_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const FAILED_LOGIN_WINDOW_MS = 1000 * 60 * 15;
const FAILED_LOGIN_LIMIT = 5;
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 10;
db.exec(`
  CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    ip_address TEXT,
    attempted_at TEXT NOT NULL,
    success INTEGER NOT NULL,
    failure_reason TEXT,
    user_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    requested_ip TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function migrateUserPasswordIfNeeded(user) {
  if (!user?.id || !user.password || isPasswordHash(user.password)) {
    return;
  }

  const hashedPassword = hashPassword(user.password);
  db.prepare(`
    UPDATE users
    SET password = ?, updated_at = ?
    WHERE id = ?
  `).run(hashedPassword, nowIso(), user.id);
}

export function migrateLegacyPasswords() {
  const users = db.prepare("SELECT id, password FROM users WHERE password IS NOT NULL AND password <> ''").all();
  users.forEach((user) => migrateUserPasswordIfNeeded(user));
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

function sanitizeUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    supplierId: row.supplier_id || null,
    status: row.status,
    lastLoginAt: row.last_login_at || null,
  };
}

function recordLoginAttempt({ email, success, failureReason = null, userId = null, ipAddress = null }) {
  db.prepare(`
    INSERT INTO login_attempts (id, email, ip_address, attempted_at, success, failure_reason, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(createId("login"), String(email || "").trim().toLowerCase(), ipAddress, nowIso(), success ? 1 : 0, failureReason, userId);
}

function countRecentFailedAttempts(email, ipAddress) {
  const cutoff = new Date(Date.now() - FAILED_LOGIN_WINDOW_MS).toISOString();
  return db.prepare(`
    SELECT COUNT(*) AS attempt_count
    FROM login_attempts
    WHERE email = ?
      AND COALESCE(ip_address, '') = COALESCE(?, '')
      AND success = 0
      AND attempted_at >= ?
  `).get(String(email || "").trim().toLowerCase(), ipAddress, cutoff)?.attempt_count || 0;
}

function clearExpiredPasswordResetTokens() {
  db.prepare(`
    DELETE FROM password_reset_tokens
    WHERE expires_at < ?
       OR used_at IS NOT NULL
  `).run(nowIso());
}

function createSessionForUser(user, req, res) {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha256(rawToken);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const session = {
    id: createId("sess"),
    userId: user.id,
    tokenHash,
    createdAt,
    expiresAt,
    lastSeenAt: createdAt,
    userAgent: req.headers["user-agent"] || "",
    ipAddress: getClientIp(req),
  };

  db.prepare(`
    INSERT INTO auth_sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, user_agent, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    session.id,
    session.userId,
    session.tokenHash,
    session.createdAt,
    session.expiresAt,
    session.lastSeenAt,
    session.userAgent,
    session.ipAddress,
  );

  res.setHeader("Set-Cookie", serializeCookie(AUTH_COOKIE_NAME, encodeURIComponent(rawToken), {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    secure: process.env.NODE_ENV === "production",
  }));

  return session;
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", serializeCookie(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  }));
}

function deleteSessionByToken(rawToken) {
  if (!rawToken) {
    return;
  }

  db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(sha256(rawToken));
}

export function getAuthenticatedUser(req) {
  const rawToken = getCookieValue(req, AUTH_COOKIE_NAME);
  if (!rawToken) {
    return null;
  }

  const session = db.prepare(`
    SELECT s.*, u.id AS user_id_real, u.full_name, u.email, u.role, u.supplier_id, u.status, u.last_login_at
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `).get(sha256(rawToken));

  if (!session) {
    return null;
  }

  if (session.expires_at <= nowIso() || session.status !== "Aktif") {
    deleteSessionByToken(rawToken);
    return null;
  }

  db.prepare(`
    UPDATE auth_sessions
    SET last_seen_at = ?
    WHERE id = ?
  `).run(nowIso(), session.id);

  return sanitizeUser({
    id: session.user_id_real,
    full_name: session.full_name,
    email: session.email,
    role: session.role,
    supplier_id: session.supplier_id,
    status: session.status,
    last_login_at: session.last_login_at,
  });
}

export function requireAuth(req, res, next) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    clearSessionCookie(res);
    return res.status(401).json({
      ok: false,
      code: "AUTH_REQUIRED",
      message: "Oturum bulunamadi veya suresi doldu.",
    });
  }

  req.authUser = user;
  return next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      clearSessionCookie(res);
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
  };
}

export function handleLogin(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const ipAddress = getClientIp(req);

  if (!email || !password) {
    return res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "E-posta ve sifre zorunludur.",
    });
  }

  if (countRecentFailedAttempts(email, ipAddress) >= FAILED_LOGIN_LIMIT) {
    return res.status(429).json({
      ok: false,
      code: "TOO_MANY_ATTEMPTS",
      message: "Hesap gecici olarak kilitlendi. Lutfen 15 dakika sonra tekrar deneyin.",
    });
  }

  const user = db.prepare("SELECT * FROM users WHERE lower(email) = ?").get(email);
  if (!user) {
    recordLoginAttempt({ email, success: false, failureReason: "USER_NOT_FOUND", ipAddress });
    return res.status(401).json({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "E-posta veya sifre hatali.",
    });
  }

  if (user.status !== "Aktif") {
    recordLoginAttempt({ email, success: false, failureReason: "USER_PASSIVE", userId: user.id, ipAddress });
    return res.status(403).json({
      ok: false,
      code: "USER_PASSIVE",
      message: "Bu hesap pasif durumda. Lutfen yoneticiniz ile iletisime gecin.",
    });
  }

  const passwordMatches = verifyPassword(password, user.password);
  if (!passwordMatches) {
    recordLoginAttempt({ email, success: false, failureReason: "INVALID_PASSWORD", userId: user.id, ipAddress });
    return res.status(401).json({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "E-posta veya sifre hatali.",
    });
  }

  migrateUserPasswordIfNeeded(user);
  createSessionForUser(user, req, res);
  const loginAt = nowIso();
  db.prepare(`
    UPDATE users
    SET last_login_at = ?, updated_at = ?
    WHERE id = ?
  `).run(loginAt, loginAt, user.id);
  recordLoginAttempt({ email, success: true, userId: user.id, ipAddress });

  return res.json({
    ok: true,
    user: {
      ...sanitizeUser({
        ...user,
        last_login_at: loginAt,
      }),
      loggedInAt: loginAt,
    },
  });
}

export function handleSession(req, res) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    clearSessionCookie(res);
    return res.status(401).json({
      ok: false,
      code: "NO_SESSION",
      message: "Aktif oturum bulunamadi.",
    });
  }

  return res.json({
    ok: true,
    user,
  });
}

export function handleLogout(req, res) {
  const rawToken = getCookieValue(req, AUTH_COOKIE_NAME);
  deleteSessionByToken(rawToken);
  clearSessionCookie(res);
  return res.json({
    ok: true,
  });
}

export function handleForgotPasswordRequest(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const ipAddress = getClientIp(req);

  if (!email) {
    return res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "E-posta zorunludur.",
    });
  }

  clearExpiredPasswordResetTokens();
  const user = db.prepare("SELECT * FROM users WHERE lower(email) = ?").get(email);

  if (!user || user.status !== "Aktif") {
    return res.json({
      ok: true,
      message: "Hesap bulunduysa sifre yenileme kodu olusturuldu.",
    });
  }

  db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL").run(user.id);

  const resetCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  const tokenHash = sha256(resetCode);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();

  db.prepare(`
    INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at, used_at, requested_ip)
    VALUES (?, ?, ?, ?, ?, NULL, ?)
  `).run(createId("reset"), user.id, tokenHash, createdAt, expiresAt, ipAddress);

  const smtpEnabled = isSmtpConfigured();

  if (!smtpEnabled) {
    return res.json({
      ok: true,
      message: "SMTP ayari olmadigi icin kod ekranda gosterildi.",
      delivery: "onscreen",
      resetCode,
      expiresAt,
    });
  }

  sendPasswordResetEmail({
    toEmail: user.email,
    resetCode,
    expiresAt,
  }).then((result) => {
    if (!result?.sent) {
      return res.status(500).json({
        ok: false,
        code: "EMAIL_REJECTED",
        message: "Sifre yenileme e-postasi kabul edilmedi. SMTP ayarlarinizi kontrol edin.",
      });
    }

    res.json({
      ok: true,
      message: "Sifre yenileme kodu e-posta adresinize gonderildi.",
      delivery: "email",
      expiresAt,
    });
  }).catch(() => {
    res.status(500).json({
      ok: false,
      code: "EMAIL_SEND_FAILED",
      message: "Sifre yenileme e-postasi gonderilemedi. SMTP ayarlarinizi kontrol edin.",
    });
  });
}

export function handleForgotPasswordConfirm(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
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

  clearExpiredPasswordResetTokens();
  const user = db.prepare("SELECT * FROM users WHERE lower(email) = ?").get(email);
  if (!user || user.status !== "Aktif") {
    return res.status(400).json({
      ok: false,
      code: "INVALID_RESET_REQUEST",
      message: "Sifre yenileme istegi dogrulanamadi.",
    });
  }

  const resetRecord = db.prepare(`
    SELECT *
    FROM password_reset_tokens
    WHERE user_id = ?
      AND token_hash = ?
      AND used_at IS NULL
      AND expires_at >= ?
  `).get(user.id, sha256(resetCode), nowIso());

  if (!resetRecord) {
    return res.status(400).json({
      ok: false,
      code: "INVALID_RESET_CODE",
      message: "Sifre yenileme kodu gecersiz veya suresi dolmus.",
    });
  }

  const updatedAt = nowIso();
  db.prepare(`
    UPDATE users
    SET password = ?, updated_at = ?
    WHERE id = ?
  `).run(hashPassword(nextPassword), updatedAt, user.id);

  db.prepare(`
    UPDATE password_reset_tokens
    SET used_at = ?
    WHERE id = ?
  `).run(updatedAt, resetRecord.id);

  db.prepare("DELETE FROM auth_sessions WHERE user_id = ?").run(user.id);

  return res.json({
    ok: true,
    message: "Sifreniz basariyla yenilendi. Yeni sifreniz ile giris yapabilirsiniz.",
  });
}
