import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "../firebase/firebaseConfig";

export function uploadDocument(file, documentData, user, onProgress) {
  if (!file) {
    throw new Error("Please select a file.");
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const filePath = `files/${Date.now()}-${safeFileName}`;
  const fileRef = ref(storage, filePath);
  const uploadTask = uploadBytesResumable(fileRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        onProgress?.(progress);
      },
      (error) => {
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const metadata = {
            title: documentData.title,
            type: documentData.type,
            category: documentData.category,
            targetType: documentData.targetType || "all",
            targetCustomer: documentData.targetCustomer,
            targetCompany: documentData.targetCompany || "",
            targetCustomerId: documentData.targetCustomerId || "",
            targetCustomerName: documentData.targetCustomerName || "",
            targetCustomerEmail: documentData.targetCustomerEmail || "",
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            storagePath: filePath,
            downloadURL,
            uploadedBy: user?.id || "",
            uploadedByName: user?.name || "Admin",
            uploadedByEmail: user?.email || "",
            active: true,
            createdAt: serverTimestamp()
          };

          const documentRef = await addDoc(collection(db, "documents"), metadata);
          resolve({
            id: documentRef.id,
            ...metadata
          });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
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
