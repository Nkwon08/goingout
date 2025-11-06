// Group Chat service - handles group chat messages with support for text, images, and videos
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { uploadImage } from './storageService';

/**
 * Send a text message to a group chat
 * @param {string} groupId - The group ID
 * @param {string} userId - The user ID sending the message
 * @param {string} text - The message text
 * @param {Object} userData - User data (name, username, avatar)
 * @returns {Promise<{ messageId: string|null, error: string|null }>}
 */
export const sendMessage = async (groupId, userId, text, userData) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { messageId: null, error: 'Firestore not configured' };
    }

    if (!groupId || !userId || !text || !text.trim()) {
      return { messageId: null, error: 'Group ID, user ID, and message text are required' };
    }

    const messageData = {
      userId,
      userName: userData.name || 'User',
      userUsername: userData.username || 'user',
      userAvatar: userData.photoURL || userData.avatar || null,
      text: text.trim(),
      type: 'text',
      image: null,
      video: null,
      createdAt: serverTimestamp(),
    };

    const messagesRef = collection(db, 'groups', groupId, 'messages');
    const messageRef = await addDoc(messagesRef, messageData);

    return { messageId: messageRef.id, error: null };
  } catch (error) {
    console.error('❌ Error sending message:', error);
    return { messageId: null, error: error.message };
  }
};

/**
 * Send an image message to a group chat
 * @param {string} groupId - The group ID
 * @param {string} userId - The user ID sending the message
 * @param {string} imageUri - The local image URI
 * @param {string} text - Optional caption text
 * @param {Object} userData - User data (name, username, avatar)
 * @returns {Promise<{ messageId: string|null, error: string|null }>}
 */
export const sendImageMessage = async (groupId, userId, imageUri, text, userData) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { messageId: null, error: 'Firestore not configured' };
    }

    if (!groupId || !userId || !imageUri) {
      return { messageId: null, error: 'Group ID, user ID, and image are required' };
    }

    // Upload image to Firebase Storage
    const { url, error: uploadError } = await uploadImage(imageUri, userId, 'group-chat');
    
    if (uploadError || !url) {
      return { messageId: null, error: uploadError || 'Failed to upload image' };
    }

    const messageData = {
      userId,
      userName: userData.name || 'User',
      userUsername: userData.username || 'user',
      userAvatar: userData.photoURL || userData.avatar || null,
      text: text ? text.trim() : '',
      type: 'image',
      image: url,
      video: null,
      createdAt: serverTimestamp(),
    };

    const messagesRef = collection(db, 'groups', groupId, 'messages');
    const messageRef = await addDoc(messagesRef, messageData);

    return { messageId: messageRef.id, error: null };
  } catch (error) {
    console.error('❌ Error sending image message:', error);
    return { messageId: null, error: error.message };
  }
};

/**
 * Send a video message to a group chat
 * @param {string} groupId - The group ID
 * @param {string} userId - The user ID sending the message
 * @param {string} videoUri - The local video URI
 * @param {string} text - Optional caption text
 * @param {Object} userData - User data (name, username, avatar)
 * @returns {Promise<{ messageId: string|null, error: string|null }>}
 */
export const sendVideoMessage = async (groupId, userId, videoUri, text, userData) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { messageId: null, error: 'Firestore not configured' };
    }

    if (!groupId || !userId || !videoUri) {
      return { messageId: null, error: 'Group ID, user ID, and video are required' };
    }

    // Upload video to Firebase Storage (using uploadImage function which handles blobs)
    const { url, error: uploadError } = await uploadImage(videoUri, userId, 'group-chat');
    
    if (uploadError || !url) {
      return { messageId: null, error: uploadError || 'Failed to upload video' };
    }

    const messageData = {
      userId,
      userName: userData.name || 'User',
      userUsername: userData.username || 'user',
      userAvatar: userData.photoURL || userData.avatar || null,
      text: text ? text.trim() : '',
      type: 'video',
      image: null,
      video: url,
      createdAt: serverTimestamp(),
    };

    const messagesRef = collection(db, 'groups', groupId, 'messages');
    const messageRef = await addDoc(messagesRef, messageData);

    return { messageId: messageRef.id, error: null };
  } catch (error) {
    console.error('❌ Error sending video message:', error);
    return { messageId: null, error: error.message };
  }
};

/**
 * Send a poll message to a group chat
 * @param {string} groupId - The group ID
 * @param {string} userId - The user ID sending the message
 * @param {string} pollId - The poll ID
 * @param {string} question - The poll question
 * @param {Array} options - Array of poll options
 * @param {Object} userData - User data (name, username, avatar)
 * @returns {Promise<{ messageId: string|null, error: string|null }>}
 */
export const sendPollMessage = async (groupId, userId, pollId, question, options, userData) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { messageId: null, error: 'Firestore not configured' };
    }

    if (!groupId || !userId || !pollId || !question) {
      return { messageId: null, error: 'Group ID, user ID, poll ID, and question are required' };
    }

    const messageData = {
      userId,
      userName: userData.name || 'User',
      userUsername: userData.username || 'user',
      userAvatar: userData.photoURL || userData.avatar || null,
      text: `📊 ${question}`,
      type: 'poll',
      pollId,
      pollQuestion: question,
      pollOptions: options,
      image: null,
      video: null,
      createdAt: serverTimestamp(),
    };

    const messagesRef = collection(db, 'groups', groupId, 'messages');
    const messageRef = await addDoc(messagesRef, messageData);

    return { messageId: messageRef.id, error: null };
  } catch (error) {
    console.error('❌ Error sending poll message:', error);
    return { messageId: null, error: error.message };
  }
};

/**
 * Subscribe to messages for a group chat
 * @param {string} groupId - The group ID
 * @param {Function} callback - Callback function that receives messages array
 * @returns {Function} Unsubscribe function
 */
export const subscribeToMessages = (groupId, callback) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      callback({ messages: [], error: 'Firestore not configured' });
      return () => {};
    }

    if (!groupId) {
      callback({ messages: [], error: 'Group ID is required' });
      return () => {};
    }

    const messagesRef = collection(db, 'groups', groupId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(100)); // Get last 100 messages

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const messages = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            _id: doc.id,
            text: data.text || '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
            user: {
              _id: data.userId,
              name: data.userName || 'User',
              avatar: data.userAvatar || null,
            },
            image: data.image || null,
            video: data.video || null,
            type: data.type || 'text',
            pollId: data.pollId || null,
            pollQuestion: data.pollQuestion || null,
            pollOptions: data.pollOptions || null,
          };
        });

        // Sort by createdAt ascending (oldest first) for GiftedChat
        messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        callback({ messages, error: null });
      },
      (error) => {
        console.error('❌ Error subscribing to messages:', error);
        callback({ messages: [], error: error.message });
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error setting up messages subscription:', error);
    callback({ messages: [], error: error.message });
    return () => {};
  }
};

