import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { apiRequest } from "./apiClient.js";

export async function createAccessRequest(document) {
  if (!document?.id) {
    throw new Error("Select a document before requesting access.");
  }

  return apiRequest("/api/access-requests", {
    method: "POST",
    body: JSON.stringify({
      documentId: document.id
    })
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

function sortByCreatedAtAsc(a, b) {
  const aMillis = typeof a.createdAt?.toMillis === "function" ? a.createdAt.toMillis() : 0;
  const bMillis = typeof b.createdAt?.toMillis === "function" ? b.createdAt.toMillis() : 0;
  return aMillis - bMillis;
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
    .sort(sortByCreatedAtAsc);
}

export function listenToAccessRequests(onRequests, onError) {
  const requestsQuery = query(
    collection(db, "accessRequests"),
    orderBy("createdAt", "asc")
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

function updateAccessRequest(requestId, action, message = "") {
  return apiRequest(
    `/api/admin/access-requests/${encodeURIComponent(requestId)}/${action}`,
    {
      method: "POST",
      body: JSON.stringify({ message })
    }
  );
}

export function approveAccessRequest(requestId) {
  return updateAccessRequest(requestId, "approve");
}

export function denyAccessRequest(requestId, message) {
  return updateAccessRequest(requestId, "deny", message);
}

export function grantAccessRequest(requestId) {
  return updateAccessRequest(requestId, "grant");
}

export function revokeAccessRequest(requestId, message) {
  return updateAccessRequest(requestId, "revoke", message);
}
