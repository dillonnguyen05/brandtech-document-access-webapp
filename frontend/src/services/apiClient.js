import { auth } from "../firebase/firebaseConfig";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export async function checkApiConnection() {
  const response = await fetch(`${API_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`Express health check failed with status ${response.status}.`);
  }

  return response.json();
}

export async function apiRequest(path, options = {}) {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("You must be signed in to use the BrandTech API.");
  }

  const idToken = await currentUser.getIdToken();
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== "undefined"
    && options.body instanceof FormData;

  headers.set("Authorization", `Bearer ${idToken}`);

  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = `${API_URL}${path}`;
  const method = options.method || "GET";

  if (import.meta.env.DEV) {
    console.info(`[BrandTech API] Sending ${method} request to ${url}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const error = new Error(
      data?.error || `API request failed with status ${response.status}.`
    );

    error.status = response.status;
    error.data = data;
    throw error;
  }

  if (import.meta.env.DEV) {
    console.info(
      `[BrandTech API] Express responded ${response.status} to ${method} ${path}`
    );
  }

  return data;
}
