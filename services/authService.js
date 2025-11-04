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
    if (!auth || !db) {
      throw new Error('Firebase not configured');
    }

    // Create user account
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const user = userCredential.user;

    // Update display name
    await updateProfile(user, { displayName: name });

    // Create user document in Firestore
    const userRef = doc(db, 'users', user.uid);
    const finalUsername = username || email?.split('@')[0] || 'user';
    await setDoc(userRef, {
      uid: user.uid,
      email,
      name: name || user.displayName || email?.split('@')[0] || 'User',
      username: finalUsername,
      avatar: user.photoURL || `https://i.pravatar.cc/100?img=${Math.floor(Math.random() * 70) + 1}`,
      bio: null,
      age: null,
      gender: null,
      location: 'Bloomington, IN',
      friends: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { user, error: null };
  } catch (error) {
    console.error('Sign up error:', error);
    return { user: null, error: error.message || 'Failed to sign up.' };
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
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      const name = user.displayName || user.email?.split('@')[0] || 'User';
      const username = user.email?.split('@')[0] || `user_${user.uid.slice(0, 8)}`;
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        name,
        username,
        avatar: user.photoURL || `https://i.pravatar.cc/100?img=${Math.floor(Math.random() * 70) + 1}`,
        bio: null,
        age: null,
        gender: null,
        location: 'Bloomington, IN',
        friends: [],
        provider: 'google',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    return { user, error: null };
  } catch (error) {
    console.error('Google sign in error:', error);
    return { user: null, error: error.message || 'Failed to sign in with Google' };
  }
};
