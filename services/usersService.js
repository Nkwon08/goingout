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

    const querySnapshot = await getDocs(q);

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

