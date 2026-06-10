import { adminDb } from "../firebaseAdmin.js";

async function requireAdmin(req, res, next) {
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
    const isActiveAdmin = profile.role === "admin"
      && profile.status === "active";

    if (!isActiveAdmin) {
      return res.status(403).json({
        error: "Active administrator access required."
      });
    }

    req.userProfile = {
      id: profileSnapshot.id,
      ...profile
    };

    return next();
  } catch (error) {
    console.error(
      "Admin authorization check failed:",
      error.code || error.message
    );

    return res.status(500).json({
      error: "Unable to verify administrator access."
    });
  }
}

export default requireAdmin;
