import { apiRequest, uploadApiFile } from "./apiClient.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function formatFileSize(bytes) {
  if (!bytes) return "—";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

function formatTargetLabel(data) {
  if (data.targetType === "customer") {
    return data.targetCustomerName || data.targetCustomer || "Specific customer";
  }

  if (data.targetType === "company") {
    return data.targetCompany || data.targetCustomer || "Specific company";
  }

  return data.targetCustomer || "All Customers";
}

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

  const result = await uploadApiFile(
    "/api/admin/documents",
    formData,
    onProgress
  );

  return formatDocument(result.document);
}

export async function loadAdminDocuments() {
  const result = await apiRequest("/api/admin/documents");
  return result.documents.map(formatDocument);
}

export async function loadCustomerDocuments() {
  const result = await apiRequest("/api/documents");
  return result.documents.map(formatDocument);
}

export async function updateDocument(documentId, documentData) {
  const result = await apiRequest(
    `/api/admin/documents/${encodeURIComponent(documentId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(documentData)
    }
  );

  return formatDocument(result.document);
}

export function deleteDocument(documentId) {
  return apiRequest(
    `/api/admin/documents/${encodeURIComponent(documentId)}`,
    {
      method: "DELETE"
    }
  );
}

export async function getDocumentUrl(documentId, disposition = "attachment") {
  const query = new URLSearchParams({ disposition });
  const result = await apiRequest(
    `/api/documents/${encodeURIComponent(documentId)}/download?${query}`
  );

  return result.url;
}

export async function downloadDocument(document) {
  const url = await getDocumentUrl(document.id, "attachment");
  const link = window.document.createElement("a");

  link.href = url;
  link.download = document.fileName || document.title || "document";
  link.rel = "noreferrer";
  window.document.body.appendChild(link);
  link.click();
  link.remove();
}
