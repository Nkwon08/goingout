// Group Location service - handles sharing locations in group maps
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Enable location sharing for a user in a group
 * @param {string} groupId - The group ID
 * @param {string} userId - The user ID
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} userData - User data (name, avatar, etc.)
 * @returns {Promise<{ error: string|null }>}
 */
export const shareLocationInGroup = async (groupId, userId, lat, lng, userData) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { error: 'Firestore not configured' };
    }

    if (!groupId || !userId || lat === null || lat === undefined || lng === null || lng === undefined) {
      return { error: 'Group ID, user ID, and location coordinates are required' };
    }

    const locationRef = doc(db, 'groups', groupId, 'locations', userId);
    await setDoc(locationRef, {
      userId,
      userName: userData?.name || 'User',
      userAvatar: userData?.photoURL || userData?.avatar || null,
      lat,
      lng,
      updatedAt: serverTimestamp(),
    });

    return { error: null };
  } catch (error) {
    console.error('❌ Error sharing location:', error);
    return { error: error.message };
  }
};

/**
 * Stop sharing location for a user in a group
 * @param {string} groupId - The group ID
 * @param {string} userId - The user ID
 * @returns {Promise<{ error: string|null }>}
 */
export const stopSharingLocationInGroup = async (groupId, userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { error: 'Firestore not configured' };
    }

    if (!groupId || !userId) {
      return { error: 'Group ID and user ID are required' };
    }

    const locationRef = doc(db, 'groups', groupId, 'locations', userId);
    await deleteDoc(locationRef);

    return { error: null };
  } catch (error) {
    console.error('❌ Error stopping location sharing:', error);
    return { error: error.message };
  }
};

/**
 * Subscribe to location updates for a group
 * @param {string} groupId - The group ID
 * @param {Function} callback - Callback function that receives locations array
 * @returns {Function} Unsubscribe function
 */
export const subscribeToGroupLocations = (groupId, callback) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      callback({ locations: [], error: 'Firestore not configured' });
      return () => {};
    }

    if (!groupId) {
      callback({ locations: [], error: 'Group ID is required' });
      return () => {};
    }

    const locationsRef = collection(db, 'groups', groupId, 'locations');

    const unsubscribe = onSnapshot(
      locationsRef,
      (snapshot) => {
        const locations = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            userId: data.userId,
            userName: data.userName || 'User',
            userAvatar: data.userAvatar || null,
            lat: data.lat,
            lng: data.lng,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date()),
          };
        });

        callback({ locations, error: null });
      },
      (error) => {
        console.error('❌ Error subscribing to group locations:', error);
        callback({ locations: [], error: error.message });
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error setting up group locations subscription:', error);
    callback({ locations: [], error: error.message });
    return () => {};
  }
};

