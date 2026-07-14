import express from "express";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebaseAdmin.js";

const router = express.Router();
const ACCESS_REQUEST_SETTINGS_ID = "accessRequests";
const DEFAULT_ACCESS_REQUEST_SETTINGS = {
  reviewWindowDays: 7,
  defaultAccessDurationDays: 0
};

/**
 * Creates route errors with HTTP status codes for the shared Express error handler.
 */
function createRouteError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Converts setting values into safe integers inside an allowed range.
 */
function toIntegerInRange(value, fallback, min, max) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) {
    return fallback;
  }

  return numberValue;
}

/**
 * Normalizes Firestore settings and supplies defaults when no settings exist yet.
 */
function normalizeAccessRequestSettings(data = {}) {
  return {
    reviewWindowDays: toIntegerInRange(
      data.reviewWindowDays,
      DEFAULT_ACCESS_REQUEST_SETTINGS.reviewWindowDays,
      1,
      90
    ),
    defaultAccessDurationDays: toIntegerInRange(
      data.defaultAccessDurationDays,
      DEFAULT_ACCESS_REQUEST_SETTINGS.defaultAccessDurationDays,
      0,
      3650
    )
  };
}

/**
 * Loads saved access request defaults for the admin settings page and backend decisions.
 */
async function loadAccessRequestSettings() {
  const settingsSnapshot = await adminDb
    .collection("appSettings")
    .doc(ACCESS_REQUEST_SETTINGS_ID)
    .get();

  return normalizeAccessRequestSettings(
    settingsSnapshot.exists ? settingsSnapshot.data() : {}
  );
}

/**
 * Returns the saved access request defaults to active admins and owners.
 */
router.get("/access-requests", async (req, res) => {
  const settings = await loadAccessRequestSettings();

  res.status(200).json({ settings });
});

/**
 * Saves access request defaults used by admin review and access approval flows.
 */
router.put("/access-requests", async (req, res) => {
  const reviewWindowDays = toIntegerInRange(req.body.reviewWindowDays, NaN, 1, 90);
  const defaultAccessDurationDays = toIntegerInRange(
    req.body.defaultAccessDurationDays,
    NaN,
    0,
    3650
  );

  if (Number.isNaN(reviewWindowDays)) {
    throw createRouteError(400, "Review window must be between 1 and 90 days.");
  }

  if (Number.isNaN(defaultAccessDurationDays)) {
    throw createRouteError(
      400,
      "Default access duration must be no expiry or between 1 and 3650 days."
    );
  }

  const settings = {
    reviewWindowDays,
    defaultAccessDurationDays,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: req.auth.uid,
    updatedByName: req.userProfile.name || req.auth.email || "Admin"
  };

  await adminDb
    .collection("appSettings")
    .doc(ACCESS_REQUEST_SETTINGS_ID)
    .set(settings, { merge: true });

  res.status(200).json({
    message: "Access request defaults saved.",
    settings: normalizeAccessRequestSettings(settings)
  });
});

export {
  loadAccessRequestSettings
};
export default router;
