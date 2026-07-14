// Function from apiClient.js; checks Firebase sign-in and sends profile-photo requests to Express.
import { apiRequest } from "./apiClient.js";

/**
 * Saves the signed-in user's selected profile photo through Express and Firebase Storage.
 */
export async function uploadProfilePhoto(file) {
  const formData = new FormData();
  formData.append("photo", file);

  const result = await apiRequest("/api/auth/profile-photo", {
    method: "POST",
    body: formData
  });

  return result.user;
}

/**
 * Removes the signed-in user's saved profile photo through Express.
 */
export async function removeProfilePhoto() {
  const result = await apiRequest("/api/auth/profile-photo", {
    method: "DELETE"
  });

  return result.user;
}
