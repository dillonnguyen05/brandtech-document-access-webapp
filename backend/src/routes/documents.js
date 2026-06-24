import express from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import multer from "multer";

import { adminDb, adminStorage } from "../firebaseAdmin.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const SIGNED_URL_LIFETIME_MS = 5 * 60 * 1000;
const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx"
]);
const ALLOWED_TARGET_TYPES = new Set(["all", "company", "customer"]);

// Stores uploads in memory briefly so Express can validate and pass them to Firebase Storage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      const error = new Error(
        "Only PDF, Word, Excel, and PowerPoint files are allowed."
      );
      error.status = 400;
      callback(error);
      return;
    }

    callback(null, true);
  }
});

const router = express.Router();
const documentAccessRouter = express.Router();

/**
 * Creates route errors with HTTP status codes for the shared Express error handler.
 */
function createRouteError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Trims text fields coming from multipart form data.
 */
function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Removes risky characters before using a name in Storage paths or download headers.
 */
function safeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
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
 * Removes private Storage fields before sending document metadata to the frontend.
 */
function formatDocumentSnapshot(documentSnapshot) {
  const data = documentSnapshot.data();
  const {
    downloadURL,
    storagePath,
    ...publicData
  } = data;

  return {
    id: documentSnapshot.id,
    ...publicData,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt)
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
 * Validates who a document is assigned to before creating or updating metadata.
 */
async function validateTarget(body) {
  const targetType = cleanText(body.targetType) || "all";

  if (!ALLOWED_TARGET_TYPES.has(targetType)) {
    throw createRouteError(400, "Invalid target audience.");
  }

  if (targetType === "customer") {
    const targetCustomerId = cleanText(body.targetCustomerId);

    if (!targetCustomerId) {
      throw createRouteError(400, "Select a target customer.");
    }

    const customerSnapshot = await adminDb
      .collection("users")
      .doc(targetCustomerId)
      .get();

    if (!customerSnapshot.exists) {
      throw createRouteError(400, "The selected customer does not exist.");
    }

    const customer = customerSnapshot.data();

    if (customer.role !== "customer" || customer.status !== "active") {
      throw createRouteError(400, "The selected customer is not active.");
    }

    return {
      targetType,
      targetCustomer: customer.name || customer.email || "Specific Customer",
      targetCompany: customer.company || "",
      targetCustomerId,
      targetCustomerName: customer.name || "",
      targetCustomerEmail: customer.email || ""
    };
  }

  if (targetType === "company") {
    const targetCompany = cleanText(body.targetCompany);

    if (!targetCompany) {
      throw createRouteError(400, "Select a target company.");
    }

    const companySnapshot = await adminDb
      .collection("users")
      .where("company", "==", targetCompany)
      .get();
    const hasActiveCustomer = companySnapshot.docs.some((userSnapshot) => {
      const profile = userSnapshot.data();
      return profile.role === "customer" && profile.status === "active";
    });

    if (!hasActiveCustomer) {
      throw createRouteError(
        400,
        "The selected company does not have an active customer."
      );
    }

    return {
      targetType,
      targetCustomer: targetCompany,
      targetCompany,
      targetCustomerId: "",
      targetCustomerName: "",
      targetCustomerEmail: ""
    };
  }

  return {
    targetType: "all",
    targetCustomer: "All Customers",
    targetCompany: "",
    targetCustomerId: "",
    targetCustomerName: "",
    targetCustomerEmail: ""
  };
}

/**
 * Removes old public download tokens so documents only use short-lived signed URLs.
 */
async function revokeLegacyDownloadLink(documentSnapshot) {
  const document = documentSnapshot.data();

  if (!document.downloadURL) return;

  if (document.storagePath) {
    await adminStorage
      .bucket()
      .file(document.storagePath)
      .setMetadata({
        metadata: {
          firebaseStorageDownloadTokens: randomUUID()
        }
      })
      .catch((error) => {
        console.error(
          `Unable to rotate legacy token for ${documentSnapshot.id}:`,
          error.message
        );
      });
  }

  await documentSnapshot.ref.update({
    downloadURL: FieldValue.delete()
  });
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

// Lists admin-visible document metadata and cleans up legacy public download links.
router.get("/", async (req, res) => {
  const snapshot = await adminDb
    .collection("documents")
    .orderBy("createdAt", "desc")
    .get();

  await Promise.all(snapshot.docs.map(revokeLegacyDownloadLink));

  res.status(200).json({
    documents: snapshot.docs.map(formatDocumentSnapshot)
  });
});

// Uploads a file to Storage, saves its metadata in Firestore, and writes an audit entry.
router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) {
    throw createRouteError(400, "Please select a file.");
  }

  const title = cleanText(req.body.title);

  if (!title) {
    throw createRouteError(400, "Document title is required.");
  }

  const target = await validateTarget(req.body);
  const bucket = adminStorage.bucket();
  const filePath = `files/${Date.now()}-${randomUUID()}-${safeFileName(req.file.originalname)}`;
  const storageFile = bucket.file(filePath);
  const admin = adminIdentity(req);

  await storageFile.save(req.file.buffer, {
    resumable: false,
    metadata: {
      contentType: req.file.mimetype || "application/octet-stream"
    }
  });

  try {
    const documentRef = adminDb.collection("documents").doc();
    const auditRef = adminDb.collection("auditLog").doc();
    const metadata = {
      title,
      type: cleanText(req.body.type) || "Other",
      category: cleanText(req.body.category) || "Uncategorized",
      ...target,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype || "application/octet-stream",
      storagePath: filePath,
      uploadedBy: admin.id,
      uploadedByName: admin.name,
      uploadedByEmail: admin.email,
      active: true,
      createdAt: FieldValue.serverTimestamp()
    };
    const batch = adminDb.batch();

    batch.set(documentRef, metadata);
    batch.set(auditRef, {
      customerId: "",
      customer: "",
      company: target.targetCompany || "",
      documentId: documentRef.id,
      document: title,
      action: "Document Uploaded",
      adminId: admin.id,
      admin: admin.name,
      adminEmail: admin.email,
      requestId: "",
      createdAt: FieldValue.serverTimestamp()
    });
    await batch.commit();

    res.status(201).json({
      message: "Document uploaded successfully.",
      document: {
        id: documentRef.id,
        ...metadata,
        storagePath: undefined,
        createdAt: null
      }
    });
  } catch (error) {
    await storageFile.delete({ ignoreNotFound: true }).catch((cleanupError) => {
      console.error(
        "Unable to clean up failed document upload:",
        cleanupError.message
      );
    });
    throw error;
  }
});

// Updates document title/category/targeting metadata without replacing the stored file.
router.patch("/:documentId", async (req, res) => {
  const documentRef = adminDb
    .collection("documents")
    .doc(req.params.documentId);
  const documentSnapshot = await documentRef.get();

  if (!documentSnapshot.exists) {
    throw createRouteError(404, "Document not found.");
  }

  const title = cleanText(req.body.title);

  if (!title) {
    throw createRouteError(400, "Document title is required.");
  }

  const target = await validateTarget(req.body);
  const admin = adminIdentity(req);
  const updates = {
    title,
    type: cleanText(req.body.type) || "Other",
    category: cleanText(req.body.category) || "Uncategorized",
    ...target,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: admin.id,
    updatedByName: admin.name
  };
  const auditRef = adminDb.collection("auditLog").doc();
  const batch = adminDb.batch();

  batch.update(documentRef, updates);
  batch.set(auditRef, {
    customerId: "",
    customer: "",
    company: target.targetCompany || "",
    documentId: documentRef.id,
    document: title,
    action: "Document Updated",
    adminId: admin.id,
    admin: admin.name,
    adminEmail: admin.email,
    requestId: "",
    createdAt: FieldValue.serverTimestamp()
  });
  await batch.commit();

  res.status(200).json({
    message: "Document updated.",
    document: {
      ...formatDocumentSnapshot(documentSnapshot),
      ...updates,
      updatedAt: null
    }
  });
});

// Deletes document metadata, Storage file, related requests, related notifications, and audits it.
router.delete("/:documentId", async (req, res) => {
  const documentRef = adminDb
    .collection("documents")
    .doc(req.params.documentId);
  const documentSnapshot = await documentRef.get();

  if (!documentSnapshot.exists) {
    throw createRouteError(404, "Document not found.");
  }

  const document = documentSnapshot.data();

  if (document.storagePath) {
    await adminStorage
      .bucket()
      .file(document.storagePath)
      .delete({ ignoreNotFound: true });
  }

  const [requestSnapshot, notificationSnapshot] = await Promise.all([
    adminDb
      .collection("accessRequests")
      .where("documentId", "==", documentRef.id)
      .get(),
    adminDb
      .collection("notifications")
      .where("documentId", "==", documentRef.id)
      .get()
  ]);
  const admin = adminIdentity(req);
  const auditRef = adminDb.collection("auditLog").doc();
  const batch = adminDb.batch();

  batch.delete(documentRef);
  requestSnapshot.docs.forEach((requestDocument) => {
    batch.delete(requestDocument.ref);
  });
  notificationSnapshot.docs.forEach((notificationDocument) => {
    batch.delete(notificationDocument.ref);
  });
  batch.set(auditRef, {
    customerId: "",
    customer: "",
    company: document.targetCompany || "",
    documentId: documentRef.id,
    document: document.title || document.fileName || "Untitled Document",
    action: "Document Deleted",
    adminId: admin.id,
    admin: admin.name,
    adminEmail: admin.email,
    requestId: "",
    createdAt: FieldValue.serverTimestamp()
  });
  await batch.commit();

  res.status(200).json({
    message: "Document deleted.",
    documentId: documentRef.id
  });
});

// Lists documents the current user can see; admins see all documents.
documentAccessRouter.get("/", async (req, res) => {
  if (req.userProfile.role === "admin") {
    const snapshot = await adminDb
      .collection("documents")
      .orderBy("createdAt", "desc")
      .get();

    res.status(200).json({
      documents: snapshot.docs.map(formatDocumentSnapshot)
    });
    return;
  }

  const snapshot = await adminDb
    .collection("documents")
    .orderBy("createdAt", "desc")
    .get();
  const company = req.userProfile.company || "";
  const documents = snapshot.docs
    .filter((documentSnapshot) => {
      const document = documentSnapshot.data();
      return document.active !== false
        && documentTargetsCustomer(document, req.auth.uid, company);
    })
    .map(formatDocumentSnapshot);

  res.status(200).json({ documents });
});

// Returns a short-lived signed URL for preview/download and logs customer downloads.
documentAccessRouter.get("/:documentId/download", async (req, res) => {
  const documentRef = adminDb
    .collection("documents")
    .doc(req.params.documentId);
  const documentSnapshot = await documentRef.get();
  let approvedRequestSnapshot = null;

  if (!documentSnapshot.exists) {
    throw createRouteError(404, "Document not found.");
  }

  const document = documentSnapshot.data();

  if (document.active === false) {
    throw createRouteError(409, "This document is no longer active.");
  }

  if (req.userProfile.role !== "admin") {
    if (!documentTargetsCustomer(
      document,
      req.auth.uid,
      req.userProfile.company || ""
    )) {
      throw createRouteError(403, "This document is not assigned to your account.");
    }

    approvedRequestSnapshot = await adminDb
      .collection("accessRequests")
      .doc(`${req.auth.uid}_${documentRef.id}`)
      .get();

    if (!approvedRequestSnapshot.exists || approvedRequestSnapshot.data().status !== "approved") {
      throw createRouteError(
        403,
        "Approved access is required to open this document."
      );
    }
  }

  if (!document.storagePath) {
    throw createRouteError(404, "The stored file could not be found.");
  }

  const disposition = req.query.disposition === "inline"
    ? "inline"
    : "attachment";
  const fileName = safeFileName(
    document.fileName || document.title || "document"
  );
  const storageFile = adminStorage.bucket().file(document.storagePath);
  const [exists] = await storageFile.exists();

  if (!exists) {
    throw createRouteError(404, "The stored file could not be found.");
  }

  const [url] = await storageFile.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + SIGNED_URL_LIFETIME_MS,
    responseDisposition: `${disposition}; filename="${fileName}"`,
    responseType: document.fileType || "application/octet-stream"
  });

  if (req.userProfile.role === "customer" && disposition === "attachment") {
    const approvedRequest = approvedRequestSnapshot?.data() || {};
    const auditRef = adminDb.collection("auditLog").doc();

    await auditRef.set({
      customerId: req.auth.uid,
      customer: req.userProfile.name || req.auth.email || req.userProfile.email || "",
      company: req.userProfile.company || "",
      documentId: documentRef.id,
      document: document.title || document.fileName || "Untitled Document",
      action: "Document Downloaded",
      adminId: "",
      admin: "",
      adminEmail: "",
      requestId: approvedRequestSnapshot?.id || `${req.auth.uid}_${documentRef.id}`,
      fileName,
      fileType: document.fileType || "",
      downloadUrlExpiresAt: new Date(Date.now() + SIGNED_URL_LIFETIME_MS),
      accessReviewedBy: approvedRequest.reviewedBy || "",
      accessReviewedByName: approvedRequest.reviewedByName || "",
      createdAt: FieldValue.serverTimestamp()
    });
  }

  res.status(200).json({
    url,
    expiresInSeconds: SIGNED_URL_LIFETIME_MS / 1000,
    fileName
  });
});

export {
  documentAccessRouter
};
export default router;
