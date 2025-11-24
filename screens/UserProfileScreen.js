// User Profile screen - view another user's profile with posts and following button
import * as React from 'react';
import { View, Alert, TouchableOpacity, Image, Modal, Dimensions, FlatList, ScrollView } from 'react-native';
import { Appbar, Avatar, Text, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import UserAvatar from '../components/UserAvatar';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { subscribeToUserPosts } from '../services/postsService';
import { addFriend, removeFriend, getAuthUidFromUsername, subscribeToOutgoingFriendRequests, sendFriendRequest, cancelFriendRequest } from '../services/friendsService';
import { getUserById } from '../services/usersService';
import { blockUser, unblockUser, isUserBlocked } from '../services/blockService';
import FeedPost from '../components/FeedPost';
import { useThemeColors } from '../hooks/useThemeColors';
import { getCardBorderOnly } from '../utils/cardStyles';

const IU_CRIMSON = '#CC0000';

// Posts Tab Component
function UserPostsTab({ userId, username, themeColors, highlightPostId }) {
  const [posts, setPosts] = React.useState([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [selectedPostIndex, setSelectedPostIndex] = React.useState(null);
  const [currentPostIndex, setCurrentPostIndex] = React.useState(0);
  const [containerHeight, setContainerHeight] = React.useState(0);
  const flatListRef = React.useRef(null);
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
          // Show all posts, not limited to 9
          setPosts(result.posts);
        }
        setLoading(false);
        setRefreshing(false);
      },
      100 // Get up to 100 posts (effectively all)
    );

    return () => unsubscribe();
  }, [userId]);

  // Auto-open highlighted post when posts are loaded
  React.useEffect(() => {
    if (highlightPostId && posts.length > 0 && !loading) {
      const postIndex = posts.findIndex(p => p.id === highlightPostId);
      if (postIndex !== -1) {
        // Small delay to ensure UI is ready
        setTimeout(() => {
          setSelectedPostIndex(postIndex);
          setCurrentPostIndex(postIndex);
        }, 300);
      }
    }
  }, [highlightPostId, posts, loading]);

  const handleRefresh = () => {
    setRefreshing(true);
    // Real-time listener will automatically update
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handlePostPress = (post) => {
    const index = posts.findIndex(p => p.id === post.id);
    if (index !== -1) {
      setSelectedPostIndex(index);
      setCurrentPostIndex(index);
    }
  };

  const handleCloseModal = () => {
    setSelectedPostIndex(null);
    setCurrentPostIndex(0);
  };

  const handlePostDelete = (postId) => {
    const deletedIndex = posts.findIndex(p => p.id === postId);
    
    // Remove the deleted post from the list
    setPosts(prevPosts => {
      const newPosts = prevPosts.filter(post => post.id !== postId);
      
      // If we deleted the last post, close the modal
      if (newPosts.length === 0) {
        setSelectedPostIndex(null);
        setCurrentPostIndex(0);
        return newPosts;
      }
      
      // If we deleted the current post, navigate to previous one or close if it was the first
      if (deletedIndex === currentPostIndex) {
        if (currentPostIndex > 0) {
          // Move to previous post - just update index, user can scroll naturally
          setCurrentPostIndex(currentPostIndex - 1);
        } else {
          // It was the first post, close modal
          setSelectedPostIndex(null);
          setCurrentPostIndex(0);
        }
      } else if (deletedIndex < currentPostIndex) {
        // If we deleted a post before the current one, adjust the index
        setCurrentPostIndex(currentPostIndex - 1);
      }
      
      return newPosts;
    });
  };

  const handleViewableItemsChanged = React.useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const index = viewableItems[0].index;
      if (index !== null && index !== undefined) {
        setCurrentPostIndex(index);
      }
    }
  }).current;

  const viewabilityConfig = React.useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  // Scroll to selected post when modal opens
  React.useEffect(() => {
    if (selectedPostIndex !== null && flatListRef.current && posts.length > 0) {
      // Wait for FlatList to render, then scroll to approximate position
      setTimeout(() => {
        // Estimate scroll position (rough estimate based on average post height)
        const estimatedHeight = 500;
        const scrollOffset = estimatedHeight * selectedPostIndex;
        flatListRef.current?.scrollToOffset({ offset: scrollOffset, animated: false });
      }, 100);
    }
  }, [selectedPostIndex, posts.length]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }}>
        <Text style={{ color: text }}>Loading posts...</Text>
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent', padding: 20 }}>
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
          borderBottomColor: isDarkMode ? 'rgba(58, 58, 58, 0.3)' : 'rgba(208, 207, 205, 0.3)',
          backgroundColor: 'transparent',
        }}>
          <Text style={{
            color: text,
            fontSize: 16,
            fontWeight: '600',
          }}>
            Posts
          </Text>
        </View>

        {/* Scrollable Grid container */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: gridPadding,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: gridGap,
            alignContent: 'flex-start',
          }}
          showsVerticalScrollIndicator={true}
        >
        {posts.filter(post => {
          // Show posts that have images or videos
          const images = post.images || [];
          const videos = post.videos || [];
          const video = post.video;
          return images.length > 0 || videos.length > 0 || !!video;
        }).map((post) => {
          // Get first image or video from post
          const images = post.images || [];
          const videos = post.videos || [];
          const video = post.video;
          const firstImage = images.length > 0 ? images[0] : null;
          const firstVideo = videos.length > 0 ? videos[0] : (video || null);
          const hasVideo = !!firstVideo;
          const hasImage = !!firstImage;
          
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
              {hasImage ? (
                <Image
                  source={{ uri: firstImage }}
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                  resizeMode="cover"
                />
              ) : hasVideo ? (
                <View style={{ width: '100%', height: '100%', backgroundColor: '#000' }}>
                  <Video
                    source={{ uri: firstVideo }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                    shouldPlay={false}
                    isMuted
                  />
                  <View style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: [{ translateX: -12 }, { translateY: -12 }],
                  }}>
                    <MaterialCommunityIcons name="play-circle" size={24} color="rgba(255,255,255,0.9)" />
                  </View>
                </View>
              ) : null}
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
              {/* Video indicator */}
              {hasVideo && (
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
                    name="video" 
                    size={16} 
                    color="#FFFFFF" 
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        </ScrollView>
      </View>

      {/* Modal for maximized post with horizontal scrolling */}
      {selectedPostIndex !== null && posts.length > 0 && (
        <Modal
          visible={selectedPostIndex !== null}
          transparent={false}
          animationType="slide"
          onRequestClose={handleCloseModal}
        >
          <LinearGradient
            colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
            style={{ flex: 1 }}
          >
            <View style={{ flex: 1 }}>
              <Appbar.Header 
                mode="center-aligned" 
                style={{ 
                  backgroundColor: 'transparent',
                  ...getCardBorderOnly(),
                }}
              >
                <Appbar.Action 
                  icon="arrow-left" 
                  color={text} 
                  onPress={handleCloseModal}
                />
                <Appbar.Content title="" color={text} />
              </Appbar.Header>
              <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
                <View style={{
                  flex: 1,
                  backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                  borderRadius: 20,
                  overflow: 'hidden',
                  ...getCardBorderOnly(),
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  elevation: 8,
                }}>
                  <FlatList
                    ref={flatListRef}
                    data={posts}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={true}
                    onViewableItemsChanged={handleViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig}
                    contentContainerStyle={{ paddingBottom: 20, paddingTop: 8 }}
                    style={{ flex: 1 }}
                    renderItem={({ item }) => (
                      <View style={{ width: '100%' }}>
                        <FeedPost post={item} onDelete={handlePostDelete} />
                      </View>
                    )}
                  />
                </View>
              </View>
            </View>
          </LinearGradient>
        </Modal>
      )}
    </>
  );
}

export default function UserProfileScreen({ route, navigation }) {
  const { username: targetUsername, highlightPostId } = route.params || {};
  
  const [userProfile, setUserProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [hasPendingRequest, setHasPendingRequest] = React.useState(false);
  const [togglingFollow, setTogglingFollow] = React.useState(false);
  const [userId, setUserId] = React.useState(null);
  const [isBlocked, setIsBlocked] = React.useState(false);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [blocking, setBlocking] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ top: 0, right: 0 });
  const menuButtonRef = React.useRef(null);
  const isManuallyToggling = React.useRef(false); // Prevent useEffect from overriding manual state changes
  
  const { isDarkMode } = useTheme();
  const { user, friendsList } = useAuth();
  const themeColors = useThemeColors();
  
  // Theme colors based on dark/light mode
  const bgColor = isDarkMode ? '#121212' : '#FAFAFA';
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

  // Check if user is blocked
  React.useEffect(() => {
    if (!user?.uid || !userProfile?.authUid) {
      setIsBlocked(false);
      return;
    }

    const checkBlockStatus = async () => {
      const result = await isUserBlocked(user.uid, userProfile.authUid || userProfile.username);
      if (!result.error) {
        setIsBlocked(result.isBlocked);
      }
    };

    checkBlockStatus();
  }, [user?.uid, userProfile?.authUid, userProfile?.username]);

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
          // Don't show error for "already sent" - it's expected if user clicks twice
          if (result.error !== 'Friend request already sent') {
            console.error('❌ [UserProfileScreen] Failed to send friend request:', result.error);
            Alert.alert('Error', result.error || 'Failed to send friend request');
          } else {
            // Request already exists, update state to reflect that
            setHasPendingRequest(true);
          }
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

  // Handle block/unblock
  const handleBlock = React.useCallback(async () => {
    if (!user || !user.uid || !userProfile || blocking) {
      return;
    }

    setMenuVisible(false);

    if (isBlocked) {
      // Unblock user - no confirmation needed
      setBlocking(true);
      try {
        const result = await unblockUser(user.uid, userProfile.authUid || userProfile.username);
        if (result.success) {
          setIsBlocked(false);
          Alert.alert('User Unblocked', 'This user has been unblocked. You can now see their posts and interact with them.');
        } else {
          Alert.alert('Error', result.error || 'Failed to unblock user');
        }
      } catch (error) {
        console.error('Error unblocking user:', error);
        Alert.alert('Error', 'Failed to unblock user. Please try again.');
      } finally {
        setBlocking(false);
      }
    } else {
      // Block user - show confirmation dialog
      Alert.alert(
        'Block User',
        `Are you sure you want to block @${userProfile.username || targetUsername}? You will no longer see their posts or be able to interact with them.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setMenuVisible(false),
          },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              setBlocking(true);
              try {
                const result = await blockUser(user.uid, userProfile.authUid || userProfile.username);
                if (result.success) {
                  setIsBlocked(true);
                  Alert.alert('User Blocked', 'This user has been blocked. You will no longer see their posts or be able to interact with them.');
                } else {
                  Alert.alert('Error', result.error || 'Failed to block user');
                }
              } catch (error) {
                console.error('Error blocking user:', error);
                Alert.alert('Error', 'Failed to block user. Please try again.');
              } finally {
                setBlocking(false);
              }
            },
          },
        ]
      );
    }
  }, [user, userProfile, blocking, isBlocked, targetUsername]);

  if (loading) {
    return (
      <LinearGradient
        colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: textColor }}>Loading profile...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (!userProfile) {
    return (
      <LinearGradient
        colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1 }}>
          <Appbar.Header mode="center-aligned" style={{ backgroundColor: 'transparent' }}>
            <Appbar.Action icon="arrow-left" onPress={() => navigation.goBack()} color={textColor} />
            <Appbar.Content title="Profile" color={textColor} />
          </Appbar.Header>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: textColor }}>User not found</Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1 }}>
      {/* Header */}
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: 'transparent' }}>
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
        {/* Only show menu if viewing someone else's profile */}
        {user?.uid !== userProfile?.authUid && (
          <View
            ref={menuButtonRef}
            onLayout={() => {
              if (menuButtonRef.current) {
                menuButtonRef.current.measure((x, y, width, height, pageX, pageY) => {
                  setMenuPosition({
                    top: pageY + height + 4, // Position just below the button
                    right: Dimensions.get('window').width - pageX - width, // Align to right edge
                  });
                });
              }
            }}
          >
            <Appbar.Action
              icon="dots-vertical"
              color={textColor}
              onPress={() => {
                // Measure button position before showing menu
                if (menuButtonRef.current) {
                  menuButtonRef.current.measure((x, y, width, height, pageX, pageY) => {
                    setMenuPosition({
                      top: pageY + height + 4, // Position just below the button
                      right: Dimensions.get('window').width - pageX - width, // Align to right edge
                    });
                    setMenuVisible(true);
                  });
                } else {
                  setMenuVisible(true);
                }
              }}
            />
          </View>
        )}
      </Appbar.Header>
      
      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={{ flex: 1 }} />
        </TouchableOpacity>
        <View
          style={{
            position: 'absolute',
            top: menuPosition.top,
            right: menuPosition.right,
            backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)',
            borderRadius: 8,
            minWidth: 180,
            borderWidth: 1,
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          <TouchableOpacity
            onPress={handleBlock}
            disabled={blocking}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              opacity: blocking ? 0.5 : 1,
            }}
          >
            <MaterialCommunityIcons
              name={isBlocked ? 'account-check' : 'account-cancel'}
              size={20}
              color={textColor}
              style={{ marginRight: 12 }}
            />
            <Text style={{ color: textColor, fontSize: 16 }}>
              {isBlocked ? 'Unblock User' : 'Block User'}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
      
      {/* Profile Header Section */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 20, backgroundColor: 'transparent' }}>
        {/* Profile Photo on the left */}
        <UserAvatar 
          size={96} 
          uri={userProfile.photoURL || userProfile.avatar}
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
        <UserPostsTab userId={userId} username={targetUsername} themeColors={themeColors} highlightPostId={highlightPostId} />
      </View>
      </View>
    </LinearGradient>
  );
}

