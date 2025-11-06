// Comments service - handles comment creation, reading, and deletion
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  limit,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Add a comment to a post
 * @param {string} postId - Post ID
 * @param {string} userId - User ID who is commenting
 * @param {string} postOwnerId - Post owner ID (for notifications)
 * @param {Object} userData - User data (name, username, avatar)
 * @param {string} text - Comment text
 * @returns {Promise<{ success: boolean, commentId: string|null, error: string|null }>}
 */
export const addComment = async (postId, userId, postOwnerId, userData, text) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, commentId: null, error: 'Firestore not configured' };
    }

    if (!text || !text.trim()) {
      return { success: false, commentId: null, error: 'Comment text is required' };
    }

    const commentsRef = collection(db, 'posts', postId, 'comments');
    
    const commentData = {
      userId,
      username: userData.username || 'user',
      name: userData.name || 'User',
      avatar: userData.photoURL || userData.avatar || null,
      text: text.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Add comment
    const commentRef = await addDoc(commentsRef, commentData);
    
    // Update post reply count
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    if (postDoc.exists()) {
      const currentReplies = postDoc.data().replies || 0;
      await updateDoc(postRef, {
        replies: currentReplies + 1,
        updatedAt: serverTimestamp(),
      });
    }

    // Send notification to post owner if not the same user
    if (postOwnerId && postOwnerId !== userId) {
      try {
        const { createNotification } = await import('./notificationsService');
        await createNotification(postOwnerId, {
          type: 'comment',
          postId,
          commentId: commentRef.id,
          fromUserId: userId,
          message: 'commented on your post',
        });
      } catch (notifError) {
        console.warn('Failed to send comment notification:', notifError);
        // Don't fail the comment action if notification fails
      }
    }

    return { success: true, commentId: commentRef.id, error: null };
  } catch (error) {
    console.error('Error adding comment:', error);
    return { success: false, commentId: null, error: error.message };
  }
};

/**
 * Get comments for a post
 * @param {string} postId - Post ID
 * @param {number} pageSize - Number of comments to return (default: 50)
 * @returns {Promise<{ comments: Array, error: string|null }>}
 */
export const getComments = async (postId, pageSize = 50) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { comments: [], error: 'Firestore not configured' };
    }

    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(
      commentsRef,
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    const querySnapshot = await getDocs(q);
    const comments = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
      };
    });

    return { comments, error: null };
  } catch (error) {
    console.error('Error getting comments:', error);
    return { comments: [], error: error.message };
  }
};

/**
 * Subscribe to comments for a post (real-time updates)
 * @param {string} postId - Post ID
 * @param {Function} callback - Callback function (result) => {}
 * @param {number} pageSize - Number of comments to return (default: 50)
 * @returns {Function} Unsubscribe function
 */
export const subscribeToComments = (postId, callback, pageSize = 50) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      callback({ comments: [], error: 'Firestore not configured' });
      return () => {};
    }

    if (Object.keys(db).length === 0) {
      callback({ comments: [], error: 'Firestore not configured' });
      return () => {};
    }

    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(
      commentsRef,
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const comments = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          };
        });
        callback({ comments, error: null });
      },
      (error) => {
        console.error('Error subscribing to comments:', error);
        callback({ comments: [], error: error.message });
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up comments subscription:', error);
    callback({ comments: [], error: error.message });
    return () => {};
  }
};

/**
 * Delete a comment
 * @param {string} postId - Post ID
 * @param {string} commentId - Comment ID
 * @param {string} userId - User ID (must match comment author)
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const deleteComment = async (postId, commentId, userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const commentDoc = await getDoc(commentRef);
    
    if (!commentDoc.exists()) {
      return { success: false, error: 'Comment not found' };
    }

    // Verify user owns the comment
    if (commentDoc.data().userId !== userId) {
      return { success: false, error: 'Not authorized to delete this comment' };
    }

    // Delete comment
    await deleteDoc(commentRef);
    
    // Update post reply count
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    if (postDoc.exists()) {
      const currentReplies = postDoc.data().replies || 0;
      await updateDoc(postRef, {
        replies: Math.max(0, currentReplies - 1),
        updatedAt: serverTimestamp(),
      });
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting comment:', error);
    return { success: false, error: error.message };
  }
};

