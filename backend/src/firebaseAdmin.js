import "dotenv/config";
import {
  applicationDefault,
  getApps,
  initializeApp
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

const firebaseOptions = {
  credential: applicationDefault(),
  ...(storageBucket ? { storageBucket } : {})
};

const adminApp = getApps().length > 0
  ? getApps()[0]
  : initializeApp(firebaseOptions);

const adminAuth = getAuth(adminApp);
const adminDb = getFirestore(adminApp);
const adminStorage = getStorage(adminApp);

export {
  adminApp,
  adminAuth,
  adminDb,
  adminStorage
};
