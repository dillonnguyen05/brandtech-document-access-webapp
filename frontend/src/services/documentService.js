// Functions from apiClient.js; check Firebase sign-in, attach bearer tokens, and send document API calls.
import { apiRequest, uploadApiFile } from "./apiClient.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Converts byte counts into MB labels for document tables.
 */
function formatFileSize(bytes) {
  if (!bytes) return "—";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    uploadedDate: formatUploadDate(document.createdAt),
    size: formatFileSize(document.fileSize),
    uploadedBy: document.uploadedByName || document.uploadedByEmail || "Admin",
    targetLabel: formatTargetLabel(document)
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
  formData.append("type", documentData.type || "Other");
  formData.append("category", documentData.category || "Uncategorized");
  formData.append("targetType", documentData.targetType || "all");
  formData.append("targetCompany", documentData.targetCompany || "");
  formData.append("targetCustomerId", documentData.targetCustomerId || "");

  // Function from apiClient.js: uploads FormData to Express while reporting progress.
  const result = await uploadApiFile(
    "/api/admin/documents",
    formData,
    onProgress
  );

  return formatDocument(result.document);
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
 * Loads documents visible to the signed-in customer.
 */
export async function loadCustomerDocuments() {
  // Function from apiClient.js: checks Firebase sign-in and loads visible customer documents from Express.
  const result = await apiRequest("/api/documents");
  return result.documents.map(formatDocument);
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
