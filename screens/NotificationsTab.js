import * as React from 'react';
import { View, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { List, Divider, Text, Avatar, Button } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { subscribeToFriendRequests, acceptFriendRequest, declineFriendRequest } from '../services/friendsService';
import { subscribeToNotifications } from '../services/notificationsService';
import { acceptGroupInvitation, declineGroupInvitation } from '../services/groupsService';
import { getUserById } from '../services/usersService';

export default function NotificationsTab() {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  
  const [friendRequests, setFriendRequests] = React.useState([]);
  const [requestsWithData, setRequestsWithData] = React.useState([]);
  const [groupInvitations, setGroupInvitations] = React.useState([]);
  const [invitationsWithData, setInvitationsWithData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [processingRequest, setProcessingRequest] = React.useState(null);
  const [processingInvitation, setProcessingInvitation] = React.useState(null);
  
  const bgColor = isDarkMode ? '#1A1A1A' : '#EEEDEB';
  const surfaceColor = isDarkMode ? '#2A2A2A' : '#F5F4F2';
  const textColor = isDarkMode ? '#E6E8F0' : '#1A1A1A';
  const subTextColor = isDarkMode ? '#8A90A6' : '#666666';
  const dividerColor = isDarkMode ? '#3A3A3A' : '#D0CFCD';
  const primaryColor = '#990000';

  // Subscribe to friend requests
  React.useEffect(() => {
    if (!user?.uid) {
      setFriendRequests([]);
      setRequestsWithData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('🔔 [NotificationsTab] Setting up friend requests subscription for user:', user.uid);
    const unsubscribe = subscribeToFriendRequests(user.uid, (result) => {
      console.log('🔔 [NotificationsTab] Friend requests callback received:', {
        hasError: !!result.error,
        error: result.error,
        requestCount: result.requests?.length || 0,
      });
      
      if (result.error) {
        console.error('❌ [NotificationsTab] Error in friend requests subscription:', result.error);
        setFriendRequests([]);
        setLoading(false);
        return;
      }

      console.log('✅ [NotificationsTab] Setting', result.requests?.length || 0, 'friend requests');
      setFriendRequests(result.requests || []);
      setLoading(false);
    });

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user?.uid]);

  // Fetch sender profile data for each request
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
              if (userData) {
                return {
                  ...request,
                  sender: {
                    name: userData.name || 'Unknown User',
                    username: userData.username || 'unknown',
                    avatar: userData.avatar || null,
                    photoURL: userData.photoURL || userData.avatar || null,
                  },
                };
              }
              return {
                ...request,
                sender: {
                  name: 'Unknown User',
                  username: 'unknown',
                  avatar: null,
                  photoURL: null,
                },
              };
            } catch (error) {
              console.error('Error fetching sender data:', error);
              return {
                ...request,
                sender: {
                  name: 'Unknown User',
                  username: 'unknown',
                  avatar: null,
                  photoURL: null,
                },
              };
            }
          })
        );

        if (isMounted) {
          setRequestsWithData(requestsData);
        }
      } catch (error) {
        console.error('Error loading request data:', error);
      }
    };

    loadRequestData();

    return () => {
      isMounted = false;
    };
  }, [friendRequests]);

  // Subscribe to notifications for group invitations
  React.useEffect(() => {
    if (!user?.uid) {
      setGroupInvitations([]);
      setInvitationsWithData([]);
      return;
    }

    const unsubscribe = subscribeToNotifications(user.uid, (result) => {
      if (result.error) {
        console.error('Error loading notifications:', result.error);
        setGroupInvitations([]);
        return;
      }

      // Filter for group invitations
      const invitations = (result.notifications || []).filter(
        (notif) => notif.type === 'group_invitation' && !notif.read
      );
      setGroupInvitations(invitations);
    });

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user?.uid]);

  // Fetch group and sender data for each invitation
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
                group: group ? {
                  name: group.name || 'Unknown Group',
                  id: group.id,
                } : null,
              };
            } catch (error) {
              console.error('Error fetching invitation data:', error);
              return {
                ...invitation,
                sender: {
                  name: 'Unknown User',
                  username: 'unknown',
                  avatar: null,
                  photoURL: null,
                },
                group: null,
              };
            }
          })
        );

        if (isMounted) {
          setInvitationsWithData(invitationsData);
        }
      } catch (error) {
        console.error('Error loading invitation data:', error);
      }
    };

    loadInvitationData();

    return () => {
      isMounted = false;
    };
  }, [groupInvitations]);

  // Handle accept friend request
  const handleAccept = React.useCallback(async (requestId, fromUserId) => {
    if (!user?.uid || processingRequest) return;

    setProcessingRequest(requestId);
    try {
      const result = await acceptFriendRequest(requestId, fromUserId, user.uid);
      if (result.success) {
        Alert.alert('Success', 'Friend request accepted!', [{ text: 'OK' }]);
      } else {
        Alert.alert('Error', result.error || 'Failed to accept friend request', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request. Please try again.', [{ text: 'OK' }]);
    } finally {
      setProcessingRequest(null);
    }
  }, [user?.uid, processingRequest]);

  // Handle decline friend request
  const handleDecline = React.useCallback(async (requestId) => {
    if (!user?.uid || processingRequest) return;

    setProcessingRequest(requestId);
    try {
      const result = await declineFriendRequest(requestId);
      if (result.success) {
        // Request removed, will update automatically via subscription
      } else {
        Alert.alert('Error', result.error || 'Failed to decline friend request', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Error declining friend request:', error);
      Alert.alert('Error', 'Failed to decline friend request. Please try again.', [{ text: 'OK' }]);
    } finally {
      setProcessingRequest(null);
    }
  }, [user?.uid, processingRequest]);

  // Handle accept group invitation
  const handleAcceptGroupInvitation = React.useCallback(async (groupId, notificationId) => {
    if (!user?.uid || processingInvitation) return;

    setProcessingInvitation(notificationId);
    try {
      const result = await acceptGroupInvitation(groupId, user.uid, notificationId);
      if (result.success) {
        Alert.alert('Success', 'Group invitation accepted!', [{ text: 'OK' }]);
      } else {
        Alert.alert('Error', result.error || 'Failed to accept group invitation', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Error accepting group invitation:', error);
      Alert.alert('Error', 'Failed to accept group invitation. Please try again.', [{ text: 'OK' }]);
    } finally {
      setProcessingInvitation(null);
    }
  }, [user?.uid, processingInvitation]);

  // Handle decline group invitation
  const handleDeclineGroupInvitation = React.useCallback(async (notificationId) => {
    if (!user?.uid || processingInvitation) return;

    setProcessingInvitation(notificationId);
    try {
      const result = await declineGroupInvitation(notificationId, user.uid);
      if (result.success) {
        // Invitation removed, will update automatically via subscription
      } else {
        Alert.alert('Error', result.error || 'Failed to decline group invitation', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Error declining group invitation:', error);
      Alert.alert('Error', 'Failed to decline group invitation. Please try again.', [{ text: 'OK' }]);
    } finally {
      setProcessingInvitation(null);
    }
  }, [user?.uid, processingInvitation]);

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

  const hasNotifications = requestsWithData.length > 0 || invitationsWithData.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {requestsWithData.length > 0 && (
          <View style={{ backgroundColor: surfaceColor, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
            <Text style={{ color: textColor, fontSize: 16, fontWeight: '600', padding: 16, paddingBottom: 8 }}>
              Friend Requests ({requestsWithData.length})
            </Text>
            {requestsWithData.map((request, idx) => (
              <View key={request.id}>
                <View style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Avatar.Image 
                      size={48} 
                      source={{ uri: request.sender?.photoURL || request.sender?.avatar || 'https://i.pravatar.cc/100?img=12' }} 
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

        {invitationsWithData.length > 0 && (
          <View style={{ backgroundColor: surfaceColor, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
            <Text style={{ color: textColor, fontSize: 16, fontWeight: '600', padding: 16, paddingBottom: 8 }}>
              Group Invitations ({invitationsWithData.length})
            </Text>
            {invitationsWithData.map((invitation, idx) => (
              <View key={invitation.id}>
                <View style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Avatar.Image 
                      size={48} 
                      source={{ uri: invitation.sender?.photoURL || invitation.sender?.avatar || 'https://i.pravatar.cc/100?img=12' }} 
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
    </View>
  );
}

