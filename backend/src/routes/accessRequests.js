import express from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb } from "../firebaseAdmin.js";
import { loadAccessRequestSettings } from "./settings.js";

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
 * Sanitizes document ID arrays before saving folder-level access exclusions.
 */
function cleanDocumentIds(value) {
  if (!Array.isArray(value)) return [];

  return [...new Set(value
    .map((documentId) => String(documentId || "").trim())
    .filter(Boolean)
  )];
}

/**
 * Converts Firestore Timestamp values into ISO strings for React.
 */
function timestampToIso(value) {
  const date = timestampToDate(value);

  return date ? date.toISOString() : null;
}

/**
 * Converts Firestore Timestamp or Date values into Date objects.
 */
function timestampToDate(value) {
  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  return null;
}

/**
 * Calculates the review due date using the saved admin review window.
 */
function reviewDueDate(createdAt, reviewWindowDays) {
  const createdDate = timestampToDate(createdAt);

  if (!createdDate) return null;

  return new Date(
    createdDate.getTime() + (reviewWindowDays * 24 * 60 * 60 * 1000)
  );
}

/**
 * Calculates the access expiration timestamp from saved admin defaults.
 */
function accessExpirationTimestamp(defaultAccessDurationDays) {
  if (!defaultAccessDurationDays) return null;

  return Timestamp.fromDate(
    new Date(Date.now() + (defaultAccessDurationDays * 24 * 60 * 60 * 1000))
  );
}

/**
 * Checks whether an approved request has passed its optional access expiration.
 */
function accessRequestExpired(accessRequest) {
  const expiresAt = timestampToDate(accessRequest.accessExpiresAt);

  return Boolean(expiresAt && expiresAt.getTime() <= Date.now());
}

/**
 * Checks whether an existing request should block a duplicate customer request.
 */
function requestBlocksNewSubmission(accessRequest) {
  if (accessRequest.status === "pending") return true;

  return accessRequest.status === "approved" && !accessRequestExpired(accessRequest);
}

/**
 * Shapes an access request document for the admin/customer dashboards.
 */
function formatRequestSnapshot(requestSnapshot, settings = {}) {
  const data = requestSnapshot.data();
  const resourceType = data.resourceType || (data.folderId ? "folder" : "document");
  const reviewWindowDays = settings.reviewWindowDays || 7;
  const dueDate = data.status === "pending"
    ? reviewDueDate(data.createdAt, reviewWindowDays)
    : null;

  return {
    id: requestSnapshot.id,
    ...data,
    resourceType,
    createdAt: timestampToIso(data.createdAt),
    reviewedAt: timestampToIso(data.reviewedAt),
    reviewDueAt: dueDate ? dueDate.toISOString() : null,
    reviewOverdue: Boolean(dueDate && dueDate.getTime() < Date.now()),
    reviewWindowDays,
    accessExpiresAt: timestampToIso(data.accessExpiresAt),
    defaultAccessDurationDays: data.defaultAccessDurationDays || 0
  };
}

/**
 * Loads customer profile fields that are useful in admin access-request tables.
 */
async function loadCustomerProfiles(customerIds) {
  const uniqueCustomerIds = [...new Set(customerIds.filter(Boolean))];
  const profiles = new Map();

  if (uniqueCustomerIds.length === 0) return profiles;

  const profileSnapshots = await adminDb.getAll(
    ...uniqueCustomerIds.map((customerId) => adminDb.collection("users").doc(customerId))
  );

  profileSnapshots.forEach((profileSnapshot) => {
    if (!profileSnapshot.exists) return;

    const profile = profileSnapshot.data();

    profiles.set(profileSnapshot.id, {
      name: profile.name || "",
      email: profile.email || "",
      company: profile.company || "",
      profilePhotoUrl: profile.profilePhotoUrl || ""
    });
  });

  return profiles;
}

/**
 * Merges latest customer profile display data into an access request row.
 */
function attachCustomerProfile(request, customerProfiles) {
  const profile = customerProfiles.get(request.customerId);

  if (!profile) {
    return {
      ...request,
      customerProfilePhotoUrl: request.customerProfilePhotoUrl || ""
    };
  }

  return {
    ...request,
    customerName: profile.name || request.customerName || "",
    customerEmail: profile.email || request.customerEmail || "",
    company: profile.company || request.company || "",
    customerProfilePhotoUrl: profile.profilePhotoUrl || request.customerProfilePhotoUrl || ""
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
 * Checks if a document lives directly inside a folder or one of its subfolders.
 */
function folderContainsDocument(folder, document) {
  const folderPath = folder.path || "";
  const documentFolderPath = document.folderPath || "";

  if (!folderPath) return true;

  return documentFolderPath === folderPath
    || documentFolderPath.startsWith(`${folderPath}/`);
}

/**
 * Checks whether a document sits inside an approved folder request's subtree.
 */
function folderRequestContainsDocument(accessRequest, document) {
  const requestFolderPath = accessRequest.folderPath || "";
  const documentFolderPath = document.folderPath || "";

  if (!requestFolderPath) return true;

  return documentFolderPath === requestFolderPath
    || documentFolderPath.startsWith(`${requestFolderPath}/`);
}

/**
 * Counts active documents in a folder subtree that are assigned to the customer.
 */
async function countTargetableFolderDocuments(folder, customerId, company) {
  const snapshot = await adminDb.collection("documents").get();

  return snapshot.docs.filter((documentSnapshot) => {
    const document = documentSnapshot.data();

    return document.active !== false
      && document.shareEnabled !== false
      && folderContainsDocument(folder, document)
      && documentTargetsCustomer(document, customerId, company);
  }).length;
}

/**
 * Validates selected folder-request exclusions before approval or later edits.
 */
async function resolveFolderExclusions(accessRequest, excludedDocumentIds, options = {}) {
  const { requireIncludedDocument = false } = options;
  const documentSnapshot = await adminDb.collection("documents").get();
  const folderDocuments = documentSnapshot.docs.filter((document) => {
    const data = document.data();

    return data.active !== false
      && data.shareEnabled !== false
      && folderRequestContainsDocument(accessRequest, data)
      && documentTargetsCustomer(
        data,
        accessRequest.customerId,
        accessRequest.company || ""
      );
  });
  const folderDocumentIds = new Set(folderDocuments.map((document) => document.id));
  const validExcludedDocumentIds = excludedDocumentIds.filter((documentId) => (
    folderDocumentIds.has(documentId)
  ));

  if (validExcludedDocumentIds.length !== excludedDocumentIds.length) {
    throw createRouteError(400, "Only documents inside this folder request can be rejected.");
  }

  if (requireIncludedDocument && folderDocumentIds.size === 0) {
    throw createRouteError(
      409,
      "This folder no longer contains requestable documents."
    );
  }

  if (
    requireIncludedDocument
    && validExcludedDocumentIds.length >= folderDocumentIds.size
  ) {
    throw createRouteError(
      400,
      "Approve at least one document, or deny the folder request instead."
    );
  }

  return {
    excludedDocumentIds: validExcludedDocumentIds,
    excludedDocumentCount: validExcludedDocumentIds.length,
    includedDocumentCount: folderDocumentIds.size - validExcludedDocumentIds.length,
    totalDocumentCount: folderDocumentIds.size
  };
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
  const requestedExcludedDocumentIds = cleanDocumentIds(req.body.excludedDocumentIds);
  const preflightSnapshot = await requestRef.get();
  const settings = (action === "approve" || action === "grant")
    ? await loadAccessRequestSettings()
    : null;
  const accessExpiresAt = settings
    ? accessExpirationTimestamp(settings.defaultAccessDurationDays)
    : null;

  if (!preflightSnapshot.exists) {
    throw createRouteError(404, "Access request not found.");
  }

  const preflightRequest = preflightSnapshot.data();
  const preflightResourceType = preflightRequest.resourceType
    || (preflightRequest.folderId ? "folder" : "document");

  if (requestedExcludedDocumentIds.length > 0 && preflightResourceType !== "folder") {
    throw createRouteError(400, "Only folder requests can reject nested documents.");
  }

  const folderScope = (
    preflightResourceType === "folder"
    && (action === "approve" || action === "grant")
  )
    ? await resolveFolderExclusions(
      preflightRequest,
      requestedExcludedDocumentIds,
      { requireIncludedDocument: action === "approve" }
    )
    : null;

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

    const resourceType = accessRequest.resourceType || (accessRequest.folderId ? "folder" : "document");
    const documentTitle = accessRequest.documentTitle
      || accessRequest.folderName
      || (resourceType === "folder" ? "the folder" : "the document");
    const partialFolderApproval = folderScope && folderScope.excludedDocumentCount > 0;
    const notificationMessage = partialFolderApproval
      ? `Your request for ${documentTitle} was approved for ${folderScope.includedDocumentCount} document(s). ${folderScope.excludedDocumentCount} document(s) were not included.`
      : config.message(documentTitle, decisionMessage);
    const auditReason = partialFolderApproval
      ? `${folderScope.includedDocumentCount} of ${folderScope.totalDocumentCount} nested document(s) approved; ${folderScope.excludedDocumentCount} rejected from folder access.`
      : decisionMessage;
    const requestUpdate = {
      status: config.nextStatus,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: admin.id,
      reviewedByName: admin.name,
      lastAction: action,
      decisionMessage
    };

    if (config.nextStatus === "approved") {
      requestUpdate.defaultAccessDurationDays = settings.defaultAccessDurationDays;
      requestUpdate.accessExpiresAt = accessExpiresAt;
    } else {
      requestUpdate.defaultAccessDurationDays = 0;
      requestUpdate.accessExpiresAt = null;
    }

    if (folderScope) {
      requestUpdate.excludedDocumentIds = folderScope.excludedDocumentIds;
      requestUpdate.excludedDocumentCount = folderScope.excludedDocumentCount;
      requestUpdate.approvedDocumentCount = folderScope.includedDocumentCount;
      requestUpdate.folderDocumentCount = folderScope.totalDocumentCount;
    }

    transaction.update(requestRef, requestUpdate);

    transaction.set(notificationRef, {
      recipientId: accessRequest.customerId,
      recipientName: accessRequest.customerName || "",
      recipientEmail: accessRequest.customerEmail || "",
      type: config.notificationType,
      message: notificationMessage,
      resourceType,
      documentId: accessRequest.documentId || "",
      folderId: accessRequest.folderId || "",
      folderPath: accessRequest.folderPath || "",
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
      folderId: accessRequest.folderId || "",
      resourceType,
      document: documentTitle,
      action: config.auditAction,
      reason: auditReason,
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
  const [snapshot, settings] = await Promise.all([
    adminDb
      .collection("accessRequests")
      .orderBy("createdAt", "asc")
      .get(),
    loadAccessRequestSettings()
  ]);

  const formattedRequests = snapshot.docs.map((requestSnapshot) => (
    formatRequestSnapshot(requestSnapshot, settings)
  ));
  const customerProfiles = await loadCustomerProfiles(
    formattedRequests.map((request) => request.customerId)
  );
  const requests = formattedRequests.map((request) => (
    attachCustomerProfile(request, customerProfiles)
  ));

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

// Updates which documents are excluded from an approved folder access request.
router.patch("/:requestId/exclusions", async (req, res) => {
  const excludedDocumentIds = cleanDocumentIds(req.body.excludedDocumentIds);
  const requestRef = adminDb
    .collection("accessRequests")
    .doc(req.params.requestId);
  const requestSnapshot = await requestRef.get();

  if (!requestSnapshot.exists) {
    throw createRouteError(404, "Access request not found.");
  }

  const accessRequest = requestSnapshot.data();
  const resourceType = accessRequest.resourceType || (accessRequest.folderId ? "folder" : "document");

  if (resourceType !== "folder") {
    throw createRouteError(400, "Only folder access can have document exclusions.");
  }

  if (accessRequest.status !== "approved") {
    throw createRouteError(409, "Only approved folder access can be changed.");
  }

  const folderScope = await resolveFolderExclusions(accessRequest, excludedDocumentIds);
  const validExcludedDocumentIds = folderScope.excludedDocumentIds;

  const admin = adminIdentity(req);
  const documentTitle = accessRequest.documentTitle
    || accessRequest.folderName
    || accessRequest.folderPath
    || "the folder";
  const notificationType = validExcludedDocumentIds.length > 0 ? "revoked" : "approved";
  const notificationMessage = validExcludedDocumentIds.length > 0
    ? `${validExcludedDocumentIds.length} document(s) were removed from your access to ${documentTitle}.`
    : `Your access to all shared documents inside ${documentTitle} has been restored.`;
  const auditMessage = validExcludedDocumentIds.length > 0
    ? `${validExcludedDocumentIds.length} nested document(s) unshared from this folder access.`
    : "All nested document exclusions were removed from this folder access.";
  const notificationRef = adminDb.collection("notifications").doc();
  const auditRef = adminDb.collection("auditLog").doc();
  const batch = adminDb.batch();

  batch.update(requestRef, {
    excludedDocumentIds: validExcludedDocumentIds,
    excludedDocumentCount: validExcludedDocumentIds.length,
    reviewedAt: FieldValue.serverTimestamp(),
    reviewedBy: admin.id,
    reviewedByName: admin.name,
    lastAction: "folder-exclusions-updated"
  });

  batch.set(notificationRef, {
    recipientId: accessRequest.customerId,
    recipientName: accessRequest.customerName || "",
    recipientEmail: accessRequest.customerEmail || "",
    type: notificationType,
    message: notificationMessage,
    resourceType: "folder",
    documentId: "",
    folderId: accessRequest.folderId || "",
    folderPath: accessRequest.folderPath || "",
    documentTitle,
    requestId: req.params.requestId,
    read: false,
    createdAt: FieldValue.serverTimestamp()
  });

  batch.set(auditRef, {
    customerId: accessRequest.customerId,
    customer: accessRequest.customerName || "",
    company: accessRequest.company || "",
    documentId: "",
    folderId: accessRequest.folderId || "",
    resourceType: "folder",
    document: documentTitle,
    action: "Folder Access Updated",
    reason: auditMessage,
    adminId: admin.id,
    admin: admin.name,
    adminEmail: admin.email,
    requestId: req.params.requestId,
    createdAt: FieldValue.serverTimestamp()
  });

  await batch.commit();

  const updatedRequestSnapshot = await requestRef.get();

  res.status(200).json({
    message: "Folder access updated.",
    request: formatRequestSnapshot(updatedRequestSnapshot)
  });
});

// Lists the current customer's request history through Express.
customerAccessRequestsRouter.get("/", async (req, res) => {
  const [snapshot, settings] = await Promise.all([
    adminDb
      .collection("accessRequests")
      .where("customerId", "==", req.auth.uid)
      .get(),
    loadAccessRequestSettings()
  ]);

  const requests = snapshot.docs
    .map((requestSnapshot) => formatRequestSnapshot(requestSnapshot, settings))
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  res.status(200).json({ requests });
});

// Lets active customers request access to documents or folders assigned to them or their company.
customerAccessRequestsRouter.post("/", async (req, res) => {
  const resourceType = req.body.resourceType === "folder" ? "folder" : "document";
  const documentId = typeof req.body.documentId === "string"
    ? req.body.documentId.trim()
    : "";
  const folderId = typeof req.body.folderId === "string"
    ? req.body.folderId.trim()
    : "";

  if (resourceType === "document" && !documentId) {
    throw createRouteError(400, "Select a document before requesting access.");
  }

  if (resourceType === "folder" && !folderId) {
    throw createRouteError(400, "Select a folder before requesting access.");
  }

  const customerId = req.auth.uid;
  const customer = req.userProfile;
  const company = customer.company || "";
  const requestId = resourceType === "folder"
    ? `${customerId}_folder_${folderId}`
    : `${customerId}_${documentId}`;
  const documentRef = resourceType === "document"
    ? adminDb.collection("documents").doc(documentId)
    : null;
  const folderRef = resourceType === "folder"
    ? adminDb.collection("documentFolders").doc(folderId)
    : null;
  const requestRef = adminDb.collection("accessRequests").doc(requestId);

  if (resourceType === "folder") {
    const folderSnapshot = await folderRef.get();

    if (!folderSnapshot.exists) {
      throw createRouteError(404, "Folder not found.");
    }

    const folder = {
      id: folderSnapshot.id,
      ...folderSnapshot.data()
    };
    const documentCount = await countTargetableFolderDocuments(
      folder,
      customerId,
      company
    );

    if (documentCount === 0) {
      throw createRouteError(
        403,
        "This folder does not contain documents assigned to your account."
      );
    }

    await adminDb.runTransaction(async (transaction) => {
      const requestSnapshot = await transaction.get(requestRef);

      if (requestSnapshot.exists) {
        const currentRequest = requestSnapshot.data();
        const currentStatus = currentRequest.status;

        if (requestBlocksNewSubmission(currentRequest)) {
          throw createRouteError(
            409,
            `This folder request is already ${currentStatus}.`
          );
        }
      }

      transaction.set(requestRef, {
        customerId,
        customerName: customer.name || "",
        customerEmail: req.auth.email || customer.email || "",
        company,
        resourceType: "folder",
        documentId: "",
        documentTitle: folder.path || folder.name || "Folder",
        documentCategory: "Folder",
        folderId,
        folderName: folder.name || "Folder",
        folderPath: folder.path || "",
        folderDocumentCount: documentCount,
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
      message: "Folder access request submitted.",
      requestId,
      status: "pending"
    });
    return;
  }

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

    if (document.shareEnabled === false) {
      throw createRouteError(403, "This document is not shared with customers.");
    }

    if (!documentTargetsCustomer(document, customerId, customer.company || "")) {
      throw createRouteError(403, "This document is not assigned to your account.");
    }

    if (requestSnapshot.exists) {
      const currentRequest = requestSnapshot.data();
      const currentStatus = currentRequest.status;

      if (requestBlocksNewSubmission(currentRequest)) {
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
      resourceType: "document",
      documentId,
      documentTitle: document.title || document.fileName || "Untitled Document",
      documentCategory: document.category || "Uncategorized",
      folderId: "",
      folderName: "",
      folderPath: "",
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
