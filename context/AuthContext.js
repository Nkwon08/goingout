// Authentication context - manages user authentication state across the app
import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getCurrentUserData, ensureUserDoc, upsertUserProfile } from '../services/authService';
import { subscribeToFriends, subscribeToOutgoingFriendRequests } from '../services/friendsService';
import { debugListUsernames } from '../services/usersService';
import { registerForPushNotifications } from '../services/notificationsService';
import { auth, db } from '../config/firebase';
import { doc, updateDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // State for current user
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  // Friends list state - managed centrally
  const [friendsList, setFriendsList] = useState([]);
  // Track if user needs to select a username
  const [needsUsername, setNeedsUsername] = useState(false);

  // Function to refresh user data manually
  const refreshUserData = React.useCallback(async (uid, forceRefresh = true) => {
    if (!uid) return;
    try {
      const { userData: data } = await getCurrentUserData(uid, forceRefresh);
      if (data) {
        // Check if user needs a username (temp document or no username)
        const hasUsername = data.username && data.username.trim() && !data.username.startsWith('temp_');
        setNeedsUsername(!hasUsername);
        
        // Prevent overwriting with stale/null data if we already have valid data
        // Only update if the new data has a photoURL or if we don't have one yet
        setUserData(prevData => {
          // If new data has photoURL, always use it
          if (data.photoURL || data.avatar) {
            console.log('✅ Updating userData with new photoURL:', data.photoURL || data.avatar);
            return data;
          }
          // If new data doesn't have photoURL but old data does, keep old photoURL
          if (prevData && (prevData.photoURL || prevData.avatar) && !data.photoURL && !data.avatar) {
            console.log('⚠️ New data missing photoURL, keeping existing:', prevData.photoURL || prevData.avatar);
            return { ...data, photoURL: prevData.photoURL, avatar: prevData.avatar };
          }
          return data;
        });
        console.log('✅ User data refreshed manually:', {
          photoURL: data.photoURL,
          avatar: data.avatar,
          forceRefresh,
          needsUsername: !hasUsername,
        });
      } else {
        // No user data found - check if it's a temp document
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('authUid', '==', uid), limit(1));
        const snapshots = await getDocs(q);
        if (!snapshots.empty) {
          const userDoc = snapshots.docs[0];
          const userData = userDoc.data();
          const isTempDoc = userDoc.id.startsWith('temp_') || !userData.username || !userData.username.trim();
          setNeedsUsername(isTempDoc);
        } else {
          // No document found - user needs to set username
          setNeedsUsername(true);
        }
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  }, []);

  // Single auth listener + friends subscription - centralized
  useEffect(() => {
    let unsubFriends = null;
    let unsubOutgoingRequests = null;
    let ensuredForUid = null;
    let lastSubscribedUid = null;
    let isMounted = true;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      // Clean up existing subscriptions if user changes
      if (unsubFriends) {
        unsubFriends();
        unsubFriends = null;
      }
      if (unsubOutgoingRequests) {
        unsubOutgoingRequests();
        unsubOutgoingRequests = null;
      }

      // If no user is signed in, clear friends list and user data
      if (!firebaseUser?.uid) {
        console.log('User not signed in, skipping friends subscription');
        setFriendsList([]);
        setUser(null);
        setUserData(null);
        setNeedsUsername(false);
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
          // This will preserve existing username if document exists
          await ensureUserDoc(firebaseUser.uid).catch(() => {});
          
          // Don't call upsertUserProfile with empty payload - it would overwrite username
          // ensureUserDoc already handles profile setup and preserves existing username
          
          ensuredForUid = firebaseUser.uid;
          console.log('✅ User document ensured:', firebaseUser.uid);

          // Fetch full user data after ensuring document
          const { userData: data } = await getCurrentUserData(firebaseUser.uid);
          if (isMounted && data) {
            // Check if user needs a username (temp document or no username)
            const hasUsername = data.username && data.username.trim() && !data.username.startsWith('temp_');
            setNeedsUsername(!hasUsername);
            
            setUserData({
              username: data.username,
              name: data.name,
              avatar: data.avatar || data.photoURL || data.photo || null,
              photoURL: data.photoURL || data.avatar || data.photo || null,
              bio: data.bio,
              age: data.age,
              gender: data.gender,
            });
          } else {
            // No user data found - check if it's a temp document
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('authUid', '==', firebaseUser.uid), limit(1));
            const snapshots = await getDocs(q);
            if (!snapshots.empty) {
              const userDoc = snapshots.docs[0];
              const userData = userDoc.data();
              const isTempDoc = userDoc.id.startsWith('temp_') || !userData.username || !userData.username.trim();
              setNeedsUsername(isTempDoc);
            } else {
              // No document found - user needs to set username
              setNeedsUsername(true);
            }
          }

          // Register for push notifications and save token
          try {
            const { success, token, error } = await registerForPushNotifications();
            if (success && token && db && typeof db === 'object' && Object.keys(db).length > 0) {
              // Get username from user document (document ID is now username, not UID)
              // We need to find the user document by authUid to get the username
              const usersRef = collection(db, 'users');
              const q = query(usersRef, where('authUid', '==', firebaseUser.uid), limit(1));
              const snapshots = await getDocs(q);
              
              if (!snapshots.empty) {
                const userDoc = snapshots.docs[0];
                const username = userDoc.id; // Document ID is the username_lowercase
                const userRef = doc(db, 'users', username);
                await updateDoc(userRef, {
                  pushToken: token,
                  updatedAt: new Date().toISOString(),
                });
                console.log('✅ Push notification token saved to user document:', username);
              } else {
                console.warn('⚠️ User document not found, cannot save push token');
              }
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

      // Subscribe to outgoing friend requests to complete reciprocity
      // When a request is accepted, the sender adds the receiver to their friends list
      unsubOutgoingRequests = subscribeToOutgoingFriendRequests(firebaseUser.uid, (result) => {
        if (!isMounted) return;
        
        if (result.error) {
          console.error('❌ Error in outgoing friend requests subscription:', result.error);
          return;
        }
        
        // The subscription callback handles reciprocity automatically
        // No need to do anything here - it's handled in the subscription function
      });
    });

    return () => {
      isMounted = false;
      if (unsubFriends && typeof unsubFriends === 'function') {
        unsubFriends();
      }
      if (unsubOutgoingRequests && typeof unsubOutgoingRequests === 'function') {
        unsubOutgoingRequests();
      }
      if (unsubscribeAuth && typeof unsubscribeAuth === 'function') {
        unsubscribeAuth();
      }
    };
  }, []); // Run once on mount - onAuthStateChanged handles all auth state changes

  return (
    <AuthContext.Provider value={{ user, userData, loading, refreshUserData, friendsList, needsUsername }}>
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

