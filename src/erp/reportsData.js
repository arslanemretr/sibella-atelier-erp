import { requestJson } from "./apiClient";

export async function getReportSchedule(reportKey) {
  const payload = await requestJson("GET", `/api/reports/schedules/${reportKey}`);
  return {
    item: payload?.item || null,
    meta: payload?.meta || {},
  };
}

export async function updateReportSchedule(reportKey, values) {
  const payload = await requestJson("PUT", `/api/reports/schedules/${reportKey}`, values);
  return payload?.item || null;
}

export async function sendConsolidatedEarningsReportNow(values) {
  const payload = await requestJson("POST", "/api/reports/consolidated-earnings/send-now", values);
  return payload || {};
}
