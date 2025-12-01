// Notification context - manages notification state globally
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { subscribeToNotifications } from '../services/notificationsService';
import { subscribeToFriendRequests } from '../services/friendsService';
import { db } from '../config/firebase';

const NotificationContext = createContext();

// Provider component - manages notification state
export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] = useState(null);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  
  // Track previous notification IDs to detect new ones (persist across renders)
  const previousNotificationIdsRef = useRef(new Set());

  // Check if Firestore is ready
  const isFirestoreReady = () => {
    return db && typeof db === 'object' && Object.keys(db).length > 0;
  };

  // Subscribe to all notification types
  useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0);
      setLatestNotification(null);
      setHasNewNotification(false);
      return;
    }

    // Wait for Firestore to be ready
    if (!isFirestoreReady()) {
      console.log('⏳ Waiting for Firestore to initialize...');
      // Retry after a short delay
      const timeout = setTimeout(() => {
        if (isFirestoreReady()) {
          // Firestore is ready, but we'll let the next effect handle it
          console.log('✅ Firestore is now ready');
        }
      }, 1000);
      return () => clearTimeout(timeout);
    }

    let unsubscribeNotifications = () => {};

    try {
      // Subscribe to all notifications (post notifications, group invitations)
      unsubscribeNotifications = subscribeToNotifications(user.uid, ({ notifications, error }) => {
        if (error) {
          console.error('Error subscribing to notifications:', error);
          return;
        }

        // Filter for post notifications (likes, comments, tags, mentions) and group messages
        const postNotifications = (notifications || []).filter(
          (notif) => !notif.read && (
            ((notif.type === 'like' || notif.type === 'comment' || notif.type === 'tag' || notif.type === 'mention') && notif.postId) || 
            (notif.type === 'group_message' && notif.groupId)
          )
        );

        // Sort by createdAt descending to get the most recent first
        const sortedNotifications = [...postNotifications].sort((a, b) => {
          const aTime = a.createdAt?.getTime ? a.createdAt.getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const bTime = b.createdAt?.getTime ? b.createdAt.getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return bTime - aTime; // Most recent first
        });

        // Find the most recent new notification (not seen before)
        const newNotification = sortedNotifications.find(notif => !previousNotificationIdsRef.current.has(notif.id));
        
        if (newNotification) {
          // This is a new notification - show popup
          setLatestNotification({
            id: newNotification.id,
            type: newNotification.type,
            message: newNotification.message || `${newNotification.fromUserName || 'Someone'} ${getNotificationMessage(newNotification.type)}`,
            fromUserName: newNotification.fromUserName || 'Someone',
            fromUserAvatar: newNotification.fromUserAvatar,
            postId: newNotification.postId,
            groupId: newNotification.groupId,
            timestamp: newNotification.createdAt,
          });
          setHasNewNotification(true);
          
          // Add to seen set
          previousNotificationIdsRef.current.add(newNotification.id);
          
          // Auto-hide after 5 seconds
          setTimeout(() => {
            setHasNewNotification(false);
          }, 5000);
        }
        
        // Add all current notification IDs to the seen set (to prevent showing popups for old notifications)
        postNotifications.forEach(notif => {
          previousNotificationIdsRef.current.add(notif.id);
        });
      });
    } catch (error) {
      console.error('Error setting up notification subscription:', error);
    }

    return () => {
      if (unsubscribeNotifications) unsubscribeNotifications();
    };
  }, [user?.uid]);

  // Combined subscription to calculate total unread count
  useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0);
      return;
    }

    // Wait for Firestore to be ready
    if (!isFirestoreReady()) {
      console.log('⏳ Waiting for Firestore to initialize for unread count...');
      return;
    }

    let unsubscribeNotifications = () => {};
    let unsubscribeFriendRequests = () => {};

    let postNotificationsCount = 0;
    let friendRequestsCount = 0;
    let groupInvitationsCount = 0;

    const updateUnreadCount = () => {
      const total = postNotificationsCount + friendRequestsCount + groupInvitationsCount;
      // Force immediate update
      setUnreadCount(total);
    };

    try {
      // Subscribe to all notifications (post notifications and group invitations)
      unsubscribeNotifications = subscribeToNotifications(user.uid, ({ notifications, error }) => {
        if (error) {
          console.error('Notification subscription error:', error);
          return;
        }
        
        // Count post notifications
        const postNotifs = (notifications || []).filter(
          (notif) => (notif.type === 'like' || notif.type === 'comment' || notif.type === 'tag' || notif.type === 'mention') && notif.postId && !notif.read
        );
        postNotificationsCount = postNotifs.length;
        
        // Count group invitations
        const groupInvites = (notifications || []).filter(
          (notif) => notif.type === 'group_invitation' && !notif.read
        );
        groupInvitationsCount = groupInvites.length;
        
        // Count group messages (add to unread count)
        const groupMessages = (notifications || []).filter(
          (notif) => notif.type === 'group_message' && notif.groupId && !notif.read
        );
        const groupMessagesCount = groupMessages.length;
        
        // Add group messages to post notifications count for unread total
        postNotificationsCount += groupMessagesCount;
        
        // Update immediately
        updateUnreadCount();
      });

      // Subscribe to friend requests
      unsubscribeFriendRequests = subscribeToFriendRequests(user.uid, ({ requests, error }) => {
        if (error) {
          console.error('Friend request subscription error:', error);
          return;
        }
        
        const pendingRequests = (requests || []).filter(req => req.status === 'pending');
        friendRequestsCount = pendingRequests.length;
        
        // Update immediately
        updateUnreadCount();
      });
    } catch (error) {
      console.error('Error setting up unread count subscriptions:', error);
    }

    return () => {
      if (unsubscribeNotifications) unsubscribeNotifications();
      if (unsubscribeFriendRequests) unsubscribeFriendRequests();
    };
  }, [user?.uid]);

  const clearNewNotification = () => {
    setHasNewNotification(false);
    setLatestNotification(null);
  };

  // Always provide default values to prevent undefined errors
  // Use useMemo to ensure updates propagate immediately
  const contextValue = React.useMemo(() => ({
    unreadCount: unreadCount || 0,
    latestNotification: latestNotification || null,
    hasNewNotification: hasNewNotification || false,
    clearNewNotification,
  }), [unreadCount, latestNotification, hasNewNotification]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

// Helper function to get notification message
function getNotificationMessage(type) {
  switch (type) {
    case 'like':
      return 'liked your post';
    case 'comment':
      return 'commented on your post';
    case 'tag':
      return 'tagged you in a post';
    case 'mention':
      return 'mentioned you';
    case 'group_message':
      return 'sent a message in a group';
    default:
      return 'interacted with your post';
  }
}

// Hook to use notification context in components
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    // Return default values instead of throwing to prevent crashes
    console.warn('useNotifications called outside NotificationProvider, using defaults');
    return {
      unreadCount: 0,
      latestNotification: null,
      hasNewNotification: false,
      clearNewNotification: () => {},
    };
  }
  return context;
}

