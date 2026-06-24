import { auth } from "../firebase/firebaseConfig";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/**
 * Confirms the Express API is reachable from the frontend.
 */
export async function checkApiConnection() {
  const response = await fetch(`${API_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`Express health check failed with status ${response.status}.`);
  }

  return response.json();
}

/**
 * Sends a JSON API request to Express with the current Firebase ID token.
 */
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

/**
 * Uploads FormData with XMLHttpRequest so the UI can display upload progress.
 */
export async function uploadApiFile(path, formData, onProgress) {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("You must be signed in to use the BrandTech API.");
  }

  const idToken = await currentUser.getIdToken();
  const url = `${API_URL}${path}`;

  if (import.meta.env.DEV) {
    console.info(`[BrandTech API] Sending POST upload to ${url}`);
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("POST", url);
    request.setRequestHeader("Authorization", `Bearer ${idToken}`);

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;

      const progress = Math.round((event.loaded / event.total) * 100);
      onProgress?.(progress);
    });

    request.addEventListener("load", () => {
      let data;

      try {
        data = request.responseText ? JSON.parse(request.responseText) : null;
      } catch {
        data = undefined;
      }

      if (request.status < 200 || request.status >= 300) {
        const error = new Error(
          data?.error || `API upload failed with status ${request.status}.`
        );

        error.status = request.status;
        error.data = data;
        reject(error);
        return;
      }

      if (import.meta.env.DEV) {
        console.info(
          `[BrandTech API] Express responded ${request.status} to POST ${path}`
        );
      }

      onProgress?.(100);
      resolve(data);
    });

    request.addEventListener("error", () => {
      reject(new Error("Unable to connect to the BrandTech API."));
    });

    request.addEventListener("abort", () => {
      reject(new Error("Document upload was canceled."));
    });

    request.send(formData);
  });
}
