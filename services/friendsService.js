// Friends service - handles friendships using simple array structure
//
// DATABASE STRUCTURE (matches Firestore schema):
// ==================
// users (collection):
//   userId (document ID = Firebase Auth UID):
//     uid: string (matches document ID)
//     username: string (case-sensitive for display)
//     username_lowercase: string (lowercase for case-insensitive search)
//     email: string (Firebase Auth email)
//     name: string (full name for display)
//     avatar: string (URL for profile picture)
//     friends: [userId1, userId2, ...]  // Array of friend UIDs (strings)
//     createdAt: timestamp (optional, useful for sorting/debugging)
//     otherProfileInfo: {...}
//
// DESIGN DECISIONS:
// ================
// 1. Simple Array Storage:  
//    - Each user document has a `friends` array field
//    - When adding a friend, both users get each other in their arrays
//    - Uses Firestore `arrayUnion` to avoid duplicates
//
// 2. Direct Mutual Friendship:
//    - No friend requests - adding a friend is immediate and mutual
//    - Both users are added to each other's friends array atomically
//
// 3. Real-time Updates:
//    - Uses onSnapshot() on user document to listen to friends array changes
//    - If friend removes you, you'll see their ID removed from your friends array
//
// SECURITY RULES (Firestore - MUST IMPLEMENT IN PRODUCTION):
// ===========================================================
// match /users/{userId} {
//   allow read: if request.auth != null;
//   allow update: if request.auth != null && request.auth.uid == userId;
// }
//
import {
  collection,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  runTransaction,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../config/firebase';

/**
 * Add friend (mutual)
 * Adds friendId to currentUser's friends array and currentUserId to friend's friends array
 * Uses transaction for atomic updates (both users updated together or neither)
 * @param {string} currentUserId
 * @param {string} friendUserId
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const addFriend = async (currentUserId, friendUserId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    if (!currentUserId || !friendUserId || currentUserId === friendUserId) {
      return { success: false, error: 'Invalid friend IDs' };
    }

    const currentUserRef = doc(db, 'users', currentUserId);
    const friendRef = doc(db, 'users', friendUserId);

    // Use transaction to ensure atomic updates (both users updated together or neither)
    await runTransaction(db, async (transaction) => {
      // Read both documents in the transaction
      const [currentUserDoc, friendDoc] = await Promise.all([
        transaction.get(currentUserRef),
        transaction.get(friendRef),
      ]);

      if (!currentUserDoc.exists() || !friendDoc.exists()) {
        throw new Error('User not found');
      }

      const currentUserData = currentUserDoc.data();
      const friendData = friendDoc.data();

      // Check if already friends
      if ((currentUserData.friends || []).includes(friendUserId)) {
        throw new Error('Already friends');
      }

      // Add each other atomically
      transaction.update(currentUserRef, {
        friends: arrayUnion(friendUserId),
        updatedAt: serverTimestamp(),
      });

      transaction.update(friendRef, {
        friends: arrayUnion(currentUserId),
        updatedAt: serverTimestamp(),
      });
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('❌ addFriend error:', error);
    return { success: false, error: error.message || 'Failed to add friend' };
  }
};

// Remove a friend (unfriend) - uses transaction for atomic updates
// Removes friendId from currentUser's friends array and currentUserId from friend's friends array
// Returns: { success: boolean, error: string }
export const removeFriend = async (currentUserId, friendId) => {
  try {
    console.log('🗑️ Removing friend:', currentUserId, '→', friendId);
    
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    // Use transaction to ensure atomic updates (both users updated together or neither)
    await runTransaction(db, async (transaction) => {
      const currentUserRef = doc(db, 'users', currentUserId);
      const friendRef = doc(db, 'users', friendId);

      // Read both documents in the transaction
      const [currentUserDoc, friendDoc] = await Promise.all([
        transaction.get(currentUserRef),
        transaction.get(friendRef),
      ]);

      // Check if documents exist
      if (!currentUserDoc.exists() || !friendDoc.exists()) {
        throw new Error('User not found');
      }

      // Update both users' friends arrays atomically within transaction
      transaction.update(currentUserRef, {
        friends: arrayRemove(friendId),
        updatedAt: serverTimestamp(),
      });

      transaction.update(friendRef, {
        friends: arrayRemove(currentUserId),
        updatedAt: serverTimestamp(),
      });
    });

    console.log('✅ Friend removed successfully (atomic update)');
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error removing friend:', error);
    return { success: false, error: error.message || 'Failed to remove friend' };
  }
};

// Check if two users are friends
// Optimized: if friends array is provided, use it directly (no Firestore query)
// Otherwise, query Firestore (slower but works when friends array not available)
// Usage:
//   - Optimized: checkFriendship(friendsArray, targetUserId) - returns boolean immediately
//   - Fallback: checkFriendship(userId1, userId2) - queries Firestore, returns Promise<boolean>
// Returns: boolean (if friends array provided) or Promise<boolean> (if querying Firestore)
export const checkFriendship = async (userId1OrFriendsArray, userId2) => {
  // If first argument is an array, use optimized check (no Firestore query)
  if (Array.isArray(userId1OrFriendsArray)) {
    return userId1OrFriendsArray.includes(userId2);
  }
  
  // Otherwise, query Firestore (backward compatibility)
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return false;
    }

    const userId1 = userId1OrFriendsArray; // First arg is userId when not an array
    const userRef = doc(db, 'users', userId1);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return false;
    }

    const userData = userDoc.data();
    const friends = userData.friends || [];
    
    return friends.includes(userId2);
  } catch (error) {
    console.error('❌ Error checking friendship:', error);
    return false;
  }
};

/**
 * Wait for Firebase Auth to be ready before proceeding
 * Ensures onAuthStateChanged has fired and user is authenticated
 */
const waitForAuthReady = () => {
  return new Promise((resolve) => {
    // Check if auth is already initialized
    if (!auth) {
      console.warn('⚠️ Firebase Auth not initialized');
      resolve(null);
      return;
    }

    // Use onAuthStateChanged to wait for auth state
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // Only run once
      resolve(user);
    });

    // Timeout after 2 seconds if auth state doesn't change
    setTimeout(() => {
      unsubscribe();
      resolve(auth.currentUser);
    }, 2000);
  });
};

// Get friends list for a user
// Checks auth.currentUser first before querying Firestore
// Returns: { friends: array of userIds, error: string }
export const getFriends = async (userId) => {
  try {
    // First check auth.currentUser directly (no async wait needed)
    if (!auth || !auth.currentUser || !auth.currentUser.uid) {
      console.log('User not found, skipping fetch');
      return { friends: [], error: 'User not signed in' };
    }

    // If no userId provided, use auth.currentUser
    if (!userId) {
      userId = auth.currentUser.uid;
    }

    // Verify userId matches current user (safety check)
    if (userId !== auth.currentUser.uid) {
      console.warn('⚠️ User ID mismatch - using current user ID');
      userId = auth.currentUser.uid;
    }
    
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { friends: [], error: 'Firestore not configured' };
    }


    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return { friends: [], error: 'User not found' };
    }

    const userData = userDoc.data();
    const friends = userData.friends || [];

    console.log('✅ Found', friends.length, 'friends');
    return { friends, error: null };
  } catch (error) {
    console.error('❌ Error getting friends:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    
    // Handle different error types
    if (error.code === 'unavailable') {
      // unavailable can mean offline OR connection issues
      return { friends: [], error: 'Unable to connect to database. Please check your internet connection and try again.' };
    }
    if (error.code === 'deadline-exceeded') {
      return { friends: [], error: 'Request timed out. Please check your internet connection and try again.' };
    }
    if (error.code === 'permission-denied') {
      return { friends: [], error: 'Permission denied. Please check Firestore security rules.' };
    }
    if (error.message?.includes('offline') || error.message?.includes('network')) {
      return { friends: [], error: 'Network error. Please check your internet connection and try again.' };
    }
    return { friends: [], error: error.message || 'Failed to get friends' };
  }
};

// Listen to friends list in real-time
// Checks auth.currentUser first before setting up subscription
// Returns: unsubscribe function
// Note: Listens to the user document's friends array field
// If a friend removes you, your friends array will update automatically
export const subscribeToFriends = (userId, callback) => {
  try {
    // Check auth.currentUser first (no async wait needed)
    if (!auth || !auth.currentUser || !auth.currentUser.uid) {
      console.log('User not found, skipping friends subscription');
      callback({ friends: [], error: 'User not signed in' });
      return () => {};
    }

    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      callback({ friends: [], error: 'Firestore not configured' });
      return () => {};
    }

    // If no userId provided, use auth.currentUser
    if (!userId) {
      userId = auth.currentUser.uid;
    }

    // Verify userId matches current user (safety check)
    if (userId !== auth.currentUser.uid) {
      console.warn('⚠️ User ID mismatch - using current user ID');
      userId = auth.currentUser.uid;
    }

    let unsubscribeSnapshot = null;
    let isMounted = true;


    const userRef = doc(db, 'users', userId);

    unsubscribeSnapshot = onSnapshot(
      userRef,
      (snapshot) => {
        if (!isMounted) return;

        // Verify user still signed in
        if (!auth.currentUser || auth.currentUser.uid !== userId) {
          console.log('User changed during subscription, ignoring update');
          return;
        }

        if (!snapshot.exists()) {
          callback({ friends: [], error: 'User not found' });
          return;
        }

        const userData = snapshot.data();
        const friends = userData.friends || [];
        
        callback({ friends, error: null });
      },
      (error) => {
        if (!isMounted) return;

        // Verify user still signed in
        if (!auth.currentUser || auth.currentUser.uid !== userId) {
          console.log('User changed during subscription error, ignoring');
          return;
        }

        console.error('❌ Friends subscription error:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);
        
        // Handle different error types
        if (error.code === 'unavailable') {
          callback({ friends: [], error: 'Unable to connect to database. Please check your internet connection and try again.' });
        } else if (error.code === 'permission-denied') {
          callback({ friends: [], error: 'Permission denied. Please check Firestore security rules.' });
        } else if (error.message?.includes('offline') || error.message?.includes('network')) {
          callback({ friends: [], error: 'Network error. Please check your internet connection and try again.' });
        } else {
          callback({ friends: [], error: error.message || 'Failed to subscribe to friends' });
        }
      }
    );

    // Return unsubscribe function
    return () => {
      isMounted = false;
      if (unsubscribeSnapshot && typeof unsubscribeSnapshot === 'function') {
        unsubscribeSnapshot();
      }
    };
  } catch (error) {
    console.error('❌ Error setting up friends subscription:', error);
    callback({ friends: [], error: error.message });
    return () => {};
  }
};
