// Profile screen - user profile with tabs for posts and settings
import * as React from 'react';
import { View, ScrollView, FlatList, RefreshControl, TouchableOpacity, Image, Modal, Dimensions, StyleSheet, Platform, StatusBar, TextInput, Alert } from 'react-native';
import { Appbar, Avatar, Text, Button, Switch, List, Divider, TextInput as PaperTextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import UserAvatar from '../components/UserAvatar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useRoute } from '@react-navigation/native';
import { signOutUser } from '../services/authService';
import { deleteAccount } from '../services/authService';
import { getCurrentLocation } from '../services/locationService';
import { subscribeToUserPosts } from '../services/postsService';
import FeedPost from '../components/FeedPost';
import { useThemeColors } from '../hooks/useThemeColors';
import { getCardBorderOnly } from '../utils/cardStyles';

const IU_CRIMSON = '#CC0000';
// Header height: Appbar.Header is typically 56px on Android, 44px on iOS, plus status bar
const HEADER_HEIGHT = Platform.OS === 'ios' ? 44 : 56;
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 0 : StatusBar.currentHeight || 0;
const TOTAL_HEADER_HEIGHT = HEADER_HEIGHT + STATUS_BAR_HEIGHT;

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
                  borderBottomColor: isDarkMode ? '#2A2A2A' : '#E0E0E0',
                }}
              >
                <UserAvatar 
                  size={50} 
                  uri={friend.photoURL || friend.avatar}
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
  const [showDeleteAccountModal, setShowDeleteAccountModal] = React.useState(false);
  const [deleteEmail, setDeleteEmail] = React.useState('');
  const [deletePassword, setDeletePassword] = React.useState('');
  const [deletingAccount, setDeletingAccount] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState('');

  const handleDeleteAccountPress = () => {
    setDeleteEmail('');
    setDeletePassword('');
    setDeleteError('');
    setShowDeleteAccountModal(true);
  };

  const handleDeleteAccount = async () => {
    if (!deleteEmail.trim() || !deletePassword.trim()) {
      setDeleteError('Please enter both email and password');
      return;
    }

    setDeletingAccount(true);
    setDeleteError('');

    try {
      const result = await deleteAccount(deleteEmail.trim(), deletePassword);
      
      if (result.success) {
        Alert.alert(
          'Account Deleted',
          'Your account has been permanently deleted. You will be signed out.',
          [{ text: 'OK' }]
        );
        // The auth state change will handle navigation automatically
      } else {
        setDeleteError(result.error || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      setDeleteError(error.message || 'Failed to delete account');
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* Settings section */}
      <View style={{ 
        backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)',
        borderRadius: 20,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
      }}>
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
      <View style={{ 
        backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
      }}>
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
        <List.Item 
          title="Blocked Users" 
          titleStyle={{ color: textColor }} 
          left={(p) => <List.Icon {...p} color={textColor} icon="account-cancel-outline" />} 
          onPress={() => navigation.navigate('BlockedUsers')}
        />
        <Divider style={{ backgroundColor: dividerColor }} />
        <List.Item title="Privacy" titleStyle={{ color: textColor }} left={(p) => <List.Icon {...p} color={textColor} icon="shield-outline" />} onPress={() => navigation.navigate('Privacy')} />
        <Divider style={{ backgroundColor: dividerColor }} />
        <List.Item title="Help" titleStyle={{ color: textColor }} left={(p) => <List.Icon {...p} color={textColor} icon="help-circle-outline" />} onPress={() => navigation.navigate('Help')} />
        <Divider style={{ backgroundColor: dividerColor }} />
        <List.Item
          title="Delete Account"
          titleStyle={{ color: '#FF6B6B' }}
          left={(p) => <List.Icon {...p} color="#FF6B6B" icon="delete-forever-outline" />}
          onPress={handleDeleteAccountPress}
        />
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

    {/* Delete Account Modal */}
    <Modal
      visible={showDeleteAccountModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => !deletingAccount && setShowDeleteAccountModal(false)}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', padding: 20 }}>
        <View style={{ 
          backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)',
          borderRadius: 20,
          padding: 24,
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 4,
        }}>
          <Text style={{ color: textColor, fontSize: 20, fontWeight: '600', marginBottom: 8 }}>
            Delete Account
          </Text>
          <Text style={{ color: subTextColor, fontSize: 14, marginBottom: 24 }}>
            This action cannot be undone. All your data will be permanently deleted. Please enter your email and password to confirm.
          </Text>

          <PaperTextInput
            label="Email"
            value={deleteEmail}
            onChangeText={setDeleteEmail}
            mode="outlined"
            autoCapitalize="none"
            keyboardType="email-address"
            disabled={deletingAccount}
            style={{ marginBottom: 16, backgroundColor: bgColor }}
            textColor={textColor}
            outlineColor={dividerColor}
            activeOutlineColor={textColor}
          />

          <PaperTextInput
            label="Password"
            value={deletePassword}
            onChangeText={setDeletePassword}
            mode="outlined"
            secureTextEntry
            disabled={deletingAccount}
            style={{ marginBottom: 16, backgroundColor: bgColor }}
            textColor={textColor}
            outlineColor={dividerColor}
            activeOutlineColor={textColor}
          />

          {deleteError ? (
            <Text style={{ color: '#FF6B6B', fontSize: 12, marginBottom: 16 }}>
              {deleteError}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button
              mode="outlined"
              onPress={() => {
                setShowDeleteAccountModal(false);
                setDeleteEmail('');
                setDeletePassword('');
                setDeleteError('');
              }}
              disabled={deletingAccount}
              style={{ flex: 1 }}
              textColor={textColor}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleDeleteAccount}
              disabled={deletingAccount || !deleteEmail.trim() || !deletePassword.trim()}
              loading={deletingAccount}
              buttonColor="#FF6B6B"
              textColor="#fff"
              style={{ flex: 1 }}
            >
              Delete Account
            </Button>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

export default function ProfileScreen({ navigation }) {
  const route = useRoute();
  const { highlightPostId } = route.params || {};
  
  // State for user settings
  const [publicAlbums, setPublicAlbums] = React.useState(true);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [location, setLocation] = React.useState('');
  const [loadingLocation, setLoadingLocation] = React.useState(true);
  const [showSettings, setShowSettings] = React.useState(false);
  const [posts, setPosts] = React.useState([]);
  const [postsLoading, setPostsLoading] = React.useState(true);
  const [showFriendsList, setShowFriendsList] = React.useState(false);
  const [selectedPost, setSelectedPost] = React.useState(null);
  const [avatarKey, setAvatarKey] = React.useState(0);
  
  
  // Track if we've already opened the post from highlightPostId to prevent reopening
  const hasOpenedHighlightPost = React.useRef(false);
  
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
  const bgColor = isDarkMode ? '#121212' : '#FAFAFA';
  const surfaceColor = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const textColor = isDarkMode ? '#E6E8F0' : '#1A1A1A';
  const subTextColor = isDarkMode ? '#8A90A6' : '#666666';
  const dividerColor = isDarkMode ? '#2A2A2A' : '#E0E0E0';

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

  // Listen for route params changes (for highlightPostId from navigation)
  React.useEffect(() => {
    // Reset the flag when highlightPostId changes (new notification tapped)
    if (highlightPostId) {
      hasOpenedHighlightPost.current = false;
    }
  }, [highlightPostId]);

  // Auto-open highlighted post when posts are loaded (from initial highlightPostId)
  React.useEffect(() => {
    if (highlightPostId && posts.length > 0 && !postsLoading && !selectedPost && !hasOpenedHighlightPost.current) {
      const post = posts.find(p => p.id === highlightPostId);
      if (post) {
        hasOpenedHighlightPost.current = true;
        // Small delay to ensure UI is ready
        setTimeout(() => {
          setSelectedPost(post);
        }, 300);
      }
    }
  }, [highlightPostId, posts, postsLoading, selectedPost]);

  // Handle closing the post modal - clear route params to prevent reopening
  const handleClosePost = React.useCallback(() => {
    setSelectedPost(null);
    // Clear the highlightPostId from route params
    if (highlightPostId) {
      navigation.setParams({ highlightPostId: undefined });
    }
  }, [highlightPostId, navigation]);

  // Calculate statistics
  const photosCount = posts.filter(post => (post.images || []).length > 0).length;
  const followersCount = friendsList?.length || 0;
  const followingCount = friendsList?.length || 0; // Mutual friendships

  // Get work posts (posts with images or videos) for "My works" section - show all posts
  const workPosts = posts.filter(post => {
    const images = post.images || [];
    const videos = post.videos || [];
    const video = post.video;
    return images.length > 0 || videos.length > 0 || !!video;
  });


  return (
    <LinearGradient
      colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1 }}>
        {/* Header */}
        <Appbar.Header mode="center-aligned" style={{ backgroundColor: 'transparent', elevation: 0 }}>
        <View style={{ width: 40 }} />
        <View style={{ flex: 1 }} />
        <View style={{ width: 40 }} />
      </Appbar.Header>

      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ 
          paddingBottom: 100, 
          paddingTop: TOTAL_HEADER_HEIGHT
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Dark Profile Card - Includes profile picture overlapping at top */}
        <View style={{
          backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.2)' : 'rgba(255, 255, 255, 0.3)',
          marginHorizontal: 16,
          marginTop: 20,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20,
          paddingTop: 70,
          paddingBottom: 24,
          paddingHorizontal: 20,
          marginBottom: 0,
          alignItems: 'center',
          ...getCardBorderOnly(),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 8,
        }}>
          {/* Profile Picture - Overlapping with background */}
          <View style={{
            position: 'absolute',
            top: -50,
            width: 120,
            height: 120,
            borderRadius: 60,
            overflow: 'hidden',
          }}>
            <UserAvatar 
              key={`avatar-${avatarKey}`}
              size={120} 
              uri={userData?.photoURL || userData?.avatar}
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
                borderRadius: 20,
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
                backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                paddingVertical: 12,
                borderRadius: 20,
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: IU_CRIMSON,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4,
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
            borderTopWidth: 0.5,
            borderTopColor: '#555555',
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
              width: 0.5,
              height: 40,
              backgroundColor: '#555555',
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

        {/* My works Section - 3x3 Grid */}
        {workPosts.length > 0 && (
          <View style={{
            marginHorizontal: 16,
            marginTop: 0,
            marginBottom: 24,
            backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.2)' : 'rgba(255, 255, 255, 0.3)',
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
            paddingHorizontal: 20,
            paddingVertical: 16,
            ...getCardBorderOnly(),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: 12,
            }}>
              Posts
            </Text>
            {(() => {
              const screenWidth = Dimensions.get('window').width;
              const containerMargin = 16 * 2; // marginHorizontal: 16 on each side (matches profile card)
              const cardPadding = 20 * 2; // paddingHorizontal: 20 on each side (matches profile card)
              const gridGap = 2; // 2px gap between items
              // Calculate item size to ensure exactly 3 fit per row
              // Total available width = screenWidth - margins - padding
              const totalAvailableWidth = screenWidth - containerMargin - cardPadding;
              // For 3 items with 2 gaps between them: itemSize * 3 + gap * 2 = totalAvailableWidth
              // So: itemSize = (totalAvailableWidth - gap * 2) / 3
              // Add 1px buffer to ensure they fit
              const itemSize = (totalAvailableWidth - (gridGap * 2) - 1) / 3;
              const itemHeight = itemSize * (4 / 3);
              
              return (
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  width: '100%',
                }}>
                  {workPosts.map((post, index) => {
                    const images = post.images || [];
                    const videos = post.videos || [];
                    const video = post.video;
                    const firstImage = images.length > 0 ? images[0] : null;
                    const firstVideo = videos.length > 0 ? videos[0] : (video || null);
                    const hasVideo = !!firstVideo;
                    const hasImage = !!firstImage;
                    
                    if (!firstImage && !firstVideo) return null;
                
                    return (
                      <TouchableOpacity
                        key={post.id}
                        onPress={() => setSelectedPost(post)}
                        style={{
                          width: itemSize,
                          height: itemHeight,
                          marginRight: index % 3 < 2 ? gridGap : 0, // Add gap after first and second item in each row
                          marginBottom: gridGap,
                          borderRadius: 4,
                          overflow: 'hidden',
                          backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)',
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
                              isLooping
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
                </View>
              );
            })()}
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
              backgroundColor: '#1E1E1E',
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
          onRequestClose={handleClosePost}
        >
          <View style={{ flex: 1, backgroundColor: '#000000' }}>
            <Appbar.Header mode="center-aligned" style={{ backgroundColor: '#000000' }}>
              <Appbar.Action 
                icon="arrow-left" 
                color="#FFFFFF" 
                onPress={handleClosePost}
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
          backgroundColor: isDarkMode ? '#121212' : '#FAFAFA',
          zIndex: 1000
        }}>
          <Appbar.Header mode="center-aligned" style={{ backgroundColor: isDarkMode ? '#121212' : '#FAFAFA' }}>
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
            bgColor={isDarkMode ? '#121212' : '#FAFAFA'}
            surfaceColor={isDarkMode ? '#1E1E1E' : '#FFFFFF'}
            textColor={isDarkMode ? '#E6E8F0' : '#1A1A1A'}
            subTextColor={isDarkMode ? '#8A90A6' : '#666666'}
            dividerColor={isDarkMode ? '#2A2A2A' : '#E0E0E0'}
          />
        </View>
      )}
      </View>
    </LinearGradient>
  );
}
