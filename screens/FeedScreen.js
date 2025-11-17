// Feed screen - shows feed of posts with camera and notifications buttons
import * as React from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, StyleSheet, Alert, Modal, Platform } from 'react-native';
import { Text, Snackbar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import FeedPost from '../components/FeedPost';
import ComposePost from '../components/ComposePost';
import NotificationsTab from './NotificationsTab';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { subscribeToPosts, createPost } from '../services/postsService';
import { uploadImages } from '../services/storageService';
import { getCurrentLocation } from '../services/locationService';
import { subscribeToBlockedUsers } from '../services/blockService';

const IU_CRIMSON = '#CC0000';

export default function FeedScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  
  // State management
  const [posts, setPosts] = React.useState([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [composeVisible, setComposeVisible] = React.useState(false);
  const [notificationsVisible, setNotificationsVisible] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [snackbarVisible, setSnackbarVisible] = React.useState(false);
  
  // GPS location state
  const [userLat, setUserLat] = React.useState(null);
  const [userLng, setUserLng] = React.useState(null);
  const [userLocation, setUserLocation] = React.useState(null); // City name
  const [loadingLocation, setLoadingLocation] = React.useState(true);
  const [blockedUsersList, setBlockedUsersList] = React.useState([]);
  
  // Get current user from auth context (friendsList is managed centrally in AuthContext)
  const { user, userData, loading: authLoading, friendsList } = useAuth();
  const { isDarkMode } = useTheme();
  const { background, subText, text, surface, divider } = useThemeColors();
  const insets = useSafeAreaInsets();
  
  // ScrollView ref for scrolling to highlighted post
  const scrollViewRef = React.useRef(null);
  const postRefs = React.useRef({});
  
  // Get GPS location on mount and when user changes
  React.useEffect(() => {
    if (!user) {
      return;
    }
    
    setLoadingLocation(true);
    getCurrentLocation()
      .then((locationData) => {
        if (locationData.error) {
          console.error('❌ Error getting location:', locationData.error);
          setError('Location required: ' + locationData.error);
          // Fallback to city name from userData if available
          setUserLocation(userData?.location || 'Unknown Location');
        } else {
          setUserLocation(locationData.city || 'Unknown Location');
          setUserLat(locationData.lat);
          setUserLng(locationData.lng);
        }
      })
      .catch((error) => {
        console.error('❌ Error getting location:', error);
        setError('Failed to get location: ' + error.message);
        // Fallback to city name from userData if available
        setUserLocation(userData?.location || 'Unknown Location');
      })
      .finally(() => {
        setLoadingLocation(false);
      });
  }, [user]); // Get location when user logs in

  // Reset submitting state when opening compose modal
  React.useEffect(() => {
    if (composeVisible) {
      setSubmitting(false);
      setError(null);
    }
  }, [composeVisible]);

  // Handle scrolling to highlighted post when route params change
  useFocusEffect(
    React.useCallback(() => {
      const highlightPostId = route.params?.highlightPostId;
      
      if (highlightPostId && posts.length > 0) {
        // Wait a bit for posts to render
        setTimeout(() => {
          const postRef = postRefs.current[highlightPostId];
          if (postRef && scrollViewRef.current) {
            postRef.measureLayout(
              scrollViewRef.current,
              (x, y) => {
                scrollViewRef.current?.scrollTo({
                  y: y - 20, // Add some padding above the post
                  animated: true,
                });
              },
              () => {
                // If measureLayout fails, try scrollToEnd and then scroll back
                console.warn('Could not measure post layout');
              }
            );
          }
        }, 300);
      }
    }, [route.params?.highlightPostId, posts])
  );

  // Subscribe to posts in real-time with account location filtering
  React.useEffect(() => {
    if (!user || !userData) {
      // Wait for user and userData to load before subscribing
      return;
    }

    // Set up real-time listener with account location (not GPS)
    // Use account location from userData, not GPS-based location
    const accountLocation = userData?.location || userLocation || null;
    
    const unsubscribe = subscribeToPosts(
      (result) => {
        if (result.error) {
          setError(result.error);
          setSnackbarVisible(true);
        } else {
          // Verify no duplicate IDs before setting
          const uniqueIds = [...new Set(result.posts.map(p => p.id))];
          if (uniqueIds.length !== result.posts.length) {
            // Remove duplicates before setting
            const uniquePosts = result.posts.filter((post, index, self) => 
              index === self.findIndex((p) => p.id === post.id)
            );
            setPosts(uniquePosts);
          } else {
            setPosts(result.posts);
          }
        }
        setRefreshing(false);
      },
      20, // pageSize
      accountLocation, // Account location (from userData.location) - used for filtering posts
      user.uid, // userId - for checking Friends Only posts
      userLat, // GPS latitude (not used for filtering anymore)
      userLng, // GPS longitude (not used for filtering anymore)
      null, // radiusKm (not used for filtering anymore)
      friendsList, // Friends list for filtering Friends Only posts
      blockedUsersList // Blocked users list for filtering posts
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [user, userData, friendsList, blockedUsersList]); // Re-subscribe if user, userData, friends, or blocked users change

  // Subscribe to blocked users
  React.useEffect(() => {
    if (!user?.uid) {
      setBlockedUsersList([]);
      return;
    }

    const unsubscribe = subscribeToBlockedUsers(user.uid, (result) => {
      if (result.error) {
        console.error('Error loading blocked users:', result.error);
      } else {
        // Extract usernames from blocked users
        const blockedList = result.blockedUsers.map(u => u.username || u.authUid || u).filter(Boolean);
        setBlockedUsersList(blockedList);
      }
    });

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user?.uid]);

  // Refresh posts manually
  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Force re-subscription to get fresh data
    // The subscription will automatically update posts
    // Set refreshing to false after a short delay to show the refresh indicator
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, []);

  // Handle when user submits a new post
  const handlePostSubmit = async (postData) => {
    if (!user) {
      setError('Please sign in to create a post');
      setSnackbarVisible(true);
      return;
    }

    // Get userData quickly - use cached or fallback (don't block)
    let currentUserData = userData;
    if (!currentUserData) {
      // Use fallback immediately - don't wait for fetch
      currentUserData = {
        name: user.displayName || user.email?.split('@')[0] || 'User',
        username: user.email?.split('@')[0] || 'user',
        avatar: user.photoURL || null,
      };
    }

    // Close modal IMMEDIATELY - before any async operations (optimistic UI)
    setComposeVisible(false);
    setSubmitting(false);
    setError(null);

    // Run post submission in background - NO TIMEOUT, let it complete naturally
    (async () => {
      try {
        // Upload images if any
        let imageUrls = postData.images && Array.isArray(postData.images) && postData.images.length > 0 
          ? postData.images 
          : postData.image 
            ? [postData.image] 
            : [];
        
        // If images are local URIs, upload them to Firebase Storage
        if (imageUrls.length > 0 && imageUrls[0]?.startsWith('file://')) {
          // Upload images in parallel for faster uploads
          const uploadResult = await uploadImages(imageUrls, user.uid, 'posts');
          
          if (uploadResult.errors && uploadResult.errors.length > 0) {
            throw new Error('Failed to upload some images: ' + uploadResult.errors.join(', '));
          }
          imageUrls = uploadResult.urls || [];
        }

        // Prepare post data
        if (!postData.location || !postData.location.trim()) {
          throw new Error('Location is required for all posts');
        }

        const postPayload = {
          text: postData.text || '',
          location: postData.location.trim(),
          image: imageUrls.length > 0 ? imageUrls[0] : null,
          images: imageUrls.length > 0 ? imageUrls : null,
          visibility: postData.visibility || 'location',
          bar: postData.bar || null, // Bar name (optional)
        };

        // Create post - NO TIMEOUT, let it complete naturally
        // Post will appear automatically via real-time listener
        const result = await createPost(user.uid, currentUserData, postPayload);
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        // Post appears automatically via real-time listener - no success alert needed
        
      } catch (err) {
        const errorMessage = err.message || 'Failed to create post. Please check your connection and try again.';
        setError(errorMessage);
        setSnackbarVisible(true);
        
        Alert.alert(
          'Error',
          errorMessage,
          [{ text: 'OK' }],
          { cancelable: false }
        );
      }
    })(); // Immediately invoke async function to run in background
  };

  // Show loading state only while checking auth (not while loading posts)
  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={IU_CRIMSON} />
      </View>
    );
  }

  // Show message if not logged in (only check user, userData loads in background)
  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: background, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ textAlign: 'center', fontSize: 16, marginBottom: 16, color: subText }}>
          Please sign in to view posts
        </Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, overflow: 'visible' }}>
        {/* Header with camera and notifications buttons */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => {
              // Navigate to root navigator's Camera screen
              let rootNavigator = navigation;
              let parent = navigation.getParent();
              while (parent) {
                rootNavigator = parent;
                parent = parent.getParent();
              }
              rootNavigator.navigate('Camera');
            }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Roll</Text>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setNotificationsVisible(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="bell-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Scrollable list of posts with pull-to-refresh */}
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 80 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={IU_CRIMSON}
            />
          }
        >
          {posts.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400, padding: 20 }}>
              <Text style={{ color: subText, fontSize: 16, textAlign: 'center' }}>Empty</Text>
              {error && (
                <Text style={{ color: '#FF6B6B', fontSize: 12, textAlign: 'center', marginTop: 12, padding: 12 }}>
                  {error}
                </Text>
              )}
            </View>
          ) : (
            posts.map((post) => (
              <View
                key={post.id}
                ref={(ref) => {
                  if (ref) {
                    postRefs.current[post.id] = ref;
                  }
                }}
              >
                <FeedPost
                  post={post}
                  onDelete={(postId) => {
                    // Post will be automatically removed from feed via real-time listener
                  }}
                />
              </View>
            ))
          )}
        </ScrollView>

        {/* Modal for composing new posts */}
        <ComposePost
          visible={composeVisible}
          onClose={() => {
            setComposeVisible(false);
            setSubmitting(false); // Reset submitting when modal closes
            setError(null); // Clear any errors
          }}
          onSubmit={handlePostSubmit}
          currentUser={userData || { 
            name: user?.displayName || user?.email || 'User', 
            username: user?.email?.split('@')[0] || 'user', 
            avatar: null,
            location: userData?.location || 'Bloomington, IN' // Include location in fallback
          }}
          submitting={submitting}
        />

        {/* Notifications Modal */}
        <Modal
          visible={notificationsVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setNotificationsVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: background }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: text }]}>Notifications</Text>
                <TouchableOpacity
                  onPress={() => setNotificationsVisible(false)}
                  style={styles.closeButton}
                >
                  <MaterialCommunityIcons name="close" size={24} color={text} />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <NotificationsTab />
              </View>
            </View>
          </View>
        </Modal>

        {/* Error snackbar */}
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          action={{
            label: 'Dismiss',
            onPress: () => setSnackbarVisible(false),
          }}
        >
          {error || 'An error occurred'}
        </Snackbar>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 0,
    marginTop: 64,
    fontFamily: Platform.select({
      ios: 'AvenirNext-Bold',
      android: 'Roboto-Bold',
      default: 'System',
    }),
    letterSpacing: 2,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  modalContent: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
});

