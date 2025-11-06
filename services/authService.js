// Authentication service - handles user login, signup, logout
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { auth, db, storage, GOOGLE_CLIENT_ID } from '../config/firebase';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

// Complete web browser auth session
WebBrowser.maybeCompleteAuthSession();

// ============================================================================
// Profile Writer Utilities
// ============================================================================

/**
 * Remove undefined values from object (Firestore drops them silently)
 * @param {Object} obj - Object to clean
 * @returns {Object} Object without undefined values
 */
const clean = (obj) => {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
};

/**
 * Upload avatar to Storage and return download URL
 * Accepts Expo URI (file:// or asset-library://) or remote URL
 * @param {string} uid - User ID
 * @param {string} source - Local URI or remote URL
 * @returns {Promise<string>} Download URL
 */
export const uploadAvatarAndGetURL = async (uid, source) => {
  try {
    if (!source) return null;
    
    // If it's a remote URL and not explicitly told to mirror, return as-is
    if (source.startsWith('http://') || source.startsWith('https://')) {
      // For now, mirror remote URLs to Storage
      // If you want to skip mirroring, return source here
      try {
        const response = await fetch(source);
        if (!response.ok) {
          console.warn('[uploadAvatarAndGetURL] Failed to fetch remote URL, using as-is');
          return source;
        }
        const blob = await response.blob();
        
        if (!storage || typeof storage !== 'object' || Object.keys(storage).length === 0) {
          console.warn('[uploadAvatarAndGetURL] Storage not configured, using remote URL as-is');
          return source;
        }
        
        const avatarRef = ref(storage, `profile/${uid}/avatar.jpg`);
        const uploadTask = uploadBytesResumable(avatarRef, blob);
        
        await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            null,
            (error) => reject(error),
            () => resolve()
          );
        });
        
        return await getDownloadURL(uploadTask.snapshot.ref);
      } catch (error) {
        console.warn('[uploadAvatarAndGetURL] Failed to mirror remote URL:', error.message);
        return source; // Fallback to original URL
      }
    }
    
    // Local file URI - upload to Storage
    if (!storage || typeof storage !== 'object' || Object.keys(storage).length === 0) {
      throw new Error('Storage not configured');
    }
    
    const avatarRef = ref(storage, `profile/${uid}/avatar.jpg`);
    
    // Fetch and convert to blob
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Image file is empty');
    }
    
    // Upload blob
    const uploadTask = uploadBytesResumable(avatarRef, blob);
    
    await new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        null,
        (error) => reject(error),
        () => resolve()
      );
    });
    
    // Get download URL
    return await getDownloadURL(uploadTask.snapshot.ref);
  } catch (error) {
    console.error('[uploadAvatarAndGetURL] Error:', error);
    throw error;
  }
};

/**
 * Reserve username (optional - ensures uniqueness)
 * Normalizes username and checks for conflicts using transaction
 * @param {string} uid - User ID
 * @param {string} username - Username to reserve
 * @throws {Error} 'username_taken' if username is already taken by another user
 */
export const reserveUsername = async (uid, username) => {
  try {
    if (!username || !uid) return;
    
    // Normalize username
    const username_lowercase = username.toLowerCase().replace(/\s+/g, '');
    
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      console.warn('[reserveUsername] Firestore not configured, skipping reservation');
      return;
    }
    
    const handleRef = doc(db, 'usernames', username_lowercase);
    const userRef = doc(db, 'users', uid);
    
    // Use transaction to ensure atomic username reservation
    await runTransaction(db, async (tx) => {
      const handleDoc = await tx.get(handleRef);
      
      // Check if username is already taken by another user
      if (handleDoc.exists()) {
        const handleData = handleDoc.data();
        if (handleData.uid !== uid) {
          console.warn('[reserveUsername] taken', username);
          throw new Error('username_taken');
        }
        // Username is already reserved by this user - that's fine
      }
      
      // Reserve username
      tx.set(handleRef, { uid, createdAt: serverTimestamp() }, { merge: false });
      
      // Update user document
      tx.set(userRef, { username, username_lowercase, updatedAt: serverTimestamp() }, { merge: true });
    });
    
    console.log('[reserveUsername] reserved', username_lowercase, 'for', uid);
  } catch (error) {
    if (error.message === 'username_taken') {
      throw error; // Re-throw to be handled by caller
    }
    console.error('[reserveUsername] Error:', error);
    // Don't throw - username reservation is optional
  }
};

/**
 * Upsert user profile (idempotent merge writer)
 * Main profile writer that handles all profile updates
 * @param {string} uid - User ID
 * @param {Object} payload - Profile data (name, username, bio, age, gender, location, photoURL, pfpUri)
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const upsertUserProfile = async (uid, payload = {}) => {
  try {
    if (!uid) {
      return { success: false, error: 'No UID provided' };
    }
    
    if (!auth || !auth.currentUser || auth.currentUser.uid !== uid) {
      return { success: false, error: 'User not authenticated' };
    }
    
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured. Please check your Firebase configuration.' };
    }
    
    const authUser = auth.currentUser;
    const email = authUser?.email ?? '';
    
    // Reserve username if provided
    if (payload.username) {
      try {
        await reserveUsername(uid, payload.username);
      } catch (error) {
        if (error.message === 'username_taken') {
          return { success: false, error: 'username_taken' };
        }
        // Continue anyway - reservation failure is non-fatal
      }
    }
    
    // Upload avatar if pfpUri provided
    let photoURL = payload.photoURL ?? null;
    if (payload.pfpUri && !photoURL) {
      try {
        console.log('[upsertUserProfile] Uploading avatar from pfpUri:', payload.pfpUri);
        photoURL = await uploadAvatarAndGetURL(uid, payload.pfpUri);
        console.log('[upsertUserProfile] Avatar uploaded successfully:', photoURL);
      } catch (error) {
        console.error('[upsertUserProfile] Avatar upload failed:', error.message);
        // Continue without photoURL
      }
    } else if (payload.photoURL) {
      console.log('[upsertUserProfile] Using provided photoURL:', payload.photoURL);
    }
    
    // Fallbacks for name and photoURL
    let name = payload.name ?? authUser?.displayName ?? (email ? email.split('@')[0] : 'User');
    if (!photoURL) {
      // Check Storage for existing avatar
      if (storage && typeof storage === 'object' && Object.keys(storage).length > 0) {
        try {
          const avatarRef = ref(storage, `profile/${uid}/avatar.jpg`);
          photoURL = await getDownloadURL(avatarRef);
        } catch (storageError) {
          // Avatar doesn't exist - that's okay
          if (storageError.code !== 'storage/object-not-found') {
            console.warn('[upsertUserProfile] Error checking Storage:', storageError.message);
          }
        }
      }
      // Fallback to Auth photoURL
      if (!photoURL) {
        photoURL = authUser?.photoURL ?? null;
      }
    }
    
    // Derive username if not provided - always set a username
    let username = payload.username ?? null;
    if (!username) {
      // Derive from email or displayName
      username = authUser?.displayName ?? (email ? email.split('@')[0] : `user_${uid.slice(0, 6)}`);
    }
    const username_lowercase = username.toLowerCase().replace(/\s+/g, '');
    
    // Build write payload (clean removes undefined values)
    const write = clean({
      uid,
      email,
      name,
      username,
      username_lowercase,
      bio: payload.bio,
      age: payload.age,
      gender: payload.gender,
      location: payload.location,
      photoURL,
      friends: payload.friends ?? [],
      isDiscoverable: payload.isDiscoverable ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Write to Firestore with merge:true (idempotent)
    const userRef = doc(db, 'users', uid);
    
    try {
      await setDoc(userRef, write, { merge: true });
      console.log('[upsertUserProfile] write', { uid, username, hasPhoto: !!photoURL, photoURL });
      return { success: true, error: null };
    } catch (writeError) {
      console.error('[upsertUserProfile] Write error:', writeError);
      console.error('[upsertUserProfile] Error code:', writeError.code);
      console.error('[upsertUserProfile] Error message:', writeError.message);
      
      // Check for database not found/enabled errors
      if (writeError.code === 'not-found' || 
          writeError.message?.includes('not found') || 
          writeError.message?.includes('doesn\'t exist') ||
          writeError.message?.includes('database') && writeError.message?.includes('not')) {
        return { 
          success: false, 
          error: 'Firestore database not enabled. Please enable Firestore in Firebase Console: https://console.firebase.google.com/project/goingout-8b2e0/firestore' 
        };
      }
      
      // Check for permission errors
      if (writeError.code === 'permission-denied') {
        return { 
          success: false, 
          error: 'Permission denied. Please check Firestore security rules.' 
        };
      }
      
      throw writeError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error('[upsertUserProfile] Error:', error);
    
    // Final check for database errors
    if (error.code === 'not-found' || 
        error.message?.includes('not found') || 
        error.message?.includes('doesn\'t exist') ||
        (error.message?.includes('database') && error.message?.includes('not'))) {
      return { 
        success: false, 
        error: 'Firestore database not enabled. Please enable Firestore in Firebase Console: https://console.firebase.google.com/project/goingout-8b2e0/firestore' 
      };
    }
    
    return { success: false, error: error.message || 'Failed to update profile' };
  }
};

// Sign up new user with email and password
export const signUp = async (email, password, name, username, pfpUri = null) => {
  try {
    if (!auth || !db) {
      throw new Error('Firebase not configured');
    }

    // Create user account
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const user = userCredential.user;

    // Update display name in Auth
    if (name) {
      try {
        await updateProfile(user, { displayName: name });
      } catch (profileError) {
        console.warn('[signUp] Failed to update Auth displayName:', profileError.message);
        // Continue anyway
      }
    }

    // Use upsertUserProfile to create profile (handles username reservation, avatar upload, etc.)
    const profileResult = await upsertUserProfile(user.uid, {
      name,
      username: username || email?.split('@')[0] || null,
      location: 'Bloomington, IN',
      pfpUri, // Upload avatar if provided
    });

    if (!profileResult.success) {
      // Handle username_taken error
      if (profileResult.error === 'username_taken') {
        return { user: null, error: 'username_taken', errorCode: 'username_taken' };
      }
      console.warn('[signUp] Profile creation warning:', profileResult.error);
      // Continue anyway - user account is created
    }

    return { user, error: null };
  } catch (error) {
    console.error('[signUp] Error:', error);
    
    // Handle username_taken from reserveUsername
    if (error.message === 'username_taken') {
      return { user: null, error: 'username_taken', errorCode: 'username_taken' };
    }
    
    return { user: null, error: error.message || 'Failed to sign up.', errorCode: error.code };
  }
};

// Sign in existing user
export const signIn = async (email, password) => {
  try {
    if (!auth) {
      throw new Error('Firebase not configured');
    }
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    return { user: userCredential.user, error: null };
  } catch (error) {
    console.error('Sign in error:', error);
    return { user: null, error: error.message || 'Failed to sign in.' };
  }
};

// Sign out current user
export const signOutUser = async () => {
  try {
    await signOut(auth);
    return { error: null };
  } catch (error) {
    return { error: error.message || 'Failed to sign out' };
  }
};

/**
 * Ensure user document exists in Firestore (minimal write-first creator)
 * Derives basic display handle from auth.currentUser
 * Uses upsertUserProfile internally for consistency
 * @param {string} uid - User ID
 * @returns {Promise<{ userData: Object|null, error: string|null }>}
 */
export const ensureUserDoc = async (uid) => {
  try {
    if (!uid) return { userData: null, error: 'No UID provided' };

    if (!auth || !auth.currentUser || auth.currentUser.uid !== uid) {
      console.log('[ensureUserDoc] User not authenticated, skipping');
      return { userData: null, error: 'User not authenticated' };
    }

    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { userData: null, error: 'Firestore not configured' };
    }

    const authUser = auth.currentUser;
    const email = authUser?.email ?? '';
    
    // Derive basic display handle
    const base = authUser?.displayName ?? (email ? email.split('@')[0] : `user_${uid.slice(0, 6)}`);
    const username = base;
    const displayName = base;

    // Use upsertUserProfile for consistency (it will handle fallbacks)
    // Always provide username to ensure it's set
    const result = await upsertUserProfile(uid, {
      name: displayName,
      username: username, // Always set username to ensure it's stored
      // Don't pass bio/age/gender - let them remain null/undefined
      // photoURL will be handled by upsertUserProfile's fallback logic
    });

    if (!result.success) {
      return { userData: null, error: result.error };
    }

    // Get stored data for return
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    
    if (snap.exists()) {
      const data = snap.data();
      return {
        userData: {
          username: data.username || username,
          name: data.name || displayName,
          photo: data.photoURL || authUser?.photoURL || null,
          bio: data.bio || null,
          age: data.age || null,
          gender: data.gender || null,
        },
        error: null,
      };
    }

    return { userData: null, error: 'Document not found after write' };
  } catch (error) {
    console.error('[ensureUserDoc] Error:', error);
    console.error('[ensureUserDoc] error code:', error.code);
    console.error('[ensureUserDoc] error message:', error.message);
    return { userData: null, error: error.message || 'Failed to ensure user document' };
  }
};

// Get current user data from Firestore
// Returns consolidated fields: username, name, photo (photoURL), bio, age, gender
export const getCurrentUserData = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        userData: {
          username: data.username || auth.currentUser?.email?.split('@')[0] || 'user',
          name: data.name || auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'User',
          photo: data.photoURL || data.avatar || auth.currentUser?.photoURL || null,
          bio: data.bio || null,
          age: data.age || null,
          gender: data.gender || null,
        },
        error: null,
      };
    }
    return { userData: null, error: 'User not found' };
  } catch (error) {
    return { userData: null, error: error.message };
  }
};

// Listen to auth state changes
export const onAuthStateChange = (callback) => {
  return firebaseOnAuthStateChanged(auth, callback);
};

// Sign in with Google using OAuth
export const signInWithGoogle = async () => {
  try {
    if (!auth || !db || !GOOGLE_CLIENT_ID) {
      throw new Error('Firebase or Google Client ID not configured');
    }
    const discovery = {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://www.googleapis.com/oauth2/v4/token',
      revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
    };
    const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
    const request = new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.Code,
      redirectUri,
      extraParams: { access_type: 'offline' },
    });
    const result = await request.promptAsync(discovery, { useProxy: true });

    if (result.type !== 'success') {
      return { user: null, error: 'Google sign in cancelled' };
    }

    const tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        clientId: GOOGLE_CLIENT_ID,
        code: result.params.code,
        redirectUri,
        extraParams: {},
      },
      discovery
    );

    const credential = GoogleAuthProvider.credential(tokenResponse.idToken);
    const userCredential = await signInWithCredential(auth, credential);
    const user = userCredential.user;

    // Use upsertUserProfile to create/update profile (idempotent)
    const profileResult = await upsertUserProfile(user.uid, {
      name: user.displayName || null, // Use provider display name
      // username will be derived from email if not provided
    });

    if (!profileResult.success && profileResult.error !== 'username_taken') {
      console.warn('[signInWithGoogle] Profile update warning:', profileResult.error);
      // Continue anyway - user is signed in
    }

    return { user, error: null };
  } catch (error) {
    console.error('Google sign in error:', error);
    return { user: null, error: error.message || 'Failed to sign in with Google' };
  }
};
