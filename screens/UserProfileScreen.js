// User Profile screen - view another user's profile with posts and following button
import * as React from 'react';
import { View, Alert, TouchableOpacity, Image, Modal, Dimensions } from 'react-native';
import { Appbar, Avatar, Text, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { subscribeToUserPosts } from '../services/postsService';
import { addFriend, removeFriend, getAuthUidFromUsername, subscribeToOutgoingFriendRequests, sendFriendRequest, cancelFriendRequest } from '../services/friendsService';
import { getUserById } from '../services/usersService';
import FeedPost from '../components/FeedPost';
import { useThemeColors } from '../hooks/useThemeColors';

const IU_CRIMSON = '#990000';

// Posts Tab Component
function UserPostsTab({ userId, username, themeColors }) {
  const [posts, setPosts] = React.useState([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [selectedPost, setSelectedPost] = React.useState(null);
  const [containerHeight, setContainerHeight] = React.useState(0);
  const { text, subText, background, surface } = themeColors;
  const { isDarkMode } = useTheme();

  React.useEffect(() => {
    if (!userId) {
      return;
    }

    const unsubscribe = subscribeToUserPosts(
      userId,
      (result) => {
        if (result.error) {
          console.error('Error loading posts:', result.error);
        } else {
          // Limit to 9 posts for 3x3 grid
          setPosts(result.posts.slice(0, 9));
        }
        setLoading(false);
        setRefreshing(false);
      },
      9 // Get up to 9 posts
    );

    return () => unsubscribe();
  }, [userId]);

  const handleRefresh = () => {
    setRefreshing(true);
    // Real-time listener will automatically update
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handlePostPress = (post) => {
    setSelectedPost(post);
  };

  const handleCloseModal = () => {
    setSelectedPost(null);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background }}>
        <Text style={{ color: text }}>Loading posts...</Text>
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background, padding: 20 }}>
        <Text style={{ color: subText, fontSize: 16, textAlign: 'center' }}>
          No posts yet.
        </Text>
      </View>
    );
  }

  // Calculate grid item size to fill available space
  // 3 columns with gaps, 3 rows to fill vertical space
  const screenWidth = Dimensions.get('window').width;
  const gridPadding = 16;
  const gridGap = 2;
  const headerHeight = 40; // Height of the "Posts" header
  
  // Calculate item size based on available width and height
  // Ensure 9 posts (3x3) fill the remaining vertical space
  const availableWidth = screenWidth - (gridPadding * 2);
  const availableHeight = containerHeight > 0 ? containerHeight - headerHeight - gridPadding : 0;
  
  // Calculate size based on width (3 columns)
  const itemSizeByWidth = (availableWidth - (gridGap * 2)) / 3;
  
  // Calculate size based on height (3 rows) if we have container height
  const itemSizeByHeight = availableHeight > 0 ? (availableHeight - (gridGap * 2)) / 3 : itemSizeByWidth;
  
  // Use the smaller of the two to ensure everything fits
  const itemSize = availableHeight > 0 
    ? Math.min(itemSizeByWidth, itemSizeByHeight) 
    : itemSizeByWidth;

  return (
    <>
      <View 
        style={{ flex: 1 }}
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          setContainerHeight(height);
        }}
      >
        {/* Header divider */}
        <View style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: isDarkMode ? '#3A3A3A' : '#D0CFCD',
          backgroundColor: background,
        }}>
          <Text style={{
            color: text,
            fontSize: 16,
            fontWeight: '600',
          }}>
            Posts
          </Text>
        </View>

        {/* Grid container */}
        <View style={{
          flex: 1,
          padding: gridPadding,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: gridGap,
          alignContent: 'flex-start',
        }}>
        {posts.map((post) => {
          // Get first image from post
          const images = post.images || [];
          const firstImage = images.length > 0 ? images[0] : null;
          
          // Calculate height for 3:4 aspect ratio
          const itemHeight = itemSize * (4 / 3);
          
          return (
            <TouchableOpacity
              key={post.id}
              onPress={() => handlePostPress(post)}
              style={{
                width: itemSize,
                height: itemHeight,
                backgroundColor: surface,
                borderRadius: 4,
                overflow: 'hidden',
              }}
              activeOpacity={0.8}
            >
              {firstImage ? (
                <Image
                  source={{ uri: firstImage }}
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{
                  width: '100%',
                  height: '100%',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: isDarkMode ? '#2A2A2A' : '#F5F4F2',
                }}>
                  <MaterialCommunityIcons 
                    name="image-outline" 
                    size={32} 
                    color={subText} 
                  />
                </View>
              )}
              {/* Overlay for multiple images indicator */}
              {images.length > 1 && (
                <View style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  borderRadius: 12,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}>
                  <MaterialCommunityIcons 
                    name="layers" 
                    size={16} 
                    color="#FFFFFF" 
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        </View>
      </View>

      {/* Modal for maximized post */}
      {selectedPost && (
        <Modal
          visible={!!selectedPost}
          transparent={false}
          animationType="slide"
          onRequestClose={handleCloseModal}
        >
          <View style={{ flex: 1, backgroundColor: background }}>
            <Appbar.Header mode="center-aligned" style={{ backgroundColor: background }}>
              <Appbar.Action 
                icon="close" 
                color={text} 
                onPress={handleCloseModal}
              />
              <Appbar.Content title="Post" color={text} />
            </Appbar.Header>
            <View style={{ flex: 1 }}>
              <FeedPost post={selectedPost} onDelete={() => {}} />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

export default function UserProfileScreen({ route, navigation }) {
  const { username: targetUsername } = route.params || {};
  
  const [userProfile, setUserProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [hasPendingRequest, setHasPendingRequest] = React.useState(false);
  const [togglingFollow, setTogglingFollow] = React.useState(false);
  const [userId, setUserId] = React.useState(null);
  const isManuallyToggling = React.useRef(false); // Prevent useEffect from overriding manual state changes
  
  const { isDarkMode } = useTheme();
  const { user, friendsList } = useAuth();
  const themeColors = useThemeColors();
  
  // Theme colors based on dark/light mode
  const bgColor = isDarkMode ? '#1A1A1A' : '#EEEDEB';
  const surfaceColor = isDarkMode ? '#2A2A2A' : '#F5F4F2';
  const textColor = isDarkMode ? '#E6E8F0' : '#1A1A1A';
  const subTextColor = isDarkMode ? '#8A90A6' : '#666666';
  const dividerColor = isDarkMode ? '#3A3A3A' : '#D0CFCD';

  // Load user profile data
  React.useEffect(() => {
    if (!targetUsername) {
      setLoading(false);
      return;
    }

    const loadUserProfile = async () => {
      try {
        setLoading(true);
        // Get user data by username
        const { userData } = await getUserById(targetUsername);
        
        if (userData) {
          setUserProfile(userData);
          // Get authUid from username for subscribing to posts
          const authUid = userData.authUid;
          if (authUid) {
            setUserId(authUid);
          }
        } else {
          setUserProfile(null);
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [targetUsername]);

  // Check if following (if user is in friends list)
  // IMPORTANT: If they're friends, they can't have a pending request
  React.useEffect(() => {
    // Don't override manual state changes during toggle
    if (isManuallyToggling.current) {
      console.log('⏸️ [UserProfileScreen] Skipping useEffect update - manual toggle in progress');
      return;
    }

    if (!targetUsername || !friendsList || friendsList.length === 0) {
      setIsFollowing(false);
      return;
    }

    // friendsList contains usernames (document IDs) - they are lowercase
    // Check both targetUsername (route param) and userProfile.username (loaded data)
    // Normalize to lowercase for case-insensitive comparison
    const targetUsernameLower = targetUsername.toLowerCase().replace(/\s+/g, '');
    const profileUsernameLower = userProfile?.username?.toLowerCase().replace(/\s+/g, '');
    
    // Check if either username matches (case-insensitive)
    const following = friendsList.some((friendUsername) => {
      const friendUsernameLower = friendUsername?.toLowerCase().replace(/\s+/g, '');
      return (
        friendUsernameLower === targetUsernameLower ||
        (profileUsernameLower && friendUsernameLower === profileUsernameLower)
      );
    });
    
    console.log('🔍 [UserProfileScreen] Checking follow status:', { 
      targetUsername, 
      targetUsernameLower,
      profileUsername: userProfile?.username,
      profileUsernameLower,
      following, 
      friendsListLength: friendsList.length,
      friendsList: friendsList.slice(0, 5), // Show first 5 for debugging
    });
    
    setIsFollowing(following);
    
    // IMPORTANT: If they're friends, clear pending request status
    // They can't have a pending request if they're already friends
    if (following && hasPendingRequest) {
      console.log('🔍 [UserProfileScreen] User is friend, clearing pending request status');
      setHasPendingRequest(false);
    }
  }, [targetUsername, friendsList, hasPendingRequest, userProfile?.username]);

  // Check for pending outgoing friend requests
  React.useEffect(() => {
    if (!user?.uid || !userProfile) {
      setHasPendingRequest(false);
      return;
    }

    console.log('📡 [UserProfileScreen] Setting up outgoing friend requests subscription');
    const unsubscribe = subscribeToOutgoingFriendRequests(user.uid, (result) => {
      if (result.error) {
        console.error('❌ [UserProfileScreen] Error subscribing to outgoing requests:', result.error);
        setHasPendingRequest(false);
        return;
      }

      // Check if there's a pending request to this user
      // Note: toUserId might be a UID (long string) or username (short string) depending on when the request was created
      // IMPORTANT: If they're already friends, don't show pending request (they were accepted)
      const targetAuthUid = userProfile.authUid;
      const targetUsernameForMatch = userProfile.username || targetUsername;
      
      // First check if they're already friends - if so, no pending request
      // Use case-insensitive comparison
      const targetUsernameLower = targetUsernameForMatch.toLowerCase().replace(/\s+/g, '');
      const isAlreadyFriend = friendsList?.some((friendUsername) => {
        const friendUsernameLower = friendUsername?.toLowerCase().replace(/\s+/g, '');
        return friendUsernameLower === targetUsernameLower;
      }) || false;
      
      if (isAlreadyFriend) {
        console.log('🔍 [UserProfileScreen] User is already friend, clearing pending request');
        setHasPendingRequest(false);
        return;
      }
      
      const pendingRequest = result.requests?.find((request) => {
        // Only check pending requests (exclude accepted/declined/cancelled)
        if (request.status !== 'pending') return false;
        
        // Check if toUserId matches authUid (UID) or username
        const toUserId = request.toUserId;
        return (
          toUserId === targetAuthUid || // UID match
          toUserId === targetUsernameForMatch || // Username match
          toUserId?.toLowerCase() === targetUsernameForMatch?.toLowerCase() // Case-insensitive username match
        );
      });

      console.log('📡 [UserProfileScreen] Outgoing requests:', {
        totalRequests: result.requests?.length || 0,
        pendingRequest: !!pendingRequest,
        isAlreadyFriend,
        targetAuthUid: targetAuthUid,
        targetUsername: targetUsernameForMatch,
        allToUserIds: result.requests?.map(r => ({ toUserId: r.toUserId, status: r.status })) || [],
      });

      setHasPendingRequest(!!pendingRequest);
    });

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user?.uid, userProfile?.authUid, userProfile?.username, targetUsername, friendsList]);

  // Handle follow/unfollow toggle
  // This function handles three states:
  // 1. If already friends → remove friend (unfriend)
  // 2. If pending request → cancel request
  // 3. If not friends → send friend request
  const handleToggleFollow = React.useCallback(async () => {
    if (!user || !user.uid || !targetUsername || togglingFollow) {
      console.log('⚠️ [UserProfileScreen] Toggle blocked:', { user: !!user, targetUsername, togglingFollow });
      return;
    }

    // Check actual friends list state from context (most reliable source of truth)
    // Use case-insensitive comparison like in the useEffect
    const targetUsernameLower = targetUsername.toLowerCase().replace(/\s+/g, '');
    const profileUsernameLower = userProfile?.username?.toLowerCase().replace(/\s+/g, '');
    
    const actuallyFollowing = friendsList?.some((friendUsername) => {
      const friendUsernameLower = friendUsername?.toLowerCase().replace(/\s+/g, '');
      return (
        friendUsernameLower === targetUsernameLower ||
        (profileUsernameLower && friendUsernameLower === profileUsernameLower)
      );
    }) || false;
    console.log('🔄 [UserProfileScreen] Toggling follow:', { 
      isFollowingState: isFollowing, 
      actuallyFollowing,
      hasPendingRequest,
      targetUsername,
      friendsListLength: friendsList?.length || 0
    });

    // Set flag to prevent useEffect from overriding our manual state change
    isManuallyToggling.current = true;
    setTogglingFollow(true);

    try {
      // Get authUid for friend operations
      const friendAuthUid = userProfile?.authUid;
      if (!friendAuthUid) {
        console.error('❌ [UserProfileScreen] No authUid for friend:', userProfile);
        Alert.alert('Error', 'Unable to follow/unfollow user - user data missing');
        isManuallyToggling.current = false;
        setTogglingFollow(false);
        return;
      }

      // Priority 1: If already friends → remove friend (unfriend)
      if (actuallyFollowing) {
        console.log('🗑️ [UserProfileScreen] Unfriending user (already friends):', friendAuthUid);
        const result = await removeFriend(user.uid, friendAuthUid);
        
        console.log('🗑️ [UserProfileScreen] Remove friend result:', result);
        
        if (result.success) {
          setIsFollowing(false);
          console.log('✅ [UserProfileScreen] Successfully unfriended');
          // Don't show alert for unfriending - it happens immediately
        } else {
          console.error('❌ [UserProfileScreen] Failed to unfriend:', result.error);
          Alert.alert('Error', result.error || 'Failed to remove friend');
        }
      } 
      // Priority 2: If pending request exists → cancel request
      else if (hasPendingRequest) {
        console.log('❌ [UserProfileScreen] Cancelling pending friend request:', friendAuthUid);
        const result = await cancelFriendRequest(friendAuthUid);
        
        console.log('❌ [UserProfileScreen] Cancel friend request result:', result);
        
        if (result.success) {
          setHasPendingRequest(false);
          console.log('✅ [UserProfileScreen] Successfully cancelled friend request');
        } else {
          console.error('❌ [UserProfileScreen] Failed to cancel friend request:', result.error);
          Alert.alert('Error', result.error || 'Failed to cancel friend request');
        }
      } 
      // Priority 3: Not friends and no pending request → send friend request
      else {
        console.log('📤 [UserProfileScreen] Sending friend request (not friends):', friendAuthUid);
        
        // Use username for sendFriendRequest (it accepts username or UID)
        const result = await sendFriendRequest(targetUsername);
        
        console.log('📤 [UserProfileScreen] Send friend request result:', result);
        
        if (result.success) {
          setHasPendingRequest(true);
          console.log('✅ [UserProfileScreen] Successfully sent friend request');
        } else {
          console.error('❌ [UserProfileScreen] Failed to send friend request:', result.error);
          Alert.alert('Error', result.error || 'Failed to send friend request');
        }
      }
    } catch (error) {
      console.error('❌ [UserProfileScreen] Error toggling follow:', error);
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    } finally {
      setTogglingFollow(false);
      // Clear flag after a short delay to allow context to update
      setTimeout(() => {
        isManuallyToggling.current = false;
      }, 1000);
    }
  }, [user, targetUsername, isFollowing, userProfile, togglingFollow, friendsList, hasPendingRequest]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: textColor }}>Loading profile...</Text>
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor }}>
        <Appbar.Header mode="center-aligned" style={{ backgroundColor: bgColor }}>
          <Appbar.Action icon="arrow-left" onPress={() => navigation.goBack()} color={textColor} />
          <Appbar.Content title="Profile" color={textColor} />
        </Appbar.Header>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: textColor }}>User not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* Header */}
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: bgColor }}>
        <Appbar.Action 
          icon="arrow-left" 
          onPress={() => {
            // If we're in a modal (UserProfileModal), just go back
            // This will close the modal and return to the current tab
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              // Fallback: try to get parent and navigate
              const parent = navigation.getParent();
              if (parent) {
                parent.goBack();
              }
            }
          }} 
          color={textColor} 
        />
        <Appbar.Content title={`@${userProfile.username || targetUsername}`} color={textColor} />
      </Appbar.Header>
      
      {/* Profile Header Section */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 20, backgroundColor: bgColor }}>
        {/* Profile Photo on the left */}
        <Avatar.Image 
          size={96} 
          source={{ uri: userProfile.photoURL || userProfile.avatar || 'https://i.pravatar.cc/200?img=12' }} 
        />
        
        {/* User info on the right */}
        <View style={{ flex: 1, marginLeft: 16, justifyContent: 'center' }}>
          {/* Name and Follow/Unfollow button in a row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              {/* Name */}
              <Text variant="titleLarge" style={{ color: textColor }}>
                {userProfile.name || 'User'}
              </Text>
              
              {/* Username */}
              <Text variant="titleMedium" style={{ color: subTextColor, marginTop: 4 }}>
                @{userProfile.username || targetUsername}
              </Text>
            </View>
            
            {/* Follow/Unfollow Icon Button */}
            {/* Icon reflects current status:
                - account-check (crimson, with border): Already friends → clicking unfriends
                - clock-outline (subText): Pending request → clicking cancels request
                - account-plus (text): Not friends → clicking sends friend request */}
            <IconButton
              icon={
                isFollowing 
                  ? 'account-check'  // Friends: clicking will unfriend
                  : hasPendingRequest 
                    ? 'clock-outline'  // Pending: clicking will cancel
                    : 'account-plus'   // Not friends: clicking will send request
              }
              iconColor={
                isFollowing 
                  ? IU_CRIMSON  // Crimson for friends
                  : hasPendingRequest 
                    ? subTextColor  // Muted for pending
                    : textColor     // Normal for not friends
              }
              size={28}
              onPress={handleToggleFollow}
              disabled={togglingFollow}
              loading={togglingFollow}
              style={{ 
                margin: 0,
                backgroundColor: 'transparent',
                borderWidth: isFollowing ? 2 : 0,
                borderColor: isFollowing ? IU_CRIMSON : 'transparent',
                borderRadius: isFollowing ? 20 : 0,
                width: isFollowing ? 40 : 40,
                height: isFollowing ? 40 : 40,
              }}
            />
          </View>
          
          {/* Bio */}
          {userProfile.bio && (
            <Text style={{ color: subTextColor, marginTop: 8, fontSize: 14 }}>
              {userProfile.bio}
            </Text>
          )}
          
          {/* Age and Gender */}
          {(userProfile.age || userProfile.gender) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
              {userProfile.age && (
                <Text style={{ color: subTextColor, fontSize: 14 }}>
                  {userProfile.age} years old
                </Text>
              )}
              {userProfile.gender && (
                <Text style={{ color: subTextColor, fontSize: 14 }}>
                  {userProfile.gender}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Posts - Full Width */}
      <View style={{ flex: 1 }}>
        <UserPostsTab userId={userId} username={targetUsername} themeColors={themeColors} />
      </View>
    </View>
  );
}

