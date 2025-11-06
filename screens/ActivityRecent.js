// Activity Recent screen - shows feed of posts and allows creating new posts with Firebase
import * as React from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { FAB, Text, Snackbar, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedPost from '../components/FeedPost';
import ComposePost from '../components/ComposePost';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../context/AuthContext';
import { subscribeToPosts, createPost } from '../services/postsService';
import { uploadImages } from '../services/storageService';
import { getCurrentUserData } from '../services/authService';
import { getCurrentLocation } from '../services/locationService';
import { subscribeToVotesForLocation } from '../services/votesService';

const IU_CRIMSON = '#990000';

export default function ActivityRecent() {
  // State management
  const [posts, setPosts] = React.useState([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [composeVisible, setComposeVisible] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [snackbarVisible, setSnackbarVisible] = React.useState(false);
  
  // Poll results state
  const [voteCounts, setVoteCounts] = React.useState({});
  const [selectedBarFilter, setSelectedBarFilter] = React.useState(null);
  const [pollExpanded, setPollExpanded] = React.useState(false);
  
  // GPS location state
  const [userLat, setUserLat] = React.useState(null);
  const [userLng, setUserLng] = React.useState(null);
  const [userLocation, setUserLocation] = React.useState(null); // City name
  const [loadingLocation, setLoadingLocation] = React.useState(true);
  
  // Get current user from auth context (friendsList is managed centrally in AuthContext)
  const { user, userData, loading: authLoading, friendsList } = useAuth();
  const { background, subText, text, surface, divider } = useThemeColors();
  const insets = useSafeAreaInsets();
  
  // Calculate bottom position for FAB - position in bottom right corner
  // Account for bottom tab bar height (~70px) - lowered further
  const fabBottom = insets.bottom - 17;

  // Get poll results for current location
  React.useEffect(() => {
    if (!user || !userData) {
      return;
    }

    const accountLocation = userData?.location || userLocation || null;
    if (!accountLocation) {
      return;
    }

    const unsubscribe = subscribeToVotesForLocation(accountLocation, (result) => {
      if (result.error) {
        console.error('Error loading poll results:', result.error);
      } else {
        setVoteCounts(result.voteCounts || {});
      }
    });

    return () => unsubscribe();
  }, [user, userData, userLocation]);

  // Get sorted bars by votes
  const sortedBars = React.useMemo(() => {
    const barsWithVotes = Object.keys(voteCounts).filter(bar => voteCounts[bar] > 0);
    return barsWithVotes.sort((a, b) => voteCounts[b] - voteCounts[a]);
  }, [voteCounts]);

  const totalVotes = React.useMemo(() => {
    return Object.values(voteCounts).reduce((sum, count) => sum + count, 0);
  }, [voteCounts]);

  // Filter posts based on selected bar
  const filteredPosts = React.useMemo(() => {
    if (!selectedBarFilter) {
      return posts;
    }
    return posts.filter(post => post.bar === selectedBarFilter);
  }, [posts, selectedBarFilter]);
  
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
  
  // Use friends list from AuthContext (centralized subscription)
  // No need to create a new subscription here - AuthContext manages it
  // friendsList is already available from useAuth() hook

      // Reset submitting state when opening compose modal
      React.useEffect(() => {
        if (composeVisible) {
          setSubmitting(false);
          setError(null);
        }
      }, [composeVisible]);

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
      friendsList // Friends list for filtering Friends Only posts
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [user, userData, friendsList]); // Re-subscribe if user, userData, or friends change

  // Removed debug logging for faster performance

  // Refresh posts manually
  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Real-time listener will automatically update
    setTimeout(() => setRefreshing(false), 1000);
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
        avatar: user.photoURL || 'https://i.pravatar.cc/100?img=12',
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
    <View style={{ flex: 1, backgroundColor: background, overflow: 'visible' }}>
      {/* Scrollable list of posts with pull-to-refresh */}
      <ScrollView
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
        {/* Poll Results Component */}
        {sortedBars.length > 0 && (
          <Card style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: surface, borderRadius: 16 }}>
            <Card.Content>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: text }}>
                  Tonight's Poll ({totalVotes} {totalVotes === 1 ? 'vote' : 'votes'})
                </Text>
                {selectedBarFilter && (
                  <TouchableOpacity
                    onPress={() => setSelectedBarFilter(null)}
                    style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                  >
                    <Text style={{ color: IU_CRIMSON, fontSize: 14 }}>Clear filter</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {(pollExpanded ? sortedBars : sortedBars.slice(0, 3)).map((bar) => {
                const voteCount = voteCounts[bar] || 0;
                const ratio = totalVotes > 0 ? voteCount / totalVotes : 0;
                const isSelected = selectedBarFilter === bar;
                
                return (
                  <TouchableOpacity
                    key={bar}
                    onPress={() => setSelectedBarFilter(isSelected ? null : bar)}
                    style={{
                      marginBottom: 12,
                      padding: 12,
                      borderRadius: 0,
                      backgroundColor: isSelected ? IU_CRIMSON + '20' : 'transparent',
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? IU_CRIMSON : divider,
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: text, flex: 1 }}>{bar}</Text>
                      <Text style={{ fontSize: 12, color: subText }}>
                        {voteCount} vote{voteCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: divider, borderRadius: 0, overflow: 'hidden' }}>
                      <View 
                        style={{
                          height: '100%',
                          width: `${ratio * 100}%`,
                          backgroundColor: IU_CRIMSON,
                        }}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
              
              {sortedBars.length > 3 && (
                <TouchableOpacity
                  onPress={() => setPollExpanded(!pollExpanded)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}
                >
                  <Text style={{ color: subText, fontSize: 14, marginRight: 4 }}>
                    {pollExpanded ? 'Show less' : `Show ${sortedBars.length - 3} more`}
                  </Text>
                  <MaterialCommunityIcons
                    name={pollExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={subText}
                  />
                </TouchableOpacity>
              )}
            </Card.Content>
          </Card>
        )}

        {filteredPosts.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400, padding: 20 }}>
            <Text style={{ color: subText, fontSize: 16, textAlign: 'center' }}>Empty</Text>
            {error && (
              <Text style={{ color: '#FF6B6B', fontSize: 12, textAlign: 'center', marginTop: 12, padding: 12 }}>
                {error}
              </Text>
            )}
          </View>
        ) : (
          filteredPosts.map((post) => (
            <FeedPost
              key={post.id}
              post={post}
              onDelete={(postId) => {
                // Post will be automatically removed from feed via real-time listener
              }}
            />
          ))
        )}
      </ScrollView>

      {/* Floating action button to create new post - bottom right of feed */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          right: 16,
          bottom: fabBottom,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: IU_CRIMSON,
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        }}
        onPress={() => setComposeVisible(true)}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

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
          avatar: 'https://i.pravatar.cc/100?img=12',
          location: userData?.location || 'Bloomington, IN' // Include location in fallback
        }}
        submitting={submitting}
      />

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
  );
}
