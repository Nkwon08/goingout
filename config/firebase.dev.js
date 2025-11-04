// Development mode - use this for testing without Firebase
// Switch to firebase.js when you have Firebase credentials

// Mock Firebase initialization for development
let mockAuth = {
  currentUser: null,
  onAuthStateChanged: (callback) => {
    // Return unsubscribe function
    return () => {};
  },
};

let mockDb = {};
let mockStorage = {};

export const auth = mockAuth;
export const db = mockDb;
export const storage = mockStorage;

// Development notice
console.warn('⚠️ Using mock Firebase - Development mode');
console.warn('Update config/firebase.js with your Firebase credentials for production');

