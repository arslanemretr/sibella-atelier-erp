const AUTH_EVENT_NAME = "sibella-auth-changed";

let authUser = null;
let authLoaded = false;
let restorePromise = null;

function emitAuthChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_EVENT_NAME));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.message || "Istek basarisiz oldu.");
    error.code = payload?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }

  return payload;
}

export function getAuthUser() {
  return authUser;
}

export function hasAuthLoaded() {
  return authLoaded;
}

export function isAuthenticated() {
  return Boolean(authUser);
}

export function clearAuthState() {
  authUser = null;
  authLoaded = true;
  emitAuthChange();
}

export async function restoreAuthSession(force = false) {
  if (typeof window === "undefined") {
    authLoaded = true;
    authUser = null;
    return null;
  }

  if (!force && authLoaded) {
    return authUser;
  }

  if (!force && restorePromise) {
    return restorePromise;
  }

  restorePromise = (async () => {
    try {
      const payload = await requestJson("/api/auth/session", { method: "GET" });
      authUser = payload?.user || null;
      return authUser;
    } catch {
      authUser = null;
      return null;
    } finally {
      authLoaded = true;
      emitAuthChange();
      restorePromise = null;
    }
  })();

  return restorePromise;
}

export async function loginUser(email, password) {
  const payload = await requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  authUser = payload?.user || null;
  authLoaded = true;
  emitAuthChange();
  return authUser;
}

export async function requestPasswordReset(email) {
  return requestJson("/api/auth/forgot-password/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(email, resetCode, nextPassword) {
  return requestJson("/api/auth/forgot-password/confirm", {
    method: "POST",
    body: JSON.stringify({ email, resetCode, nextPassword }),
  });
}

export async function logoutUser() {
  try {
    await requestJson("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
  } catch {
    // even if the server session is already gone, clear local auth state
  } finally {
    clearAuthState();
  }
}

export function onAuthChange(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(AUTH_EVENT_NAME, callback);
  return () => window.removeEventListener(AUTH_EVENT_NAME, callback);
}
