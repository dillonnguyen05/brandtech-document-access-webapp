import { apiRequest } from "./apiClient.js";

/**
 * Sends registration profile data and browser-captured location to Express.
 */
export function createCustomerProfile(registrationData) {
  return apiRequest("/api/register/customer-profile", {
    method: "POST",
    body: JSON.stringify(registrationData)
  });
}
