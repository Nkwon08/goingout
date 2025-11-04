// Firebase configuration - initialize Firebase services
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase config - replace with your Firebase project credentials
const firebaseConfig = {
  apiKey: 'AIzaSyA4LjGDNcL_MnTKN28zhtVB3Tc8T5G3Gkk',
  authDomain: 'goingout-8b2e0.firebaseapp.com',
  projectId: 'goingout-8b2e0',
  storageBucket: 'goingout-8b2e0.firebasestorage.app',
  messagingSenderId: '861094736123',
  appId: '1:861094736123:web:4e7163d87a8624b3ae805e',
  measurementId: 'G-VRM4FBNHM7', // Optional: For Google Analytics
};

// Google OAuth Client ID
export const GOOGLE_CLIENT_ID = '861094736123-v0qb4hdkq5e7r46sse6cr4sjk62abuvk.apps.googleusercontent.com';

// Check if Firebase is configured
const isConfigured = firebaseConfig.apiKey !== 'YOUR_API_KEY';

let app, auth, db, storage;

// Create mock auth object for development mode
const createMockAuth = () => {
  const mockAuth = {
    currentUser: null,
    _isMock: true, // Flag to identify mock auth
    onAuthStateChanged: (callback) => {
      // Mock: call callback immediately with null (not logged in)
      if (callback && typeof callback === 'function') {
        // Use setTimeout(0) to make it async like real Firebase
        setTimeout(() => {
          callback(null);
        }, 0);
      }
      return () => {}; // Return unsubscribe function
    },
  };
  return mockAuth;
};

if (isConfigured) {
  try {
    console.log('🔧 Initializing Firebase...');
    // Initialize Firebase with real credentials
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase app initialized');
    
    // Initialize Auth with AsyncStorage persistence (saves auth state automatically)
    // This ensures users stay signed in across app restarts
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
      console.log('✅ Firebase Auth initialized with persistence');
    } catch (error) {
      console.log('⚠️ Auth initialization error (might already be initialized):', error.message);
      // Auth already initialized, get existing instance
      // The existing instance should already have persistence configured
      try {
        auth = getAuth(app);
        console.log('✅ Using existing Firebase Auth instance');
      } catch (getAuthError) {
        console.error('❌ Error getting auth:', getAuthError.message);
        throw getAuthError;
      }
    }
    
    // Verify auth is not mock
    if (auth && auth._isMock === true) {
      throw new Error('Auth was set to mock even though Firebase is configured');
    }
    
    // Initialize Firestore (database)
    try {
      db = getFirestore(app);
      console.log('✅ Firestore initialized');
    } catch (dbError) {
      console.error('❌ Firestore initialization error:', dbError.message);
      throw dbError;
    }
    
    // Initialize Storage (for images/videos)
    try {
      storage = getStorage(app);
      console.log('✅ Firebase Storage initialized');
    } catch (storageError) {
      console.error('❌ Storage initialization error:', storageError.message);
      throw storageError;
    }
    
    console.log('✅ Firebase initialized successfully');
    console.log('🔍 Auth object type:', typeof auth);
    console.log('🔍 Auth is mock?', auth?._isMock);
    console.log('🔍 Auth has app?', auth?.app ? 'yes' : 'no');
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.warn('⚠️ Falling back to development mode');
    // Fall through to development mode
    auth = createMockAuth();
    db = {};
    storage = {};
    app = undefined;
  }
} else {
  // Development mode - use mock objects
  console.warn('⚠️ Firebase not configured - Using development mode');
  console.warn('⚠️ Update config/firebase.js with your Firebase credentials');
  
  auth = createMockAuth();
  db = {};
  storage = {};
  app = undefined;
  
  console.warn('⚠️ Running in development mode - Authentication disabled');
}

export { app, auth, db, storage };

