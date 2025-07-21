// NOTIZ-NEW/lib/firebase.js

import { initializeApp, getApps, getApp } from "firebase/app"; // Import getApps and getApp
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// IMPORTANT: These values are now read from environment variables (e.g., .env.local)
// They MUST be prefixed with NEXT_PUBLIC_ for client-side access in Next.js
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Include only if you enabled Analytics
};

// --- DIAGNOSTIC LOG: CHECK THESE VALUES IN YOUR TERMINAL ---
console.log("Firebase Config loaded in firebase.js:", firebaseConfig);
// --- END DIAGNOSTIC LOG ---


// Initialize Firebase App
// Use getApps() to check if an app has already been initialized
// This is the correct way to prevent re-initialization with the modular SDK
let app;
if (getApps().length === 0) { // Check if no Firebase apps are currently initialized
  app = initializeApp(firebaseConfig);
} else {
  app = getApp(); // If an app is already initialized, retrieve it
}

// Get the Authentication service instance
const auth = getAuth(app);
// Get the Firestore service instance
const db = getFirestore(app);

// Export the services so they can be used in other files
export { app, auth, db };
