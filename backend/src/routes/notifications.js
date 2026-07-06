import express from "express";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebaseAdmin.js";

const router = express.Router();

/**
 * Creates an HTTP-style error object that the shared Express error handler can return.
 */
function createRouteError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Converts Firestore Timestamp values into ISO strings for React.
 */
function timestampToIso(value) {
  return typeof value?.toDate === "function"
    ? value.toDate().toISOString()
    : null;
}

/**
 * Loads a notification and confirms the signed-in user owns it before mutation.
 */
async function getOwnedNotification(req) {
  const notificationRef = adminDb
    .collection("notifications")
    .doc(req.params.notificationId);
  const notificationSnapshot = await notificationRef.get();

  if (!notificationSnapshot.exists) {
    throw createRouteError(404, "Notification not found.");
  }

  if (notificationSnapshot.data().recipientId !== req.auth.uid) {
    throw createRouteError(
      403,
      "You can only update your own notifications."
    );
  }

  return notificationSnapshot;
}

/**
 * Lists notifications owned by the current signed-in user.
 */
router.get("/", async (req, res) => {
  const snapshot = await adminDb
    .collection("notifications")
    .where("recipientId", "==", req.auth.uid)
    .get();

  const notifications = snapshot.docs
    .map((notificationSnapshot) => {
      const data = notificationSnapshot.data();

      return {
        id: notificationSnapshot.id,
        ...data,
        createdAt: timestampToIso(data.createdAt),
        readAt: timestampToIso(data.readAt)
      };
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  res.status(200).json({ notifications });
});

/**
 * Marks up to 100 of the current user's unread notifications as read in one batch.
 */
router.patch("/read", async (req, res) => {
  const notificationIds = Array.isArray(req.body.notificationIds)
    ? [...new Set(req.body.notificationIds)]
    : [];

  if (notificationIds.length === 0) {
    res.status(200).json({
      message: "No notifications needed updating.",
      updated: 0
    });
    return;
  }

  if (notificationIds.length > 100) {
    throw createRouteError(400, "A maximum of 100 notifications can be updated.");
  }

  const notificationRefs = notificationIds.map((notificationId) => (
    adminDb.collection("notifications").doc(String(notificationId))
  ));
  const notificationSnapshots = await adminDb.getAll(...notificationRefs);
  const batch = adminDb.batch();
  let updated = 0;

  notificationSnapshots.forEach((notificationSnapshot) => {
    if (!notificationSnapshot.exists) return;

    const notification = notificationSnapshot.data();

    if (notification.recipientId !== req.auth.uid) {
      throw createRouteError(
        403,
        "You can only update your own notifications."
      );
    }

    if (!notification.read) {
      batch.update(notificationSnapshot.ref, {
        read: true,
        readAt: FieldValue.serverTimestamp()
      });
      updated += 1;
    }
  });

  if (updated > 0) {
    await batch.commit();
  }

  res.status(200).json({
    message: "Notifications marked as read.",
    updated
  });
});

/**
 * Marks one owned notification as read.
 */
router.patch("/:notificationId/read", async (req, res) => {
  const notificationSnapshot = await getOwnedNotification(req);

  if (!notificationSnapshot.data().read) {
    await notificationSnapshot.ref.update({
      read: true,
      readAt: FieldValue.serverTimestamp()
    });
  }

  res.status(200).json({
    message: "Notification marked as read.",
    notificationId: notificationSnapshot.id
  });
});

/**
 * Deletes one owned notification so it disappears from the customer's notification list.
 */
router.delete("/:notificationId", async (req, res) => {
  const notificationSnapshot = await getOwnedNotification(req);

  await notificationSnapshot.ref.delete();

  res.status(200).json({
    message: "Notification dismissed.",
    notificationId: notificationSnapshot.id
  });
});

export default router;
