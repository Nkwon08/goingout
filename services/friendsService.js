// Friends service - handles friendships using simple array structure
//
// DATABASE STRUCTURE:
// ==================
// users (collection):
//   userId (document ID):
//     username: string
//     email: string
//     friends: [userId1, userId2, ...]  // Array of friend user IDs
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
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Add a friend (mutual friendship)
// Adds friendId to currentUser's friends array and currentUserId to friend's friends array
// Returns: { success: boolean, error: string }
export const addFriend = async (currentUserId, friendUserId) => {
  try {
    console.log('👥 Adding friend:', currentUserId, '→', friendUserId);
    
    // Check if Firestore is configured
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    // Prevent self-friend
    if (currentUserId === friendUserId) {
      return { success: false, error: 'Cannot add yourself as a friend' };
    }

    // Check if already friends
    const areFriends = await checkFriendship(currentUserId, friendUserId);
    if (areFriends) {
      return { success: false, error: 'Already friends' };
    }

    // Check if friend user exists
    const friendUserRef = doc(db, 'users', friendUserId);
    const friendUserDoc = await getDoc(friendUserRef);
    if (!friendUserDoc.exists()) {
      return { success: false, error: 'User not found' };
    }

    // Update both users' friends arrays atomically
    const currentUserRef = doc(db, 'users', currentUserId);
    const friendRef = doc(db, 'users', friendUserId);

    // Use arrayUnion to add friend IDs (prevents duplicates)
    await Promise.all([
      updateDoc(currentUserRef, {
        friends: arrayUnion(friendUserId),
        updatedAt: serverTimestamp(),
      }),
      updateDoc(friendRef, {
        friends: arrayUnion(currentUserId),
        updatedAt: serverTimestamp(),
      }),
    ]);

    console.log('✅ Friend added successfully');
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error adding friend:', error);
    return { success: false, error: error.message || 'Failed to add friend' };
  }
};

// Remove a friend (unfriend)
// Removes friendId from currentUser's friends array and currentUserId from friend's friends array
// Returns: { success: boolean, error: string }
export const removeFriend = async (currentUserId, friendId) => {
  try {
    console.log('🗑️ Removing friend:', currentUserId, '→', friendId);
    
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    // Update both users' friends arrays atomically
    const currentUserRef = doc(db, 'users', currentUserId);
    const friendRef = doc(db, 'users', friendId);

    // Use arrayRemove to remove friend IDs
    await Promise.all([
      updateDoc(currentUserRef, {
        friends: arrayRemove(friendId),
        updatedAt: serverTimestamp(),
      }),
      updateDoc(friendRef, {
        friends: arrayRemove(currentUserId),
        updatedAt: serverTimestamp(),
      }),
    ]);

    console.log('✅ Friend removed successfully');
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error removing friend:', error);
    return { success: false, error: error.message || 'Failed to remove friend' };
  }
};

// Check if two users are friends
// Returns: boolean
export const checkFriendship = async (userId1, userId2) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return false;
    }

    // Check if userId2 is in userId1's friends array
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

// Get friends list for a user
// Returns: { friends: array of userIds, error: string }
export const getFriends = async (userId) => {
  try {
    console.log('👥 Getting friends for:', userId);
    
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
    return { friends: [], error: error.message };
  }
};

// Listen to friends list in real-time
// Returns: unsubscribe function
// Note: Listens to the user document's friends array field
// If a friend removes you, your friends array will update automatically
export const subscribeToFriends = (userId, callback) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      callback({ friends: [], error: 'Firestore not configured' });
      return () => {};
    }

    const userRef = doc(db, 'users', userId);

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          callback({ friends: [], error: 'User not found' });
          return;
        }

        const userData = snapshot.data();
        const friends = userData.friends || [];
        
        callback({ friends, error: null });
      },
      (error) => {
        console.error('❌ Friends subscription error:', error);
        callback({ friends: [], error: error.message });
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error setting up friends subscription:', error);
    callback({ friends: [], error: error.message });
    return () => {};
  }
};
