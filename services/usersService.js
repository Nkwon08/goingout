// Users service - handles user profile operations
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy, limit, startAt, endAt } from 'firebase/firestore';
import { db } from '../config/firebase';

// Get user by ID
export const getUserById = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { userData: { id: userDoc.id, ...userDoc.data() }, error: null };
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
    
    // If username is being updated, also update usernameLowercase for searching
    const updateData = { ...updates };
    if (updates.username) {
      updateData.usernameLowercase = String(updates.username).trim().toLowerCase();
    }
    updateData.updatedAt = new Date().toISOString();
    
    await updateDoc(userRef, updateData);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
};

// Search users by username using Firestore queries (faster than fetching all users)
// Uses usernameLowercase field for case-insensitive prefix matching
// Returns: { users: array, error: string }
export const searchUsersByUsername = async (username) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { users: [], error: 'Firestore not configured' };
    }

    if (!username || !username.trim()) {
      return { users: [], error: null };
    }

    const searchTerm = username.trim().toLowerCase();
    console.log('🔍 Searching for username (case-insensitive):', searchTerm);
    const usersRef = collection(db, 'users');
    
    // Strategy 1: Try exact match first (fastest, if user typed exact username)
    try {
      const exactQuery = query(
        usersRef,
        where('usernameLowercase', '==', searchTerm),
        limit(1)
      );
      const exactSnapshot = await getDocs(exactQuery);
      
      if (!exactSnapshot.empty) {
        console.log('✅ Found exact match');
        const user = exactSnapshot.docs[0].data();
        return {
          users: [{
            uid: exactSnapshot.docs[0].id,
            username: user.username || null,
            name: user.name || null,
            avatar: user.avatar || null,
            bio: user.bio || null,
            age: user.age || null,
            gender: user.gender || null,
            ...user
          }],
          error: null
        };
      }
    } catch (exactError) {
      console.log('⚠️ Exact match query failed, trying prefix search:', exactError.message);
    }
    
    // Strategy 2: Prefix matching (autocomplete-style search)
    try {
      const searchEnd = searchTerm + '\uf8ff'; // Unicode character for prefix matching
      console.log('🔍 Search range:', searchTerm, 'to', searchEnd);
      
      // Query for usernames that start with searchTerm (case-insensitive prefix match)
      const q = query(
        usersRef,
        where('usernameLowercase', '>=', searchTerm),
        where('usernameLowercase', '<=', searchEnd),
        orderBy('usernameLowercase'),
        limit(20) // Limit results for performance
      );
      
      console.log('📡 Executing Firestore prefix query...');
      const querySnapshot = await getDocs(q);
      console.log('📦 Query returned', querySnapshot.docs.length, 'documents');
      
      // Debug: Log all found usernames
      if (querySnapshot.docs.length > 0) {
        console.log('✅ Found usernames:', querySnapshot.docs.map(doc => ({
          uid: doc.id,
          username: doc.data().username,
          usernameLowercase: doc.data().usernameLowercase,
        })));
      }
      
      // Map results and include all user data
      const users = querySnapshot.docs
        .map((doc) => {
          const data = doc.data();
          return { 
            uid: doc.id, 
            username: data.username || null,
            name: data.name || null,
            avatar: data.avatar || null,
            bio: data.bio || null,
            age: data.age || null,
            gender: data.gender || null,
            ...data 
          };
        })
        .filter((user) => {
          // Double-check that username exists and matches
          if (!user.username) {
            return false;
          }
          const userLowercase = String(user.username).toLowerCase().trim();
          return userLowercase.includes(searchTerm);
        });

      // Sort: exact matches first, then prefix matches, then other matches
      const sortedUsers = users.sort((a, b) => {
        const aUsername = (a.username?.toLowerCase() || '').trim();
        const bUsername = (b.username?.toLowerCase() || '').trim();
        
        const aExact = aUsername === searchTerm;
        const bExact = bUsername === searchTerm;
        
        // Exact matches come first
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Then prefix matches (starts with search term)
        const aStarts = aUsername.startsWith(searchTerm);
        const bStarts = bUsername.startsWith(searchTerm);
        
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Finally, alphabetical order
        return aUsername.localeCompare(bUsername);
      });

      if (sortedUsers.length > 0) {
        return { users: sortedUsers, error: null };
      }
    } catch (prefixError) {
      console.error('❌ Prefix search failed:', prefixError.message);
      // Continue to fallback
    }
    
    // Strategy 3: Fallback - fetch all users and filter client-side (if index missing)
    console.log('🔄 Falling back to client-side filtering...');
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    console.log('📦 Fetched', querySnapshot.docs.length, 'total users');
    
    const allUsers = querySnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return { 
          uid: doc.id, 
          username: data.username || null,
          name: data.name || null,
          avatar: data.avatar || null,
          bio: data.bio || null,
          age: data.age || null,
          gender: data.gender || null,
          usernameLowercase: data.usernameLowercase || null,
          ...data 
        };
      })
      .filter((user) => {
        if (!user.username) {
          return false;
        }
        // Case-insensitive matching: check both username and usernameLowercase
        const userUsername = String(user.username).toLowerCase().trim();
        const userLowercase = user.usernameLowercase || userUsername;
        
        // Exact match or prefix match or contains match
        const matches = 
          userLowercase === searchTerm || 
          userLowercase.startsWith(searchTerm) || 
          userLowercase.includes(searchTerm);
        
        return matches;
      })
      .sort((a, b) => {
        const aUsername = (a.username?.toLowerCase() || '').trim();
        const bUsername = (b.username?.toLowerCase() || '').trim();
        const aExact = aUsername === searchTerm;
        const bExact = bUsername === searchTerm;
        
        // Exact matches first
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Then prefix matches
        const aStarts = aUsername.startsWith(searchTerm);
        const bStarts = bUsername.startsWith(searchTerm);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Finally alphabetical
        return aUsername.localeCompare(bUsername);
      })
      .slice(0, 20); // Limit to 20 results
    
    console.log('✅ Fallback found', allUsers.length, 'matching users');
    return { users: allUsers, error: null };
  } catch (error) {
    // If all strategies fail
    console.error('❌ All search strategies failed:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    
    // Check if it's an index error
    if (error.code === 'failed-precondition') {
      console.error('❌ MISSING FIRESTORE INDEX!');
      console.error('❌ Create index for: users collection, usernameLowercase field (Ascending)');
      console.error('❌ Check Firebase Console for the index creation link');
    }
    
    return { users: [], error: error.message || 'Search failed' };
  }
};

