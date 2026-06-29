import {
  collection,
  onSnapshot,
  query,
  where
} from "firebase/firestore";
// Firestore client from firebaseConfig.js; realtime listeners check this user's notification records.
import { db } from "../firebase/firebaseConfig";
// Function from apiClient.js; checks Firebase sign-in and sends notification updates to Express.
import { apiRequest } from "./apiClient.js";

/**
 * Converts Firestore notification timestamps into user-friendly labels.
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

  return String(value);
}

/**
 * Sorts notifications so newest updates appear first.
 */
function sortByCreatedAtDesc(a, b) {
  const aMillis = typeof a.createdAt?.toMillis === "function" ? a.createdAt.toMillis() : 0;
  const bMillis = typeof b.createdAt?.toMillis === "function" ? b.createdAt.toMillis() : 0;
  return bMillis - aMillis;
}

/**
 * Maps a Firestore snapshot into dashboard notification objects.
 */
function mapNotificationSnapshot(snapshot) {
  return snapshot.docs
    .map((notificationSnapshot) => {
      const data = notificationSnapshot.data();

      return {
        id: notificationSnapshot.id,
        ...data,
        timestamp: formatNotificationDate(data.createdAt)
      };
    })
    .sort(sortByCreatedAtDesc);
}

/**
 * Opens a realtime listener for notifications owned by one user.
 */
export function listenToUserNotifications(userId, onNotifications, onError) {
  const notificationsQuery = query(
    collection(db, "notifications"),
    where("recipientId", "==", userId)
  );

  return onSnapshot(
    notificationsQuery,
    (snapshot) => onNotifications(mapNotificationSnapshot(snapshot)),
    onError
  );
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
