// Notifications service - handles creating and sending push notifications
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
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions and register for push notifications
 * @returns {Promise<{ success: boolean, token: string|null, error: string|null }>}
 */
export const registerForPushNotifications = async () => {
  try {
    console.log('📱 Registering for push notifications...');
    
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('📱 Current notification permission status:', existingStatus);
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      console.log('📱 Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('📱 Permission request result:', status);
    }
    
    if (finalStatus !== 'granted') {
      console.warn('⚠️ Notification permission not granted. Status:', finalStatus);
      return { success: false, token: null, error: `Permission not granted. Status: ${finalStatus}` };
    }

    console.log('✅ Notification permissions granted');

    // Get push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('⚠️ Project ID not found, cannot get push token');
      console.warn('💡 Make sure app.json has extra.eas.projectId configured');
      return { success: false, token: null, error: 'Project ID not configured' };
    }

    console.log('📱 Getting Expo push token with projectId:', projectId);
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenData.data;

    console.log('✅ Push token obtained:', token.substring(0, 30) + '...');
    return { success: true, token, error: null };
  } catch (error) {
    console.error('❌ Error registering for push notifications:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
    });
    return { success: false, token: null, error: error.message };
  }
};

/**
 * Create a notification in Firestore and send push notification
 * @param {string} userId - User ID to notify
 * @param {Object} notificationData - Notification data
 * @param {string} notificationData.type - Notification type ('like', 'comment', etc.)
 * @param {string} notificationData.postId - Post ID
 * @param {string} notificationData.fromUserId - User ID who triggered the notification
 * @param {string} notificationData.message - Notification message
 * @param {string} notificationData.commentId - Comment ID (optional, for comments)
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const createNotification = async (userId, notificationData) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      console.error('❌ Firestore not configured in createNotification');
      return { success: false, error: 'Firestore not configured' };
    }

    console.log(`📨 Creating notification for userId: ${userId}, type: ${notificationData.type}`);

    // Get username from authUid (document IDs are usernames, not authUids)
    const { getUsernameFromAuthUid } = await import('./friendsService');
    const username = await getUsernameFromAuthUid(userId);
    
    if (!username) {
      console.error(`❌ User not found for userId: ${userId}`);
      return { success: false, error: 'User not found' };
    }

    console.log(`✅ Found username: ${username} for userId: ${userId}`);

    // Get user data for notification
    const { getUserById } = await import('./usersService');
    const { userData: fromUserData } = await getUserById(notificationData.fromUserId);
    
    if (!fromUserData) {
      console.error(`❌ From user not found for userId: ${notificationData.fromUserId}`);
      return { success: false, error: 'User not found' };
    }

    console.log(`✅ Found from user: ${fromUserData.name || fromUserData.username}`);

    // Create notification document
    const notificationsRef = collection(db, 'users', username, 'notifications');
    const notificationDoc = {
      type: notificationData.type,
      postId: notificationData.postId || null,
      commentId: notificationData.commentId || null,
      groupId: notificationData.groupId || null,
      fromUserId: notificationData.fromUserId,
      fromUserName: fromUserData.name || 'Someone',
      fromUserUsername: fromUserData.username || 'user',
      fromUserAvatar: fromUserData.photoURL || fromUserData.avatar || null,
      message: notificationData.message || '',
      read: false,
      createdAt: serverTimestamp(),
    };

    console.log(`📝 Adding notification document to: users/${username}/notifications`);
    const docRef = await addDoc(notificationsRef, notificationDoc);
    console.log(`✅ Notification document created with ID: ${docRef.id}`);

    // Send push notification
    try {
      await sendPushNotification(userId, {
        title: fromUserData.name || 'Someone',
        body: `${fromUserData.name || 'Someone'} ${notificationData.message || 'interacted with your post'}`,
        data: {
          type: notificationData.type,
          postId: notificationData.postId,
          groupId: notificationData.groupId,
          fromUserId: notificationData.fromUserId,
        },
      });
      console.log(`✅ Push notification sent to userId: ${userId}`);
    } catch (pushError) {
      console.error('⚠️ Error sending push notification (non-fatal):', pushError);
      // Don't fail if push notification fails
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    console.error('❌ Error stack:', error.stack);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification via Expo push notification service
 * @param {string} userId - User ID to send notification to
 * @param {Object} notification - Notification object with title, body, and data
 * @returns {Promise<void>}
 */
const sendPushNotification = async (userId, notification) => {
  try {
    console.log('📤 Attempting to send push notification to userId:', userId);
    
    // Get username from authUid (document IDs are usernames, not authUids)
    const { getUsernameFromAuthUid } = await import('./friendsService');
    const username = await getUsernameFromAuthUid(userId);
    
    if (!username) {
      console.warn('⚠️ User not found for push notification, userId:', userId);
      return;
    }

    console.log('✅ Found username for push notification:', username);

    // Get user's push token from Firestore
    const userRef = doc(db, 'users', username);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.warn('⚠️ User document not found for push notification, username:', username);
      return;
    }

    const userData = userDoc.data();
    const pushToken = userData.pushToken;

    if (!pushToken) {
      console.warn('⚠️ User has no push token registered, username:', username);
      console.warn('💡 Make sure the app has requested notification permissions and the user has granted them.');
      return;
    }

    console.log('✅ Found push token for user:', username, 'Token:', pushToken.substring(0, 30) + '...');

    // Send via Expo push notification service
    const message = {
      to: pushToken,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data,
    };

    console.log('📨 Sending push notification:', {
      to: pushToken.substring(0, 30) + '...',
      title: notification.title,
      body: notification.body,
    });

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    // Check HTTP status
    console.log('📡 Push notification API response status:', response.status, response.statusText);

    // Parse response JSON
    let responseData;
    try {
      responseData = await response.json();
    } catch (jsonError) {
      console.error('❌ Failed to parse push notification API response as JSON');
      console.error('❌ Response status:', response.status);
      console.error('❌ Response text:', await response.text().catch(() => 'Could not read response'));
      return;
    }
    
    // Check if request was successful
    if (response.ok) {
      // Expo API returns data in different formats
      if (responseData.data) {
        // Success response with data array
        const results = Array.isArray(responseData.data) ? responseData.data : [responseData.data];
        const successCount = results.filter(r => r.status === 'ok').length;
        const errorCount = results.filter(r => r.status === 'error').length;
        
        if (errorCount > 0) {
          console.warn('⚠️ Push notification sent with some errors:', {
            successCount,
            errorCount,
            results,
          });
          // Log individual errors
          results.forEach((result, index) => {
            if (result.status === 'error') {
              console.error(`  Error ${index + 1}:`, {
                message: result.message,
                details: result.details,
                error: result.error,
              });
            }
          });
        } else {
          console.log('✅ Push notification sent successfully:', {
            successCount,
            results,
          });
        }
      } else {
        // Different response format
        console.log('✅ Push notification sent successfully:', responseData);
      }
    } else {
      // HTTP error status
      console.error('❌ Push notification API returned error status:', response.status);
      console.error('❌ Response data:', responseData);
      
      // Check for Expo-specific error format
      if (responseData.errors && Array.isArray(responseData.errors)) {
        console.error('❌ Expo API errors:');
        responseData.errors.forEach((error, index) => {
          console.error(`  Error ${index + 1}:`, {
            code: error.code,
            message: error.message,
            details: error.details,
          });
        });
      } else if (responseData.error) {
        console.error('❌ Expo API error:', responseData.error);
      }
      
      // Log common error scenarios
      if (response.status === 400) {
        console.error('💡 Bad request - check push token format and message structure');
      } else if (response.status === 401) {
        console.error('💡 Unauthorized - check API credentials');
      } else if (response.status === 429) {
        console.error('💡 Rate limited - too many requests');
      } else if (response.status >= 500) {
        console.error('💡 Server error - Expo push service may be down');
      }
    }
  } catch (error) {
    // Network errors, timeouts, etc.
    console.error('❌ Error sending push notification (network/request error):', error);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    
    // Check for specific error types
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error('💡 Network error - check internet connection');
    } else if (error.name === 'AbortError') {
      console.error('💡 Request was aborted');
    } else if (error.message?.includes('timeout')) {
      console.error('💡 Request timed out');
    }
    
    // Don't throw - notification sending is best effort
  }
};

/**
 * Get notifications for a user
 * @param {string} userId - User ID
 * @param {number} pageSize - Number of notifications to return (default: 50)
 * @returns {Promise<{ notifications: Array, error: string|null }>}
 */
export const getNotifications = async (userId, pageSize = 50) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { notifications: [], error: 'Firestore not configured' };
    }

    // Get username from authUid (document IDs are usernames, not authUids)
    const { getUsernameFromAuthUid } = await import('./friendsService');
    const username = await getUsernameFromAuthUid(userId);
    
    if (!username) {
      return { notifications: [], error: 'User not found' };
    }

    const notificationsRef = collection(db, 'users', username, 'notifications');
    const q = query(
      notificationsRef,
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    const querySnapshot = await getDocs(q);
    const notifications = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
      };
    });

    return { notifications, error: null };
  } catch (error) {
    console.error('Error getting notifications:', error);
    return { notifications: [], error: error.message };
  }
};

/**
 * Subscribe to notifications for a user (real-time updates)
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function (result) => {}
 * @param {number} pageSize - Number of notifications to return (default: 50)
 * @returns {Function} Unsubscribe function
 */
export const subscribeToNotifications = (userId, callback, pageSize = 50) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      callback({ notifications: [], error: 'Firestore not configured' });
      return () => {};
    }

    if (Object.keys(db).length === 0) {
      callback({ notifications: [], error: 'Firestore not configured' });
      return () => {};
    }

    // Get username from authUid (document IDs are usernames, not authUids)
    // We'll do this asynchronously and set up the subscription
    let unsubscribeFn = () => {};
    
    const setupSubscription = async () => {
      try {
        const { getUsernameFromAuthUid } = await import('./friendsService');
        const username = await getUsernameFromAuthUid(userId);
        
        if (!username) {
          callback({ notifications: [], error: 'User not found' });
          return;
        }

        const notificationsRef = collection(db, 'users', username, 'notifications');
        const q = query(
          notificationsRef,
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );

        unsubscribeFn = onSnapshot(
          q,
          (snapshot) => {
            const notifications = snapshot.docs.map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
              };
            });
            callback({ notifications, error: null });
          },
          (error) => {
            console.error('Error subscribing to notifications:', error);
            callback({ notifications: [], error: error.message });
          }
        );
      } catch (error) {
        console.error('Error setting up notifications subscription:', error);
        callback({ notifications: [], error: error.message });
      }
    };

    setupSubscription();

    return () => {
      if (unsubscribeFn && typeof unsubscribeFn === 'function') {
        unsubscribeFn();
      }
    };
  } catch (error) {
    console.error('Error setting up notifications subscription:', error);
    callback({ notifications: [], error: error.message });
    return () => {};
  }
};

/**
 * Mark notification as read
 * @param {string} userId - User ID
 * @param {string} notificationId - Notification ID
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const markNotificationAsRead = async (userId, notificationId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    // Get username from authUid (document IDs are usernames, not authUids)
    const { getUsernameFromAuthUid } = await import('./friendsService');
    const username = await getUsernameFromAuthUid(userId);
    
    if (!username) {
      return { success: false, error: 'User not found' };
    }

    const notificationRef = doc(db, 'users', username, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      read: true,
      readAt: serverTimestamp(),
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete multiple notifications
 * @param {string} userId - User ID
 * @param {Array<string>} notificationIds - Array of notification IDs
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const deleteNotifications = async (userId, notificationIds) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    // Get username from authUid (document IDs are usernames, not authUids)
    const { getUsernameFromAuthUid } = await import('./friendsService');
    const username = await getUsernameFromAuthUid(userId);
    
    if (!username) {
      return { success: false, error: 'User not found' };
    }

    const deletePromises = notificationIds.map(notificationId => {
      const notificationRef = doc(db, 'users', username, 'notifications', notificationId);
      return deleteDoc(notificationRef);
    });

    await Promise.all(deletePromises);

    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark all notifications as read
 * @param {string} userId - User ID
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    // Get username from authUid (document IDs are usernames, not authUids)
    const { getUsernameFromAuthUid } = await import('./friendsService');
    const username = await getUsernameFromAuthUid(userId);
    
    if (!username) {
      return { success: false, error: 'User not found' };
    }

    const notificationsRef = collection(db, 'users', username, 'notifications');
    const q = query(
      notificationsRef,
      where('read', '==', false)
    );

    const querySnapshot = await getDocs(q);
    const updatePromises = [];
    querySnapshot.forEach((docSnapshot) => {
      updatePromises.push(updateDoc(docSnapshot.ref, {
        read: true,
        readAt: serverTimestamp(),
      }));
    });

    await Promise.all(updatePromises);

    return { success: true, error: null };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return { success: false, error: error.message };
  }
};

