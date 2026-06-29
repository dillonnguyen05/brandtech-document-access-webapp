import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where
} from "firebase/firestore";
// Firestore client from firebaseConfig.js; realtime listeners check request records in Firestore.
import { db } from "../firebase/firebaseConfig";
// Function from apiClient.js; checks Firebase sign-in and sends access-request decisions to Express.
import { apiRequest } from "./apiClient.js";

/**
 * Creates or resubmits a customer document access request.
 */
export async function createAccessRequest(document) {
  if (!document?.id) {
    throw new Error("Select a document before requesting access.");
  }

  // Function from apiClient.js: checks Firebase sign-in and sends the customer access request to Express.
  return apiRequest("/api/access-requests", {
    method: "POST",
    body: JSON.stringify({
      documentId: document.id
    })
  });
}

/**
 * Formats Firestore request timestamps for request tables.
 */
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

/**
 * Sorts access requests oldest first so admins handle the queue fairly.
 */
function sortByCreatedAtAsc(a, b) {
  const aMillis = typeof a.createdAt?.toMillis === "function" ? a.createdAt.toMillis() : 0;
  const bMillis = typeof b.createdAt?.toMillis === "function" ? b.createdAt.toMillis() : 0;
  return aMillis - bMillis;
}

/**
 * Converts Firestore access request snapshots into UI-ready request objects.
 */
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

/**
 * Opens a realtime listener for all access requests in admin view.
 */
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

/**
 * Opens a realtime listener for one customer's access request history.
 */
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

/**
 * Sends a shared admin decision request for approve, deny, grant, or revoke.
 */
function updateAccessRequest(requestId, action, message = "") {
  // Function from apiClient.js: checks Firebase sign-in and sends the admin request decision to Express.
  return apiRequest(
    `/api/admin/access-requests/${encodeURIComponent(requestId)}/${action}`,
    {
      method: "POST",
      body: JSON.stringify({ message })
    }
  );
}

/**
 * Approves a pending document access request.
 */
export function approveAccessRequest(requestId) {
  return updateAccessRequest(requestId, "approve");
}

/**
 * Denies a pending document access request with an admin message.
 */
export function denyAccessRequest(requestId, message) {
  return updateAccessRequest(requestId, "deny", message);
}

/**
 * Grants access again after a denied or revoked request.
 */
export function grantAccessRequest(requestId) {
  return updateAccessRequest(requestId, "grant");
}

/**
 * Revokes a previously approved document access request with an admin message.
 */
export function revokeAccessRequest(requestId, message) {
  return updateAccessRequest(requestId, "revoke", message);
}
