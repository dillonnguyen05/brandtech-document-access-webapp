import express from "express";

import { adminDb } from "../firebaseAdmin.js";

const router = express.Router();

/**
 * Converts Firestore Timestamp values into ISO strings for React.
 */
function timestampToIso(value) {
  return typeof value?.toDate === "function"
    ? value.toDate().toISOString()
    : null;
}

/**
 * Returns the signed-in user's Firestore profile using the verified Firebase token.
 */
router.get("/profile", async (req, res) => {
  const uid = req.auth?.uid;

  if (!uid) {
    return res.status(401).json({
      error: "Authentication required."
    });
  }

  const profileSnapshot = await adminDb.collection("users").doc(uid).get();

  if (!profileSnapshot.exists) {
    return res.status(404).json({
      error: "No user profile found. Ask an admin to finish setting up this account."
    });
  }

  const profile = profileSnapshot.data();

  res.status(200).json({
    user: {
      id: profileSnapshot.id,
      ...profile,
      email: req.auth.email || profile.email || "",
      emailVerified: req.auth.email_verified === true,
      createdAt: timestampToIso(profile.createdAt),
      approvedAt: timestampToIso(profile.approvedAt),
      deniedAt: timestampToIso(profile.deniedAt),
      revokedAt: timestampToIso(profile.revokedAt)
    }
  });
});

export default router;
