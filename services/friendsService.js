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
  setDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  runTransaction,
  orderBy,
  limit,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../config/firebase';

// ============================================================================
// Helper Functions - Convert between authUid and username
// ============================================================================

/**
 * Get username from authUid by querying user document
 * @param {string} authUid - Firebase Auth UID
 * @returns {Promise<string|null>} Username (document ID) or null if not found
 */
export const getUsernameFromAuthUid = async (authUid) => {
  try {
    if (!authUid || !db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return null;
    }
    
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('authUid', '==', authUid), limit(1));
    const snapshots = await getDocs(q);
    
    if (!snapshots.empty) {
      return snapshots.docs[0].id; // Document ID is the username_lowercase
    }
    
    return null;
  } catch (error) {
    console.error('Error getting username from authUid:', error);
    return null;
  }
};

/**
 * Get authUid from username by looking up document
 * @param {string} username - Username (document ID)
 * @returns {Promise<string|null>} authUid or null if not found
 */
export const getAuthUidFromUsername = async (username) => {
  try {
    if (!username || !db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return null;
    }
    
    const username_lowercase = username.toLowerCase().replace(/\s+/g, '');
    const userRef = doc(db, 'users', username_lowercase);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      return data.authUid || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting authUid from username:', error);
    return null;
  }
};

/**
 * Add friend (mutual)
 * Adds friendUsername to currentUser's friends array and currentUsername to friend's friends array
 * Uses transaction for atomic updates (both users updated together or neither)
 * @param {string} currentUserId - Firebase Auth UID of current user
 * @param {string} friendUserId - Firebase Auth UID of friend to add
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

    // Get usernames from authUids (document IDs are now usernames)
    const currentUsername = await getUsernameFromAuthUid(currentUserId);
    const friendUsername = await getUsernameFromAuthUid(friendUserId);

    if (!currentUsername || !friendUsername) {
      return { success: false, error: 'User not found' };
    }

    if (currentUsername === friendUsername) {
      return { success: false, error: 'Cannot add yourself as friend' };
    }

    const currentUserRef = doc(db, 'users', currentUsername);
    const friendRef = doc(db, 'users', friendUsername);

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

      // Check if already friends (friends array now stores usernames, not UIDs)
      if ((currentUserData.friends || []).includes(friendUsername)) {
        throw new Error('Already friends');
      }

      // Check if either user has blocked the other (blocked array stores usernames)
      const currentUserBlocked = currentUserData.blocked || [];
      const friendBlocked = friendData.blocked || [];
      
      if (currentUserBlocked.includes(friendUsername) || friendBlocked.includes(currentUsername)) {
        throw new Error('Cannot add friend: User is blocked');
      }

      // Ensure friends array exists (initialize if needed)
      const currentUserFriends = currentUserData.friends || [];
      const friendFriends = friendData.friends || [];

      // Add each other atomically (only if not already friends)
      // Friends array now stores usernames (document IDs), not authUids
      if (!currentUserFriends.includes(friendUsername)) {
        transaction.update(currentUserRef, {
          friends: arrayUnion(friendUsername),
          updatedAt: serverTimestamp(),
        });
      }

      if (!friendFriends.includes(currentUsername)) {
        transaction.update(friendRef, {
          friends: arrayUnion(currentUsername),
          updatedAt: serverTimestamp(),
        });
      }
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('❌ addFriend error:', error);
    return { success: false, error: error.message || 'Failed to add friend' };
  }
};

// Remove a friend (unfriend) - uses transaction for atomic updates
// Removes friendId from currentUser's friends array and currentUserId from friend's friends array
// Note: currentUserId and friendId are now Firebase Auth UIDs (not usernames)
// We need to convert them to usernames to access the documents
// Returns: { success: boolean, error: string }
export const removeFriend = async (currentUserId, friendId) => {
  try {
    console.log('🗑️ [removeFriend] Removing friend:', currentUserId, '→', friendId);
    
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      console.error('❌ [removeFriend] Firestore not configured');
      return { success: false, error: 'Firestore not configured' };
    }

    // Get usernames from authUids (document IDs are now usernames)
    const currentUsername = await getUsernameFromAuthUid(currentUserId);
    const friendUsername = await getUsernameFromAuthUid(friendId);

    console.log('🗑️ [removeFriend] Usernames:', { currentUsername, friendUsername });

    if (!currentUsername || !friendUsername) {
      console.error('❌ [removeFriend] User not found:', { currentUsername, friendUsername });
      return { success: false, error: 'User not found' };
    }

    if (currentUsername === friendUsername) {
      console.error('❌ [removeFriend] Cannot remove yourself');
      return { success: false, error: 'Cannot remove yourself as friend' };
    }

    // Use transaction to ensure atomic updates (both users updated together or neither)
    // IMPORTANT: Only update the current user's own document (no cross-user writes)
    await runTransaction(db, async (transaction) => {
      const currentUserRef = doc(db, 'users', currentUsername);

      // Read current user document
      const currentUserDoc = await transaction.get(currentUserRef);

      // Check if document exists
      if (!currentUserDoc.exists()) {
        throw new Error('User not found');
      }

      const currentUserData = currentUserDoc.data();
      const currentFriends = currentUserData.friends || [];
      
      console.log('🗑️ [removeFriend] Current friends list:', currentFriends);
      console.log('🗑️ [removeFriend] Checking if friendUsername is in list:', friendUsername, currentFriends.includes(friendUsername));

      // Only remove if they're actually in the friends list
      if (!currentFriends.includes(friendUsername)) {
        console.log('⚠️ [removeFriend] Friend not in list, nothing to remove');
        // Don't throw error, just return success (idempotent operation)
        return;
      }

      // Only update current user's friends array (remove friendUsername)
      // The friend will need to remove us from their list when they see the change
      transaction.update(currentUserRef, {
        friends: arrayRemove(friendUsername),
        updatedAt: serverTimestamp(),
      });
    });

    console.log('✅ [removeFriend] Friend removed successfully:', currentUsername, 'removed', friendUsername);
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ [removeFriend] Error removing friend:', error);
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
// Returns: { friends: array of usernames (document IDs), error: string }
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

    // Get username from authUid (document ID is now username)
    const username = await getUsernameFromAuthUid(userId);
    if (!username) {
      return { friends: [], error: 'User not found' };
    }

    const userRef = doc(db, 'users', username);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return { friends: [], error: 'User not found' };
    }

    const userData = userDoc.data();
    const friends = userData.friends || []; // Array of usernames (document IDs)
    const blocked = userData.blocked || []; // Array of usernames (document IDs)

    // Filter out blocked users from friends list
    let filteredFriends = friends.filter((friendUsername) => !blocked.includes(friendUsername));

    // Verify mutual friendships - only include friends where both users have each other
    // This ensures that if someone removes you, they won't appear in your friends list
    const mutualFriends = [];
    
    for (const friendUsername of filteredFriends) {
      try {
        const friendRef = doc(db, 'users', friendUsername);
        const friendDoc = await getDoc(friendRef);
        
        if (friendDoc.exists()) {
          const friendData = friendDoc.data();
          const friendFriends = friendData.friends || [];
          
          // Only include if the friend also has the current user in their friends list
          if (friendFriends.includes(username)) {
            mutualFriends.push(friendUsername);
          } else {
            console.log('🔍 [getFriends] Removing non-mutual friend:', friendUsername);
          }
        }
      } catch (error) {
        console.error('❌ Error checking mutual friendship for', friendUsername, error);
        // If we can't check, include them to avoid removing valid friends due to errors
        mutualFriends.push(friendUsername);
      }
    }

    console.log('✅ Found', mutualFriends.length, 'mutual friends (filtered from', friends.length, 'total)');
    return { friends: mutualFriends, error: null };
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
// Friends array now stores usernames (document IDs), not authUids
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
    let username = null;

    // Get username from authUid (document ID is now username)
    // We'll set up the subscription asynchronously
    getUsernameFromAuthUid(userId).then((userUsername) => {
      if (!userUsername || !isMounted) {
        if (!isMounted) return;
        callback({ friends: [], error: 'User not found' });
        return;
      }
      
      username = userUsername;
      const userRef = doc(db, 'users', username);

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
          const friends = userData.friends || []; // Array of usernames (document IDs)
          const blocked = userData.blocked || []; // Array of usernames (document IDs)
          
          // Filter out blocked users from friends list
          let filteredFriends = friends.filter((friendUsername) => !blocked.includes(friendUsername));
          
          // Verify mutual friendships - only include friends where both users have each other
          // This ensures that if someone removes you, they won't appear in your friends list
          const verifyMutualFriendships = async () => {
            if (filteredFriends.length === 0) {
              callback({ friends: [], error: null });
              return;
            }
            
            try {
              // Check each friend to verify mutual friendship
              const mutualFriends = [];
              
              for (const friendUsername of filteredFriends) {
                try {
                  const friendRef = doc(db, 'users', friendUsername);
                  const friendDoc = await getDoc(friendRef);
                  
                  if (friendDoc.exists()) {
                    const friendData = friendDoc.data();
                    const friendFriends = friendData.friends || [];
                    
                    // Only include if the friend also has the current user in their friends list
                    if (friendFriends.includes(username)) {
                      mutualFriends.push(friendUsername);
                    } else {
                      console.log('🔍 [subscribeToFriends] Removing non-mutual friend:', friendUsername);
                    }
                  }
                } catch (error) {
                  console.error('❌ Error checking mutual friendship for', friendUsername, error);
                  // If we can't check, include them to avoid removing valid friends due to errors
                  mutualFriends.push(friendUsername);
                }
              }
              
              if (isMounted) {
                callback({ friends: mutualFriends, error: null });
              }
            } catch (error) {
              console.error('❌ Error verifying mutual friendships:', error);
              // On error, return all friends (better to show them than hide valid friendships)
              if (isMounted) {
                callback({ friends: filteredFriends, error: null });
              }
            }
          };
          
          // Verify mutual friendships asynchronously
          verifyMutualFriendships();
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
    }).catch((error) => {
      if (!isMounted) return;
      console.error('❌ Error getting username from authUid:', error);
      callback({ friends: [], error: 'Failed to get user information' });
    });

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

// ============================================================================
// Blocking Functions
// ============================================================================

/**
 * Block a user
 * Adds user to blocked array and removes them from friends array if they were friends
 * @param {string} currentUserId - User doing the blocking
 * @param {string} blockedUserId - User being blocked
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const blockUser = async (currentUserId, blockedUserId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    if (!currentUserId || !blockedUserId || currentUserId === blockedUserId) {
      return { success: false, error: 'Invalid user IDs' };
    }

    const currentUserRef = doc(db, 'users', currentUserId);
    const blockedUserRef = doc(db, 'users', blockedUserId);

    // Use transaction to ensure atomic updates
    await runTransaction(db, async (transaction) => {
      // Read both documents
      const [currentUserDoc, blockedUserDoc] = await Promise.all([
        transaction.get(currentUserRef),
        transaction.get(blockedUserRef),
      ]);

      if (!currentUserDoc.exists() || !blockedUserDoc.exists()) {
        throw new Error('User not found');
      }

      const currentUserData = currentUserDoc.data();
      const blockedUserData = blockedUserDoc.data();

      // Check if already blocked
      if ((currentUserData.blocked || []).includes(blockedUserId)) {
        throw new Error('User already blocked');
      }

      // Add to blocked array
      transaction.update(currentUserRef, {
        blocked: arrayUnion(blockedUserId),
        // Remove from friends if they were friends
        friends: arrayRemove(blockedUserId),
        updatedAt: serverTimestamp(),
      });

      // Remove current user from blocked user's friends array (if they were friends)
      transaction.update(blockedUserRef, {
        friends: arrayRemove(currentUserId),
        updatedAt: serverTimestamp(),
      });
    });

    console.log('✅ User blocked successfully:', currentUserId, '→', blockedUserId);
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error blocking user:', error);
    return { success: false, error: error.message || 'Failed to block user' };
  }
};

/**
 * Unblock a user
 * Removes user from blocked array
 * @param {string} currentUserId - User doing the unblocking
 * @param {string} blockedUserId - User being unblocked
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const unblockUser = async (currentUserId, blockedUserId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    if (!currentUserId || !blockedUserId || currentUserId === blockedUserId) {
      return { success: false, error: 'Invalid user IDs' };
    }

    const currentUserRef = doc(db, 'users', currentUserId);

    // Use transaction to ensure atomic updates
    await runTransaction(db, async (transaction) => {
      // Read document
      const currentUserDoc = await transaction.get(currentUserRef);

      if (!currentUserDoc.exists()) {
        throw new Error('User not found');
      }

      const currentUserData = currentUserDoc.data();

      // Check if user is blocked
      if (!(currentUserData.blocked || []).includes(blockedUserId)) {
        throw new Error('User is not blocked');
      }

      // Remove from blocked array
      transaction.update(currentUserRef, {
        blocked: arrayRemove(blockedUserId),
        updatedAt: serverTimestamp(),
      });
    });

    console.log('✅ User unblocked successfully:', currentUserId, '→', blockedUserId);
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error unblocking user:', error);
    return { success: false, error: error.message || 'Failed to unblock user' };
  }
};

/**
 * Check if a user is blocked
 * @param {string} currentUserId - User checking
 * @param {string} targetUserId - User to check
 * @returns {Promise<boolean>}
 */
export const isUserBlocked = async (currentUserId, targetUserId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return false;
    }

    const userRef = doc(db, 'users', currentUserId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return false;
    }

    const userData = userDoc.data();
    const blocked = userData.blocked || [];
    
    return blocked.includes(targetUserId);
  } catch (error) {
    console.error('❌ Error checking if user is blocked:', error);
    return false;
  }
};

/**
 * Get blocked users list
 * @param {string} userId - User ID
 * @returns {Promise<{ blocked: Array, error: string|null }>}
 */
export const getBlockedUsers = async (userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { blocked: [], error: 'Firestore not configured' };
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return { blocked: [], error: 'User not found' };
    }

    const userData = userDoc.data();
    const blocked = userData.blocked || [];

    return { blocked, error: null };
  } catch (error) {
    console.error('❌ Error getting blocked users:', error);
    return { blocked: [], error: error.message || 'Failed to get blocked users' };
  }
};

// ============================================================================
// Friend Request Functions
// ============================================================================

/**
 * Send a friend request
 * Creates a friend request document in friendRequests collection using addDoc
 * Requires auth.currentUser.uid - rejects self-requests
 * @param {string} targetId - User receiving the request (can be UID or username)
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const sendFriendRequest = async (targetId) => {
  try {
    // Require auth.currentUser.uid
    if (!auth || !auth.currentUser || !auth.currentUser.uid) {
      return { success: false, error: 'User not authenticated' };
    }

    const fromUserId = auth.currentUser.uid;
    
    // Convert targetId to UID if it's a username
    // UIDs are typically 28 characters, usernames are shorter
    let toUserId = targetId;
    if (targetId && targetId.length < 20) {
      // Likely a username, convert to UID
      const authUid = await getAuthUidFromUsername(targetId);
      if (!authUid) {
        return { success: false, error: 'User not found' };
      }
      toUserId = authUid;
    }

    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    // Reject self-requests
    if (!toUserId || fromUserId === toUserId) {
      return { success: false, error: 'Cannot send friend request to yourself' };
    }

    // Prepare payload
    const payload = {
      fromUserId: fromUserId,
      toUserId: toUserId,
      status: 'pending',
      createdAt: serverTimestamp(),
    };

    // Log path and payload before write
    const collectionPath = 'friendRequests';
    console.log('📝 Sending friend request:');
    console.log('   Path: friendRequests/ (addDoc will generate ID)');
    console.log('   Payload:', {
      fromUserId: payload.fromUserId,
      toUserId: payload.toUserId,
      status: payload.status,
      createdAt: '[serverTimestamp]',
    });
    console.log('   Method: addDoc');

    // Use addDoc to create document (Firestore will generate ID)
    const collectionRef = collection(db, collectionPath);
    const docRef = await addDoc(collectionRef, payload);

    console.log('✅ Friend request sent successfully:', fromUserId, '→', toUserId);
    console.log('   Document ID:', docRef.id);
    console.log('   Full path: friendRequests/' + docRef.id);
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error sending friend request:', error);
    console.error('   Error code:', error.code);
    console.error('   Error message:', error.message);
    console.error('   Write path: friendRequests/ (addDoc)');
    console.error('   Full payload:', {
      fromUserId: auth?.currentUser?.uid || 'unknown',
      toUserId: targetUid || 'unknown',
      status: 'pending',
      createdAt: '[serverTimestamp]',
    });
    console.error('   Method used: addDoc');
    return { success: false, error: error.message || 'Failed to send friend request' };
  }
};

/**
 * Accept a friend request
 * Adds both users to each other's friends array and deletes the request
 * @param {string} requestId - Friend request document ID
 * @param {string} fromUserId - User who sent the request (Firebase Auth UID)
 * @param {string} toUserId - User accepting the request (Firebase Auth UID)
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const acceptFriendRequest = async (requestId, fromUserId, toUserId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    console.log('🔄 [acceptFriendRequest] Starting:', { requestId, fromUserId, toUserId });

    // Get usernames from authUids (document IDs are now usernames)
    const fromUsername = await getUsernameFromAuthUid(fromUserId);
    const toUsername = await getUsernameFromAuthUid(toUserId);

    console.log('🔄 [acceptFriendRequest] Usernames:', { fromUsername, toUsername });

    if (!fromUsername || !toUsername) {
      console.error('❌ [acceptFriendRequest] User not found:', { fromUserId, toUserId, fromUsername, toUsername });
      return { success: false, error: 'User not found' };
    }

    if (fromUsername === toUsername) {
      return { success: false, error: 'Cannot accept friend request from yourself' };
    }

    // Use transaction to ensure atomic updates
    // IMPORTANT: Only update the receiver's own document (no cross-user writes)
    await runTransaction(db, async (transaction) => {
      const requestRef = doc(db, 'friendRequests', requestId);
      const toUserRef = doc(db, 'users', toUsername);

      // Read documents
      const [requestDoc, toUserDoc] = await Promise.all([
        transaction.get(requestRef),
        transaction.get(toUserRef),
      ]);

      if (!requestDoc.exists()) {
        throw new Error('Friend request not found');
      }

      const requestData = requestDoc.data();
      
      // Verify this request is for the current user (toUserId)
      if (requestData.toUserId !== toUserId) {
        throw new Error('Friend request does not belong to current user');
      }

      // Verify request is still pending
      if (requestData.status !== 'pending') {
        throw new Error('Friend request is not pending');
      }

      if (!toUserDoc.exists()) {
        throw new Error('User not found');
      }

      // Get user data
      const toUserData = toUserDoc.data();

      // Check if user has blocked the sender (blocked arrays now contain usernames)
      const toUserBlocked = toUserData.blocked || [];
      
      if (toUserBlocked.includes(fromUsername)) {
        throw new Error('Cannot accept friend request: User is blocked');
      }

      // Ensure friends array exists (initialize if needed)
      const toUserFriends = toUserData.friends || [];

      // Add sender to receiver's friends array (only if not already friends)
      // Only update the receiver's own document (no cross-user write)
      if (!toUserFriends.includes(fromUsername)) {
        transaction.update(toUserRef, {
          friends: arrayUnion(fromUsername),
          updatedAt: serverTimestamp(),
        });
      }

      // Update request status to 'accepted' first (for sender to observe)
      transaction.update(requestRef, {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      });
    });

    // Delete the request after it's been accepted and friend added
    // The sender's subscription will process the status change before deletion
    try {
      const requestRef = doc(db, 'friendRequests', requestId);
      await deleteDoc(requestRef);
      console.log('🗑️ [acceptFriendRequest] Deleted accepted friend request:', requestId);
    } catch (error) {
      console.error('❌ [acceptFriendRequest] Error deleting accepted request:', error);
      // Don't fail the whole operation if deletion fails - friend was already added
    }

    console.log('✅ Friend request accepted:', fromUsername, '↔', toUsername);
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ [acceptFriendRequest] Error accepting friend request:', error);
    console.error('❌ [acceptFriendRequest] Error code:', error.code);
    console.error('❌ [acceptFriendRequest] Error message:', error.message);
    console.error('❌ [acceptFriendRequest] Stack:', error.stack);
    return { success: false, error: error.message || 'Failed to accept friend request' };
  }
};

/**
 * Decline a friend request
 * Deletes the friend request after declining
 * @param {string} requestId - Friend request document ID
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const declineFriendRequest = async (requestId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    const requestRef = doc(db, 'friendRequests', requestId);
    
    // Verify the request exists and is pending before deleting
    const requestDoc = await getDoc(requestRef);
    if (!requestDoc.exists()) {
      return { success: false, error: 'Friend request not found' };
    }

    const requestData = requestDoc.data();
    
    // Verify request is still pending (can only decline pending requests)
    if (requestData.status !== 'pending') {
      console.log('⚠️ [declineFriendRequest] Request is not pending, status:', requestData.status);
      // Still delete it if it's already declined or accepted
      await deleteDoc(requestRef);
      return { success: true, error: null };
    }

    // Delete the request (no need to update status first since we're deleting)
    await deleteDoc(requestRef);

    console.log('✅ Friend request declined and deleted:', requestId);
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error declining friend request:', error);
    return { success: false, error: error.message || 'Failed to decline friend request' };
  }
};

/**
 * Cancel a friend request (unsend)
 * Finds and deletes the pending friend request sent by the current user to the target user
 * @param {string} targetUserId - User ID who received the request (UID)
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const cancelFriendRequest = async (targetUserId) => {
  try {
    if (!auth || !auth.currentUser || !auth.currentUser.uid) {
      return { success: false, error: 'User not authenticated' };
    }

    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    const fromUserId = auth.currentUser.uid;
    
    // Convert targetUserId to UID if it's a username
    let toUserId = targetUserId;
    if (targetUserId && targetUserId.length < 20) {
      // Likely a username, convert to UID
      const authUid = await getAuthUidFromUsername(targetUserId);
      if (!authUid) {
        return { success: false, error: 'User not found' };
      }
      toUserId = authUid;
    }

    // Find the pending friend request
    const requestsRef = collection(db, 'friendRequests');
    const q = query(
      requestsRef,
      where('fromUserId', '==', fromUserId),
      where('toUserId', '==', toUserId),
      where('status', '==', 'pending'),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: false, error: 'Friend request not found' };
    }

    // Delete the request
    const requestDoc = snapshot.docs[0];
    await deleteDoc(doc(db, 'friendRequests', requestDoc.id));

    console.log('✅ Friend request cancelled:', fromUserId, '→', toUserId);
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error cancelling friend request:', error);
    return { success: false, error: error.message || 'Failed to cancel friend request' };
  }
};

/**
 * Get incoming friend requests for a user
 * @param {string} userId - User ID to get requests for
 * @returns {Promise<{ requests: Array, error: string|null }>}
 */
export const getIncomingFriendRequests = async (userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { requests: [], error: 'Firestore not configured' };
    }

    const requestsRef = collection(db, 'friendRequests');
    // Query without orderBy to avoid index requirement (will sort client-side)
    const q = query(
      requestsRef,
      where('toUserId', '==', userId),
      where('status', '==', 'pending'),
      limit(50)
    );

    const snapshot = await getDocs(q);
    
    // Sort by createdAt descending (newest first) client-side
    const requests = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return bTime - aTime; // Newest first
      });

    return { requests, error: null };
  } catch (error) {
    console.error('❌ Error getting friend requests:', error);
    return { requests: [], error: error.message || 'Failed to get friend requests' };
  }
};

/**
 * Subscribe to incoming friend requests for a user
 * @param {string} userId - User ID to subscribe to requests for
 * @param {Function} callback - Callback function (result) => { requests: Array, error: string|null }
 * @returns {Function} Unsubscribe function
 */
export const subscribeToFriendRequests = (userId, callback) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      console.error('❌ [subscribeToFriendRequests] Firestore not configured');
      callback({ requests: [], error: 'Firestore not configured' });
      return () => {};
    }

    if (!userId) {
      console.error('❌ [subscribeToFriendRequests] No user ID provided');
      callback({ requests: [], error: 'No user ID provided' });
      return () => {};
    }

    console.log('📡 [subscribeToFriendRequests] Setting up subscription for userId:', userId);

    const requestsRef = collection(db, 'friendRequests');
    // Query without orderBy to avoid index requirement (will sort client-side)
    const q = query(
      requestsRef,
      where('toUserId', '==', userId),
      where('status', '==', 'pending'),
      limit(50)
    );

    let isMounted = true;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isMounted) return;

        console.log('📡 [subscribeToFriendRequests] Snapshot received:', {
          size: snapshot.size,
          empty: snapshot.empty,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
        });

        // Sort by createdAt descending (newest first) client-side
        const requests = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return bTime - aTime; // Newest first
          });

        console.log('📡 [subscribeToFriendRequests] Returning', requests.length, 'requests');
        callback({ requests, error: null });
      },
      (error) => {
        if (!isMounted) return;
        console.error('❌ [subscribeToFriendRequests] Subscription error:', error);
        console.error('❌ [subscribeToFriendRequests] Error code:', error.code);
        console.error('❌ [subscribeToFriendRequests] Error message:', error.message);
        console.error('❌ [subscribeToFriendRequests] Query was:', {
          collection: 'friendRequests',
          where: [{ field: 'toUserId', op: '==', value: userId }, { field: 'status', op: '==', value: 'pending' }],
        });
        callback({ requests: [], error: error.message || 'Failed to subscribe to friend requests' });
      }
    );

    return () => {
      isMounted = false;
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  } catch (error) {
    console.error('❌ Error setting up friend requests subscription:', error);
    callback({ requests: [], error: error.message });
    return () => {};
  }
};

/**
 * Subscribe to outgoing friend requests (sent by current user)
 * When a request is accepted, the sender adds the receiver to their friends list (client-side reciprocity)
 * @param {string} userId - User ID to subscribe to outgoing requests for
 * @param {Function} callback - Callback function (result) => { requests: Array, error: string|null }
 * @returns {Function} Unsubscribe function
 */
export const subscribeToOutgoingFriendRequests = (userId, callback) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      console.error('❌ [subscribeToOutgoingFriendRequests] Firestore not configured');
      callback({ requests: [], error: 'Firestore not configured' });
      return () => {};
    }

    if (!userId) {
      console.error('❌ [subscribeToOutgoingFriendRequests] No user ID provided');
      callback({ requests: [], error: 'No user ID provided' });
      return () => {};
    }

    console.log('📡 [subscribeToOutgoingFriendRequests] Setting up subscription for userId:', userId);

    const requestsRef = collection(db, 'friendRequests');
    // Subscribe to requests sent by this user (outgoing requests)
    const q = query(
      requestsRef,
      where('fromUserId', '==', userId),
      limit(50)
    );

    let isMounted = true;

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (!isMounted) return;

        console.log('📡 [subscribeToOutgoingFriendRequests] Snapshot received:', {
          size: snapshot.size,
          empty: snapshot.empty,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
        });

        // Process accepted requests to complete reciprocity
        const acceptedRequests = snapshot.docs
          .filter(doc => doc.data().status === 'accepted')
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));

        // For each accepted request, add the receiver to sender's friends list
        if (acceptedRequests.length > 0 && auth && auth.currentUser) {
          const currentUserId = auth.currentUser.uid;
          const currentUsername = await getUsernameFromAuthUid(currentUserId);
          
          if (currentUsername) {
            for (const request of acceptedRequests) {
              try {
                // Get receiver's username
                const receiverUsername = await getUsernameFromAuthUid(request.toUserId);
                
                if (receiverUsername) {
                  // Add receiver to sender's friends list (complete reciprocity)
                  const userRef = doc(db, 'users', currentUsername);
                  const userDoc = await getDoc(userRef);
                  
                  if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const friends = userData.friends || [];
                    
                    // Only add if not already friends
                    if (!friends.includes(receiverUsername)) {
                      await updateDoc(userRef, {
                        friends: arrayUnion(receiverUsername),
                        updatedAt: serverTimestamp(),
                      });
                      console.log('✅ [subscribeToOutgoingFriendRequests] Completed reciprocity:', currentUsername, '↔', receiverUsername);
                    }
                  }
                }
              } catch (error) {
                console.error('❌ [subscribeToOutgoingFriendRequests] Error completing reciprocity:', error);
              }
            }
          }
        }

        // Sort by createdAt descending (newest first) client-side
        const requests = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return bTime - aTime; // Newest first
          });

        console.log('📡 [subscribeToOutgoingFriendRequests] Returning', requests.length, 'requests');
        callback({ requests, error: null });
      },
      (error) => {
        if (!isMounted) return;
        console.error('❌ [subscribeToOutgoingFriendRequests] Subscription error:', error);
        callback({ requests: [], error: error.message || 'Failed to subscribe to outgoing friend requests' });
      }
    );

    return () => {
      isMounted = false;
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  } catch (error) {
    console.error('❌ Error setting up outgoing friend requests subscription:', error);
    callback({ requests: [], error: error.message });
    return () => {};
  }
};
