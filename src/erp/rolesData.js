async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }

  if (!response.ok) {
    const error = new Error(payload?.message || "Istek basarisiz oldu.");
    error.code = payload?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }

  return payload;
}

export async function listRolesFresh() {
  const payload = await requestJson("/api/roles", { method: "GET" });
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function createRole(values) {
  const payload = await requestJson("/api/roles", {
    method: "POST",
    body: JSON.stringify(values),
  });
  return payload?.item || null;
}

export async function updateRole(roleId, values) {
  const payload = await requestJson(`/api/roles/${encodeURIComponent(roleId)}`, {
    method: "PUT",
    body: JSON.stringify(values),
  });
  return payload?.item || null;
}

export async function deleteRole(roleId) {
  return requestJson(`/api/roles/${encodeURIComponent(roleId)}`, { method: "DELETE" });
}
