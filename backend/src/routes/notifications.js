import express from "express";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebaseAdmin.js";

const router = express.Router();

function createRouteError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

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

router.delete("/:notificationId", async (req, res) => {
  const notificationSnapshot = await getOwnedNotification(req);

  await notificationSnapshot.ref.delete();

  res.status(200).json({
    message: "Notification dismissed.",
    notificationId: notificationSnapshot.id
  });
});

export default router;
