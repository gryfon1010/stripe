import { initializeApp, cert, getApps, ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Lazily initializes and returns the Firestore instance using Firebase Admin SDK.
 * Requires the following environment variables (do NOT expose them to the browser):
 *
 *  FIREBASE_PROJECT_ID
 *  FIREBASE_CLIENT_EMAIL
 *  FIREBASE_PRIVATE_KEY  (replace newlines with \n)
 */
export function getAdminDb() {
  if (!getApps().length) {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
      throw new Error("Firebase service account environment variables are not set.");
    }

    initializeApp({
      credential: cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        // Replace escaped newlines in the private key
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      } as ServiceAccount),
    });
  }

  return getFirestore();
}
