import express from "express";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebaseAdmin.js";

const router = express.Router();

function createRouteError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseCoordinate(value, label, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < min || number > max) {
    throw createRouteError(400, `${label} is required for registration.`);
  }

  return number;
}

function parseAccuracy(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw createRouteError(400, "Location accuracy is required for registration.");
  }

  return number;
}

function parseCapturedAt(value) {
  const timestamp = Number(value);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const date = new Date(timestamp);

  return Number.isNaN(date.getTime()) ? null : date;
}

function requireRegistrationLocation(location) {
  if (!location || typeof location !== "object") {
    throw createRouteError(
      400,
      "Location permission is required to register for this portal."
    );
  }

  return {
    latitude: parseCoordinate(location.latitude, "Latitude", -90, 90),
    longitude: parseCoordinate(location.longitude, "Longitude", -180, 180),
    accuracy: parseAccuracy(location.accuracy),
    capturedAt: parseCapturedAt(location.timestamp),
    source: "browser-geolocation"
  };
}

router.post("/customer-profile", async (req, res) => {
  const uid = req.auth?.uid;
  const email = req.auth?.email || cleanText(req.body.email);

  if (!uid || !email) {
    throw createRouteError(401, "A signed-in Firebase account is required.");
  }

  const name = cleanText(req.body.fullName || req.body.name);
  const company = cleanText(req.body.company);
  const phone = cleanText(req.body.phone);

  if (!name) {
    throw createRouteError(400, "Full name is required.");
  }

  if (!company) {
    throw createRouteError(400, "Company name is required.");
  }

  if (!phone) {
    throw createRouteError(400, "Phone number is required.");
  }

  const registrationLocation = {
    ...requireRegistrationLocation(req.body.registrationLocation),
    ipAddress: req.ip || req.socket.remoteAddress || "",
    userAgent: req.get("user-agent") || ""
  };
  const userRef = adminDb.collection("users").doc(uid);
  const auditRef = adminDb.collection("auditLog").doc();

  await adminDb.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);

    if (userSnapshot.exists) {
      throw createRouteError(409, "A customer profile already exists for this account.");
    }

    transaction.set(userRef, {
      name,
      email,
      company,
      phone,
      role: "customer",
      status: "pending",
      accountMessage: "",
      emailVerified: req.auth.email_verified === true,
      registrationLocation,
      createdAt: FieldValue.serverTimestamp()
    });

    transaction.set(auditRef, {
      customerId: uid,
      customer: name,
      company,
      document: "Customer Account",
      action: "Account Registered",
      reason: "Customer submitted registration with location.",
      adminId: "",
      admin: "",
      adminEmail: "",
      requestId: "",
      registrationLocation,
      createdAt: FieldValue.serverTimestamp()
    });
  });

  res.status(201).json({
    message: "Customer profile created and pending admin approval.",
    user: {
      id: uid,
      name,
      email,
      company,
      phone,
      role: "customer",
      status: "pending",
      emailVerified: req.auth.email_verified === true
    }
  });
});

export default router;
