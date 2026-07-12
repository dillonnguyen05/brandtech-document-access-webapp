import express from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import multer from "multer";

import { adminDb, adminStorage } from "../firebaseAdmin.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FOLDER_UPLOAD_FILES = 100;
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
const ALLOWED_TARGET_TYPES = new Set(["all", "company", "customer", "admin"]);

/**
 * Checks if a file name has a supported document extension.
 */
function isAllowedDocumentFile(fileName) {
  return ALLOWED_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

/**
 * Rejects unsupported file types before they are stored in memory.
 */
function validateUploadFile(req, file, callback) {
  if (!isAllowedDocumentFile(file.originalname)) {
    const error = new Error(
      "Only PDF, Word, Excel, and PowerPoint files are allowed."
    );
    error.status = 400;
    callback(error);
    return;
  }

  callback(null, true);
}

// Stores uploads in memory briefly so Express can validate and pass them to Firebase Storage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  },
  fileFilter: validateUploadFile
});

// Handles folder uploads, where the browser sends many documents in one request.
const folderUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FOLDER_UPLOAD_FILES
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
 * Converts folder names into safe Storage path segments.
 */
function safeFolderSegment(folderName) {
  const safeSegment = folderName
    .replace(/[^a-zA-Z0-9._ -]/g, "-")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return safeSegment || "folder";
}

/**
 * Normalizes visible folder names before writing metadata.
 */
function cleanFolderName(value) {
  const folderName = cleanText(value)
    .replace(/[\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim();

  if (!folderName) {
    throw createRouteError(400, "Folder name is required.");
  }

  return folderName;
}

/**
 * Converts repeated multipart fields into an array.
 */
function bodyValues(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
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
function formatDocumentData(id, data) {
  const {
    downloadURL,
    storagePath,
    ...publicData
  } = data;

  return {
    id,
    ...publicData,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt)
  };
}

/**
 * Removes private Storage fields before sending document metadata to the frontend.
 */
function formatDocumentSnapshot(documentSnapshot) {
  return formatDocumentData(documentSnapshot.id, documentSnapshot.data());
}

/**
 * Removes private folder fields and normalizes timestamps for React.
 */
function formatFolderSnapshot(folderSnapshot) {
  const data = folderSnapshot.data();

  return {
    id: folderSnapshot.id,
    name: data.name || "Untitled Folder",
    parentFolderId: data.parentFolderId || "",
    path: data.path || "",
    depth: data.depth || 0,
    createdBy: data.createdBy || "",
    createdByName: data.createdByName || "",
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt)
  };
}

/**
 * Returns a folder record or a virtual root folder when no id is supplied.
 */
async function loadFolder(folderId) {
  const id = cleanText(folderId);

  if (!id) {
    return {
      id: "",
      name: "All Documents",
      parentFolderId: "",
      path: "",
      depth: 0
    };
  }

  const folderSnapshot = await adminDb
    .collection("documentFolders")
    .doc(id)
    .get();

  if (!folderSnapshot.exists) {
    throw createRouteError(404, "Folder not found.");
  }

  return {
    id: folderSnapshot.id,
    ...folderSnapshot.data()
  };
}

/**
 * Finds an existing folder by path or creates it under its parent.
 */
async function createOrGetFolder(parentFolderId, rawName, admin, options = {}) {
  const parentFolder = await loadFolder(parentFolderId);
  const name = cleanFolderName(rawName);
  const pathValue = [parentFolder.path, name].filter(Boolean).join("/");
  const pathKey = pathValue.toLowerCase();
  const existingSnapshot = await adminDb
    .collection("documentFolders")
    .where("pathKey", "==", pathKey)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    if (options.throwIfExists) {
      throw createRouteError(409, "A folder with this name already exists here.");
    }

    const existingFolder = existingSnapshot.docs[0];
    return {
      id: existingFolder.id,
      ...existingFolder.data()
    };
  }

  const folderRef = adminDb.collection("documentFolders").doc();
  const folderData = {
    name,
    nameLower: name.toLowerCase(),
    parentFolderId: parentFolder.id || "",
    parentPath: parentFolder.path || "",
    path: pathValue,
    pathKey,
    depth: Number(parentFolder.depth || 0) + 1,
    createdBy: admin.id,
    createdByName: admin.name,
    createdByEmail: admin.email,
    ...(options.folderData || {}),
    createdAt: FieldValue.serverTimestamp()
  };

  await folderRef.set(folderData);

  return {
    id: folderRef.id,
    ...folderData
  };
}

/**
 * Creates or reuses each folder segment from an uploaded folder path.
 */
async function createOrGetNestedFolder(parentFolderId, folderSegments, admin, cache) {
  let currentFolder = await loadFolder(parentFolderId);

  for (const segment of folderSegments) {
    const cleanSegment = cleanFolderName(segment);
    const cacheKey = `${currentFolder.id || "root"}:${cleanSegment.toLowerCase()}`;

    if (!cache.has(cacheKey)) {
      cache.set(
        cacheKey,
        createOrGetFolder(currentFolder.id, cleanSegment, admin)
      );
    }

    currentFolder = await cache.get(cacheKey);
  }

  return currentFolder;
}

/**
 * Builds the Storage prefix for files inside a folder.
 */
function storagePrefixFromFolder(folder) {
  if (!folder?.path) return "";

  return folder.path
    .split("/")
    .filter(Boolean)
    .map(safeFolderSegment)
    .join("/");
}

/**
 * Infers the display type from each uploaded folder file.
 */
function documentTypeFromFileName(fileName) {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".pdf") return "PDF";
  if (extension === ".doc" || extension === ".docx") return "Word";
  if (extension === ".xls" || extension === ".xlsx") return "Excel";
  if (extension === ".ppt" || extension === ".pptx") return "PowerPoint";
  return "Other";
}

/**
 * Uses the file name without extension as the default title for folder uploads.
 */
function titleFromFileName(fileName) {
  return path.basename(fileName, path.extname(fileName)) || fileName;
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
 * Checks if a folder access request covers a document in that folder subtree.
 */
function folderRequestCoversDocument(accessRequest, document, documentId = "") {
  if ((accessRequest.resourceType || "") !== "folder") return false;

  const excludedDocumentIds = Array.isArray(accessRequest.excludedDocumentIds)
    ? accessRequest.excludedDocumentIds
    : [];

  if (documentId && excludedDocumentIds.includes(documentId)) {
    return false;
  }

  const requestFolderPath = accessRequest.folderPath || "";
  const documentFolderPath = document.folderPath || "";

  if (!requestFolderPath) return true;

  return documentFolderPath === requestFolderPath
    || documentFolderPath.startsWith(`${requestFolderPath}/`);
}

/**
 * Checks if a document belongs inside a folder or one of its subfolders.
 */
function folderContainsDocument(folder, document) {
  const folderPath = folder.path || "";
  const documentFolderPath = document.folderPath || "";

  if (!folderPath) return true;

  return documentFolderPath === folderPath
    || documentFolderPath.startsWith(`${folderPath}/`);
}

/**
 * Adds request/approval counts to folder metadata for the customer folder browser.
 */
function formatCustomerFolder(folderSnapshot, targetDocuments, approvedDocuments) {
  const folder = {
    id: folderSnapshot.id,
    ...folderSnapshot.data()
  };
  const requestableDocumentCount = targetDocuments.filter(({ data }) => (
    folderContainsDocument(folder, data)
  )).length;
  const approvedDocumentCount = approvedDocuments.filter(({ data }) => (
    folderContainsDocument(folder, data)
  )).length;

  return {
    ...formatFolderSnapshot(folderSnapshot),
    requestableDocumentCount,
    approvedDocumentCount
  };
}

/**
 * Validates who a document is assigned to before creating or updating metadata.
 */
async function validateTarget(body) {
  const targetType = cleanText(body.targetType) || "all";

  if (!ALLOWED_TARGET_TYPES.has(targetType)) {
    throw createRouteError(400, "Invalid target audience.");
  }

  if (targetType === "admin") {
    return {
      targetType,
      targetCustomer: "Admins only",
      targetCompany: "",
      targetCustomerId: "",
      targetCustomerName: "",
      targetCustomerEmail: ""
    };
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

/**
 * Treats owner accounts as admin-facing accounts for document APIs.
 */
function hasAdminDocumentAccess(profile) {
  return ["admin", "owner"].includes(profile?.role);
}

// Lists admin-visible folder metadata for the document browser.
router.get("/folders", async (req, res) => {
  const snapshot = await adminDb
    .collection("documentFolders")
    .orderBy("path", "asc")
    .get();

  res.status(200).json({
    folders: snapshot.docs.map(formatFolderSnapshot)
  });
});

// Creates a folder under the selected parent folder.
router.post("/folders", async (req, res) => {
  const admin = adminIdentity(req);
  const target = await validateTarget(req.body);
  const parentFolderId = cleanText(req.body.parentFolderId);
  const folder = await createOrGetFolder(
    parentFolderId,
    req.body.name,
    admin,
    {
      throwIfExists: true,
      folderData: target
    }
  );
  const auditRef = adminDb.collection("auditLog").doc();

  await auditRef.set({
    customerId: target.targetCustomerId || "",
    customer: target.targetCustomerName || "",
    company: target.targetCompany || "",
    documentId: "",
    folderId: folder.id,
    folderPath: folder.path || "",
    resourceType: "folder",
    document: folder.path || folder.name,
    action: "Folder Created",
    adminId: admin.id,
    admin: admin.name,
    adminEmail: admin.email,
    requestId: "",
    createdAt: FieldValue.serverTimestamp()
  });

  res.status(201).json({
    message: "Folder created.",
    folder: {
      ...folder,
      createdAt: null
    }
  });
});

// Updates folder name/location and optionally applies category/target changes to nested documents.
router.patch("/folders/:folderId", async (req, res) => {
  const folderRef = adminDb
    .collection("documentFolders")
    .doc(req.params.folderId);
  const folderSnapshot = await folderRef.get();

  if (!folderSnapshot.exists) {
    throw createRouteError(404, "Folder not found.");
  }

  const folder = {
    id: folderSnapshot.id,
    ...folderSnapshot.data()
  };
  const oldPath = folder.path || folder.name || "";
  const name = cleanFolderName(req.body.name);
  const parentFolderId = cleanText(req.body.parentFolderId);

  if (parentFolderId === folder.id) {
    throw createRouteError(400, "A folder cannot be moved inside itself.");
  }

  const parentFolder = await loadFolder(parentFolderId);

  if (
    parentFolder.path
    && oldPath
    && (parentFolder.path === oldPath || parentFolder.path.startsWith(`${oldPath}/`))
  ) {
    throw createRouteError(400, "A folder cannot be moved into one of its subfolders.");
  }

  const newPath = [parentFolder.path, name].filter(Boolean).join("/");
  const newPathKey = newPath.toLowerCase();
  const conflictingFolderSnapshot = await adminDb
    .collection("documentFolders")
    .where("pathKey", "==", newPathKey)
    .limit(1)
    .get();

  if (
    !conflictingFolderSnapshot.empty
    && conflictingFolderSnapshot.docs[0].id !== folder.id
  ) {
    throw createRouteError(409, "A folder with this name already exists here.");
  }

  const categoryAction = cleanText(req.body.category);
  const categoryUpdate = categoryAction && categoryAction !== "__keep"
    ? categoryAction
    : "";
  const targetAction = cleanText(req.body.targetType);
  const targetUpdate = !targetAction || targetAction === "__keep"
    ? null
    : await validateTarget(req.body);
  const admin = adminIdentity(req);
  const [folderSnapshotAll, documentSnapshot, requestSnapshot] = await Promise.all([
    adminDb.collection("documentFolders").get(),
    adminDb.collection("documents").get(),
    adminDb.collection("accessRequests").get()
  ]);
  const affectedFolders = folderSnapshotAll.docs
    .map((snapshot) => ({
      ref: snapshot.ref,
      id: snapshot.id,
      data: snapshot.data()
    }))
    .filter(({ id, data }) => (
      id === folder.id
      || (oldPath && (data.path || "").startsWith(`${oldPath}/`))
    ));
  const updatedFolderById = new Map();

  affectedFolders.forEach(({ id, data }) => {
    const currentPath = data.path || "";
    const suffix = id === folder.id
      ? ""
      : currentPath.slice(oldPath.length + 1);
    const updatedPath = [newPath, suffix].filter(Boolean).join("/");
    const updatedName = id === folder.id ? name : data.name;

    updatedFolderById.set(id, {
      ...data,
      name: updatedName,
      nameLower: String(updatedName || "").toLowerCase(),
      parentFolderId: id === folder.id ? parentFolder.id || "" : data.parentFolderId || "",
      parentPath: updatedPath.split("/").slice(0, -1).join("/"),
      path: updatedPath,
      pathKey: updatedPath.toLowerCase(),
      depth: updatedPath.split("/").filter(Boolean).length
    });
  });

  const affectedDocuments = documentSnapshot.docs.filter((snapshot) => {
    const document = snapshot.data();
    const documentFolderPath = document.folderPath || "";

    return documentFolderPath === oldPath
      || (oldPath && documentFolderPath.startsWith(`${oldPath}/`));
  });
  const affectedFolderIds = new Set(affectedFolders.map(({ id }) => id));
  const affectedFolderRequests = requestSnapshot.docs.filter((snapshot) => {
    const accessRequest = snapshot.data();

    return accessRequest.resourceType === "folder"
      && affectedFolderIds.has(accessRequest.folderId);
  });
  const auditRef = adminDb.collection("auditLog").doc();
  const batch = adminDb.batch();

  affectedFolders.forEach(({ ref, id }) => {
    const data = updatedFolderById.get(id);

    batch.update(ref, {
      name: data.name,
      nameLower: data.nameLower,
      parentFolderId: data.parentFolderId,
      parentPath: data.parentPath,
      path: data.path,
      pathKey: data.pathKey,
      depth: data.depth,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.id,
      updatedByName: admin.name
    });
  });

  affectedDocuments.forEach((snapshot) => {
    const document = snapshot.data();
    const updatedFolder = updatedFolderById.get(document.folderId);
    const updates = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.id,
      updatedByName: admin.name
    };

    if (updatedFolder) {
      updates.folderName = updatedFolder.name;
      updates.folderPath = updatedFolder.path || "";
    }

    if (categoryUpdate) {
      updates.category = categoryUpdate;
    }

    if (targetUpdate) {
      Object.assign(updates, targetUpdate);
    }

    batch.update(snapshot.ref, updates);
  });

  affectedFolderRequests.forEach((snapshot) => {
    const accessRequest = snapshot.data();
    const updatedFolder = updatedFolderById.get(accessRequest.folderId);

    if (!updatedFolder) return;

    batch.update(snapshot.ref, {
      documentTitle: updatedFolder.path || updatedFolder.name || "Folder",
      folderName: updatedFolder.name || "Folder",
      folderPath: updatedFolder.path || "",
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  batch.set(auditRef, {
    customerId: "",
    customer: "",
    company: targetUpdate?.targetCompany || "",
    documentId: "",
    folderId: folder.id,
    folderPath: newPath || "",
    resourceType: "folder",
    document: newPath || name,
    action: "Folder Updated",
    adminId: admin.id,
    admin: admin.name,
    adminEmail: admin.email,
    requestId: "",
    createdAt: FieldValue.serverTimestamp()
  });
  await batch.commit();

  const updatedFolder = updatedFolderById.get(folder.id);

  res.status(200).json({
    message: "Folder updated.",
    folder: {
      id: folder.id,
      ...updatedFolder,
      updatedAt: null
    },
    documentsUpdated: affectedDocuments.length
  });
});

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
  const folder = await loadFolder(req.body.folderId);
  const storagePrefix = storagePrefixFromFolder(folder);
  const bucket = adminStorage.bucket();
  const filePath = `files/${storagePrefix ? `${storagePrefix}/` : ""}${Date.now()}-${randomUUID()}-${safeFileName(req.file.originalname)}`;
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
      type: documentTypeFromFileName(req.file.originalname),
      category: cleanText(req.body.category) || "Uncategorized",
      ...target,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype || "application/octet-stream",
      storagePath: filePath,
      folderId: folder.id || "",
      folderName: folder.id ? folder.name : "",
      folderPath: folder.path || "",
      uploadedBy: admin.id,
      uploadedByName: admin.name,
      uploadedByEmail: admin.email,
      active: true,
      shareEnabled: true,
      createdAt: FieldValue.serverTimestamp()
    };
    const batch = adminDb.batch();

    batch.set(documentRef, metadata);
    batch.set(auditRef, {
      customerId: "",
      customer: "",
      company: target.targetCompany || "",
      documentId: documentRef.id,
      folderId: folder.id || "",
      folderPath: folder.path || "",
      resourceType: "document",
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

// Uploads a browser-selected folder, creates subfolder metadata, and saves each document.
router.post(
  "/folder-upload",
  folderUpload.array("files", MAX_FOLDER_UPLOAD_FILES),
  async (req, res) => {
    const files = req.files || [];

    if (files.length === 0) {
      throw createRouteError(400, "Please select a folder with documents.");
    }

    const target = await validateTarget(req.body);
    const parentFolderId = cleanText(req.body.parentFolderId || req.body.folderId);
    await loadFolder(parentFolderId);

    const admin = adminIdentity(req);
    const bucket = adminStorage.bucket();
    const category = cleanText(req.body.category) || "Uncategorized";
    const relativePaths = bodyValues(req.body.relativePaths);
    const shareSelectionApplied = cleanText(req.body.shareSelectionApplied) === "true";
    const sharedFilePaths = new Set(
      bodyValues(req.body.sharedFilePaths)
        .map((filePath) => cleanText(filePath).replace(/\\/g, "/"))
        .filter(Boolean)
    );
    const folderCache = new Map();
    const uploadedStorageFiles = [];
    const uploadedDocuments = [];
    const skippedFiles = [];
    let sharedCount = 0;

    if (shareSelectionApplied && sharedFilePaths.size === 0) {
      throw createRouteError(400, "Select at least one folder item to share.");
    }

    try {
      const batch = adminDb.batch();

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const relativePath = cleanText(relativePaths[index] || file.originalname)
          .replace(/\\/g, "/");
        const shareEnabled = shareSelectionApplied
          ? sharedFilePaths.has(relativePath)
          : true;

        if (!isAllowedDocumentFile(file.originalname)) {
          skippedFiles.push({
            name: relativePath || file.originalname,
            reason: "Unsupported file type"
          });
          continue;
        }

        const pathParts = relativePath.split("/").filter(Boolean);
        const folderSegments = pathParts.length > 1 ? pathParts.slice(0, -1) : [];
        const folder = await createOrGetNestedFolder(
          parentFolderId,
          folderSegments,
          admin,
          folderCache
        );
        const storagePrefix = storagePrefixFromFolder(folder);
        const filePath = `files/${storagePrefix ? `${storagePrefix}/` : ""}${Date.now()}-${randomUUID()}-${safeFileName(file.originalname)}`;
        const storageFile = bucket.file(filePath);

        await storageFile.save(file.buffer, {
          resumable: false,
          metadata: {
            contentType: file.mimetype || "application/octet-stream"
          }
        });
        uploadedStorageFiles.push(storageFile);

        const documentRef = adminDb.collection("documents").doc();
        const auditRef = adminDb.collection("auditLog").doc();
        const title = titleFromFileName(file.originalname);
        const metadata = {
          title,
          type: documentTypeFromFileName(file.originalname),
          category,
          ...target,
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype || "application/octet-stream",
          storagePath: filePath,
          folderId: folder.id || "",
          folderName: folder.id ? folder.name : "",
          folderPath: folder.path || "",
          uploadedBy: admin.id,
          uploadedByName: admin.name,
          uploadedByEmail: admin.email,
          active: true,
          shareEnabled,
          createdAt: FieldValue.serverTimestamp()
        };

        batch.set(documentRef, metadata);
        batch.set(auditRef, {
          customerId: "",
          customer: "",
          company: target.targetCompany || "",
          documentId: documentRef.id,
          folderId: folder.id || "",
          folderPath: folder.path || "",
          resourceType: "document",
          document: title,
          action: "Document Uploaded",
          adminId: admin.id,
          admin: admin.name,
          adminEmail: admin.email,
          requestId: "",
          createdAt: FieldValue.serverTimestamp()
        });

        uploadedDocuments.push({
          id: documentRef.id,
          ...metadata,
          storagePath: undefined,
          createdAt: null
        });

        if (shareEnabled) {
          sharedCount += 1;
        }
      }

      if (uploadedDocuments.length === 0) {
        throw createRouteError(400, "No supported documents found in this folder.");
      }

      await batch.commit();

      res.status(201).json({
        message: "Folder uploaded successfully.",
        documents: uploadedDocuments,
        skippedFiles,
        sharedCount
      });
    } catch (error) {
      await Promise.all(
        uploadedStorageFiles.map((storageFile) => (
          storageFile.delete({ ignoreNotFound: true }).catch((cleanupError) => {
            console.error(
              "Unable to clean up failed folder upload:",
              cleanupError.message
            );
          })
        ))
      );
      throw error;
    }
  }
);

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
  const document = documentSnapshot.data();
  const folder = await loadFolder(req.body.folderId);
  const admin = adminIdentity(req);
  const updates = {
    title,
    type: documentTypeFromFileName(document.fileName || title),
    category: cleanText(req.body.category) || "Uncategorized",
    ...target,
    folderId: folder.id || "",
    folderName: folder.id ? folder.name : "",
    folderPath: folder.path || "",
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
    folderId: folder.id || "",
    folderPath: folder.path || "",
    resourceType: "document",
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
    folderId: document.folderId || "",
    folderPath: document.folderPath || "",
    resourceType: "document",
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

// Lists documents/folders the current user can see; admins see all documents.
documentAccessRouter.get("/", async (req, res) => {
  if (hasAdminDocumentAccess(req.userProfile)) {
    const [documentSnapshot, folderSnapshot] = await Promise.all([
      adminDb
        .collection("documents")
        .orderBy("createdAt", "desc")
        .get(),
      adminDb
        .collection("documentFolders")
        .orderBy("path", "asc")
        .get()
    ]);

    res.status(200).json({
      documents: documentSnapshot.docs.map(formatDocumentSnapshot),
      folders: folderSnapshot.docs.map(formatFolderSnapshot)
    });
    return;
  }

  const [documentSnapshot, folderSnapshot, requestSnapshot] = await Promise.all([
    adminDb
      .collection("documents")
      .orderBy("createdAt", "desc")
      .get(),
    adminDb
      .collection("documentFolders")
      .orderBy("path", "asc")
      .get(),
    adminDb
      .collection("accessRequests")
      .where("customerId", "==", req.auth.uid)
      .get()
  ]);
  const company = req.userProfile.company || "";
  const approvedRequests = requestSnapshot.docs
    .map((snapshot) => snapshot.data())
    .filter((request) => request.status === "approved");
  const approvedDocumentIds = new Set(
    approvedRequests
      .filter((request) => (request.resourceType || "document") === "document")
      .map((request) => request.documentId)
      .filter(Boolean)
  );
  const approvedFolderRequests = approvedRequests.filter((request) => (
    request.resourceType === "folder"
  ));
  const targetDocuments = documentSnapshot.docs
    .map((snapshot) => ({
      id: snapshot.id,
      data: snapshot.data()
    }))
    .filter(({ data }) => (
      data.active !== false
      && data.shareEnabled !== false
      && documentTargetsCustomer(data, req.auth.uid, company)
    ));
  const approvedDocuments = targetDocuments.filter(({ id, data }) => (
    approvedDocumentIds.has(id)
    || approvedFolderRequests.some((request) => folderRequestCoversDocument(request, data, id))
  ));
  const folders = folderSnapshot.docs
    .map((snapshot) => ({
      snapshot,
      data: {
        id: snapshot.id,
        ...snapshot.data()
      }
    }))
    .filter(({ data }) => (
      targetDocuments.some((document) => folderContainsDocument(data, document.data))
    ))
    .map(({ snapshot }) => (
      formatCustomerFolder(snapshot, targetDocuments, approvedDocuments)
    ));

  res.status(200).json({
    documents: approvedDocuments.map(({ id, data }) => formatDocumentData(id, data)),
    folders
  });
});

// Returns a short-lived signed URL for preview/download and logs customer downloads.
documentAccessRouter.get("/:documentId/download", async (req, res) => {
  const documentRef = adminDb
    .collection("documents")
    .doc(req.params.documentId);
  const documentSnapshot = await documentRef.get();
  let approvedAccessRequest = null;

  if (!documentSnapshot.exists) {
    throw createRouteError(404, "Document not found.");
  }

  const document = documentSnapshot.data();

  if (document.active === false) {
    throw createRouteError(409, "This document is no longer active.");
  }

  if (!hasAdminDocumentAccess(req.userProfile)) {
    if (document.shareEnabled === false) {
      throw createRouteError(403, "This document is not shared with customers.");
    }

    if (!documentTargetsCustomer(
      document,
      req.auth.uid,
      req.userProfile.company || ""
    )) {
      throw createRouteError(403, "This document is not assigned to your account.");
    }

    const directRequestSnapshot = await adminDb
      .collection("accessRequests")
      .doc(`${req.auth.uid}_${documentRef.id}`)
      .get();

    if (directRequestSnapshot.exists && directRequestSnapshot.data().status === "approved") {
      approvedAccessRequest = {
        id: directRequestSnapshot.id,
        data: directRequestSnapshot.data()
      };
    }

    if (!approvedAccessRequest) {
      const folderRequestSnapshot = await adminDb
        .collection("accessRequests")
        .where("customerId", "==", req.auth.uid)
        .get();
      const approvedFolderRequest = folderRequestSnapshot.docs.find((requestSnapshot) => (
        requestSnapshot.data().status === "approved"
        && requestSnapshot.data().resourceType === "folder"
        && folderRequestCoversDocument(requestSnapshot.data(), document, documentRef.id)
      ));

      if (approvedFolderRequest) {
        approvedAccessRequest = {
          id: approvedFolderRequest.id,
          data: approvedFolderRequest.data()
        };
      }
    }

    if (!approvedAccessRequest) {
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
    const approvedRequest = approvedAccessRequest?.data || {};
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
      requestId: approvedAccessRequest?.id || `${req.auth.uid}_${documentRef.id}`,
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
