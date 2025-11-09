// Users service - handles user profile operations
import { doc, getDoc, updateDoc, collection, query, where, getDocs, getDocsFromServer, orderBy, limit, startAt, startAfter, endAt } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../config/firebase';

/**
 * Debug function to list usernames from Firestore (for debugging/admin purposes)
 * Call this from anywhere in your app to see all usernames
 * @param {number} limitCount - Maximum number of users to return (default: 20)
 * @returns {Promise<Array>} Array of user objects with username, name, email, uid
 */
export async function debugListUsernames(limitCount = 20) {
  try {
    console.log('[debugListUsernames] Fetching users...');

    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      console.error('[debugListUsernames] ❌ Firestore not configured');
      return [];
    }

    const usersRef = collection(db, 'users');
    // Use getDocsFromServer to force fresh data from server (bypass cache)
    const snapshot = await getDocsFromServer(usersRef);

    if (snapshot.empty) {
      console.log('[debugListUsernames] ❌ No users found in database');
      return [];
    }

    const rows = [];
    snapshot.forEach((d) => {
      const u = d.data();
      rows.push({
        id: d.id,
        username: u.username || 'MISSING',
        username_lowercase: u.username_lowercase || 'MISSING',
        name: u.name || 'N/A',
        email: u.email || 'N/A',
      });
    });

    console.log('[debugListUsernames]', rows.slice(0, limitCount));
    
    // Check for missing usernames
    const missingUsernames = rows.filter(r => !r.username || r.username === 'MISSING');
    if (missingUsernames.length > 0) {
      console.warn(`[debugListUsernames] ⚠️ WARNING: ${missingUsernames.length} users missing username field!`);
      missingUsernames.forEach(u => {
        console.warn(`  - UID: ${u.id}, Email: ${u.email}`);
      });
    }

    // Sort by username
    rows.sort((a, b) => (a.username || '').localeCompare(b.username || ''));

    console.log(`\n[debugListUsernames] ✅ Found ${rows.length} users (showing first ${Math.min(limitCount, rows.length)}):\n`);
    console.log('═'.repeat(90));
    console.log(`${'Username'.padEnd(25)} ${'Username_lowercase'.padEnd(25)} ${'Email'.padEnd(30)}`);
    console.log('═'.repeat(90));

    rows.slice(0, limitCount).forEach((user) => {
      console.log(`${(user.username || 'MISSING').padEnd(25)} ${(user.username_lowercase || 'MISSING').padEnd(25)} ${user.email.padEnd(30)}`);
    });

    console.log('═'.repeat(90));
    console.log(`\n📊 Total: ${rows.length} users`);
    
    return rows;
  } catch (error) {
    console.error('[debugListUsernames] ❌ Error fetching usernames:', error);
    console.error('[debugListUsernames] Error details:', error.message);
    return [];
  }
}

/**
 * List all usernames from Firestore (for debugging/admin purposes)
 * Call this from anywhere in your app to see all usernames
 * @returns {Promise<Array>} Array of user objects with username, name, email, uid
 */
export const listAllUsernames = async () => {
  return await debugListUsernames(100); // Show up to 100 users
};

// Get user by username (document ID is now username_lowercase)
// Also supports getting by Firebase Auth UID for backward compatibility
export const getUserById = async (userId) => {
  try {
    // Normalize input - could be username or authUid
    const userId_lowercase = userId.toLowerCase().replace(/\s+/g, '');
    
    // First, try to get by username (document ID)
    const userDoc = await getDoc(doc(db, 'users', userId_lowercase));
    if (userDoc.exists()) {
      const data = userDoc.data();
      // Verify this is the right user (by checking authUid if it's a UID lookup)
      if (data.authUid === userId || userId_lowercase === userDoc.id) {
        return { userData: { id: userDoc.id, username: userDoc.id, ...data }, error: null };
      }
    }
    
    // If not found by document ID, try to find by authUid (for backward compatibility)
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('authUid', '==', userId), limit(1));
    const snapshots = await getDocs(q);
    
    if (!snapshots.empty) {
      const doc = snapshots.docs[0];
      return { userData: { id: doc.id, username: doc.id, ...doc.data() }, error: null };
    }
    
    return { userData: null, error: 'User not found' };
  } catch (error) {
    return { userData: null, error: error.message };
  }
};

// Update user profile
export const updateUserProfile = async (userId, updates) => {
  try {
    const userRef = doc(db, 'users', userId);
    
    // If username is being updated, also update username_lowercase for searching
    const updateData = { ...updates };
    if (updates.username) {
      updateData.username_lowercase = String(updates.username).trim().toLowerCase();
    }
    updateData.updatedAt = new Date().toISOString();
    
    await updateDoc(userRef, updateData);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
};

/**
 * Search users by username (case-insensitive)
 * Uses username_lowercase field for exact match
 * @param {string} username - The username to search for
 * @returns {Promise<{ users: Array, error: string|null }>}
 */
export const searchUsersByUsername = async (username) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { users: [], error: 'Firestore not configured' };
    }

    if (!username) return { users: [], error: null };

    const usernameLower = username.toLowerCase(); // Convert for case-insensitive search

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username_lowercase', '==', usernameLower));

    // Use getDocsFromServer to force fresh data from server (bypass cache)
    const querySnapshot = await getDocsFromServer(q);

    const users = querySnapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    }));

    return { users, error: null };
  } catch (error) {
    console.error('❌ searchUsersByUsername error:', error);
    
    // Handle different error types
    if (error.code === 'unavailable') {
      return { users: [], error: 'Unable to connect to database. Please check your internet connection and try again.' };
    }
    if (error.code === 'permission-denied') {
      return { users: [], error: 'Permission denied. Please check Firestore security rules.' };
    }
    
    return { users: [], error: error.message || 'Failed to search users' };
  }
};

/**
 * Get all users (excluding current user) with pagination
 * Returns users with: username, name, avatar, bio, age, gender
 * Waits for Auth initialization via onAuthStateChanged before querying
 * @param {string} currentUserId - Current user's ID to exclude
 * @param {number} pageSize - Number of users per page (default: 20)
 * @param {string|null} lastUserId - Last user ID from previous page (for pagination)
 * @returns {Promise<{ users: Array, lastUserId: string|null, hasMore: boolean, error: string|null }>}
 */
export const getAllUsers = async (currentUserId, pageSize = 20, lastUserId = null) => {
  try {
    // Check if Firestore is configured
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      console.warn('⚠️ Firestore not configured');
      return { users: [], lastUserId: null, hasMore: false, error: 'Firestore not configured' };
    }

    // Check if Auth is initialized
    if (!auth) {
      console.warn('⚠️ Firebase Auth not initialized');
      return { users: [], lastUserId: null, hasMore: false, error: 'Firebase Auth not initialized' };
    }

    // Wait for onAuthStateChanged to fire before proceeding
    // This ensures auth state is fully initialized
    const waitForAuthState = () => {
      return new Promise((resolve) => {
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

    // Wait for auth state to be ready
    const authUser = await waitForAuthState();

    // If no currentUserId provided, use auth state
    if (!currentUserId) {
      if (!authUser || !authUser.uid) {
        console.log('ℹ️ No user signed in - skipping user fetch');
        return { users: [], lastUserId: null, hasMore: false, error: 'No user signed in' };
      }
      currentUserId = authUser.uid;
    } else {
      // Verify the provided userId matches auth state
      if (!authUser || authUser.uid !== currentUserId) {
        console.warn('⚠️ User ID mismatch - waiting for auth state');
        // Wait a bit more for auth to sync
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }


    const usersRef = collection(db, 'users');
    let q;

    // Build query with pagination - use simple approach that works without complex indexes
    if (lastUserId) {
      // Get last document for pagination
      const lastDocRef = doc(db, 'users', lastUserId);
      const lastDoc = await getDoc(lastDocRef);
      
      if (lastDoc.exists()) {
        q = query(
          usersRef,
          orderBy('__name__'),
          startAfter(lastDoc),
          limit(pageSize + 1) // Get one extra to check if there's more
        );
      } else {
        // Fallback if lastDoc doesn't exist
        q = query(
          usersRef,
          orderBy('__name__'),
          limit(pageSize + 1)
        );
      }
    } else {
      // First page
      q = query(
        usersRef,
        orderBy('__name__'),
        limit(pageSize + 1)
      );
    }

    // Use getDocsFromServer to force fresh data from server (bypass cache)
    // This ensures deleted users are not shown
    const querySnapshot = await getDocsFromServer(q);
    
    // Check if there are more pages
    const hasMore = querySnapshot.docs.length > pageSize;
    const docs = hasMore ? querySnapshot.docs.slice(0, pageSize) : querySnapshot.docs;
    
    // Filter out current user and map to user objects
    // Note: doc.id is now username (document ID), not UID
    // We need to filter by authUid field instead
    const users = docs
      .filter((doc) => {
        const data = doc.data();
        // Exclude current user by comparing authUid (document ID is now username)
        return data.authUid !== currentUserId;
      })
      .map((doc) => {
        const data = doc.data();
        // Check photoURL first (new field), then avatar (backward compatibility), then photo (legacy)
        const avatarUrl = data.photoURL || data.avatar || data.photo || 'https://i.pravatar.cc/100';
        return {
          uid: doc.id, // This is now the username (document ID), but we'll use it as uid for display
          username: data.username || 'username',
          name: data.name || 'User',
          avatar: avatarUrl,
          bio: data.bio || null,
          age: data.age || null,
          gender: data.gender || null,
        };
      });

    // Get last user ID for next page (from filtered results)
    const newLastUserId = users.length > 0 && docs.length > 0 ? docs[docs.length - 1].id : null;

    // If we filtered out the current user and need more, adjust pagination
    let finalLastUserId = newLastUserId;
    let finalHasMore = hasMore;
    
    // If we filtered out current user and got fewer results, we might need to load more
    if (users.length < docs.length && hasMore) {
      // We have more, but need to account for filtering
      finalHasMore = true;
    }

    return {
      users,
      lastUserId: finalLastUserId,
      hasMore: finalHasMore,
      error: null,
    };
  } catch (error) {
    console.error('❌ getAllUsers error:', error);
    
    // Handle different error types
    if (error.code === 'unavailable') {
      return {
        users: [],
        lastUserId: null,
        hasMore: false,
        error: 'Unable to connect to database. Please check your internet connection.',
      };
    }
    if (error.code === 'permission-denied') {
      return {
        users: [],
        lastUserId: null,
        hasMore: false,
        error: 'Permission denied. Please check Firestore security rules.',
      };
    }
    if (error.code === 'failed-precondition') {
      // Index needed - try simpler query without orderBy
      // This is a fallback that works but won't have consistent ordering
      try {
        const usersRef = collection(db, 'users');
        let q;
        
        if (lastUserId) {
          const lastDocRef = doc(db, 'users', lastUserId);
          const lastDoc = await getDoc(lastDocRef);
          if (lastDoc.exists()) {
            q = query(usersRef, startAfter(lastDoc), limit(pageSize + 1));
          } else {
            q = query(usersRef, limit(pageSize + 1));
          }
        } else {
          q = query(usersRef, limit(pageSize + 1));
        }
        
        const querySnapshot = await getDocs(q);
        const hasMore = querySnapshot.docs.length > pageSize;
        const docs = hasMore ? querySnapshot.docs.slice(0, pageSize) : querySnapshot.docs;
        
        const users = docs
          .filter((doc) => doc.id !== currentUserId)
          .map((doc) => {
            const data = doc.data();
            return {
              uid: doc.id,
              username: data.username || 'username',
              name: data.name || 'User',
              avatar: data.avatar || data.photo || 'https://i.pravatar.cc/100',
              bio: data.bio || null,
              age: data.age || null,
              gender: data.gender || null,
            };
          });

        return {
          users,
          lastUserId: docs.length > 0 ? docs[docs.length - 1].id : null,
          hasMore,
          error: null,
        };
      } catch (fallbackError) {
        return {
          users: [],
          lastUserId: null,
          hasMore: false,
          error: fallbackError.message || 'Failed to load users',
        };
      }
    }

    return {
      users: [],
      lastUserId: null,
      hasMore: false,
      error: error.message || 'Failed to load users',
    };
  }
};

/**
 * Search users by username prefix (for @mention autocomplete)
 * Returns users whose username starts with the query string
 * @param {string} searchQuery - The search query (username prefix)
 * @param {string} currentUserId - Current user's ID to exclude
 * @param {Array<string>} friendsList - List of friend usernames to prioritize
 * @param {number} limitCount - Maximum number of results (default: 15)
 * @returns {Promise<{ users: Array, error: string|null }>}
 */
export const searchUsersByPrefix = async (searchQuery, currentUserId, friendsList = [], limitCount = 15) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { users: [], error: 'Firestore not configured' };
    }

    if (!searchQuery || searchQuery.trim().length === 0) {
      return { users: [], error: null };
    }

    const queryLower = searchQuery.toLowerCase().trim();
    const queryUpper = queryLower.slice(0, -1) + String.fromCharCode(queryLower.charCodeAt(queryLower.length - 1) + 1);

    const usersRef = collection(db, 'users');
    
    // Use range query for prefix matching: >= queryLower and < queryUpper
    const q = query(
      usersRef,
      where('username_lowercase', '>=', queryLower),
      where('username_lowercase', '<', queryUpper),
      orderBy('username_lowercase'),
      limit(limitCount * 2) // Get more to filter out current user and prioritize friends
    );

    const querySnapshot = await getDocsFromServer(q);
    
    const allUsers = querySnapshot.docs
      .filter((doc) => {
        const data = doc.data();
        // Exclude current user
        return data.authUid !== currentUserId;
      })
      .map((doc) => {
        const data = doc.data();
        const avatarUrl = data.photoURL || data.avatar || data.photo || 'https://i.pravatar.cc/100';
        const docId = doc.id.toLowerCase();
        return {
          uid: doc.id,
          username: data.username || 'username',
          name: data.name || 'User',
          avatar: avatarUrl,
          bio: data.bio || null,
          isFriend: friendsList.includes(docId),
        };
      });

    // Prioritize friends first, then others
    const friends = allUsers.filter(u => u.isFriend);
    const others = allUsers.filter(u => !u.isFriend);
    
    // Combine: friends first, then others, limit to limitCount
    const users = [...friends, ...others].slice(0, limitCount);

    return { users, error: null };
  } catch (error) {
    console.error('❌ searchUsersByPrefix error:', error);
    
    // Handle different error types
    if (error.code === 'unavailable') {
      return { users: [], error: 'Unable to connect to database. Please check your internet connection and try again.' };
    }
    if (error.code === 'permission-denied') {
      return { users: [], error: 'Permission denied. Please check Firestore security rules.' };
    }
    if (error.code === 'failed-precondition') {
      // Index needed - fallback to client-side filtering
      try {
        const { getAllUsers } = await import('./usersService');
        const result = await getAllUsers(currentUserId, 100, null);
        
        if (result.error) {
          return { users: [], error: result.error };
        }
        
        const queryLower = searchQuery.toLowerCase().trim();
        const filtered = result.users
          .filter(u => {
            const usernameLower = (u.username || '').toLowerCase();
            return usernameLower.startsWith(queryLower);
          })
          .map(u => ({
            ...u,
            isFriend: friendsList.includes((u.uid || u.username || '').toLowerCase()),
          }));
        
        const friends = filtered.filter(u => u.isFriend);
        const others = filtered.filter(u => !u.isFriend);
        const users = [...friends, ...others].slice(0, limitCount);
        
        return { users, error: null };
      } catch (fallbackError) {
        return { users: [], error: fallbackError.message || 'Failed to search users' };
      }
    }
    
    return { users: [], error: error.message || 'Failed to search users' };
  }
};

