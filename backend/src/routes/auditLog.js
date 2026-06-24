import express from "express";

import { adminDb } from "../firebaseAdmin.js";

const router = express.Router();

/**
 * Converts Firestore Timestamp values to ISO strings for frontend formatting.
 */
function timestampToIso(value) {
  return typeof value?.toDate === "function"
    ? value.toDate().toISOString()
    : null;
}

/**
 * Returns the latest audit log records for the admin dashboard.
 */
router.get("/", async (req, res) => {
  const snapshot = await adminDb
    .collection("auditLog")
    .orderBy("createdAt", "desc")
    .limit(250)
    .get();

  const auditLog = snapshot.docs.map((auditSnapshot) => {
    const data = auditSnapshot.data();

    return {
      id: auditSnapshot.id,
      ...data,
      createdAt: timestampToIso(data.createdAt)
    };
  });

  res.status(200).json({ auditLog });
});

export default router;
