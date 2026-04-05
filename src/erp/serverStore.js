const cache = new Map();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requestJson(method, url, body) {
  const xhr = new XMLHttpRequest();
  xhr.open(method, url, false);
  xhr.setRequestHeader("Content-Type", "application/json");

  try {
    xhr.send(body ? JSON.stringify(body) : null);
  } catch {
    return null;
  }

  if (xhr.status < 200 || xhr.status >= 300) {
    return null;
  }

  try {
    return JSON.parse(xhr.responseText);
  } catch {
    return null;
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
  if (response?.ok) {
    cache.set(storageKey, response.value);
    return clone(response.value);
  }

  requestJson("PUT", `/api/store/${encodeURIComponent(storageKey)}`, { value: seedValue });
  cache.set(storageKey, seedValue);
  return clone(seedValue);
}

export function writePersistentStore(storageKey, value) {
  if (typeof window === "undefined") {
    return clone(value);
  }

  cache.set(storageKey, clone(value));
  requestJson("PUT", `/api/store/${encodeURIComponent(storageKey)}`, { value });
  return clone(value);
}

export function clearPersistentStoreCache(storageKey) {
  if (storageKey) {
    cache.delete(storageKey);
    return;
  }

  cache.clear();
}
