import * as React from 'react';
import { View, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { List, Divider, Text, Avatar, Button } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { subscribeToFriendRequests, acceptFriendRequest, declineFriendRequest } from '../services/friendsService';
import { getUserById } from '../services/usersService';

export default function NotificationsTab() {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  
  const [friendRequests, setFriendRequests] = React.useState([]);
  const [requestsWithData, setRequestsWithData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [processingRequest, setProcessingRequest] = React.useState(null);
  
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

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {requestsWithData.length > 0 ? (
          <View style={{ backgroundColor: surfaceColor, borderRadius: 16, overflow: 'hidden' }}>
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
        ) : (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: subTextColor, textAlign: 'center' }}>No friend requests</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

