import express from "express";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebaseAdmin.js";

const router = express.Router();

const decisionConfig = {
  approve: {
    allowedStatuses: ["pending"],
    nextStatus: "approved",
    notificationType: "approved",
    auditAction: "Access Granted",
    message: (title) => `Your request for ${title} has been approved.`
  },
  deny: {
    allowedStatuses: ["pending"],
    nextStatus: "denied",
    notificationType: "denied",
    auditAction: "Access Denied",
    message: (title) => `Your request for ${title} was denied.`
  },
  grant: {
    allowedStatuses: ["denied", "revoked"],
    nextStatus: "approved",
    notificationType: "approved",
    auditAction: "Access Granted",
    message: (title) => `Access to ${title} has been granted.`
  },
  revoke: {
    allowedStatuses: ["approved"],
    nextStatus: "revoked",
    notificationType: "revoked",
    auditAction: "Access Revoked",
    message: (title) => `Your access to ${title} has been revoked.`
  }
};

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

function formatRequestSnapshot(requestSnapshot) {
  const data = requestSnapshot.data();

  return {
    id: requestSnapshot.id,
    ...data,
    createdAt: timestampToIso(data.createdAt),
    reviewedAt: timestampToIso(data.reviewedAt)
  };
}

function adminIdentity(req) {
  return {
    id: req.auth.uid,
    name: req.userProfile.name || req.auth.email || "Admin",
    email: req.auth.email || req.userProfile.email || ""
  };
}

async function updateAccessDecision(req, action) {
  const config = decisionConfig[action];
  const { requestId } = req.params;
  const admin = adminIdentity(req);
  const requestRef = adminDb.collection("accessRequests").doc(requestId);
  const notificationRef = adminDb.collection("notifications").doc();
  const auditRef = adminDb.collection("auditLog").doc();

  await adminDb.runTransaction(async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);

    if (!requestSnapshot.exists) {
      throw createRouteError(404, "Access request not found.");
    }

    const accessRequest = requestSnapshot.data();
    const currentStatus = accessRequest.status || "unknown";

    if (!config.allowedStatuses.includes(currentStatus)) {
      throw createRouteError(
        409,
        `Cannot ${action} an access request with status ${currentStatus}.`
      );
    }

    if (!accessRequest.customerId) {
      throw createRouteError(
        422,
        "Access request does not contain a customer ID."
      );
    }

    const documentTitle = accessRequest.documentTitle || "the document";

    transaction.update(requestRef, {
      status: config.nextStatus,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: admin.id,
      reviewedByName: admin.name,
      lastAction: action
    });

    transaction.set(notificationRef, {
      recipientId: accessRequest.customerId,
      recipientName: accessRequest.customerName || "",
      recipientEmail: accessRequest.customerEmail || "",
      type: config.notificationType,
      message: config.message(documentTitle),
      documentId: accessRequest.documentId || "",
      documentTitle,
      requestId,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });

    transaction.set(auditRef, {
      customerId: accessRequest.customerId,
      customer: accessRequest.customerName || "",
      company: accessRequest.company || "",
      documentId: accessRequest.documentId || "",
      document: documentTitle,
      action: config.auditAction,
      adminId: admin.id,
      admin: admin.name,
      adminEmail: admin.email,
      requestId,
      createdAt: FieldValue.serverTimestamp()
    });
  });

  return config.nextStatus;
}

router.get("/", async (req, res) => {
  const snapshot = await adminDb
    .collection("accessRequests")
    .orderBy("createdAt", "desc")
    .get();

  const requests = snapshot.docs.map(formatRequestSnapshot);

  res.status(200).json({ requests });
});

router.post("/:requestId/approve", async (req, res) => {
  const status = await updateAccessDecision(req, "approve");

  res.status(200).json({
    message: "Access request approved.",
    requestId: req.params.requestId,
    status
  });
});

router.post("/:requestId/deny", async (req, res) => {
  const status = await updateAccessDecision(req, "deny");

  res.status(200).json({
    message: "Access request denied.",
    requestId: req.params.requestId,
    status
  });
});

router.post("/:requestId/grant", async (req, res) => {
  const status = await updateAccessDecision(req, "grant");

  res.status(200).json({
    message: "Document access granted.",
    requestId: req.params.requestId,
    status
  });
});

router.post("/:requestId/revoke", async (req, res) => {
  const status = await updateAccessDecision(req, "revoke");

  res.status(200).json({
    message: "Document access revoked.",
    requestId: req.params.requestId,
    status
  });
});

export default router;
