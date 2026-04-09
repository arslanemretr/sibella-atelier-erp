import { clearAuthState } from "../auth";
import { message } from "antd";

const cache = new Map();
let lastStoreErrorAt = 0;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function showStoreError(text) {
  const now = Date.now();
  if (now - lastStoreErrorAt < 1500) {
    return;
  }
  lastStoreErrorAt = now;
  message.error(text);
}

function requestJson(method, url, body) {
  const xhr = new XMLHttpRequest();
  xhr.open(method, url, false);
  xhr.setRequestHeader("Content-Type", "application/json");

  try {
    xhr.send(body ? JSON.stringify(body) : null);
  } catch {
    return {
      ok: false,
      status: 0,
      type: "network",
      message: "Sunucuya baglanilamadi.",
    };
  }

  if (xhr.status === 401) {
    clearAuthState();
    return {
      ok: false,
      status: 401,
      type: "auth",
      message: "Oturum suresi doldu.",
    };
  }

  if (xhr.status < 200 || xhr.status >= 300) {
    let errorMessage = "Sunucu islemi basarisiz oldu.";
    try {
      const payload = JSON.parse(xhr.responseText);
      if (payload?.message) {
        errorMessage = payload.message;
      }
    } catch {
      // ignore parse errors
    }

    return {
      ok: false,
      status: xhr.status,
      type: "http",
      message: errorMessage,
    };
  }

  try {
    return {
      ok: true,
      status: xhr.status,
      data: JSON.parse(xhr.responseText),
    };
  } catch {
    return {
      ok: false,
      status: xhr.status,
      type: "parse",
      message: "Sunucu yaniti okunamadi.",
    };
  }
}

export function readPersistentStore(storageKey, seedValue) {
  if (typeof window === "undefined") {
    return clone(seedValue);
  }

  if (cache.has(storageKey)) {
    return clone(cache.get(storageKey));
  }

  const response = requestJson("GET", `/api/store/${encodeURIComponent(storageKey)}`);
  if (response.ok && response.data?.ok) {
    cache.set(storageKey, response.data.value);
    return clone(response.data.value);
  }

  if (response.status === 401) {
    return clone(cache.get(storageKey) ?? seedValue);
  }

  if (response.status === 404) {
    const initResponse = requestJson("PUT", `/api/store/${encodeURIComponent(storageKey)}`, { value: seedValue });
    if (initResponse.ok && initResponse.data?.ok) {
      cache.set(storageKey, seedValue);
      return clone(seedValue);
    }
  }

  showStoreError("Veritabani baglantisi kurulamadi. Veriler guncellenemeyebilir.");
  return clone(seedValue);
}

export function writePersistentStore(storageKey, value) {
  if (typeof window === "undefined") {
    return clone(value);
  }

  const response = requestJson("PUT", `/api/store/${encodeURIComponent(storageKey)}`, { value });
  if (response.ok && response.data?.ok) {
    cache.set(storageKey, clone(value));
    return clone(value);
  }

  if (response.status !== 401) {
    showStoreError(response.message || "Kayit islemi basarisiz oldu. Lutfen sunucu baglantisini kontrol edin.");
  }

  throw new Error(response.message || "Kayit islemi basarisiz oldu.");
}

export function clearPersistentStoreCache(storageKey) {
  if (storageKey) {
    cache.delete(storageKey);
    return;
  }

  cache.clear();
}
