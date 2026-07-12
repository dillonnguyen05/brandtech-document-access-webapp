// Function from apiClient.js; checks Firebase sign-in and sends access-request decisions to Express.
import { apiRequest } from "./apiClient.js";

/**
 * Creates or resubmits a customer document/folder access request.
 */
export async function createAccessRequest(resource) {
  if (!resource?.id) {
    throw new Error("Select a document or folder before requesting access.");
  }

  const resourceType = resource.resourceType === "folder" ? "folder" : "document";

  // Function from apiClient.js: checks Firebase sign-in and sends the customer access request to Express.
  return apiRequest("/api/access-requests", {
    method: "POST",
    body: JSON.stringify({
      resourceType,
      documentId: resourceType === "document" ? resource.id : "",
      folderId: resourceType === "folder" ? resource.id : ""
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
 * Sorts access requests oldest first so admins handle the queue fairly.
 */
function sortByCreatedAtAsc(a, b) {
  const aMillis = typeof a.createdAt?.toMillis === "function"
    ? a.createdAt.toMillis()
    : new Date(a.createdAt || 0).getTime();
  const bMillis = typeof b.createdAt?.toMillis === "function"
    ? b.createdAt.toMillis()
    : new Date(b.createdAt || 0).getTime();
  return aMillis - bMillis;
}

/**
 * Converts access request API rows into UI-ready request objects.
 */
function mapApiRequests(requests = []) {
  return requests
    .map((request) => ({
      ...request,
      dateRequested: formatRequestDate(request.createdAt)
    }))
    .sort(sortByCreatedAtAsc);
}

/**
 * Loads all access requests for the admin queue through Express.
 */
export async function loadAccessRequests() {
  // Function from apiClient.js: checks Firebase sign-in and loads admin access requests from Express.
  const result = await apiRequest("/api/admin/access-requests");
  return mapApiRequests(result.requests);
}

/**
 * Loads one customer's access request history through Express.
 */
export async function loadCustomerRequests() {
  // Function from apiClient.js: checks Firebase sign-in and loads this customer's requests from Express.
  const result = await apiRequest("/api/access-requests");
  return mapApiRequests(result.requests);
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

/**
 * Updates which nested documents are excluded from an approved folder request.
 */
export async function updateFolderAccessExclusions(requestId, excludedDocumentIds) {
  // Function from apiClient.js: checks Firebase sign-in and updates folder access exclusions through Express.
  const result = await apiRequest(
    `/api/admin/access-requests/${encodeURIComponent(requestId)}/exclusions`,
    {
      method: "PATCH",
      body: JSON.stringify({
        excludedDocumentIds
      })
    }
  );

  return mapApiRequests([result.request])[0];
}
