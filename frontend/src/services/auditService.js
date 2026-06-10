import { apiRequest } from "./apiClient.js";

function formatAuditDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export async function loadAuditLog() {
  const result = await apiRequest("/api/admin/audit-log");

  return result.auditLog.map((entry) => ({
    ...entry,
    timestamp: formatAuditDate(entry.createdAt)
  }));
}
