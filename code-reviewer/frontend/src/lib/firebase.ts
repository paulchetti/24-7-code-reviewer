import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';

// Google Cloud Identity Platform / Firebase Auth Configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemo-CloudIdentityPlatformKey",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "qwiklabs-gcp-04-a30b79abe2f7.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "qwiklabs-gcp-04-a30b79abe2f7",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "qwiklabs-gcp-04-a30b79abe2f7.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef123456",
};

let app: FirebaseApp;
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (e) {
    console.warn("Firebase App initialization warning:", e);
  }
} else {
  app = getApps()[0];
}

export const auth = getAuth(app!);
export const googleProvider = new GoogleAuthProvider();

export interface AuthUserState {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isDemoUser: boolean;
  token: string;
}

// Default demo developer for seamless hackathon testing
export const DEMO_USER: AuthUserState = {
  uid: "hackathon-dev-01",
  email: "developer@codekitchen.gcp",
  displayName: "Principal Cloud Engineer",
  photoURL: "https://api.dicebear.com/7.x/bottts/svg?seed=GCPArchitect",
  isDemoUser: true,
  token: "demo-token-12345",
};

export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.warn("Firebase Google popup login failed. Using demo developer profile:", error);
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.warn("Logout error:", error);
  }
}
