import "dotenv/config";
import {
  applicationDefault,
  getApps,
  initializeApp
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Reads the Firebase Storage bucket name from backend/.env so the Admin SDK can manage uploaded files.
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

// Builds the Admin SDK options using the local service-account credential path from GOOGLE_APPLICATION_CREDENTIALS.
const firebaseOptions = {
  credential: applicationDefault(),
  ...(storageBucket ? { storageBucket } : {})
};

// Reuses an existing Admin app during watch-mode reloads, otherwise initializes Firebase Admin once.
const adminApp = getApps().length > 0
  ? getApps()[0]
  : initializeApp(firebaseOptions);

// Shared Firebase Admin clients used by Express routes and middleware.
const adminAuth = getAuth(adminApp);
const adminDb = getFirestore(adminApp);
const adminStorage = getStorage(adminApp);

export {
  adminApp,
  adminAuth,
  adminDb,
  adminStorage
};
