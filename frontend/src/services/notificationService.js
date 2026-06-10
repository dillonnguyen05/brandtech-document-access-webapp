import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

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

function sortByCreatedAtDesc(a, b) {
  const aMillis = typeof a.createdAt?.toMillis === "function" ? a.createdAt.toMillis() : 0;
  const bMillis = typeof b.createdAt?.toMillis === "function" ? b.createdAt.toMillis() : 0;
  return bMillis - aMillis;
}

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

export async function markNotificationsRead(notifications) {
  const unreadNotifications = notifications.filter((notification) => !notification.read);
  if (unreadNotifications.length === 0) return;

  const batch = writeBatch(db);

  unreadNotifications.forEach((notification) => {
    batch.update(doc(db, "notifications", notification.id), {
      read: true,
      readAt: serverTimestamp()
    });
  });

  await batch.commit();
}
