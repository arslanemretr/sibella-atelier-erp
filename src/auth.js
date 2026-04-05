import { authenticateUser } from "./erp/usersData";

const AUTH_STORAGE_KEY = "sibella.erp.auth.v1";
const AUTH_EVENT_NAME = "sibella-auth-changed";

export function getAuthUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getAuthUser());
}

export function loginUser(email, password) {
  const user = authenticateUser(email, password);
  if (!user || typeof window === "undefined") {
    return null;
  }

  const sessionUser = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    supplierId: user.supplierId || null,
    loggedInAt: new Date().toISOString(),
  };

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));
  window.dispatchEvent(new Event(AUTH_EVENT_NAME));
  return sessionUser;
}

export function logoutUser() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT_NAME));
}

export function onAuthChange(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(AUTH_EVENT_NAME, callback);
  return () => window.removeEventListener(AUTH_EVENT_NAME, callback);
}
