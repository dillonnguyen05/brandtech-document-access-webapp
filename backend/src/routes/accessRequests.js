import express from "express";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebaseAdmin.js";

const router = express.Router();
const customerAccessRequestsRouter = express.Router();

// Centralizes how each admin decision changes status, notifications, and audit labels.
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
    requiresMessage: true,
    message: (title, decisionMessage) => (
      `Your request for ${title} was denied. Reason: ${decisionMessage}`
    )
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
    requiresMessage: true,
    message: (title, decisionMessage) => (
      `Your access to ${title} has been revoked. Reason: ${decisionMessage}`
    )
  }
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
 * Reads and validates the optional/required admin decision message.
 */
function getDecisionMessage(req, config) {
  const message = typeof req.body.message === "string"
    ? req.body.message.trim()
    : "";

  if (config.requiresMessage && !message) {
    throw createRouteError(400, "A message explaining this decision is required.");
  }

  if (message.length > 500) {
    throw createRouteError(400, "The decision message must be 500 characters or fewer.");
  }

  return message;
}

/**
 * Converts Firestore Timestamp values into ISO strings for React.
 */
function timestampToIso(value) {
  return typeof value?.toDate === "function"
    ? value.toDate().toISOString()
    : null;
}

/**
 * Shapes an access request document for the admin/customer dashboards.
 */
function formatRequestSnapshot(requestSnapshot) {
  const data = requestSnapshot.data();

  return {
    id: requestSnapshot.id,
    ...data,
    createdAt: timestampToIso(data.createdAt),
    reviewedAt: timestampToIso(data.reviewedAt)
  };
}

/**
 * Normalizes the current admin identity for audit records.
 */
function adminIdentity(req) {
  return {
    id: req.auth.uid,
    name: req.userProfile.name || req.auth.email || "Admin",
    email: req.auth.email || req.userProfile.email || ""
  };
}

/**
 * Checks whether a document's target rules include this customer or company.
 */
function documentTargetsCustomer(document, customerId, company) {
  if (!document.targetType || document.targetType === "all") {
    return true;
  }

  if (document.targetType === "company") {
    return Boolean(company) && document.targetCompany === company;
  }

  if (document.targetType === "customer") {
    return document.targetCustomerId === customerId;
  }

  return false;
}

/**
 * Applies approve, deny, grant, or revoke decisions inside one Firestore transaction.
 */
async function updateAccessDecision(req, action) {
  const config = decisionConfig[action];
  const { requestId } = req.params;
  const admin = adminIdentity(req);
  const decisionMessage = getDecisionMessage(req, config);
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
      lastAction: action,
      decisionMessage
    });

    transaction.set(notificationRef, {
      recipientId: accessRequest.customerId,
      recipientName: accessRequest.customerName || "",
      recipientEmail: accessRequest.customerEmail || "",
      type: config.notificationType,
      message: config.message(documentTitle, decisionMessage),
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
      reason: decisionMessage,
      adminId: admin.id,
      admin: admin.name,
      adminEmail: admin.email,
      requestId,
      createdAt: FieldValue.serverTimestamp()
    });
  });

  return config.nextStatus;
}

// Lists access requests oldest first so admins can review the queue fairly.
router.get("/", async (req, res) => {
  const snapshot = await adminDb
    .collection("accessRequests")
    .orderBy("createdAt", "asc")
    .get();

  const requests = snapshot.docs.map(formatRequestSnapshot);

  res.status(200).json({ requests });
});

// Approves a pending customer request for a document.
router.post("/:requestId/approve", async (req, res) => {
  const status = await updateAccessDecision(req, "approve");

  res.status(200).json({
    message: "Access request approved.",
    requestId: req.params.requestId,
    status
  });
});

// Denies a pending request and requires an admin message for the customer.
router.post("/:requestId/deny", async (req, res) => {
  const status = await updateAccessDecision(req, "deny");

  res.status(200).json({
    message: "Access request denied.",
    requestId: req.params.requestId,
    status
  });
});

// Restores access after a denial or revocation.
router.post("/:requestId/grant", async (req, res) => {
  const status = await updateAccessDecision(req, "grant");

  res.status(200).json({
    message: "Document access granted.",
    requestId: req.params.requestId,
    status
  });
});

// Revokes a previously approved document access request.
router.post("/:requestId/revoke", async (req, res) => {
  const status = await updateAccessDecision(req, "revoke");

  res.status(200).json({
    message: "Document access revoked.",
    requestId: req.params.requestId,
    status
  });
});

// Lets active customers request access to documents assigned to them or their company.
customerAccessRequestsRouter.post("/", async (req, res) => {
  const documentId = typeof req.body.documentId === "string"
    ? req.body.documentId.trim()
    : "";

  if (!documentId) {
    throw createRouteError(400, "Select a document before requesting access.");
  }

  const customerId = req.auth.uid;
  const customer = req.userProfile;
  const requestId = `${customerId}_${documentId}`;
  const documentRef = adminDb.collection("documents").doc(documentId);
  const requestRef = adminDb.collection("accessRequests").doc(requestId);

  await adminDb.runTransaction(async (transaction) => {
    const [documentSnapshot, requestSnapshot] = await Promise.all([
      transaction.get(documentRef),
      transaction.get(requestRef)
    ]);

    if (!documentSnapshot.exists) {
      throw createRouteError(404, "Document not found.");
    }

    const document = documentSnapshot.data();

    if (document.active === false) {
      throw createRouteError(409, "This document is no longer active.");
    }

    if (!documentTargetsCustomer(document, customerId, customer.company || "")) {
      throw createRouteError(403, "This document is not assigned to your account.");
    }

    if (requestSnapshot.exists) {
      const currentStatus = requestSnapshot.data().status;

      if (currentStatus === "pending" || currentStatus === "approved") {
        throw createRouteError(
          409,
          `This document request is already ${currentStatus}.`
        );
      }
    }

    transaction.set(requestRef, {
      customerId,
      customerName: customer.name || "",
      customerEmail: req.auth.email || customer.email || "",
      company: customer.company || "",
      documentId,
      documentTitle: document.title || document.fileName || "Untitled Document",
      documentCategory: document.category || "Uncategorized",
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      reviewedAt: null,
      reviewedBy: null,
      reviewedByName: null,
      lastAction: "requested",
      decisionMessage: ""
    });
  });

  res.status(201).json({
    message: "Access request submitted.",
    requestId,
    status: "pending"
  });
});

export {
  customerAccessRequestsRouter
};
export default router;
