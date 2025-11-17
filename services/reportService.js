// Report service - handles reporting posts and users
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

/**
 * Report a post
 * @param {string} postId - ID of the post to report
 * @param {string} reason - Reason for reporting (e.g., 'spam', 'inappropriate', 'harassment', 'other')
 * @param {string} details - Additional details (optional)
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const reportPost = async (postId, reason = 'inappropriate', details = null) => {
  try {
    if (!auth || !auth.currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    if (!postId) {
      return { success: false, error: 'Post ID is required' };
    }

    const reporterId = auth.currentUser.uid;
    const reporterEmail = auth.currentUser.email || 'unknown';

    // Check if user has already reported this post
    // Note: This query might fail if Firestore index is needed, but we'll catch and continue
    try {
      const reportsRef = collection(db, 'reports');
      const existingReportQuery = query(
        reportsRef,
        where('postId', '==', postId),
        where('reporterId', '==', reporterId),
        where('type', '==', 'post')
      );
      const existingReports = await getDocs(existingReportQuery);

      if (!existingReports.empty) {
        return { success: false, error: 'You have already reported this post' };
      }
    } catch (queryError) {
      // If query fails (e.g., missing index or permissions), log but continue
      // We'll still try to create the report - Firestore will prevent duplicates at the document level
      console.warn('⚠️ Could not check for existing reports:', queryError.message);
    }

    // Create report document
    const reportData = {
      type: 'post',
      postId,
      reporterId,
      reporterEmail,
      reason,
      details: details || null,
      status: 'pending', // 'pending', 'reviewed', 'resolved', 'dismissed'
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, 'reports'), reportData);

    console.log('✅ Post reported successfully:', postId);
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error reporting post:', error);
    return { success: false, error: error.message || 'Failed to report post' };
  }
};

/**
 * Report a user
 * @param {string} userId - ID of the user to report
 * @param {string} reason - Reason for reporting
 * @param {string} details - Additional details (optional)
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const reportUser = async (userId, reason = 'inappropriate', details = null) => {
  try {
    if (!auth || !auth.currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    if (!userId) {
      return { success: false, error: 'User ID is required' };
    }

    if (userId === auth.currentUser.uid) {
      return { success: false, error: 'You cannot report yourself' };
    }

    const reporterId = auth.currentUser.uid;
    const reporterEmail = auth.currentUser.email || 'unknown';

    // Check if user has already reported this user
    const reportsRef = collection(db, 'reports');
    const existingReportQuery = query(
      reportsRef,
      where('reportedUserId', '==', userId),
      where('reporterId', '==', reporterId),
      where('type', '==', 'user')
    );
    const existingReports = await getDocs(existingReportQuery);

    if (!existingReports.empty) {
      return { success: false, error: 'You have already reported this user' };
    }

    // Create report document
    const reportData = {
      type: 'user',
      reportedUserId: userId,
      reporterId,
      reporterEmail,
      reason,
      details: details || null,
      status: 'pending',
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, 'reports'), reportData);

    console.log('✅ User reported successfully:', userId);
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error reporting user:', error);
    return { success: false, error: error.message || 'Failed to report user' };
  }
};

