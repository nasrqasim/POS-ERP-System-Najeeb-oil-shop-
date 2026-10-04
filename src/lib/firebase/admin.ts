import * as admin from 'firebase-admin';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "al-hadeed-traders";

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId,
    });
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export default admin;
