import { apiRequest } from "./apiClient.js";

export function createCustomerProfile(registrationData) {
  return apiRequest("/api/register/customer-profile", {
    method: "POST",
    body: JSON.stringify(registrationData)
  });
}
