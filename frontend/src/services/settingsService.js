// Function from apiClient.js; checks Firebase sign-in and sends admin settings requests to Express.
import { apiRequest } from "./apiClient.js";

/**
 * Loads admin access request defaults from Express.
 */
export async function loadAccessRequestDefaults() {
  const result = await apiRequest("/api/admin/settings/access-requests");

  return result.settings;
}

/**
 * Saves admin access request defaults through Express.
 */
export async function saveAccessRequestDefaults(settings) {
  const result = await apiRequest("/api/admin/settings/access-requests", {
    method: "PUT",
    body: JSON.stringify(settings)
  });

  return result.settings;
}
