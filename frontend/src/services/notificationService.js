// Function from apiClient.js; checks Firebase sign-in and sends notification updates to Express.
import { apiRequest } from "./apiClient.js";

/**
 * Converts API notification timestamps into user-friendly labels.
 */
function formatNotificationDate(value) {
  if (!value) return "Just now";

  if (typeof value.toDate === "function") {
    return value.toDate().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  const date = value instanceof Date ? value : new Date(value);

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
 * Sorts notifications so newest updates appear first.
 */
function sortByCreatedAtDesc(a, b) {
  const aMillis = typeof a.createdAt?.toMillis === "function"
    ? a.createdAt.toMillis()
    : new Date(a.createdAt || 0).getTime();
  const bMillis = typeof b.createdAt?.toMillis === "function"
    ? b.createdAt.toMillis()
    : new Date(b.createdAt || 0).getTime();
  return bMillis - aMillis;
}

/**
 * Maps API notification rows into dashboard notification objects.
 */
function mapApiNotifications(notifications = []) {
  return notifications
    .map((notification) => ({
      ...notification,
      timestamp: formatNotificationDate(notification.createdAt)
    }))
    .sort(sortByCreatedAtDesc);
}

/**
 * Loads notifications owned by the signed-in user through Express.
 */
export async function loadUserNotifications() {
  // Function from apiClient.js: checks Firebase sign-in and loads notifications from Express.
  const result = await apiRequest("/api/notifications");
  return mapApiNotifications(result.notifications);
}

/**
 * Marks every unread notification in the supplied list as read.
 */
export async function markNotificationsRead(notifications) {
  const unreadNotifications = notifications.filter((notification) => !notification.read);
  if (unreadNotifications.length === 0) return;

  // Function from apiClient.js: checks Firebase sign-in and marks notifications read through Express.
  await apiRequest("/api/notifications/read", {
    method: "PATCH",
    body: JSON.stringify({
      notificationIds: unreadNotifications.map((notification) => notification.id)
    })
  });
}

/**
 * Marks one notification as read through Express.
 */
export function markNotificationRead(notificationId) {
  // Function from apiClient.js: checks Firebase sign-in and marks one notification read through Express.
  return apiRequest(
    `/api/notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: "PATCH"
    }
  );
}

/**
 * Deletes one notification through Express.
 */
export function dismissNotification(notificationId) {
  // Function from apiClient.js: checks Firebase sign-in and deletes one notification through Express.
  return apiRequest(
    `/api/notifications/${encodeURIComponent(notificationId)}`,
    {
      method: "DELETE"
    }
  );
}
