import {
  collection,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { uploadApiFile } from "./apiClient.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

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
  formData.append("targetCustomer", documentData.targetCustomer || "");
  formData.append("targetCompany", documentData.targetCompany || "");
  formData.append("targetCustomerId", documentData.targetCustomerId || "");
  formData.append("targetCustomerName", documentData.targetCustomerName || "");
  formData.append("targetCustomerEmail", documentData.targetCustomerEmail || "");

  const result = await uploadApiFile(
    "/api/admin/documents",
    formData,
    onProgress
  );

  return result.document;
}

function formatFileSize(bytes) {
  if (!bytes) return "—";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadDate(value) {
  if (!value) return "—";

  if (typeof value.toDate === "function") {
    return value.toDate().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  return String(value);
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

export function listenToDocuments(onDocuments, onError) {
  const documentsQuery = query(
    collection(db, "documents"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    documentsQuery,
    (snapshot) => {
      const documents = snapshot.docs.map((documentSnapshot) => {
        const data = documentSnapshot.data();

        return {
          id: documentSnapshot.id,
          ...data,
          title: data.title || data.fileName || "Untitled Document",
          type: data.type || data.fileType || "File",
          category: data.category || "Uncategorized",
          uploadedDate: formatUploadDate(data.createdAt),
          size: formatFileSize(data.fileSize),
          uploadedBy: data.uploadedByName || data.uploadedByEmail || "Admin",
          targetLabel: formatTargetLabel(data)
        };
      });

      onDocuments(documents);
    },
    onError
  );
}
