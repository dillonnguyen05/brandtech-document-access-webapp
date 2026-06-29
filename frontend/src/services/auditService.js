// Function from apiClient.js; checks Firebase sign-in and sends bearer-token requests to Express.
import { apiRequest } from "./apiClient.js";

/**
 * Formats audit timestamps into a readable date/time for the admin table.
 */
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

/**
 * Loads the latest audit log entries from the Express admin API.
 */
export async function loadAuditLog() {
  // Function from apiClient.js: checks Firebase sign-in and requests admin audit rows from Express.
  const result = await apiRequest("/api/admin/audit-log");

  return result.auditLog.map((entry) => ({
    ...entry,
    timestamp: formatAuditDate(entry.createdAt)
  }));
}
