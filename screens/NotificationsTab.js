import * as React from 'react';
import { View, ScrollView, ActivityIndicator, Alert, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { List, Divider, Text, Avatar, Button } from 'react-native-paper';
import UserAvatar from '../components/UserAvatar';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { subscribeToFriendRequests, acceptFriendRequest, declineFriendRequest } from '../services/friendsService';
import { subscribeToNotifications, markNotificationAsRead, deleteNotifications } from '../services/notificationsService';
import { acceptGroupInvitation, declineGroupInvitation } from '../services/groupsService';
import { getUserById } from '../services/usersService';

export default function NotificationsTab() {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  
  const [friendRequests, setFriendRequests] = React.useState([]);
  const [requestsWithData, setRequestsWithData] = React.useState([]);
  const [groupInvitations, setGroupInvitations] = React.useState([]);
  const [invitationsWithData, setInvitationsWithData] = React.useState([]);
  const [postNotifications, setPostNotifications] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [processingRequest, setProcessingRequest] = React.useState(null);
  const [processingInvitation, setProcessingInvitation] = React.useState(null);
  const [clearingPostNotifications, setClearingPostNotifications] = React.useState(false);
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [selectedNotifications, setSelectedNotifications] = React.useState(new Set());
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  
  const bgColor = isDarkMode ? '#121212' : '#FAFAFA';
  const surfaceColor = isDarkMode ? '#1E1E1E' : '#F5F4F2';
  const textColor = isDarkMode ? '#E6E8F0' : '#1A1A1A';
  const subTextColor = isDarkMode ? '#8A90A6' : '#666666';
  const dividerColor = isDarkMode ? '#3A3A3A' : '#D0CFCD';
  const primaryColor = '#CC0000';

  // Handle refresh
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Force re-subscription by incrementing refreshKey
    setRefreshKey(prev => prev + 1);
    // Reset refreshing after a short delay
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // ---------- subscriptions (unchanged) ----------
  React.useEffect(() => {
    if (!user?.uid) {
      setFriendRequests([]);
      setRequestsWithData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToFriendRequests(user.uid, (result) => {
      if (result.error) {
        setFriendRequests([]);
        setLoading(false);
        return;
      }
      setFriendRequests(result.requests || []);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe && unsubscribe();
  }, [user?.uid, refreshKey]);

  React.useEffect(() => {
    if (!friendRequests.length) {
      setRequestsWithData([]);
      return;
    }

    let isMounted = true;
    const loadRequestData = async () => {
      try {
        const requestsData = await Promise.all(
          friendRequests.map(async (request) => {
            try {
              const { userData } = await getUserById(request.fromUserId);
              return {
                ...request,
                sender: {
                  name: userData?.name || 'Unknown User',
                  username: userData?.username || 'unknown',
                  avatar: userData?.avatar || null,
                  photoURL: userData?.photoURL || userData?.avatar || null,
                },
              };
            } catch (error) {
              return {
                ...request,
                sender: { name: 'Unknown User', username: 'unknown', avatar: null, photoURL: null },
              };
            }
          })
        );

        if (isMounted) setRequestsWithData(requestsData);
      } catch (error) {
        console.error(error);
      }
    };

    loadRequestData();
    return () => { isMounted = false; };
  }, [friendRequests]);

  React.useEffect(() => {
    if (!user?.uid) {
      setGroupInvitations([]);
      setInvitationsWithData([]);
      setPostNotifications([]);
      return;
    }

    // IMPORTANT: when modal is open we avoid replacing the array (to prevent jump),
    // but here we still compute the incoming notifications and update only when modal closed.
    const unsubscribe = subscribeToNotifications(user.uid, (result) => {
      if (result.error) {
        setGroupInvitations([]);
        setPostNotifications([]);
        return;
      }

      const invitations = (result.notifications || []).filter(
        (notif) => notif.type === 'group_invitation' && !notif.read
      );
      setGroupInvitations(invitations);

      const postNotifs = (result.notifications || []).filter(
        (notif) => (notif.type === 'like' || notif.type === 'comment' || notif.type === 'tag' || notif.type === 'mention') && notif.postId
      );
      
      // Only update if the list actually changed (to prevent unnecessary re-renders)
      setPostNotifications(prev => {
        const prevIds = prev.map(n => n.id).sort().join(',');
        const newIds = postNotifs.map(n => n.id).sort().join(',');
        if (prevIds !== newIds) {
          return postNotifs;
        }
        // Update read status without causing full re-render
        return prev.map(prevNotif => {
          const updated = postNotifs.find(n => n.id === prevNotif.id);
          return updated ? { ...prevNotif, read: updated.read } : prevNotif;
        });
      });
    });

    return () => unsubscribe && unsubscribe();
  }, [user?.uid, refreshKey]);

  React.useEffect(() => {
    if (!groupInvitations.length) {
      setInvitationsWithData([]);
      return;
    }

    let isMounted = true;
    const loadInvitationData = async () => {
      try {
        const invitationsData = await Promise.all(
          groupInvitations.map(async (invitation) => {
            try {
              const { userData: senderData } = await getUserById(invitation.fromUserId);
              const { getGroupById } = await import('../services/groupsService');
              const { group } = invitation.groupId ? await getGroupById(invitation.groupId) : { group: null };
              
              return {
                ...invitation,
                sender: {
                  name: senderData?.name || 'Unknown User',
                  username: senderData?.username || 'unknown',
                  avatar: senderData?.avatar || null,
                  photoURL: senderData?.photoURL || senderData?.avatar || null,
                },
                group: group ? { name: group.name || 'Unknown Group', id: group.id } : null,
              };
            } catch (error) {
              return { ...invitation, sender: { name: 'Unknown User', username: 'unknown', avatar: null, photoURL: null }, group: null };
            }
          })
        );

        if (isMounted) setInvitationsWithData(invitationsData);
      } catch (error) {
        console.error(error);
      }
    };

    loadInvitationData();
    return () => { isMounted = false; };
  }, [groupInvitations]);

  // ---------- action handlers (unchanged) ----------
  const handleAccept = React.useCallback(async (requestId, fromUserId) => {
    if (!user?.uid || processingRequest) return;
    setProcessingRequest(requestId);
    try {
      const result = await acceptFriendRequest(requestId, fromUserId, user.uid);
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to accept friend request', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request. Please try again.', [{ text: 'OK' }]);
    } finally {
      setProcessingRequest(null);
    }
  }, [user?.uid, processingRequest]);

  const handleDecline = React.useCallback(async (requestId) => {
    if (!user?.uid || processingRequest) return;
    setProcessingRequest(requestId);
    try {
      const result = await declineFriendRequest(requestId);
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to decline friend request', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Error declining friend request:', error);
      Alert.alert('Error', 'Failed to decline friend request. Please try again.', [{ text: 'OK' }]);
    } finally {
      setProcessingRequest(null);
    }
  }, [user?.uid, processingRequest]);

  const handleAcceptGroupInvitation = React.useCallback(async (groupId, notificationId) => {
    if (!user?.uid || processingInvitation) return;
    setProcessingInvitation(notificationId);
    try {
      const result = await acceptGroupInvitation(groupId, user.uid, notificationId);
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to accept group invitation', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Error accepting group invitation:', error);
      Alert.alert('Error', 'Failed to accept group invitation. Please try again.', [{ text: 'OK' }]);
    } finally {
      setProcessingInvitation(null);
    }
  }, [user?.uid, processingInvitation]);

  const handleDeclineGroupInvitation = React.useCallback(async (notificationId) => {
    if (!user?.uid || processingInvitation) return;
    setProcessingInvitation(notificationId);
    try {
      const result = await declineGroupInvitation(notificationId, user.uid);
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to decline group invitation', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Error declining group invitation:', error);
      Alert.alert('Error', 'Failed to decline group invitation. Please try again.', [{ text: 'OK' }]);
    } finally {
      setProcessingInvitation(null);
    }
  }, [user?.uid, processingInvitation]);

  const handleToggleSelectionMode = React.useCallback(() => {
    setSelectionMode(prev => !prev);
    setSelectedNotifications(new Set());
  }, []);

  const handleToggleNotificationSelection = React.useCallback((notificationId) => {
    setSelectedNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  }, []);

  const handleClearSelectedNotifications = React.useCallback(async () => {
    if (!user?.uid || clearingPostNotifications || selectedNotifications.size === 0) return;

    setClearingPostNotifications(true);
    const selectedIds = Array.from(selectedNotifications);
    
    try {
      // Delete notifications from Firestore (they will be permanently removed)
      const result = await deleteNotifications(user.uid, selectedIds);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete notifications');
      }
      
      // Clear selection mode
      setSelectionMode(false);
      setSelectedNotifications(new Set());
    } catch (error) {
      console.error('Error deleting notifications:', error);
      Alert.alert('Error', 'Failed to delete notifications. Please try again.', [{ text: 'OK' }]);
    } finally {
      setClearingPostNotifications(false);
    }
  }, [user?.uid, clearingPostNotifications, selectedNotifications]);

  const handleClearAllNotifications = React.useCallback(async () => {
    if (!user?.uid || clearingPostNotifications || postNotifications.length === 0) return;

    setClearingPostNotifications(true);
    const allNotificationIds = postNotifications.map(n => n.id);
    
    try {
      // Delete all notifications from Firestore
      const result = await deleteNotifications(user.uid, allNotificationIds);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete notifications');
      }
      
      // Clear selection mode if active
      setSelectionMode(false);
      setSelectedNotifications(new Set());
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      Alert.alert('Error', 'Failed to delete notifications. Please try again.', [{ text: 'OK' }]);
    } finally {
      setClearingPostNotifications(false);
    }
  }, [user?.uid, clearingPostNotifications, postNotifications]);

  // Handle notification tap - navigate to post
  const handleNotificationTap = React.useCallback(async (notification) => {
    if (!user?.uid || !notification?.postId) return;

    // Mark as read if not already read (but allow navigation even if already read)
    if (!notification.read) {
      try {
        await markNotificationAsRead(user.uid, notification.id);
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // For tag and mention notifications, navigate to Activity/Feed tab to show the post
    // For other notifications (like, comment), navigate to profile with post highlighted
    const isTagNotification = notification.type === 'tag' || notification.type === 'mention';
    
    try {
      // Try multiple navigation approaches to find the right navigator
      let currentNav = navigation;
      let rootNavigator = null;
      let parent = navigation.getParent();
      
      // Walk up the navigation tree to find RootNavigator
      while (parent) {
        const state = parent.getState();
        const routeNames = state?.routeNames || state?.routes?.map(r => r.name);
        
        // Check if this navigator has 'MainTabs' (RootNavigator)
        if (routeNames && routeNames.includes('MainTabs')) {
          rootNavigator = parent;
          break;
        }
        
        // Check if this navigator has 'Activity' or 'Profile' (BottomTabs)
        if (routeNames && routeNames.includes('Activity')) {
          // This is BottomTabs, navigate directly
          if (isTagNotification) {
            // Navigate to Activity -> Feed (Recent) with postId
            parent.dispatch(
              CommonActions.navigate({
                name: 'Activity',
                params: {
                  screen: 'Feed',
                  params: {
                    highlightPostId: notification.postId,
                  },
                },
              })
            );
          } else {
            // Navigate to Profile with post highlighted
            parent.dispatch(
              CommonActions.navigate({
                name: 'Profile',
                params: {
                  screen: 'ProfileMain',
                  params: {
                    highlightPostId: notification.postId,
                  },
                },
              })
            );
          }
          return;
        }
        
        if (routeNames && routeNames.includes('Profile')) {
          // This is BottomTabs, navigate directly
          if (isTagNotification) {
            // Navigate to Activity -> Feed (Recent) with postId
            parent.dispatch(
              CommonActions.navigate({
                name: 'Activity',
                params: {
                  screen: 'Feed',
                  params: {
                    highlightPostId: notification.postId,
                  },
                },
              })
            );
          } else {
            // Navigate to Profile with post highlighted
            parent.dispatch(
              CommonActions.navigate({
                name: 'Profile',
                params: {
                  screen: 'ProfileMain',
                  params: {
                    highlightPostId: notification.postId,
                  },
                },
              })
            );
          }
          return;
        }
        
        currentNav = parent;
        parent = parent.getParent();
      }
      
      // If we found RootNavigator, navigate through MainTabs
      if (rootNavigator) {
        if (isTagNotification) {
          // Navigate to Activity -> Feed (Recent) with postId
          rootNavigator.dispatch(
            CommonActions.navigate({
              name: 'MainTabs',
              params: {
                screen: 'Activity',
                params: {
                  screen: 'Feed',
                  params: {
                    highlightPostId: notification.postId,
                  },
                },
              },
            })
          );
        } else {
          // Navigate to Profile with post highlighted
          rootNavigator.dispatch(
            CommonActions.navigate({
              name: 'MainTabs',
              params: {
                screen: 'Profile',
                params: {
                  screen: 'ProfileMain',
                  params: {
                    highlightPostId: notification.postId,
                  },
                },
              },
            })
          );
        }
        return;
      }
      
      // Fallback: Try using the current navigation's navigate method
      try {
        if (isTagNotification) {
          navigation.navigate('Activity', {
            screen: 'Feed',
            params: {
              highlightPostId: notification.postId,
            },
          });
        } else {
          navigation.navigate('Profile', {
            screen: 'ProfileMain',
            params: {
              highlightPostId: notification.postId,
            },
          });
        }
      } catch (fallbackError) {
        console.error('Fallback navigation also failed:', fallbackError);
        Alert.alert('Error', 'Failed to open post. Please try again.', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Error navigating to post:', error);
      Alert.alert('Error', 'Failed to open post. Please try again.', [{ text: 'OK' }]);
    }
  }, [user?.uid, navigation]);

  // ---------- render ----------
  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: subTextColor }}>Please sign in to view notifications</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  const hasNotifications = requestsWithData.length > 0 || invitationsWithData.length > 0 || postNotifications.length > 0;

  return (
    <LinearGradient
      colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 40 }}
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, marginTop: 15 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
        >
        {/* Post notifications section */}
        {postNotifications.length > 0 && (
          <View style={{ 
            backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)',
            borderRadius: 20,
            overflow: 'hidden',
            marginBottom: 16,
            borderWidth: 1,
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
              <Text style={{ color: textColor, fontSize: 16, fontWeight: '600' }}>
                Post Activity ({postNotifications.length})
              </Text>
              {selectionMode ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={handleToggleSelectionMode}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: dividerColor,
                    }}
                  >
                    <Text style={{ color: textColor, fontSize: 12, fontWeight: '600' }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleClearSelectedNotifications}
                    disabled={clearingPostNotifications || selectedNotifications.size === 0}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: (clearingPostNotifications || selectedNotifications.size === 0) ? dividerColor : primaryColor,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
                      {clearingPostNotifications ? 'Clearing...' : `Clear (${selectedNotifications.size})`}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handleClearAllNotifications}
                  disabled={clearingPostNotifications || postNotifications.length === 0}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: (clearingPostNotifications || postNotifications.length === 0) ? dividerColor : primaryColor,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
                    {clearingPostNotifications ? 'Clearing...' : 'Clear'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {postNotifications.map((notification, idx) => (
              <TouchableOpacity
                key={notification.id}
                onPress={() => {
                  if (selectionMode) {
                    handleToggleNotificationSelection(notification.id);
                  } else {
                    handleNotificationTap(notification);
                  }
                }}
                activeOpacity={0.7}
                disabled={false}
              >
                <View style={{ 
                  padding: 16, 
                  opacity: notification.read ? 0.7 : 1,
                  backgroundColor: selectedNotifications.has(notification.id) ? (isDarkMode ? '#3A3A3A' : '#E0E0E0') : 'transparent',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {selectionMode && (
                      <View style={{ marginRight: 12 }}>
                        <View style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: selectedNotifications.has(notification.id) ? primaryColor : dividerColor,
                          backgroundColor: selectedNotifications.has(notification.id) ? primaryColor : 'transparent',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                          {selectedNotifications.has(notification.id) && (
                            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>✓</Text>
                          )}
                        </View>
                      </View>
                    )}
                    <UserAvatar 
                      size={48} 
                      uri={notification.fromUserAvatar || notification.fromUser?.photoURL || notification.fromUser?.avatar}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: textColor, fontSize: 15, fontWeight: '600' }}>
                        {notification.fromUserName || notification.fromUser?.name || 'Someone'}
                      </Text>
                      <Text style={{ color: subTextColor, fontSize: 14, marginTop: 2 }}>
                        {notification.message || 
                          (notification.type === 'like' ? 'liked your post' : 
                           notification.type === 'comment' ? 'commented on your post' :
                           notification.type === 'tag' ? 'mentioned you in a post' : 
                           notification.type === 'mention' ? 'mentioned you in a comment' :
                           'interacted with your post')}
                      </Text>
                    </View>
                    {!notification.read && !selectionMode && (
                      <View style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: primaryColor,
                        marginLeft: 8,
                      }} />
                    )}
                  </View>
                </View>
                {idx < postNotifications.length - 1 && <Divider style={{ backgroundColor: dividerColor }} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Friend requests */}
        {requestsWithData.length > 0 && (
          <View style={{ 
            backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)',
            borderRadius: 20,
            overflow: 'hidden',
            marginBottom: 16,
            borderWidth: 1,
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          }}>
            <Text style={{ color: textColor, fontSize: 16, fontWeight: '600', padding: 16, paddingBottom: 8 }}>
              Friend Requests ({requestsWithData.length})
            </Text>
            {requestsWithData.map((request, idx) => (
              <View key={request.id}>
                <View style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <UserAvatar 
                      size={48} 
                      uri={request.sender?.photoURL || request.sender?.avatar}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: textColor, fontSize: 16, fontWeight: '600' }}>
                        {request.sender?.name || 'Unknown User'}
                      </Text>
                      <Text style={{ color: subTextColor, fontSize: 14 }}>
                        @{request.sender?.username || 'unknown'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button
                      mode="contained"
                      buttonColor={primaryColor}
                      textColor="#fff"
                      compact
                      onPress={() => handleAccept(request.id, request.fromUserId)}
                      disabled={processingRequest === request.id}
                      loading={processingRequest === request.id}
                      style={{ flex: 1 }}
                    >
                      Accept
                    </Button>
                    <Button
                      mode="outlined"
                      textColor={textColor}
                      compact
                      onPress={() => handleDecline(request.id)}
                      disabled={processingRequest === request.id}
                      style={{ flex: 1, borderColor: dividerColor }}
                    >
                      Decline
                    </Button>
                  </View>
                </View>
                {idx < requestsWithData.length - 1 && <Divider style={{ backgroundColor: dividerColor }} />}
              </View>
            ))}
          </View>
        )}

        {/* Group invitations */}
        {invitationsWithData.length > 0 && (
          <View style={{ 
            backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)',
            borderRadius: 20,
            overflow: 'hidden',
            marginBottom: 16,
            borderWidth: 1,
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          }}>
            <Text style={{ color: textColor, fontSize: 16, fontWeight: '600', padding: 16, paddingBottom: 8 }}>
              Group Invitations ({invitationsWithData.length})
            </Text>
            {invitationsWithData.map((invitation, idx) => (
              <View key={invitation.id}>
                <View style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <UserAvatar 
                      size={48} 
                      uri={invitation.sender?.photoURL || invitation.sender?.avatar}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: textColor, fontSize: 16, fontWeight: '600' }}>
                        {invitation.sender?.name || 'Unknown User'}
                      </Text>
                      <Text style={{ color: subTextColor, fontSize: 14 }}>
                        {invitation.group?.name ? `invited you to join "${invitation.group.name}"` : invitation.message || 'invited you to join a group'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button
                      mode="contained"
                      buttonColor={primaryColor}
                      textColor="#fff"
                      compact
                      onPress={() => handleAcceptGroupInvitation(invitation.groupId, invitation.id)}
                      disabled={processingInvitation === invitation.id || !invitation.groupId}
                      loading={processingInvitation === invitation.id}
                      style={{ flex: 1 }}
                    >
                      Accept
                    </Button>
                    <Button
                      mode="outlined"
                      textColor={textColor}
                      compact
                      onPress={() => handleDeclineGroupInvitation(invitation.id)}
                      disabled={processingInvitation === invitation.id}
                      style={{ flex: 1, borderColor: dividerColor }}
                    >
                      Decline
                    </Button>
                  </View>
                </View>
                {idx < invitationsWithData.length - 1 && <Divider style={{ backgroundColor: dividerColor }} />}
              </View>
            ))}
          </View>
        )}

        {!hasNotifications && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: subTextColor, textAlign: 'center' }}>No notifications</Text>
          </View>
        )}
      </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
