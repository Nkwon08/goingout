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
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, GOOGLE_CLIENT_ID } from '../config/firebase';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

// Complete web browser auth session
WebBrowser.maybeCompleteAuthSession();

// Sign up new user with email and password
export const signUp = async (email, password, name, username) => {
  try {
    console.log('📝 Attempting to sign up:', email);
    console.log('🔍 Auth object:', auth ? 'exists' : 'null');
    console.log('🔍 Auth is mock?', auth?._isMock);
    console.log('🔍 Auth has app?', auth?.app ? 'yes' : 'no');
    
    // Check if Firebase is configured (check if auth is mock)
    if (!auth) {
      console.error('❌ Auth object is null');
      return { 
        user: null, 
        error: 'Firebase not configured.\n\nTo use this feature:\n1. Update config/firebase.js with your Firebase credentials\n2. Restart the app: expo start --clear\n\nSee FIREBASE_SETUP.md for setup instructions.' 
      };
    }
    
    if (auth._isMock === true) {
      console.error('❌ Auth is mock (development mode)');
      return { 
        user: null, 
        error: 'Firebase not configured.\n\nTo use this feature:\n1. Update config/firebase.js with your Firebase credentials\n2. Restart the app: expo start --clear\n\nSee FIREBASE_SETUP.md for setup instructions.' 
      };
    }
    
    // Additional check: ensure auth has required Firebase methods
    if (typeof createUserWithEmailAndPassword !== 'function') {
      console.error('❌ createUserWithEmailAndPassword function not available');
      return {
        user: null,
        error: 'Firebase auth functions not available. Please restart the app: expo start --clear'
      };
    }

    // Validate email and password
    if (!email || !email.trim()) {
      return { user: null, error: 'Please enter your email address' };
    }
    
    if (!password || !password.trim()) {
      return { user: null, error: 'Please enter your password' };
    }
    
    if (password.length < 6) {
      return { user: null, error: 'Password must be at least 6 characters' };
    }

    console.log('✅ Calling createUserWithEmailAndPassword...');
    // Create user account
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const user = userCredential.user;
    console.log('✅ User account created:', user.email);

    // Update display name
    console.log('✅ Updating profile with name:', name);
    await updateProfile(user, { displayName: name });

    // Create user document in Firestore with all profile fields
    // This ensures profile data persists across app restarts
    if (db && typeof db === 'object' && Object.keys(db).length > 0) {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        // Create new user document with all profile fields
        const finalUsername = username || email?.split('@')[0] || 'user';
        await setDoc(userRef, {
          uid: user.uid,
          email,
          name: name || user.displayName || email?.split('@')[0] || 'User',
          username: finalUsername,
          usernameLowercase: finalUsername.trim().toLowerCase(), // For faster username search
          avatar: user.photoURL || `https://i.pravatar.cc/100?img=${Math.floor(Math.random() * 70) + 1}`,
          bio: null, // User can add bio later in Edit Profile
          age: null, // User can add age later in Edit Profile
          gender: null, // User can add gender later in Edit Profile
          location: 'Bloomington, IN', // Default location
          friends: [], // Initialize empty friends array
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log('✅ User document created in Firestore');
      } else {
        // User document exists - ensure it has all required fields
        const existingData = userDoc.data();
        const updateData = {};
        
        if (!existingData.name && name) updateData.name = name;
        if (!existingData.username && username) {
          updateData.username = username;
          updateData.usernameLowercase = username.trim().toLowerCase(); // For faster username search
        }
        if (!existingData.avatar && user.photoURL) updateData.avatar = user.photoURL;
        if (!existingData.hasOwnProperty('bio')) updateData.bio = existingData.bio || null;
        if (!existingData.hasOwnProperty('age')) updateData.age = existingData.age || null;
        if (!existingData.hasOwnProperty('gender')) updateData.gender = existingData.gender || null;
        if (!existingData.location) updateData.location = 'Bloomington, IN';
        if (Object.keys(updateData).length > 0) {
          updateData.updatedAt = serverTimestamp();
          await updateDoc(userRef, updateData);
          console.log('✅ User document updated with missing fields');
        }
      }
    }

    console.log('✅ Sign up successful');
    return { user, error: null };
  } catch (error) {
    console.error('❌ Sign up error:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/email-already-in-use') {
      return { 
        user: null, 
        error: 'An account with this email already exists. Please sign in instead.',
        errorCode: 'email-already-in-use' // Add error code for easier detection
      };
    }
    if (error.code === 'auth/invalid-email') {
      return { user: null, error: 'Invalid email address. Please check and try again.' };
    }
    if (error.code === 'auth/weak-password') {
      return { user: null, error: 'Password is too weak. Please use a stronger password.' };
    }
    if (error.code === 'auth/network-request-failed') {
      return { user: null, error: 'Network error. Please check your internet connection and try again.' };
    }
    if (error.code === 'auth/operation-not-allowed') {
      return { user: null, error: 'Email/password sign up is not enabled. Please contact support.' };
    }
    
    // Check if error is from Firebase not being configured
    if (error.message && (error.message.includes('Firebase') || error.message.includes('auth'))) {
      return { user: null, error: 'Firebase not configured. Please set up Firebase credentials in config/firebase.js' };
    }
    
    // Return user-friendly error message
    return { user: null, error: error.message || 'Failed to sign up. Please try again.' };
  }
};

// Sign in existing user
export const signIn = async (email, password) => {
  try {
    console.log('🔐 Attempting to sign in:', email);
    
    // Check if Firebase is configured (check if auth is mock)
    if (!auth) {
      console.error('❌ Auth object is null');
      return { 
        user: null, 
        error: 'Firebase not configured.\n\nTo use this feature:\n1. Update config/firebase.js with your Firebase credentials\n2. Restart the app: expo start --clear\n\nSee FIREBASE_SETUP.md for setup instructions.' 
      };
    }
    
    if (auth._isMock === true) {
      console.error('❌ Auth is mock (development mode)');
      return { 
        user: null, 
        error: 'Firebase not configured.\n\nTo use this feature:\n1. Update config/firebase.js with your Firebase credentials\n2. Restart the app: expo start --clear\n\nSee FIREBASE_SETUP.md for setup instructions.' 
      };
    }

    // Validate email and password
    if (!email || !email.trim()) {
      return { user: null, error: 'Please enter your email address' };
    }
    
    if (!password || !password.trim()) {
      return { user: null, error: 'Please enter your password' };
    }

    console.log('✅ Calling signInWithEmailAndPassword...');
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const user = userCredential.user;
    console.log('✅ Sign in successful:', user.email);
    
    // Fetch and update user data from Firestore to ensure usernameLowercase exists (migration)
    if (db && typeof db === 'object' && Object.keys(db).length > 0) {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        // Ensure existing user document has usernameLowercase field (migration)
        const existingData = userDoc.data();
        const updateData = {};
        
        if (!existingData.usernameLowercase && existingData.username) {
          updateData.usernameLowercase = String(existingData.username).trim().toLowerCase();
          updateData.updatedAt = serverTimestamp();
          await updateDoc(userRef, updateData);
          console.log('✅ Added usernameLowercase to existing user (migration)');
        }
      }
    }
    
    return { user, error: null };
  } catch (error) {
    console.error('❌ Sign in error:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/user-not-found') {
      return { user: null, error: 'No account found with this email address. Please sign up first.' };
    }
    if (error.code === 'auth/wrong-password') {
      return { user: null, error: 'Incorrect password. Please try again.' };
    }
    if (error.code === 'auth/invalid-email') {
      return { user: null, error: 'Invalid email address. Please check and try again.' };
    }
    if (error.code === 'auth/user-disabled') {
      return { user: null, error: 'This account has been disabled. Please contact support.' };
    }
    if (error.code === 'auth/too-many-requests') {
      return { user: null, error: 'Too many failed attempts. Please try again later.' };
    }
    if (error.code === 'auth/network-request-failed') {
      return { user: null, error: 'Network error. Please check your internet connection and try again.' };
    }
    
    // Check if error is from Firebase not being configured
    if (error.message && (error.message.includes('Firebase') || error.message.includes('auth'))) {
      return { user: null, error: 'Firebase not configured. Please set up Firebase credentials in config/firebase.js' };
    }
    
    // Return user-friendly error message
    return { user: null, error: error.message || 'Failed to sign in. Please check your email and password.' };
  }
};

// Sign out current user
export const signOutUser = async () => {
  try {
    // Check if Firebase is configured (check if auth is mock)
    if (!auth || auth._isMock === true) {
      // Mock auth - nothing to sign out, return success
      return { error: null };
    }
    await signOut(auth);
    return { error: null };
  } catch (error) {
    return { error: error.message || 'Failed to sign out' };
  }
};

// Get current user data from Firestore
export const getCurrentUserData = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return { userData: userDoc.data(), error: null };
    }
    return { userData: null, error: 'User not found' };
  } catch (error) {
    return { userData: null, error: error.message };
  }
};

// Listen to auth state changes
export const onAuthStateChange = (callback) => {
  try {
    // Check if auth exists and has onAuthStateChanged method
    if (!auth) {
      // No auth object - call callback with null
      if (callback && typeof callback === 'function') {
        callback(null);
      }
      return () => {};
    }

    // Check if this is the mock auth (has _isMock flag)
    // Real Firebase auth uses the imported function, mock auth uses the method
    if (auth && auth._isMock === true) {
      // This is mock auth - use its method directly
      return auth.onAuthStateChanged(callback);
    } else {
      // Real Firebase auth - use Firebase's onAuthStateChanged function
      try {
        return firebaseOnAuthStateChanged(auth, callback);
      } catch (error) {
        console.error('Firebase onAuthStateChanged error:', error);
        // Fallback: call callback with null
        if (callback && typeof callback === 'function') {
          callback(null);
        }
        return () => {};
      }
    }
  } catch (error) {
    console.error('onAuthStateChange error:', error);
    // Call callback with null (not logged in) and return dummy unsubscribe
    if (callback && typeof callback === 'function') {
      callback(null);
    }
    return () => {};
  }
};

// Sign in with Google using OAuth
export const signInWithGoogle = async () => {
  try {
    // Check if Firebase is configured
    // Real Firebase auth objects have an 'app' property and are not mock objects
    if (!auth || auth._isMock === true) {
      return { 
        user: null, 
        error: 'Firebase not configured. Please:\n1. Update config/firebase.js with your Firebase credentials\n2. Set GOOGLE_CLIENT_ID\n3. Restart the app (expo start --clear)' 
      };
    }

    // Check if this is actually a real Firebase auth object
    if (!auth.app && typeof auth.currentUser === 'undefined') {
      return { 
        user: null, 
        error: 'Firebase auth not initialized. Please check your Firebase configuration and restart the app' 
      };
    }

    const googleClientId = GOOGLE_CLIENT_ID;
    if (!googleClientId || googleClientId === 'YOUR_GOOGLE_CLIENT_ID') {
      return { 
        user: null, 
        error: 'Google Client ID not configured. Please set GOOGLE_CLIENT_ID in config/firebase.js. See GOOGLE_SIGNIN_SETUP.md for instructions' 
      };
    }

    // Google OAuth configuration
    const discovery = {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://www.googleapis.com/oauth2/v4/token',
      revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
    };

    // Get redirect URI - MUST use Expo proxy (https://auth.expo.io) for Google OAuth
    // Google doesn't accept exp:// URIs - must use https:// domain
    // Force use of Expo's proxy to get https://auth.expo.io URL
    const redirectUri = AuthSession.makeRedirectUri({
      useProxy: true, // CRITICAL: Use Expo's proxy server for https:// domain
      scheme: undefined, // Don't use custom scheme
      path: undefined, // Use default path
    });
    
    // Ensure we're getting an https:// URL (Expo proxy URL)
    // Should be something like: https://auth.expo.io/@anonymous/outlink
    if (!redirectUri || !redirectUri.startsWith('https://')) {
      // Fallback: construct Expo proxy URL manually
      const expoUsername = Constants.expoConfig?.extra?.expoUsername || 'anonymous';
      const projectSlug = Constants.expoConfig?.slug || 'outlink';
      const fallbackRedirectUri = `https://auth.expo.io/@${expoUsername}/${projectSlug}`;
      console.warn('⚠️ Using fallback redirect URI:', fallbackRedirectUri);
      var finalRedirectUri = fallbackRedirectUri;
    } else {
      var finalRedirectUri = redirectUri;
    }

    // Verify it's using https:// (not exp://)
    if (!finalRedirectUri.startsWith('https://')) {
      console.error('❌ ERROR: Redirect URI must use https://');
      console.error('   Current URI:', finalRedirectUri);
      return { 
        user: null, 
        error: 'Redirect URI must use https:// domain. Google OAuth does not accept exp:// URIs.\n\nPlease add this URI to Google Cloud Console:\n' + finalRedirectUri
      };
    }
    
    console.log('📝 IMPORTANT: Add this redirect URI to Google Cloud Console:');
    console.log(`   ${finalRedirectUri}`);
    console.log('   1. Go to: https://console.cloud.google.com/apis/credentials');
    console.log('   2. Edit your OAuth 2.0 Client ID');
    console.log('   3. Add the URI above to "Authorized redirect URIs"');
    console.log('   4. Save and wait 2-5 minutes');

    // Request configuration - use Code flow to get ID token
    const request = new AuthSession.AuthRequest({
      clientId: googleClientId,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.Code,
      redirectUri: finalRedirectUri, // Use the https:// redirect URI
      extraParams: {
        access_type: 'offline',
      },
    });

    // Start authentication - MUST use proxy to match redirect URI
    const result = await request.promptAsync(discovery, {
      useProxy: true, // CRITICAL: Must match redirect URI configuration
    });

    if (result.type !== 'success') {
      return { user: null, error: 'Google sign in cancelled' };
    }

    // Exchange code for tokens - must use same redirect URI
    const tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        clientId: googleClientId,
        code: result.params.code,
        redirectUri: finalRedirectUri, // Use same redirect URI as request
        extraParams: {},
      },
      discovery
    );

    // Get ID token from Google
    const idToken = tokenResponse.idToken;

    // Create Google credential using ID token
    const credential = GoogleAuthProvider.credential(idToken);

    // Sign in with credential
    const userCredential = await signInWithCredential(auth, credential);
    const user = userCredential.user;

    // Check if user exists in Firestore, if not create it with all profile fields
    // This ensures profile data persists across app restarts
    if (db && typeof db === 'object' && Object.keys(db).length > 0) {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        // Extract name and username from email or display name
        const name = user.displayName || user.email?.split('@')[0] || 'User';
        const username = user.email?.split('@')[0] || `user_${user.uid.slice(0, 8)}`;
        
        // Create new user document with all profile fields
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          name,
          username,
          usernameLowercase: username.trim().toLowerCase(), // For faster username search
          avatar: user.photoURL || `https://i.pravatar.cc/100?img=${Math.floor(Math.random() * 70) + 1}`,
          bio: null, // User can add bio later in Edit Profile
          age: null, // User can add age later in Edit Profile
          gender: null, // User can add gender later in Edit Profile
          location: 'Bloomington, IN', // Default location
          friends: [], // Initialize empty friends array
          provider: 'google',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log('✅ Google user document created in Firestore');
      } else {
        // User document exists - ensure it has all required fields
        const existingData = userDoc.data();
        const updateData = {};
        
        if (!existingData.name && user.displayName) updateData.name = user.displayName;
        if (!existingData.username) {
          const defaultUsername = user.email?.split('@')[0] || `user_${user.uid.slice(0, 8)}`;
          updateData.username = defaultUsername;
          updateData.usernameLowercase = defaultUsername.trim().toLowerCase(); // For faster username search
        }
        // Add usernameLowercase for existing users who don't have it yet (migration)
        if (existingData.username && !existingData.usernameLowercase) {
          updateData.usernameLowercase = String(existingData.username).trim().toLowerCase();
        }
        if (!existingData.avatar && user.photoURL) updateData.avatar = user.photoURL;
        if (!existingData.hasOwnProperty('bio')) updateData.bio = existingData.bio || null;
        if (!existingData.hasOwnProperty('age')) updateData.age = existingData.age || null;
        if (!existingData.hasOwnProperty('gender')) updateData.gender = existingData.gender || null;
        if (!existingData.location) updateData.location = 'Bloomington, IN';
        if (Object.keys(updateData).length > 0) {
          updateData.updatedAt = serverTimestamp();
          await updateDoc(userRef, updateData);
          console.log('✅ Google user document updated with missing fields');
        }
      }
    }

    return { user, error: null };
  } catch (error) {
    console.error('Google sign in error:', error);
    if (error.message && error.message.includes('Firebase')) {
      return { user: null, error: 'Firebase not configured. Please set up Firebase credentials in config/firebase.js' };
    }
    return { user: null, error: error.message || 'Failed to sign in with Google' };
  }
};

