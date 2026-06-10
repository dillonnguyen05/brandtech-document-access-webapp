import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { apiRequest } from "./apiClient.js";

export async function createAccessRequest(user, document) {
  if (!user?.id) {
    throw new Error("You must be signed in to request access.");
  }

  if (!document?.id) {
    throw new Error("Select a document before requesting access.");
  }

  const requestId = `${user.id}_${document.id}`;

  await setDoc(doc(db, "accessRequests", requestId), {
    customerId: user.id,
    customerName: user.name || "",
    customerEmail: user.email || "",
    company: user.company || "",
    documentId: document.id,
    documentTitle: document.title || document.fileName || "Untitled Document",
    documentCategory: document.category || "Uncategorized",
    status: "pending",
    createdAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null
  });
}

function formatRequestDate(value) {
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

function sortByCreatedAtDesc(a, b) {
  const aMillis = typeof a.createdAt?.toMillis === "function" ? a.createdAt.toMillis() : 0;
  const bMillis = typeof b.createdAt?.toMillis === "function" ? b.createdAt.toMillis() : 0;
  return bMillis - aMillis;
}

function mapRequestSnapshot(snapshot) {
  return snapshot.docs
    .map((requestSnapshot) => {
      const data = requestSnapshot.data();

      return {
        id: requestSnapshot.id,
        ...data,
        dateRequested: formatRequestDate(data.createdAt)
      };
    })
    .sort(sortByCreatedAtDesc);
}

export function listenToAccessRequests(onRequests, onError) {
  const requestsQuery = query(
    collection(db, "accessRequests"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    requestsQuery,
    (snapshot) => onRequests(mapRequestSnapshot(snapshot)),
    onError
  );
}

export function listenToCustomerRequests(userId, onRequests, onError) {
  const requestsQuery = query(
    collection(db, "accessRequests"),
    where("customerId", "==", userId)
  );

  return onSnapshot(
    requestsQuery,
    (snapshot) => onRequests(mapRequestSnapshot(snapshot)),
    onError
  );
}

function updateAccessRequest(requestId, action) {
  return apiRequest(
    `/api/admin/access-requests/${encodeURIComponent(requestId)}/${action}`,
    {
      method: "POST"
    }
  );
}

export function approveAccessRequest(requestId) {
  return updateAccessRequest(requestId, "approve");
}

export function denyAccessRequest(requestId) {
  return updateAccessRequest(requestId, "deny");
}

export function grantAccessRequest(requestId) {
  return updateAccessRequest(requestId, "grant");
}

export function revokeAccessRequest(requestId) {
  return updateAccessRequest(requestId, "revoke");
}
