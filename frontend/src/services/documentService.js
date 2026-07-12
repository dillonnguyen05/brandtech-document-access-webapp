// Functions from apiClient.js; check Firebase sign-in, attach bearer tokens, and send document API calls.
import { apiRequest, uploadApiFile } from "./apiClient.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FOLDER_UPLOAD_FILES = 100;
const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx"
]);

/**
 * Converts byte counts into MB labels for document tables.
 */
function formatFileSize(bytes) {
  if (!bytes) return "—";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Gets the lowercase file extension from a selected browser file.
 */
function fileExtension(fileName) {
  const extensionIndex = fileName.lastIndexOf(".");
  return extensionIndex >= 0 ? fileName.slice(extensionIndex).toLowerCase() : "";
}

/**
 * Names a file with its folder path when the browser provides one.
 */
function fileDisplayName(file) {
  return file.webkitRelativePath || file.name;
}

/**
 * Separates uploadable files from unsupported, oversized, or excess folder items.
 */
function prepareFolderFiles(files) {
  const skippedFiles = [];
  const uploadableFiles = [];

  Array.from(files || []).forEach((file) => {
    const name = fileDisplayName(file);

    if (!ALLOWED_EXTENSIONS.has(fileExtension(file.name))) {
      skippedFiles.push({
        name,
        reason: "Unsupported file type"
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      skippedFiles.push({
        name,
        reason: "Larger than 50 MB"
      });
      return;
    }

    uploadableFiles.push(file);
  });

  if (uploadableFiles.length > MAX_FOLDER_UPLOAD_FILES) {
    const excessFiles = uploadableFiles.splice(MAX_FOLDER_UPLOAD_FILES);

    excessFiles.forEach((file) => {
      skippedFiles.push({
        name: fileDisplayName(file),
        reason: `Folder upload limit is ${MAX_FOLDER_UPLOAD_FILES} files`
      });
    });
  }

  return {
    uploadableFiles,
    skippedFiles
  };
}

/**
 * Formats document createdAt values for display in the UI.
 */
function formatUploadDate(value) {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

/**
 * Builds the admin/customer label that explains who a document targets.
 */
function formatTargetLabel(data) {
  if (data.shareEnabled === false) {
    return "Admin only";
  }

  if (data.targetType === "admin") {
    return "Admins only";
  }

  if (data.targetType === "customer") {
    return data.targetCustomerName || data.targetCustomer || "Specific customer";
  }

  if (data.targetType === "company") {
    return data.targetCompany || data.targetCustomer || "Specific company";
  }

  return data.targetCustomer || "All Customers";
}

/**
 * Normalizes document records returned by Express into the shape the dashboards expect.
 */
function formatDocument(document) {
  return {
    ...document,
    title: document.title || document.fileName || "Untitled Document",
    type: document.type || document.fileType || "File",
    category: document.category || "Uncategorized",
    folderId: document.folderId || "",
    folderName: document.folderName || "",
    folderPath: document.folderPath || "",
    uploadedDate: formatUploadDate(document.createdAt),
    size: formatFileSize(document.fileSize),
    uploadedBy: document.uploadedByName || document.uploadedByEmail || "Admin",
    targetLabel: formatTargetLabel(document)
  };
}

/**
 * Normalizes folder records returned by Express.
 */
function formatFolder(folder) {
  return {
    ...folder,
    name: folder.name || "Untitled Folder",
    parentFolderId: folder.parentFolderId || "",
    path: folder.path || "",
    depth: folder.depth || 0,
    createdDate: formatUploadDate(folder.createdAt)
  };
}

/**
 * Validates and uploads a new admin document through the Express document API.
 */
export async function uploadDocument(file, documentData, onProgress) {
  if (!file) {
    throw new Error("Please select a file.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File must be 50 MB or smaller.");
  }

  const formData = new FormData();

  formData.append("file", file);
  formData.append("title", documentData.title || "");
  formData.append("category", documentData.category || "Uncategorized");
  formData.append("targetType", documentData.targetType || "all");
  formData.append("targetCompany", documentData.targetCompany || "");
  formData.append("targetCustomerId", documentData.targetCustomerId || "");
  formData.append("folderId", documentData.folderId || "");

  // Function from apiClient.js: uploads FormData to Express while reporting progress.
  const result = await uploadApiFile(
    "/api/admin/documents",
    formData,
    onProgress
  );

  return formatDocument(result.document);
}

/**
 * Uploads every supported file from a selected browser folder.
 */
export async function uploadFolder(files, documentData, onProgress) {
  const fileList = Array.from(files || []);

  if (fileList.length === 0) {
    throw new Error("Please select a folder.");
  }

  const { uploadableFiles, skippedFiles } = prepareFolderFiles(fileList);
  const hasExplicitShareSelection = Array.isArray(documentData.sharedFilePaths);
  const sharedFilePaths = hasExplicitShareSelection
    ? documentData.sharedFilePaths
      .map((filePath) => String(filePath || "").replace(/\\/g, "/").trim())
      .filter(Boolean)
    : uploadableFiles.map(fileDisplayName);
  const uploadableRelativePaths = new Set(uploadableFiles.map((file) => (
    fileDisplayName(file).replace(/\\/g, "/")
  )));
  const sharedUploadablePaths = sharedFilePaths.filter((filePath) => (
    uploadableRelativePaths.has(filePath)
  ));

  if (uploadableFiles.length === 0) {
    throw new Error(
      skippedFiles.length > 0
        ? `No supported documents found. Skipped ${skippedFiles.length} unsupported or oversized files.`
        : "No supported documents found in this folder."
    );
  }

  if (sharedUploadablePaths.length === 0) {
    throw new Error("Select at least one supported folder item to share.");
  }

  const formData = new FormData();

  formData.append("category", documentData.category || "Uncategorized");
  formData.append("targetType", documentData.targetType || "all");
  formData.append("targetCompany", documentData.targetCompany || "");
  formData.append("targetCustomerId", documentData.targetCustomerId || "");
  formData.append("parentFolderId", documentData.parentFolderId || "");
  formData.append("shareSelectionApplied", hasExplicitShareSelection ? "true" : "false");

  sharedUploadablePaths.forEach((filePath) => {
    formData.append("sharedFilePaths", filePath);
  });

  uploadableFiles.forEach((file) => {
    formData.append("files", file);
    formData.append("relativePaths", fileDisplayName(file).replace(/\\/g, "/"));
  });

  // Function from apiClient.js: uploads folder FormData to Express while reporting progress.
  const result = await uploadApiFile(
    "/api/admin/documents/folder-upload",
    formData,
    onProgress
  );

  return {
    documents: result.documents.map(formatDocument),
    sharedCount: result.sharedCount,
    skippedFiles: [
      ...skippedFiles,
      ...(result.skippedFiles || [])
    ]
  };
}

/**
 * Loads all documents for admin management.
 */
export async function loadAdminDocuments() {
  // Function from apiClient.js: checks Firebase sign-in and loads admin documents from Express.
  const result = await apiRequest("/api/admin/documents");
  return result.documents.map(formatDocument);
}

/**
 * Loads folder metadata for the admin document browser.
 */
export async function loadDocumentFolders() {
  // Function from apiClient.js: checks Firebase sign-in and loads document folders from Express.
  const result = await apiRequest("/api/admin/documents/folders");
  return result.folders.map(formatFolder);
}

/**
 * Creates a folder under the selected parent folder.
 */
export async function createDocumentFolder(name, parentFolderId = "", folderData = {}) {
  // Function from apiClient.js: checks Firebase sign-in and creates a folder through Express.
  const result = await apiRequest("/api/admin/documents/folders", {
    method: "POST",
    body: JSON.stringify({
      name,
      parentFolderId,
      targetType: folderData.targetType || "all",
      targetCompany: folderData.targetCompany || "",
      targetCustomerId: folderData.targetCustomerId || ""
    })
  });

  return formatFolder(result.folder);
}

/**
 * Updates a folder and optionally applies category/target changes to documents inside it.
 */
export async function updateDocumentFolder(folderId, folderData) {
  // Function from apiClient.js: checks Firebase sign-in and updates folder metadata through Express.
  const result = await apiRequest(
    `/api/admin/documents/folders/${encodeURIComponent(folderId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(folderData)
    }
  );

  return formatFolder(result.folder);
}

/**
 * Loads documents visible to the signed-in customer.
 */
export async function loadCustomerDocuments() {
  // Function from apiClient.js: checks Firebase sign-in and loads visible customer documents from Express.
  const result = await apiRequest("/api/documents");
  return result.documents.map(formatDocument);
}

/**
 * Loads approved customer documents plus requestable folder metadata.
 */
export async function loadCustomerDocumentLibrary() {
  // Function from apiClient.js: checks Firebase sign-in and loads customer documents/folders from Express.
  const result = await apiRequest("/api/documents");

  return {
    documents: (result.documents || []).map(formatDocument),
    folders: (result.folders || []).map(formatFolder)
  };
}

/**
 * Updates document metadata and targeting rules.
 */
export async function updateDocument(documentId, documentData) {
  // Function from apiClient.js: checks Firebase sign-in and updates document metadata through Express.
  const result = await apiRequest(
    `/api/admin/documents/${encodeURIComponent(documentId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(documentData)
    }
  );

  return formatDocument(result.document);
}

/**
 * Deletes a document, its Storage file, related requests, and related notifications through Express.
 */
export function deleteDocument(documentId) {
  // Function from apiClient.js: checks Firebase sign-in and deletes a document through Express.
  return apiRequest(
    `/api/admin/documents/${encodeURIComponent(documentId)}`,
    {
      method: "DELETE"
    }
  );
}

/**
 * Requests a short-lived signed URL for previewing or downloading a document.
 */
export async function getDocumentUrl(documentId, disposition = "attachment") {
  const query = new URLSearchParams({ disposition });
  // Function from apiClient.js: checks Firebase sign-in and requests a signed file URL from Express.
  const result = await apiRequest(
    `/api/documents/${encodeURIComponent(documentId)}/download?${query}`
  );

  return result.url;
}

/**
 * Creates a temporary anchor element to start the browser download.
 */
export async function downloadDocument(document) {
  // Function from this file: gets a signed download URL before opening it in the browser.
  const url = await getDocumentUrl(document.id, "attachment");
  const link = window.document.createElement("a");

  link.href = url;
  link.download = document.fileName || document.title || "document";
  link.rel = "noreferrer";
  window.document.body.appendChild(link);
  link.click();
  link.remove();
}
