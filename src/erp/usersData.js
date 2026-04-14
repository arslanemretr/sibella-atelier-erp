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

export async function listUsersFresh() {
  const payload = await requestJson("/api/users", { method: "GET" });
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function createUser(values) {
  const payload = await requestJson("/api/users", {
    method: "POST",
    body: JSON.stringify(values),
  });
  return payload?.item || null;
}

export async function updateUser(userId, values) {
  const payload = await requestJson(`/api/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify(values),
  });
  return payload?.item || null;
}

export async function deleteUser(userId) {
  return requestJson(`/api/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}
