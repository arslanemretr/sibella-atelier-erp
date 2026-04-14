import { clearAuthState } from "../auth";
import { message } from "antd";

let lastErrorAt = 0;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function showError(text) {
  const now = Date.now();
  if (now - lastErrorAt < 1500) {
    return;
  }
  lastErrorAt = now;
  message.error(text);
}

function shouldSuppressError(status, options = {}) {
  return Array.isArray(options?.suppressStatuses) && options.suppressStatuses.includes(status);
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function requestJsonSync(method, url, body, options = {}) {
  if (typeof window === "undefined") {
    throw new Error("requestJsonSync sadece tarayici ortaminda kullanilabilir.");
  }

  const xhr = new XMLHttpRequest();
  const finalUrl =
    method === "GET" && options.cacheBust !== false
      ? `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`
      : url;
  xhr.open(method, finalUrl, false);
  xhr.setRequestHeader("Content-Type", "application/json");

  try {
    xhr.send(typeof body === "undefined" ? null : JSON.stringify(body));
  } catch {
    return {
      ok: false,
      status: 0,
      message: "Sunucuya baglanilamadi.",
    };
  }

  if (xhr.status === 401) {
    clearAuthState();
    return {
      ok: false,
      status: 401,
      message: "Oturum suresi doldu.",
    };
  }

  const payload = parseJson(xhr.responseText);
  if (xhr.status < 200 || xhr.status >= 300) {
    return {
      ok: false,
      status: xhr.status,
      message: payload?.message || "Sunucu islemi basarisiz oldu.",
    };
  }

  return {
    ok: true,
    status: xhr.status,
    data: payload,
  };
}

export async function requestJson(method, url, body, options = {}) {
  const finalUrl =
    method === "GET" && options.cacheBust !== false
      ? `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`
      : url;

  const response = await fetch(finalUrl, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: typeof body === "undefined" ? undefined : JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 401) {
    clearAuthState();
    const error = new Error("Oturum suresi doldu.");
    error.status = 401;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(payload?.message || "Sunucu islemi basarisiz oldu.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function requestCollectionSync(url, seedValue = [], options = {}) {
  if (typeof window === "undefined") {
    return clone(seedValue);
  }

  const response = requestJsonSync("GET", url, undefined, options);
  if (response.ok) {
    return Array.isArray(response.data?.items) ? clone(response.data.items) : clone(seedValue);
  }

  if (response.status !== 401 && !shouldSuppressError(response.status, options)) {
    showError(response.message || "Veriler yuklenemedi.");
  }
  return clone(seedValue);
}

export async function requestCollection(url, seedValue = [], options = {}) {
  try {
    const payload = await requestJson("GET", url, undefined, options);
    return Array.isArray(payload?.items) ? clone(payload.items) : clone(seedValue);
  } catch (error) {
    if (error?.status !== 401 && !shouldSuppressError(error?.status, options)) {
      showError(error?.message || "Veriler yuklenemedi.");
    }
    return clone(seedValue);
  }
}

export function mutateResourceSync(method, url, values, options = {}) {
  const response = requestJsonSync(method, url, values, options);
  if (!response.ok) {
    if (response.status !== 401) {
      showError(response.message || "Kayit islemi basarisiz oldu.");
    }
    throw new Error(response.message || "Kayit islemi basarisiz oldu.");
  }

  return clone(response.data?.item ?? response.data ?? null);
}
