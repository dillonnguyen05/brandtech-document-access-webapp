import express from "express";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebaseAdmin.js";

const router = express.Router();

function createRouteError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
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

export default router;
