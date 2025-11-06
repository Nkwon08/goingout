// Profile screen - user profile with tabs for posts and settings
import * as React from 'react';
import { View, ScrollView, FlatList, RefreshControl, TouchableOpacity, Image, Modal, Dimensions, StyleSheet, Platform, StatusBar } from 'react-native';
import { Appbar, Avatar, Text, Button, Switch, List, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { signOutUser } from '../services/authService';
import { getCurrentLocation } from '../services/locationService';
import { subscribeToUserPosts } from '../services/postsService';
import FeedPost from '../components/FeedPost';
import { useThemeColors } from '../hooks/useThemeColors';

const IU_CRIMSON = '#990000';
// Header height: Appbar.Header is typically 56px on Android, 44px on iOS, plus status bar
const HEADER_HEIGHT = Platform.OS === 'ios' ? 44 : 56;
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 0 : StatusBar.currentHeight || 0;
const TOTAL_HEADER_HEIGHT = HEADER_HEIGHT + STATUS_BAR_HEIGHT;

// All Posts Screen Component - displays all posts in 3 columns
function AllPostsScreen({ posts, visible, onClose, navigation }) {
  const { background, text, subText, surface } = useThemeColors();
  const { isDarkMode } = useTheme();
  const [selectedPostIndex, setSelectedPostIndex] = React.useState(null);
  const flatListRef = React.useRef(null);

  const screenWidth = Dimensions.get('window').width;
  const gridPadding = 16;
  const gridGap = 2;
  const itemSize = (screenWidth - (gridPadding * 2) - (gridGap * 2)) / 3;

  const handlePostPress = (post) => {
    const index = posts.findIndex(p => p.id === post.id);
    if (index !== -1) {
      setSelectedPostIndex(index);
    }
  };

  const handleCloseModal = () => {
    setSelectedPostIndex(null);
  };

  const postsWithImages = posts.filter(post => (post.images || []).length > 0);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: background }}>
        <Appbar.Header mode="center-aligned" style={{ backgroundColor: background }}>
          <Appbar.Action 
            icon="arrow-left" 
            color={text} 
            onPress={onClose}
          />
          <Appbar.Content title="All Posts" color={text} />
        </Appbar.Header>
        <ScrollView 
          contentContainerStyle={{
            padding: gridPadding,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: gridGap,
          }}
        >
          {postsWithImages.map((post) => {
            const images = post.images || [];
            const firstImage = images[0];
            if (!firstImage) return null;
            
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
                <Image
                  source={{ uri: firstImage }}
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                  resizeMode="cover"
                />
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
        </ScrollView>

        {/* Modal for viewing post */}
        {selectedPostIndex !== null && postsWithImages.length > 0 && (
          <Modal
            visible={selectedPostIndex !== null}
            transparent={false}
            animationType="slide"
            onRequestClose={handleCloseModal}
          >
            <View style={{ flex: 1, backgroundColor: background }}>
              <Appbar.Header mode="center-aligned" style={{ backgroundColor: background }}>
                <Appbar.Action 
                  icon="arrow-left" 
                  color={text} 
                  onPress={handleCloseModal}
                />
                <Appbar.Content title="" color={text} />
              </Appbar.Header>
              <FlatList
                ref={flatListRef}
                data={postsWithImages}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => (
                  <View style={{ width: '100%' }}>
                    <FeedPost post={item} />
                  </View>
                )}
              />
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

// Friends List Modal Component
function FriendsListModal({ visible, onClose, friendsList, navigation }) {
  const { background, text, subText, surface } = useThemeColors();
  const { isDarkMode } = useTheme();
  const [friendsWithData, setFriendsWithData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!visible || !friendsList || friendsList.length === 0) {
      setFriendsWithData([]);
      setLoading(false);
      return;
    }

    const loadFriendsData = async () => {
      setLoading(true);
      try {
        const { getUserById } = await import('../services/usersService');
        const friendsData = await Promise.all(
          friendsList.map(async (username) => {
            try {
              const { userData } = await getUserById(username);
              return userData;
            } catch (error) {
              console.error(`Error loading friend ${username}:`, error);
              return null;
            }
          })
        );
        setFriendsWithData(friendsData.filter(Boolean));
      } catch (error) {
        console.error('Error loading friends data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFriendsData();
  }, [visible, friendsList]);

  const handleFriendPress = (friend) => {
    if (!friend?.username) return;
    onClose();
    // Navigate to user profile
    let rootNavigator = navigation;
    let parent = navigation.getParent();
    while (parent) {
      rootNavigator = parent;
      parent = parent.getParent();
    }
    rootNavigator.navigate('UserProfileModal', { username: friend.username });
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: background }}>
        <Appbar.Header mode="center-aligned" style={{ backgroundColor: background }}>
          <Appbar.Action 
            icon="arrow-left" 
            color={text} 
            onPress={onClose}
          />
          <Appbar.Content title="Friends" color={text} />
        </Appbar.Header>
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: text }}>Loading friends...</Text>
          </View>
        ) : friendsWithData.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={{ color: subText, fontSize: 16, textAlign: 'center' }}>
              No friends yet
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {friendsWithData.map((friend) => (
              <TouchableOpacity
                key={friend.username}
                onPress={() => handleFriendPress(friend)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: isDarkMode ? '#3A3A3A' : '#D0CFCD',
                }}
              >
                <Avatar.Image 
                  size={50} 
                  source={{ uri: friend.photoURL || friend.avatar || 'https://i.pravatar.cc/200?img=12' }}
                />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ color: text, fontSize: 16, fontWeight: '600' }}>
                    {friend.name || friend.username}
                  </Text>
                  <Text style={{ color: subText, fontSize: 14 }}>
                    @{friend.username}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// Settings Tab Component
function SettingsTab({ navigation, user, userData, isDarkMode, toggleTheme, publicAlbums, setPublicAlbums, location, loadingLocation, loggingOut, handleLogout, bgColor, surfaceColor, textColor, subTextColor, dividerColor }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* Settings section */}
      <View style={{ backgroundColor: surfaceColor, borderRadius: 16, padding: 12, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: textColor }}>Show Public Albums</Text>
          <Switch value={publicAlbums} onValueChange={setPublicAlbums} />
        </View>
        <View style={{ height: 1, backgroundColor: dividerColor, marginVertical: 8 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: textColor }}>Dark Mode</Text>
          <Switch value={isDarkMode} onValueChange={toggleTheme} />
        </View>
      </View>

      {/* Menu items */}
      <View style={{ backgroundColor: surfaceColor, borderRadius: 16 }}>
        <List.Item 
          title="Location" 
          description={loadingLocation ? 'Getting location...' : (location || 'Location not available')}
          titleStyle={{ color: textColor }} 
          descriptionStyle={{ color: subTextColor }}
          left={(p) => <List.Icon {...p} color={textColor} icon="map-marker-outline" />} 
          onPress={() => {
            if (loadingLocation) {
              alert('Getting your location...\n\nPlease wait.');
            } else {
              alert(`Current location: ${location || 'Location not available'}\n\nLocation is automatically detected from GPS.`);
            }
          }}
        />
        <Divider style={{ backgroundColor: dividerColor }} />
        <List.Item 
          title="Edit Profile" 
          titleStyle={{ color: textColor }} 
          left={(p) => <List.Icon {...p} color={textColor} icon="account-edit-outline" />} 
          onPress={() => navigation.navigate('EditProfile')}
        />
        <Divider style={{ backgroundColor: dividerColor }} />
        {/* TEMPORARY: Debug button - test username storage */}
        <List.Item 
          title="Debug Usernames" 
          description="Test username storage and list all usernames"
          titleStyle={{ color: '#FFA500' }} 
          descriptionStyle={{ color: subTextColor, fontSize: 12 }}
          left={(p) => <List.Icon {...p} color="#FFA500" icon="database-sync-outline" />} 
          onPress={async () => {
            const { debugListUsernames } = await import('../services/usersService');
            await debugListUsernames(50);
            alert('Check console for username list');
          }}
        />
        <Divider style={{ backgroundColor: dividerColor }} />
        <List.Item title="Privacy" titleStyle={{ color: textColor }} left={(p) => <List.Icon {...p} color={textColor} icon="shield-outline" />} onPress={() => {}} />
        <Divider style={{ backgroundColor: dividerColor }} />
        <List.Item title="Help" titleStyle={{ color: textColor }} left={(p) => <List.Icon {...p} color={textColor} icon="help-circle-outline" />} onPress={() => {}} />
        <Divider style={{ backgroundColor: dividerColor }} />
        <List.Item
          title="Logout"
          titleStyle={{ color: '#FF6B6B' }}
          left={(p) => <List.Icon {...p} color="#FF6B6B" icon="logout" />}
          onPress={handleLogout}
          disabled={loggingOut}
        />
      </View>
    </ScrollView>
  );
}

export default function ProfileScreen({ navigation }) {
  // State for user settings
  const [publicAlbums, setPublicAlbums] = React.useState(true);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [location, setLocation] = React.useState('');
  const [loadingLocation, setLoadingLocation] = React.useState(true);
  const [showSettings, setShowSettings] = React.useState(false);
  const [posts, setPosts] = React.useState([]);
  const [postsLoading, setPostsLoading] = React.useState(true);
  const [showAllPosts, setShowAllPosts] = React.useState(false);
  const [showFriendsList, setShowFriendsList] = React.useState(false);
  const [selectedPost, setSelectedPost] = React.useState(null);
  const [avatarKey, setAvatarKey] = React.useState(0);
  
  const { isDarkMode, toggleTheme } = useTheme();
  const { user, userData, refreshUserData, friendsList } = useAuth();
  const themeColors = useThemeColors();
  
  // Update avatar key when photoURL changes to force image reload
  const prevPhotoURL = React.useRef(userData?.photoURL || userData?.avatar);
  React.useEffect(() => {
    const currentPhotoURL = userData?.photoURL || userData?.avatar;
    if (currentPhotoURL && currentPhotoURL !== prevPhotoURL.current) {
      prevPhotoURL.current = currentPhotoURL;
      setAvatarKey(prev => prev + 1);
    }
  }, [userData?.photoURL, userData?.avatar]);
  
  // Logout handler
  const handleLogout = React.useCallback(async () => {
    try {
      setLoggingOut(true);
      console.log('🔄 Logging out user...');
      const result = await signOutUser();
      if (result.error) {
        console.error('❌ Logout error:', result.error);
        alert('Logout failed: ' + result.error);
        setLoggingOut(false);
      } else {
        console.log('✅ Logout successful');
        // Don't set loggingOut to false - let auth state change handle navigation
        // The App.js will handle showing AuthStack when user becomes null
      }
    } catch (error) {
      console.error('❌ Logout exception:', error);
      alert('Logout failed: ' + (error.message || 'Unknown error'));
      setLoggingOut(false);
    }
  }, []);
  
  // Theme colors based on dark/light mode
  const bgColor = isDarkMode ? '#1A1A1A' : '#EEEDEB';
  const surfaceColor = isDarkMode ? '#2A2A2A' : '#F5F4F2';
  const textColor = isDarkMode ? '#E6E8F0' : '#1A1A1A';
  const subTextColor = isDarkMode ? '#8A90A6' : '#666666';
  const dividerColor = isDarkMode ? '#3A3A3A' : '#D0CFCD';

  // Get GPS location on mount and when screen comes into focus
  React.useEffect(() => {
    if (!user) {
      return;
    }
    
    setLoadingLocation(true);
    getCurrentLocation()
      .then((locationData) => {
        if (locationData.error) {
          console.error('❌ Error getting location:', locationData.error);
          setLocation(userData?.location || 'Location not available');
        } else {
          console.log('✅ GPS location obtained for Profile screen:', locationData);
          setLocation(locationData.city || 'Unknown Location');
        }
      })
      .catch((error) => {
        console.error('❌ Error getting location:', error);
        setLocation(userData?.location || 'Location not available');
      })
      .finally(() => {
        setLoadingLocation(false);
      });
  }, [user]);

  // Load posts for statistics and "My works" section
  React.useEffect(() => {
    if (!user?.uid) {
      return;
    }

    const unsubscribe = subscribeToUserPosts(
      user.uid,
      (result) => {
        if (result.error) {
          console.error('Error loading posts:', result.error);
        } else {
          setPosts(result.posts);
        }
        setPostsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Refresh user data when screen comes into focus
  React.useEffect(() => {
    if (user?.uid) {
      console.log('🔄 Refreshing user data on ProfileScreen mount...');
      refreshUserData(user.uid);
    }
    
    const unsubscribe = navigation.addListener('focus', () => {
      if (user?.uid) {
        console.log('🔄 Refreshing user data on screen focus...');
        // Reduced delay to make refresh faster while still ensuring Firestore has updated
        setTimeout(() => {
          refreshUserData(user.uid);
          console.log('✅ ProfileScreen refresh completed');
        }, 800); // Reduced from 2000ms to 800ms
        
        setLoadingLocation(true);
        getCurrentLocation()
          .then((locationData) => {
            if (locationData.error) {
              setLocation(userData?.location || 'Location not available');
            } else {
              setLocation(locationData.city || 'Unknown Location');
            }
          })
          .catch((error) => {
            setLocation(userData?.location || 'Location not available');
          })
          .finally(() => {
            setLoadingLocation(false);
          });
      }
    });

    return unsubscribe;
  }, [navigation, user, refreshUserData]);

  // Calculate statistics
  const photosCount = posts.filter(post => (post.images || []).length > 0).length;
  const followersCount = friendsList?.length || 0;
  const followingCount = friendsList?.length || 0; // Mutual friendships

  // Get work posts (posts with images) for "My works" section
  const workPosts = posts.filter(post => (post.images || []).length > 0).slice(0, 10);


  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: 'transparent', elevation: 0 }}>
        <View style={{ width: 40 }} />
        <Appbar.Content title="PROFILE" titleStyle={{ color: '#FFFFFF', fontWeight: '600' }} />
        <Appbar.Action 
          icon="cog" 
          color="#FFFFFF" 
          onPress={() => setShowSettings(true)}
        />
      </Appbar.Header>

      {/* Black Background */}
      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#000000' }} />

      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ 
          paddingBottom: 20, 
          paddingTop: TOTAL_HEADER_HEIGHT // Minimal padding to raise profile section
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Dark Grey Profile Card */}
        <View style={{
          backgroundColor: '#2A2A2A',
          marginHorizontal: 16,
          marginTop: 0,
          borderRadius: 20,
          paddingTop: 70,
          paddingBottom: 24,
          paddingHorizontal: 20,
          marginBottom: 20,
          alignItems: 'center',
        }}>
          {/* Profile Picture - Overlapping with background */}
          <View style={{
            position: 'absolute',
            top: -40,
            width: 120,
            height: 120,
            borderRadius: 60,
            overflow: 'hidden',
            borderWidth: 4,
            borderColor: '#2A2A2A',
            backgroundColor: '#2A2A2A',
          }}>
            <Avatar.Image 
              key={`avatar-${avatarKey}`}
              size={120} 
              source={{ 
                uri: (userData?.photoURL || userData?.avatar || 'https://i.pravatar.cc/200?img=12') + (userData?.photoURL || userData?.avatar ? `?t=${avatarKey}` : '')
              }}
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          </View>

          {/* Username */}
          <Text style={{
            fontSize: 20,
            fontWeight: '700',
            color: IU_CRIMSON,
            textAlign: 'center',
            marginTop: 8,
          }}>
            @{userData?.username || userData?.user || 'username'}
          </Text>

          {/* Name */}
          {userData?.name && (
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#FFFFFF',
              textAlign: 'center',
              marginTop: 4,
            }}>
              {userData.name}
            </Text>
          )}

          {/* Bio */}
          {userData?.bio && (
            <Text style={{
              fontSize: 14,
              color: '#CCCCCC',
              textAlign: 'center',
              marginTop: 12,
              paddingHorizontal: 0,
            }}>
              {userData.bio}
            </Text>
          )}

          {/* Age and Gender */}
          {(userData?.age || userData?.gender) && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 8,
              gap: 12,
            }}>
              {userData.age && (
                <Text style={{
                  fontSize: 14,
                  color: '#CCCCCC',
                }}>
                  {userData.age} years old
                </Text>
              )}
              {userData.gender && (
                <Text style={{
                  fontSize: 14,
                  color: '#CCCCCC',
                }}>
                  {userData.gender}
                </Text>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'center',
            marginTop: 20,
            gap: 12,
          }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('EditProfile')}
              style={{
                flex: 1,
                backgroundColor: IU_CRIMSON,
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{
                color: '#FFFFFF',
                fontWeight: '600',
                fontSize: 14,
              }}>
                EDIT PROFILE
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowSettings(true)}
              style={{
                flex: 1,
                backgroundColor: '#2A2A2A',
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: IU_CRIMSON,
              }}
            >
              <Text style={{
                color: IU_CRIMSON,
                fontWeight: '600',
                fontSize: 14,
              }}>
                SETTINGS
              </Text>
            </TouchableOpacity>
          </View>

          {/* Statistics Row */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 24,
            paddingTop: 24,
            borderTopWidth: 1,
            borderTopColor: '#444444',
          }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{
                fontSize: 20,
                fontWeight: '700',
                color: '#FFFFFF',
              }}>
                {photosCount}
              </Text>
              <Text style={{
                fontSize: 12,
                color: '#CCCCCC',
                marginTop: 4,
                fontWeight: '500',
              }}>
                PHOTOS
              </Text>
            </View>
            <View style={{
              width: 1,
              height: 40,
              backgroundColor: '#444444',
            }} />
            <TouchableOpacity 
              style={{ flex: 1, alignItems: 'center' }}
              onPress={() => setShowFriendsList(true)}
            >
              <Text style={{
                fontSize: 20,
                fontWeight: '700',
                color: IU_CRIMSON,
              }}>
                {friendsList?.length || 0}
              </Text>
              <Text style={{
                fontSize: 12,
                color: IU_CRIMSON,
                marginTop: 4,
                fontWeight: '500',
              }}>
                FRIENDS
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* My works Section */}
        {workPosts.length > 0 && (
          <View style={{
            marginHorizontal: 16,
            marginBottom: 24,
            backgroundColor: '#2A2A2A',
            borderRadius: 20,
            padding: 16,
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#FFFFFF',
              }}>
                Posts
              </Text>
              <TouchableOpacity onPress={() => setShowAllPosts(true)}>
                <Text style={{
                  fontSize: 14,
                  color: '#CCCCCC',
                }}>
                  View all
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12 }}
            >
              {workPosts.map((post) => {
                const images = post.images || [];
                const firstImage = images[0];
                if (!firstImage) return null;
                
                return (
                  <TouchableOpacity
                    key={post.id}
                    onPress={() => setSelectedPost(post)}
                    style={{
                      width: 160,
                      height: 200,
                      borderRadius: 12,
                      overflow: 'hidden',
                      backgroundColor: '#1A1A1A',
                    }}
                  >
                    <Image
                      source={{ uri: firstImage }}
                      style={{
                        width: '100%',
                        height: '100%',
                      }}
                      resizeMode="cover"
                    />
                    <View style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.6)',
                      padding: 12,
                    }}>
                      <Text style={{
                        color: '#FFFFFF',
                        fontWeight: '600',
                        fontSize: 14,
                      }}>
                        {post.text || 'Post'}
                      </Text>
                      <Text style={{
                        color: '#FFFFFF',
                        fontSize: 12,
                        marginTop: 4,
                      }}>
                        {images.length} {images.length === 1 ? 'photo' : 'photos'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Social media Section */}
        {(userData?.instagram || userData?.twitter || userData?.facebook) && (
          <View style={{
            marginHorizontal: 16,
            marginBottom: 24,
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: 12,
            }}>
              Social media
            </Text>
            <View style={{
              backgroundColor: '#2A2A2A',
              borderRadius: 20,
              padding: 16,
            }}>
              {userData?.instagram && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 12,
                }}>
                  <MaterialCommunityIcons name="instagram" size={20} color="#E4405F" />
                  <Text style={{
                    marginLeft: 12,
                    color: '#CCCCCC',
                    fontSize: 14,
                  }}>
                    @{userData.instagram}
                  </Text>
                </View>
              )}
              {userData?.twitter && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 12,
                }}>
                  <MaterialCommunityIcons name="twitter" size={20} color="#1DA1F2" />
                  <Text style={{
                    marginLeft: 12,
                    color: '#CCCCCC',
                    fontSize: 14,
                  }}>
                    @{userData.twitter}
                  </Text>
                </View>
              )}
              {userData?.facebook && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                  <MaterialCommunityIcons name="facebook" size={20} color="#1877F2" />
                  <Text style={{
                    marginLeft: 12,
                    color: '#CCCCCC',
                    fontSize: 14,
                  }}>
                    /{userData.facebook}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* All Posts Modal */}
      <AllPostsScreen 
        posts={posts} 
        visible={showAllPosts}
        onClose={() => setShowAllPosts(false)}
        navigation={navigation}
      />

      {/* Friends List Modal */}
      <FriendsListModal
        visible={showFriendsList}
        onClose={() => setShowFriendsList(false)}
        friendsList={friendsList || []}
        navigation={navigation}
      />

      {/* Selected Post Modal */}
      {selectedPost && (
        <Modal
          visible={selectedPost !== null}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setSelectedPost(null)}
        >
          <View style={{ flex: 1, backgroundColor: '#000000' }}>
            <Appbar.Header mode="center-aligned" style={{ backgroundColor: '#000000' }}>
              <Appbar.Action 
                icon="arrow-left" 
                color="#FFFFFF" 
                onPress={() => setSelectedPost(null)}
              />
              <Appbar.Content title="" color="#FFFFFF" />
            </Appbar.Header>
            <ScrollView 
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            >
              <FeedPost post={selectedPost} />
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <View style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: isDarkMode ? '#1A1A1A' : '#EEEDEB',
          zIndex: 1000
        }}>
          <Appbar.Header mode="center-aligned" style={{ backgroundColor: isDarkMode ? '#1A1A1A' : '#EEEDEB' }}>
            <Appbar.Action 
              icon="arrow-left" 
              color={isDarkMode ? '#E6E8F0' : '#1A1A1A'} 
              onPress={() => setShowSettings(false)}
            />
            <Appbar.Content title="Settings" color={isDarkMode ? '#E6E8F0' : '#1A1A1A'} />
          </Appbar.Header>
          <SettingsTab
            navigation={navigation}
            user={user}
            userData={userData}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
            publicAlbums={publicAlbums}
            setPublicAlbums={setPublicAlbums}
            location={location}
            loadingLocation={loadingLocation}
            loggingOut={loggingOut}
            handleLogout={handleLogout}
            bgColor={isDarkMode ? '#1A1A1A' : '#EEEDEB'}
            surfaceColor={isDarkMode ? '#2A2A2A' : '#F5F4F2'}
            textColor={isDarkMode ? '#E6E8F0' : '#1A1A1A'}
            subTextColor={isDarkMode ? '#8A90A6' : '#666666'}
            dividerColor={isDarkMode ? '#3A3A3A' : '#D0CFCD'}
          />
        </View>
      )}
    </View>
  );
}
