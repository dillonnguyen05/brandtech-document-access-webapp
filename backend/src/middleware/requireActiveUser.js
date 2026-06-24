import { adminDb } from "../firebaseAdmin.js";

/**
 * Loads the signed-in user's Firestore profile and blocks inactive accounts.
 * Customer accounts must also have a verified Firebase Auth email.
 */
async function requireActiveUser(req, res, next) {
  const uid = req.auth?.uid;

  if (!uid) {
    return res.status(401).json({
      error: "Authentication required."
    });
  }

  try {
    const profileSnapshot = await adminDb.collection("users").doc(uid).get();

    if (!profileSnapshot.exists) {
      return res.status(403).json({
        error: "User profile not found."
      });
    }

    const profile = profileSnapshot.data();

    if (profile.status !== "active") {
      return res.status(403).json({
        error: "An active account is required."
      });
    }

    if (profile.role === "customer" && req.auth.email_verified !== true) {
      return res.status(403).json({
        error: "A verified email address is required."
      });
    }

    req.userProfile = {
      id: profileSnapshot.id,
      ...profile
    };

    return next();
  } catch (error) {
    console.error(
      "Active user authorization check failed:",
      error.code || error.message
    );

    return res.status(500).json({
      error: "Unable to verify account access."
    });
  }
}

export default requireActiveUser;
