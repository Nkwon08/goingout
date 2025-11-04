// Firebase configuration - initialize Firebase services
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA4LjGDNcL_MnTKN28zhtVB3Tc8T5G3Gkk",
  authDomain: "goingout-8b2e0.firebaseapp.com",
  projectId: "goingout-8b2e0",
  storageBucket: "goingout-8b2e0.firebasestorage.app",
  messagingSenderId: "861094736123",
  appId: "1:861094736123:web:4e7163d87a8624b3ae805e",
  measurementId: "G-VRM4FBNHM7",
};

// Google OAuth Client ID
export const GOOGLE_CLIENT_ID = '861094736123-v0qb4hdkq5e7r46sse6cr4sjk62abuvk.apps.googleusercontent.com';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  auth = getAuth(app); // Get existing auth instance
}
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
