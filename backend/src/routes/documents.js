import express from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import multer from "multer";

import { adminDb, adminStorage } from "../firebaseAdmin.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
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

function createRouteError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function createDownloadUrl(bucketName, filePath, downloadToken) {
  return [
    "https://firebasestorage.googleapis.com/v0/b",
    encodeURIComponent(bucketName),
    "o",
    `${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`
  ].join("/");
}

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
  const downloadToken = randomUUID();
  const filePath = `files/${Date.now()}-${randomUUID()}-${safeFileName(req.file.originalname)}`;
  const storageFile = bucket.file(filePath);
  const adminName = req.userProfile.name || req.auth.email || "Admin";
  const adminEmail = req.auth.email || req.userProfile.email || "";

  await storageFile.save(req.file.buffer, {
    resumable: false,
    metadata: {
      contentType: req.file.mimetype || "application/octet-stream",
      metadata: {
        firebaseStorageDownloadTokens: downloadToken
      }
    }
  });

  try {
    const metadata = {
      title,
      type: cleanText(req.body.type) || "Other",
      category: cleanText(req.body.category) || "Uncategorized",
      ...target,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype || "application/octet-stream",
      storagePath: filePath,
      downloadURL: createDownloadUrl(bucket.name, filePath, downloadToken),
      uploadedBy: req.auth.uid,
      uploadedByName: adminName,
      uploadedByEmail: adminEmail,
      active: true,
      createdAt: FieldValue.serverTimestamp()
    };
    const documentRef = await adminDb.collection("documents").add(metadata);

    res.status(201).json({
      message: "Document uploaded successfully.",
      document: {
        id: documentRef.id,
        ...metadata,
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

export default router;
