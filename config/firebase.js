// Firebase configuration - initialize Firebase services
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence, onAuthStateChanged } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
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

// Initialize Firebase - singleton pattern to prevent double initialization
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  auth = getAuth(app); // Get existing auth instance
}

// Initialize Firestore with long-polling for React Native
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});

// Initialize Storage - try explicit bucket first, fallback to default
let storage;
try {
  // First try with explicit bucket name
  storage = getStorage(app, firebaseConfig.storageBucket);
  console.log('✅ Storage initialized with bucket:', firebaseConfig.storageBucket);
} catch (error) {
  console.warn('⚠️ Failed to initialize Storage with explicit bucket, trying default:', error.message);
  // Fallback to default bucket
  storage = getStorage(app);
  console.log('✅ Storage initialized with default bucket');
}

export { app, auth, db, storage };
