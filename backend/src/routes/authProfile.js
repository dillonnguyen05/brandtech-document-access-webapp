import express from "express";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import multer from "multer";

import { adminDb, adminStorage } from "../firebaseAdmin.js";

const router = express.Router();
const MAX_PROFILE_PHOTO_SIZE = 2 * 1024 * 1024;
const ALLOWED_PROFILE_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

/**
 * Rejects non-image profile photos before they reach Firebase Storage.
 */
function validateProfilePhoto(req, file, callback) {
  if (!ALLOWED_PROFILE_PHOTO_TYPES.has(file.mimetype)) {
    const error = new Error("Profile photo must be a JPG, PNG, WebP, or GIF image.");
    error.status = 400;
    callback(error);
    return;
  }

  callback(null, true);
}

// Stores the selected avatar in memory briefly so Express can validate and upload it.
const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PROFILE_PHOTO_SIZE,
    files: 1
  },
  fileFilter: validateProfilePhoto
});

/**
 * Converts Firestore Timestamp values into ISO strings for React.
 */
function timestampToIso(value) {
  return typeof value?.toDate === "function"
    ? value.toDate().toISOString()
    : null;
}

/**
 * Keeps uploaded profile-photo file names safe for Firebase Storage paths.
 */
function safeFileName(fileName = "profile-photo") {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

/**
 * Converts a stored Firestore user profile into the shape React expects.
 */
function formatProfile(profileSnapshot, authUser) {
  const profile = profileSnapshot.data();

  return {
    id: profileSnapshot.id,
    ...profile,
    email: authUser.email || profile.email || "",
    emailVerified: authUser.email_verified === true,
    createdAt: timestampToIso(profile.createdAt),
    approvedAt: timestampToIso(profile.approvedAt),
    deniedAt: timestampToIso(profile.deniedAt),
    revokedAt: timestampToIso(profile.revokedAt),
    profilePhotoUpdatedAt: timestampToIso(profile.profilePhotoUpdatedAt)
  };
}

/**
 * Loads the current user's Firestore profile or returns a 404 response.
 */
async function loadCurrentProfile(req, res) {
  const uid = req.auth?.uid;

  if (!uid) {
    res.status(401).json({
      error: "Authentication required."
    });
    return null;
  }

  const profileSnapshot = await adminDb.collection("users").doc(uid).get();

  if (!profileSnapshot.exists) {
    res.status(404).json({
      error: "No user profile found. Ask an admin to finish setting up this account."
    });
    return null;
  }

  return profileSnapshot;
}

/**
 * Builds a Firebase Storage download URL using a generated token.
 */
function firebaseDownloadUrl(bucketName, filePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
}

/**
 * Returns the signed-in user's Firestore profile using the verified Firebase token.
 */
router.get("/profile", async (req, res) => {
  const profileSnapshot = await loadCurrentProfile(req, res);

  if (!profileSnapshot) return;

  res.status(200).json({
    user: formatProfile(profileSnapshot, req.auth)
  });
});

/**
 * Uploads and saves the signed-in user's profile photo.
 */
router.post("/profile-photo", profilePhotoUpload.single("photo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "Select a profile photo to upload."
    });
  }

  const profileSnapshot = await loadCurrentProfile(req, res);

  if (!profileSnapshot) return;

  const profile = profileSnapshot.data();

  if (profile.status !== "active") {
    return res.status(403).json({
      error: "An active account is required."
    });
  }

  const bucket = adminStorage.bucket();
  const token = randomUUID();
  const filePath = `profile-photos/${profileSnapshot.id}/${Date.now()}-${randomUUID()}-${safeFileName(req.file.originalname)}`;
  const storageFile = bucket.file(filePath);

  await storageFile.save(req.file.buffer, {
    resumable: false,
    metadata: {
      contentType: req.file.mimetype,
      metadata: {
        firebaseStorageDownloadTokens: token
      }
    }
  });

  if (profile.profilePhotoPath && profile.profilePhotoPath !== filePath) {
    await bucket.file(profile.profilePhotoPath).delete({ ignoreNotFound: true });
  }

  const profilePhotoUrl = firebaseDownloadUrl(bucket.name, filePath, token);

  await profileSnapshot.ref.update({
    profilePhotoUrl,
    profilePhotoPath: filePath,
    profilePhotoUpdatedAt: FieldValue.serverTimestamp()
  });

  const updatedProfileSnapshot = await profileSnapshot.ref.get();

  return res.status(200).json({
    message: "Profile photo saved.",
    user: formatProfile(updatedProfileSnapshot, req.auth)
  });
});

/**
 * Removes the signed-in user's saved profile photo.
 */
router.delete("/profile-photo", async (req, res) => {
  const profileSnapshot = await loadCurrentProfile(req, res);

  if (!profileSnapshot) return;

  const profile = profileSnapshot.data();

  if (profile.status !== "active") {
    return res.status(403).json({
      error: "An active account is required."
    });
  }

  if (profile.profilePhotoPath) {
    await adminStorage
      .bucket()
      .file(profile.profilePhotoPath)
      .delete({ ignoreNotFound: true });
  }

  await profileSnapshot.ref.update({
    profilePhotoUrl: FieldValue.delete(),
    profilePhotoPath: FieldValue.delete(),
    profilePhotoUpdatedAt: FieldValue.serverTimestamp()
  });

  const updatedProfileSnapshot = await profileSnapshot.ref.get();

  return res.status(200).json({
    message: "Profile photo removed.",
    user: formatProfile(updatedProfileSnapshot, req.auth)
  });
});

export default router;
