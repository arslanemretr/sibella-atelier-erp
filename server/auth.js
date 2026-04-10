import crypto from "node:crypto";
import { getStoreValue, setStoreValue, sqlExec, sqlOne } from "./db.js";
import { isSmtpConfigured, sendPasswordResetEmail } from "./mailer.js";
import { hashPassword, isPasswordHash, verifyPassword } from "./passwords.js";

export const AUTH_COOKIE_NAME = "sibella_erp_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const FAILED_LOGIN_WINDOW_MS = 1000 * 60 * 15;
const FAILED_LOGIN_LIMIT = 5;
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 10;
const USERS_STORE_KEY = "sibella.erp.users.v1";

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
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
  };
}

async function loadUsersStore() {
  const usersRecord = await getStoreValue(USERS_STORE_KEY);
  return Array.isArray(usersRecord?.value) ? usersRecord.value : [];
}

async function saveUsersStore(users) {
  await setStoreValue(USERS_STORE_KEY, users);
}

async function updateUserInStore(userId, updater) {
  const users = await loadUsersStore();
  const index = users.findIndex((item) => item.id === userId);
  if (index < 0) {
    return null;
  }
  const nextUsers = [...users];
  nextUsers[index] = updater({ ...nextUsers[index] });
  await saveUsersStore(nextUsers);
  return nextUsers[index];
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

async function recordLoginAttempt({ email, success, failureReason = null, userId = null, ipAddress = null }) {
  await sqlExec(`
    INSERT INTO login_attempts (id, email, ip_address, attempted_at, success, failure_reason, user_id)
    VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7)
  `, [createId("login"), String(email || "").trim().toLowerCase(), ipAddress, nowIso(), Boolean(success), failureReason, userId]);
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
  `, [String(email || "").trim().toLowerCase(), ipAddress, cutoff]);
  return Number(row?.attempt_count || 0);
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

  await sqlExec(`
    INSERT INTO auth_sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, user_agent, ip_address)
    VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6::timestamptz, $7, $8)
  `, [
    session.id,
    session.userId,
    session.tokenHash,
    session.createdAt,
    session.expiresAt,
    session.lastSeenAt,
    session.userAgent,
    session.ipAddress,
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
  const users = await loadUsersStore();
  let changed = false;
  const nextUsers = users.map((user) => {
    if (!user?.password || isPasswordHash(user.password)) {
      return user;
    }
    changed = true;
    return {
      ...user,
      password: hashPassword(user.password),
      updatedAt: nowIso(),
    };
  });

  if (changed) {
    await saveUsersStore(nextUsers);
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

  const users = await loadUsersStore();
  const user = users.find((item) => item.id === session.user_id);
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
      clearSessionCookie(res);
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
    })().catch(next);
  };
}

export async function handleLogin(req, res) {
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

  if ((await countRecentFailedAttempts(email, ipAddress)) >= FAILED_LOGIN_LIMIT) {
    return res.status(429).json({
      ok: false,
      code: "TOO_MANY_ATTEMPTS",
      message: "Hesap gecici olarak kilitlendi. Lutfen 15 dakika sonra tekrar deneyin.",
    });
  }

  const users = await loadUsersStore();
  const user = users.find((item) => String(item.email || "").trim().toLowerCase() === email);

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

  let updatedUser = user;
  if (!isPasswordHash(user.password)) {
    updatedUser = await updateUserInStore(user.id, (target) => ({
      ...target,
      password: hashPassword(target.password || ""),
      updatedAt: nowIso(),
    }));
  }

  await createSessionForUser(updatedUser, req, res);
  const loginAt = nowIso();
  updatedUser = await updateUserInStore(updatedUser.id, (target) => ({
    ...target,
    lastLoginAt: loginAt,
    updatedAt: loginAt,
  }));

  await recordLoginAttempt({ email, success: true, userId: updatedUser.id, ipAddress });

  return res.json({
    ok: true,
    user: {
      ...sanitizeUser(updatedUser),
      loggedInAt: loginAt,
    },
  });
}

export async function handleSession(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    clearSessionCookie(res);
    return res.status(401).json({
      ok: false,
      code: "NO_SESSION",
      message: "Aktif oturum bulunamadi.",
    });
  }
  return res.json({ ok: true, user });
}

export async function handleLogout(req, res) {
  const rawToken = getCookieValue(req, AUTH_COOKIE_NAME);
  await deleteSessionByToken(rawToken);
  clearSessionCookie(res);
  return res.json({ ok: true });
}

export async function handleForgotPasswordRequest(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const ipAddress = getClientIp(req);

  if (!email) {
    return res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "E-posta zorunludur.",
    });
  }

  await clearExpiredPasswordResetTokens();
  const users = await loadUsersStore();
  const user = users.find((item) => String(item.email || "").trim().toLowerCase() === email);

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

  await clearExpiredPasswordResetTokens();
  const users = await loadUsersStore();
  const user = users.find((item) => String(item.email || "").trim().toLowerCase() === email);
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
  await updateUserInStore(user.id, (target) => ({
    ...target,
    password: hashPassword(nextPassword),
    updatedAt,
  }));

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
