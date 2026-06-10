import express from "express";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebaseAdmin.js";

const router = express.Router();

function createRouteError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function timestampToIso(value) {
  return typeof value?.toDate === "function"
    ? value.toDate().toISOString()
    : null;
}

function formatCustomerSnapshot(customerSnapshot) {
  const data = customerSnapshot.data();

  return {
    id: customerSnapshot.id,
    ...data,
    createdAt: timestampToIso(data.createdAt),
    approvedAt: timestampToIso(data.approvedAt),
    deniedAt: timestampToIso(data.deniedAt)
  };
}

function adminIdentity(req) {
  return {
    id: req.auth.uid,
    name: req.userProfile.name || req.auth.email || "Admin",
    email: req.auth.email || req.userProfile.email || ""
  };
}

async function reviewPendingCustomer(req, status) {
  const { userId } = req.params;
  const admin = adminIdentity(req);
  const userRef = adminDb.collection("users").doc(userId);
  const notificationRef = adminDb
    .collection("notifications")
    .doc(`${userId}_account-${status}`);
  const auditRef = adminDb.collection("auditLog").doc();
  const approved = status === "approved";

  await adminDb.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);

    if (!userSnapshot.exists) {
      throw createRouteError(404, "Customer account not found.");
    }

    const customer = userSnapshot.data();

    if (customer.role !== "customer") {
      throw createRouteError(400, "Only customer accounts can be reviewed.");
    }

    if (customer.status !== "pending") {
      throw createRouteError(
        409,
        `Customer account is already ${customer.status || "reviewed"}.`
      );
    }

    transaction.update(userRef, approved
      ? {
          status: "active",
          approvedAt: FieldValue.serverTimestamp(),
          approvedBy: admin.id,
          approvedByName: admin.name,
          deniedAt: null,
          deniedBy: null,
          deniedByName: null
        }
      : {
          status: "denied",
          deniedAt: FieldValue.serverTimestamp(),
          deniedBy: admin.id,
          deniedByName: admin.name,
          approvedAt: null,
          approvedBy: null,
          approvedByName: null
        });

    transaction.set(notificationRef, {
      recipientId: userId,
      recipientName: customer.name || "",
      recipientEmail: customer.email || "",
      type: approved ? "account-approved" : "account-denied",
      message: approved
        ? "Your account has been approved. You can now access the document portal."
        : "Your account request was denied. Contact BrandTech if you believe this is an error.",
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });

    transaction.set(auditRef, {
      customerId: userId,
      customer: customer.name || "",
      company: customer.company || "",
      document: "Customer Account",
      action: approved ? "Account Approved" : "Account Denied",
      adminId: admin.id,
      admin: admin.name,
      adminEmail: admin.email,
      requestId: "",
      createdAt: FieldValue.serverTimestamp()
    });
  });
}

router.get("/me", (req, res) => {
  res.status(200).json({
    uid: req.auth.uid,
    email: req.auth.email || null,
    role: req.userProfile.role,
    status: req.userProfile.status
  });
});

router.get("/pending", async (req, res) => {
  const snapshot = await adminDb
    .collection("users")
    .where("status", "==", "pending")
    .get();

  const users = snapshot.docs
    .filter((customerSnapshot) => customerSnapshot.data().role === "customer")
    .map(formatCustomerSnapshot)
    .sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      return bTime - aTime;
    });

  res.status(200).json({ users });
});

router.post("/:userId/approve", async (req, res) => {
  await reviewPendingCustomer(req, "approved");

  res.status(200).json({
    message: "Customer account approved.",
    userId: req.params.userId,
    status: "active"
  });
});

router.post("/:userId/deny", async (req, res) => {
  await reviewPendingCustomer(req, "denied");

  res.status(200).json({
    message: "Customer account denied.",
    userId: req.params.userId,
    status: "denied"
  });
});

export default router;
