// Authentication context - manages user authentication state across the app
import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getCurrentUserData, ensureUserDoc, upsertUserProfile } from '../services/authService';
import { subscribeToFriends } from '../services/friendsService';
import { debugListUsernames } from '../services/usersService';
import { registerForPushNotifications } from '../services/notificationsService';
import { auth, db } from '../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // State for current user
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  // Friends list state - managed centrally
  const [friendsList, setFriendsList] = useState([]);

  // Function to refresh user data manually
  const refreshUserData = React.useCallback(async (uid) => {
    if (!uid) return;
    try {
      const { userData: data } = await getCurrentUserData(uid);
      if (data) {
        setUserData(data);
        console.log('✅ User data refreshed manually');
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  }, []);

  // Single auth listener + friends subscription - centralized
  useEffect(() => {
    let unsubFriends = null;
    let ensuredForUid = null;
    let lastSubscribedUid = null;
    let isMounted = true;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      // Clean up existing subscription if user changes
      if (unsubFriends) {
        unsubFriends();
        unsubFriends = null;
      }

      // If no user is signed in, clear friends list and user data
      if (!firebaseUser?.uid) {
        console.log('User not signed in, skipping friends subscription');
        setFriendsList([]);
        setUser(null);
        setUserData(null);
        setLoading(false);
        return;
      }

      // Verify auth.currentUser exists before proceeding
      if (!auth.currentUser || auth.currentUser.uid !== firebaseUser.uid) {
        console.log('Auth currentUser not ready, skipping user doc check and friends subscription');
        return;
      }

      // Set user immediately
      setUser(firebaseUser);
      setLoading(false);

      // Set basic userData immediately from Firebase Auth (don't block UI)
      setUserData({
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
        username: firebaseUser.email?.split('@')[0] || 'user',
        avatar: firebaseUser.photoURL || null,
      });

      // Ensure user document exists (one-time per uid)
      if (ensuredForUid !== firebaseUser.uid) {
        try {
          // Ensure document exists (minimal write-first)
          await ensureUserDoc(firebaseUser.uid).catch(() => {});
          
          // Upsert profile with fallbacks (non-blocking, fills missing fields)
          await upsertUserProfile(firebaseUser.uid, {}).catch(() => {});
          
          ensuredForUid = firebaseUser.uid;
          console.log('✅ User document ensured:', firebaseUser.uid);

          // Fetch full user data after ensuring document
          const { userData: data } = await getCurrentUserData(firebaseUser.uid);
          if (isMounted && data) {
            setUserData({
              username: data.username,
              name: data.name,
              avatar: data.avatar || data.photoURL || data.photo || null,
              photoURL: data.photoURL || data.avatar || data.photo || null,
              bio: data.bio,
              age: data.age,
              gender: data.gender,
            });
          }

          // Register for push notifications and save token
          try {
            const { success, token, error } = await registerForPushNotifications();
            if (success && token && db && typeof db === 'object' && Object.keys(db).length > 0) {
              // Save push token to user document
              const userRef = doc(db, 'users', firebaseUser.uid);
              await updateDoc(userRef, {
                pushToken: token,
                updatedAt: new Date().toISOString(),
              });
              console.log('✅ Push notification token saved');
            } else if (error) {
              console.warn('⚠️ Failed to register for push notifications:', error);
            }
          } catch (notifError) {
            console.warn('⚠️ Error registering for push notifications:', notifError);
          }

          // Debug: List all usernames after ensuring document (one-time per session)
          // This helps verify usernames are being stored correctly
          setTimeout(async () => {
            try {
              await debugListUsernames(20);
            } catch (debugError) {
              console.warn('[AuthContext] Debug list usernames failed:', debugError);
            }
          }, 2000); // Wait 2 seconds after ensureUserDoc completes
        } catch (e) {
          console.error('ensureUserDoc error (non-fatal):', e?.message || e);
        }
      }

      // Prevent duplicate subscriptions
      if (lastSubscribedUid === firebaseUser.uid) return;
      lastSubscribedUid = firebaseUser.uid;

      console.log('✅ Setting up friends subscription for', firebaseUser.uid);

      // Create friends subscription once per session
      unsubFriends = subscribeToFriends(firebaseUser.uid, (result) => {
        if (!isMounted) return;

        if (result.error) {
          console.error('❌ Error in friends subscription:', result.error);
          return;
        }

        setFriendsList(result.friends || []);
      });
    });

    return () => {
      isMounted = false;
      if (unsubFriends && typeof unsubFriends === 'function') {
        unsubFriends();
      }
      if (unsubscribeAuth && typeof unsubscribeAuth === 'function') {
        unsubscribeAuth();
      }
    };
  }, []); // Run once on mount - onAuthStateChanged handles all auth state changes

  return (
    <AuthContext.Provider value={{ user, userData, loading, refreshUserData, friendsList }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

