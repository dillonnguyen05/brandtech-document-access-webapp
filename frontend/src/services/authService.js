// Function from apiClient.js; checks Firebase sign-in and sends the current ID token to Express.
import { apiRequest } from "./apiClient.js";

/**
 * Loads the signed-in user's role/status profile through Express.
 */
export async function loadCurrentUserProfile() {
  const result = await apiRequest("/api/auth/profile");
  return result.user;
}
