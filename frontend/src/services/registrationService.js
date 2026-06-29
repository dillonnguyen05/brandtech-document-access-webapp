// Function from apiClient.js; checks Firebase sign-in and sends the registration profile to Express.
import { apiRequest } from "./apiClient.js";

/**
 * Sends registration profile data and browser-captured location to Express.
 */
export function createCustomerProfile(registrationData) {
  // Function from apiClient.js: checks Firebase sign-in and sends registration data to Express.
  return apiRequest("/api/register/customer-profile", {
    method: "POST",
    body: JSON.stringify(registrationData)
  });
}
