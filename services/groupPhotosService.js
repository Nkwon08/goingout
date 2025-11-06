// Group Photos service - handles group album photos/videos
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Add a photo to a group's album
 * @param {string} groupId - The group ID
 * @param {string} userId - The user ID adding the photo
 * @param {string} imageUrl - The image URL (from Firebase Storage)
 * @param {Object} userData - User data (name, username, avatar)
 * @returns {Promise<{ photoId: string|null, error: string|null }>}
 */
export const addPhotoToAlbum = async (groupId, userId, imageUrl, userData) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { photoId: null, error: 'Firestore not configured' };
    }

    if (!groupId || !userId || !imageUrl) {
      return { photoId: null, error: 'Group ID, user ID, and image URL are required' };
    }

    const photoData = {
      userId,
      userName: userData.name || 'User',
      userUsername: userData.username || 'user',
      userAvatar: userData.photoURL || userData.avatar || null,
      type: 'photo',
      url: imageUrl,
      createdAt: serverTimestamp(),
    };

    const photosRef = collection(db, 'groups', groupId, 'photos');
    const photoRef = await addDoc(photosRef, photoData);

    return { photoId: photoRef.id, error: null };
  } catch (error) {
    console.error('❌ Error adding photo to album:', error);
    return { photoId: null, error: error.message };
  }
};

/**
 * Add a video to a group's album
 * @param {string} groupId - The group ID
 * @param {string} userId - The user ID adding the video
 * @param {string} videoUrl - The video URL (from Firebase Storage)
 * @param {Object} userData - User data (name, username, avatar)
 * @returns {Promise<{ photoId: string|null, error: string|null }>}
 */
export const addVideoToAlbum = async (groupId, userId, videoUrl, userData) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { photoId: null, error: 'Firestore not configured' };
    }

    if (!groupId || !userId || !videoUrl) {
      return { photoId: null, error: 'Group ID, user ID, and video URL are required' };
    }

    const photoData = {
      userId,
      userName: userData.name || 'User',
      userUsername: userData.username || 'user',
      userAvatar: userData.photoURL || userData.avatar || null,
      type: 'video',
      url: videoUrl,
      createdAt: serverTimestamp(),
    };

    const photosRef = collection(db, 'groups', groupId, 'photos');
    const photoRef = await addDoc(photosRef, photoData);

    return { photoId: photoRef.id, error: null };
  } catch (error) {
    console.error('❌ Error adding video to album:', error);
    return { photoId: null, error: error.message };
  }
};

/**
 * Subscribe to photos for a group album
 * @param {string} groupId - The group ID
 * @param {Function} callback - Callback function that receives photos array
 * @returns {Function} Unsubscribe function
 */
export const subscribeToGroupPhotos = (groupId, callback) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      callback({ photos: [], error: 'Firestore not configured' });
      return () => {};
    }

    if (!groupId) {
      callback({ photos: [], error: 'Group ID is required' });
      return () => {};
    }

    const photosRef = collection(db, 'groups', groupId, 'photos');
    const q = query(photosRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const photos = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type || 'photo',
            uri: data.url || null,
            userId: data.userId || null,
            userName: data.userName || 'User',
            userAvatar: data.userAvatar || null,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          };
        });

        callback({ photos, error: null });
      },
      (error) => {
        console.error('❌ Error subscribing to group photos:', error);
        callback({ photos: [], error: error.message });
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error setting up group photos subscription:', error);
    callback({ photos: [], error: error.message });
    return () => {};
  }
};

