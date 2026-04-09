export async function fetchDashboardSummary({ startDate, endDate }) {
  const query = new URLSearchParams();
  if (startDate) {
    query.set("start", startDate);
  }
  if (endDate) {
    query.set("end", endDate);
  }

  const response = await fetch(`/api/dashboard/summary?${query.toString()}`, {
    method: "GET",
    credentials: "same-origin",
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.message || "Dashboard verisi alinamadi.");
    error.code = payload?.code || "DASHBOARD_REQUEST_FAILED";
    throw error;
  }

  return payload;
}
