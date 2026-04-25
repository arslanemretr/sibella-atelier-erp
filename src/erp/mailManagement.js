import { requestJson } from "./apiClient";

export async function listEmailTemplatesFresh() {
  const payload = await requestJson("GET", "/api/settings/email-templates");
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    meta: payload?.meta || {},
  };
}

export async function createEmailTemplate(values) {
  const payload = await requestJson("POST", "/api/settings/email-templates", values);
  return payload?.item || null;
}

export async function updateEmailTemplate(id, values) {
  const payload = await requestJson("PUT", `/api/settings/email-templates/${id}`, values);
  return payload?.item || null;
}

export async function deleteEmailTemplate(id) {
  await requestJson("DELETE", `/api/settings/email-templates/${id}`);
}

export async function listEmailScenariosFresh() {
  const payload = await requestJson("GET", "/api/settings/email-scenarios");
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    meta: payload?.meta || {},
  };
}

export async function createEmailScenario(values) {
  const payload = await requestJson("POST", "/api/settings/email-scenarios", values);
  return payload?.item || null;
}

export async function updateEmailScenario(id, values) {
  const payload = await requestJson("PUT", `/api/settings/email-scenarios/${id}`, values);
  return payload?.item || null;
}

export async function deleteEmailScenario(id) {
  await requestJson("DELETE", `/api/settings/email-scenarios/${id}`);
}

export async function listEmailDeliveryLogsFresh() {
  const payload = await requestJson("GET", "/api/settings/email-delivery-logs");
  return Array.isArray(payload?.items) ? payload.items : [];
}
