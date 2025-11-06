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
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      return { success: false, token: null, error: 'Permission not granted' };
    }

    // Get push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('Project ID not found, cannot get push token');
      return { success: false, token: null, error: 'Project ID not configured' };
    }

    const token = (await Notifications.getExpoPushTokenAsync({
      projectId,
    })).data;

    return { success: true, token, error: null };
  } catch (error) {
    console.error('Error registering for push notifications:', error);
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
      return { success: false, error: 'Firestore not configured' };
    }

    // Get user data for notification
    const { getUserById } = await import('./usersService');
    const { userData: fromUserData } = await getUserById(notificationData.fromUserId);
    
    if (!fromUserData) {
      return { success: false, error: 'User not found' };
    }

    // Create notification document
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    const notificationDoc = {
      type: notificationData.type,
      postId: notificationData.postId || null,
      commentId: notificationData.commentId || null,
      fromUserId: notificationData.fromUserId,
      fromUserName: fromUserData.name || 'Someone',
      fromUserUsername: fromUserData.username || 'user',
      fromUserAvatar: fromUserData.photoURL || fromUserData.avatar || null,
      message: notificationData.message || '',
      read: false,
      createdAt: serverTimestamp(),
    };

    await addDoc(notificationsRef, notificationDoc);

    // Send push notification
    await sendPushNotification(userId, {
      title: fromUserData.name || 'Someone',
      body: `${fromUserData.name || 'Someone'} ${notificationData.message || 'interacted with your post'}`,
      data: {
        type: notificationData.type,
        postId: notificationData.postId,
        fromUserId: notificationData.fromUserId,
      },
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Error creating notification:', error);
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
    // Get user's push token from Firestore
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.warn('User document not found for push notification');
      return;
    }

    const userData = userDoc.data();
    const pushToken = userData.pushToken;

    if (!pushToken) {
      console.warn('User has no push token registered');
      return;
    }

    // Send via Expo push notification service
    const message = {
      to: pushToken,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data,
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
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

    const notificationsRef = collection(db, 'users', userId, 'notifications');
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

    const notificationsRef = collection(db, 'users', userId, 'notifications');
    const q = query(
      notificationsRef,
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    const unsubscribe = onSnapshot(
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

    return unsubscribe;
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

    const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
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
 * Mark all notifications as read
 * @param {string} userId - User ID
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    const notificationsRef = collection(db, 'users', userId, 'notifications');
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

