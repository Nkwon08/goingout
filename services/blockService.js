// Block service - handles user blocking functionality
//
// DATABASE STRUCTURE:
// ==================
// users (collection):
//   userId (document ID = username_lowercase):
//     blockedUsers: [userId1, userId2, ...]  // Array of blocked user IDs (usernames)
//
// DESIGN DECISIONS:
// ================
// 1. Simple Array Storage:
//    - Each user document has a `blockedUsers` array field
//    - Stores usernames (document IDs) of blocked users
//    - Uses Firestore `arrayUnion` and `arrayRemove` for atomic operations
//
// 2. One-way Blocking:
//    - Blocking is one-way (User A blocks User B)
//    - User B doesn't know they're blocked
//    - User A can't see User B's posts/content
//    - User B can't see User A's posts/content
//    - User B can't interact with User A (send friend requests, etc.)
//
import {
  collection,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Block a user
 * @param {string} currentUserId - Current user's authUid
 * @param {string} userToBlock - Username or authUid of user to block
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const blockUser = async (currentUserId, userToBlock) => {
  try {
    if (!currentUserId || !userToBlock) {
      return { success: false, error: 'Missing required parameters' };
    }

    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    // Get current user's username (document ID)
    const usersRef = collection(db, 'users');
    const currentUserQuery = query(usersRef, where('authUid', '==', currentUserId), limit(1));
    const currentUserSnapshot = await getDocs(currentUserQuery);
    
    if (currentUserSnapshot.empty) {
      return { success: false, error: 'Current user not found' };
    }

    const currentUserDoc = currentUserSnapshot.docs[0];
    const currentUsername = currentUserDoc.id; // Document ID is username_lowercase

    // Get username of user to block
    let blockedUsername = null;
    
    // Check if userToBlock is already a username (document ID)
    const userToBlockDoc = await getDoc(doc(db, 'users', userToBlock.toLowerCase().replace(/\s+/g, '')));
    if (userToBlockDoc.exists()) {
      blockedUsername = userToBlockDoc.id;
    } else {
      // Try to find by authUid
      const blockedUserQuery = query(usersRef, where('authUid', '==', userToBlock), limit(1));
      const blockedUserSnapshot = await getDocs(blockedUserQuery);
      if (!blockedUserSnapshot.empty) {
        blockedUsername = blockedUserSnapshot.docs[0].id;
      }
    }

    if (!blockedUsername) {
      return { success: false, error: 'User to block not found' };
    }

    if (currentUsername === blockedUsername) {
      return { success: false, error: 'Cannot block yourself' };
    }

    // Add to blockedUsers array
    const currentUserRef = doc(db, 'users', currentUsername);
    await updateDoc(currentUserRef, {
      blockedUsers: arrayUnion(blockedUsername),
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Error blocking user:', error);
    return { success: false, error: error.message || 'Failed to block user' };
  }
};

/**
 * Unblock a user
 * @param {string} currentUserId - Current user's authUid
 * @param {string} userToUnblock - Username or authUid of user to unblock
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const unblockUser = async (currentUserId, userToUnblock) => {
  try {
    if (!currentUserId || !userToUnblock) {
      return { success: false, error: 'Missing required parameters' };
    }

    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    // Get current user's username (document ID)
    const usersRef = collection(db, 'users');
    const currentUserQuery = query(usersRef, where('authUid', '==', currentUserId), limit(1));
    const currentUserSnapshot = await getDocs(currentUserQuery);
    
    if (currentUserSnapshot.empty) {
      return { success: false, error: 'Current user not found' };
    }

    const currentUserDoc = currentUserSnapshot.docs[0];
    const currentUsername = currentUserDoc.id;

    // Get username of user to unblock
    let unblockedUsername = null;
    
    // Check if userToUnblock is already a username (document ID)
    const userToUnblockDoc = await getDoc(doc(db, 'users', userToUnblock.toLowerCase().replace(/\s+/g, '')));
    if (userToUnblockDoc.exists()) {
      unblockedUsername = userToUnblockDoc.id;
    } else {
      // Try to find by authUid
      const unblockedUserQuery = query(usersRef, where('authUid', '==', userToUnblock), limit(1));
      const unblockedUserSnapshot = await getDocs(unblockedUserQuery);
      if (!unblockedUserSnapshot.empty) {
        unblockedUsername = unblockedUserSnapshot.docs[0].id;
      }
    }

    if (!unblockedUsername) {
      return { success: false, error: 'User to unblock not found' };
    }

    // Remove from blockedUsers array
    const currentUserRef = doc(db, 'users', currentUsername);
    await updateDoc(currentUserRef, {
      blockedUsers: arrayRemove(unblockedUsername),
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Error unblocking user:', error);
    return { success: false, error: error.message || 'Failed to unblock user' };
  }
};

/**
 * Get list of blocked users
 * @param {string} currentUserId - Current user's authUid
 * @returns {Promise<{blockedUsers: Array, error: string|null}>}
 */
export const getBlockedUsers = async (currentUserId) => {
  try {
    if (!currentUserId) {
      return { blockedUsers: [], error: 'Missing current user ID' };
    }

    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { blockedUsers: [], error: 'Firestore not configured' };
    }

    // Get current user's username (document ID)
    const usersRef = collection(db, 'users');
    const currentUserQuery = query(usersRef, where('authUid', '==', currentUserId), limit(1));
    const currentUserSnapshot = await getDocs(currentUserQuery);
    
    if (currentUserSnapshot.empty) {
      // User document doesn't exist yet - return empty list (no blocked users is valid)
      // This can happen right after signup before the user document is created
      console.log('[getBlockedUsers] User document not found yet, returning empty blocked users list');
      return { blockedUsers: [], error: null };
    }

    const currentUserDoc = currentUserSnapshot.docs[0];
    const currentUserData = currentUserDoc.data();
    const blockedUsernames = currentUserData.blockedUsers || [];

    // Fetch user data for each blocked user
    const blockedUsersData = await Promise.all(
      blockedUsernames.map(async (username) => {
        try {
          const blockedUserDoc = await getDoc(doc(db, 'users', username));
          if (blockedUserDoc.exists()) {
            const data = blockedUserDoc.data();
            return {
              username: data.username || username,
              name: data.name || 'Unknown User',
              avatar: data.photoURL || data.avatar || null,
              authUid: data.authUid,
            };
          }
          return null;
        } catch (error) {
          console.error(`Error fetching blocked user ${username}:`, error);
          return null;
        }
      })
    );

    // Filter out null values (users that no longer exist)
    const validBlockedUsers = blockedUsersData.filter(user => user !== null);

    return { blockedUsers: validBlockedUsers, error: null };
  } catch (error) {
    console.error('Error getting blocked users:', error);
    return { blockedUsers: [], error: error.message || 'Failed to get blocked users' };
  }
};

/**
 * Subscribe to blocked users list in real-time
 * @param {string} currentUserId - Current user's authUid
 * @param {Function} callback - Callback function that receives {blockedUsers: Array, error: string|null}
 * @returns {Function} Unsubscribe function
 */
export const subscribeToBlockedUsers = (currentUserId, callback) => {
  try {
    if (!currentUserId) {
      callback({ blockedUsers: [], error: 'Missing current user ID' });
      return () => {};
    }

    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      callback({ blockedUsers: [], error: 'Firestore not configured' });
      return () => {};
    }

    // Get current user's username (document ID)
    const usersRef = collection(db, 'users');
    const currentUserQuery = query(usersRef, where('authUid', '==', currentUserId), limit(1));
    
    let unsubscribeFn = null;
    let currentUsername = null;

    // First, get the username
    getDocs(currentUserQuery).then((snapshot) => {
      if (snapshot.empty) {
        // User document doesn't exist yet - return empty list (no blocked users is valid)
        // This can happen right after signup before the user document is created
        console.log('[subscribeToBlockedUsers] User document not found yet, returning empty blocked users list');
        callback({ blockedUsers: [], error: null });
        return;
      }

      currentUsername = snapshot.docs[0].id;
      const currentUserRef = doc(db, 'users', currentUsername);

      // Subscribe to changes
      unsubscribeFn = onSnapshot(
        currentUserRef,
        async (docSnapshot) => {
          if (!docSnapshot.exists()) {
            callback({ blockedUsers: [], error: null });
            return;
          }

          const userData = docSnapshot.data();
          const blockedUsernames = userData.blockedUsers || [];

          // Fetch user data for each blocked user
          const blockedUsersData = await Promise.all(
            blockedUsernames.map(async (username) => {
              try {
                const blockedUserDoc = await getDoc(doc(db, 'users', username));
                if (blockedUserDoc.exists()) {
                  const data = blockedUserDoc.data();
                  return {
                    username: data.username || username,
                    name: data.name || 'Unknown User',
                    avatar: data.photoURL || data.avatar || null,
                    authUid: data.authUid,
                  };
                }
                return null;
              } catch (error) {
                console.error(`Error fetching blocked user ${username}:`, error);
                return null;
              }
            })
          );

          const validBlockedUsers = blockedUsersData.filter(user => user !== null);
          callback({ blockedUsers: validBlockedUsers, error: null });
        },
        (error) => {
          console.error('Error subscribing to blocked users:', error);
          callback({ blockedUsers: [], error: error.message });
        }
      );
    });

    return () => {
      if (unsubscribeFn) {
        unsubscribeFn();
      }
    };
  } catch (error) {
    console.error('Error setting up blocked users subscription:', error);
    callback({ blockedUsers: [], error: error.message });
    return () => {};
  }
};

/**
 * Check if a user is blocked
 * @param {string} currentUserId - Current user's authUid
 * @param {string} checkUserId - Username or authUid of user to check
 * @returns {Promise<{isBlocked: boolean, error: string|null}>}
 */
export const isUserBlocked = async (currentUserId, checkUserId) => {
  try {
    if (!currentUserId || !checkUserId) {
      return { isBlocked: false, error: 'Missing required parameters' };
    }

    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { isBlocked: false, error: 'Firestore not configured' };
    }

    // Get current user's username (document ID)
    const usersRef = collection(db, 'users');
    const currentUserQuery = query(usersRef, where('authUid', '==', currentUserId), limit(1));
    const currentUserSnapshot = await getDocs(currentUserQuery);
    
    if (currentUserSnapshot.empty) {
      return { isBlocked: false, error: 'Current user not found' };
    }

    const currentUserDoc = currentUserSnapshot.docs[0];
    const currentUserData = currentUserDoc.data();
    const blockedUsernames = currentUserData.blockedUsers || [];

    // Get username of user to check
    let checkUsername = null;
    
    // Check if checkUserId is already a username (document ID)
    const checkUserDoc = await getDoc(doc(db, 'users', checkUserId.toLowerCase().replace(/\s+/g, '')));
    if (checkUserDoc.exists()) {
      checkUsername = checkUserDoc.id;
    } else {
      // Try to find by authUid
      const checkUserQuery = query(usersRef, where('authUid', '==', checkUserId), limit(1));
      const checkUserSnapshot = await getDocs(checkUserQuery);
      if (!checkUserSnapshot.empty) {
        checkUsername = checkUserSnapshot.docs[0].id;
      }
    }

    if (!checkUsername) {
      return { isBlocked: false, error: null };
    }

    const isBlocked = blockedUsernames.includes(checkUsername);
    return { isBlocked, error: null };
  } catch (error) {
    console.error('Error checking if user is blocked:', error);
    return { isBlocked: false, error: error.message || 'Failed to check block status' };
  }
};

