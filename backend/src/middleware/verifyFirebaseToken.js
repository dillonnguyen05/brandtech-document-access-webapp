import { adminAuth } from "../firebaseAdmin.js";

/**
 * Verifies the Firebase ID token sent by React in the Authorization header.
 * On success, the decoded Firebase user identity is attached to req.auth.
 */
async function verifyFirebaseToken(req, res, next) {
  const authorization = req.get("authorization");

  if (!authorization) {
    return res.status(401).json({
      error: "Authentication required."
    });
  }

  const [scheme, token, extra] = authorization.trim().split(/\s+/);

  if (scheme !== "Bearer" || !token || extra) {
    return res.status(401).json({
      error: "Authorization header must use Bearer token format."
    });
  }

  try {
    req.auth = await adminAuth.verifyIdToken(token);
    return next();
  } catch (error) {
    console.error(
      "Firebase ID token verification failed:",
      error.code || error.message
    );

    return res.status(401).json({
      error: "Invalid or expired authentication token."
    });
  }
}

export default verifyFirebaseToken;
