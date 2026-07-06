// Function from apiClient.js; checks Firebase sign-in and sends admin user decisions to Express.
import { apiRequest } from "./apiClient.js";

/**
 * Loads active customer profiles used by admin document targeting controls.
 */
export async function loadActiveCustomers() {
  // Function from apiClient.js: checks Firebase sign-in and loads active customers from Express.
  const result = await apiRequest("/api/admin/users/active-customers");
  return result.users;
}

/**
 * Loads pending customer registration requests for admin approval.
 */
export async function loadPendingCustomers() {
  // Function from apiClient.js: checks Firebase sign-in and loads pending users from Express.
  const result = await apiRequest("/api/admin/users/pending");
  return result.users;
}

/**
 * Sends a shared admin account decision request.
 */
function reviewCustomer(userId, action, message = "") {
  // Function from apiClient.js: checks Firebase sign-in and sends the account decision to Express.
  return apiRequest(
    `/api/admin/users/${encodeURIComponent(userId)}/${action}`,
    {
      method: "POST",
      body: JSON.stringify({ message })
    }
  );
}

/**
 * Approves a pending customer account.
 */
export function approveCustomer(userId) {
  return reviewCustomer(userId, "approve");
}

/**
 * Denies a pending customer account with an admin message.
 */
export function denyCustomer(userId, message) {
  return reviewCustomer(userId, "deny", message);
}

/**
 * Revokes an active customer account with an admin message.
 */
export function revokeCustomer(userId, message) {
  return reviewCustomer(userId, "revoke", message);
}
