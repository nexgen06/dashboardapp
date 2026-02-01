/**
 * Firebase (App + Auth) yapılandırması.
 * NEXT_PUBLIC_FIREBASE_* değişkenleri tanımlı değilse Firebase kullanılmaz.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (!isFirebaseConfigured()) return null;
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0] as FirebaseApp;
    return app;
  }
  app = initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseAuth(): Auth | null {
  if (typeof window === "undefined") return null;
  if (!isFirebaseConfigured()) return null;
  if (auth) return auth;
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  auth = getAuth(firebaseApp);
  return auth;
}

export function getFirestoreDb(): Firestore | null {
  if (typeof window === "undefined") return null;
  if (!isFirebaseConfigured()) return null;
  if (db) return db;
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  db = getFirestore(firebaseApp);
  return db;
}

export { isFirebaseConfigured };
