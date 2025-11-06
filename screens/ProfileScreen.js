// Profile screen - user profile with tabs for posts and settings
import * as React from 'react';
import { View, ScrollView, FlatList, RefreshControl, TouchableOpacity, Image, Modal, Dimensions } from 'react-native';
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

// Posts Tab Component
function PostsTab({ user, userData, themeColors }) {
  const [posts, setPosts] = React.useState([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [selectedPost, setSelectedPost] = React.useState(null);
  const [containerHeight, setContainerHeight] = React.useState(0);
  const { text, subText, background, surface } = themeColors;
  const { isDarkMode } = useTheme();

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
          // Limit to 9 posts for 3x3 grid
          setPosts(result.posts.slice(0, 9));
        }
        setLoading(false);
        setRefreshing(false);
      },
      9 // Get up to 9 posts
    );

    return () => unsubscribe();
  }, [user?.uid]);

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
          No posts yet. Start sharing your moments!
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

// Settings Tab Component
function SettingsTab({ navigation, user, userData, isDarkMode, toggleTheme, publicAlbums, setPublicAlbums, location, loadingLocation, loggingOut, bgColor, surfaceColor, textColor, subTextColor, dividerColor }) {
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
          onPress={async () => {
            setLoggingOut(true);
            await signOutUser();
            setLoggingOut(false);
          }}
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
  
  const { isDarkMode, toggleTheme } = useTheme();
  const { user, userData, refreshUserData } = useAuth();
  const themeColors = useThemeColors();
  
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

  // Refresh user data when screen comes into focus
  React.useEffect(() => {
    if (user?.uid) {
      console.log('🔄 Refreshing user data on ProfileScreen mount...');
      refreshUserData(user.uid);
    }
    
    const unsubscribe = navigation.addListener('focus', () => {
      if (user?.uid) {
        console.log('🔄 Refreshing user data on screen focus...');
        refreshUserData(user.uid);
        
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


  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* Header */}
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: bgColor }}>
        <Appbar.Content title="Profile" color={textColor} />
        <Appbar.Action 
          icon="cog" 
          color={textColor} 
          onPress={() => setShowSettings(true)}
        />
      </Appbar.Header>
      
      {/* Profile Header Section */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 20, backgroundColor: bgColor }}>
        {/* Profile Photo on the left */}
        <Avatar.Image size={96} source={{ uri: userData?.photoURL || userData?.avatar || 'https://i.pravatar.cc/200?img=12' }} />
        
        {/* User info on the right */}
        <View style={{ flex: 1, marginLeft: 16, justifyContent: 'center' }}>
          {/* Username */}
          <Text variant="titleLarge" style={{ color: textColor }}>
            @{userData?.username || userData?.user || 'username'}
          </Text>
          
          {/* Name */}
          {userData?.name && (
            <Text variant="titleMedium" style={{ color: textColor, marginTop: 4 }}>
              {userData.name}
            </Text>
          )}
          
          {/* Bio */}
          {userData?.bio && (
            <Text style={{ color: subTextColor, marginTop: 8, fontSize: 14 }}>
              {userData.bio}
            </Text>
          )}
          
          {/* Age and Gender */}
          {(userData?.age || userData?.gender) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
              {userData.age && (
                <Text style={{ color: subTextColor, fontSize: 14 }}>
                  {userData.age} years old
                </Text>
              )}
              {userData.gender && (
                <Text style={{ color: subTextColor, fontSize: 14 }}>
                  {userData.gender}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Posts Content - Always visible */}
      <View style={{ flex: 1 }}>
        <PostsTab user={user} userData={userData} themeColors={themeColors} />
      </View>

      {/* Settings Modal */}
      {showSettings && (
        <View style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: bgColor,
          zIndex: 1000
        }}>
          <Appbar.Header mode="center-aligned" style={{ backgroundColor: bgColor }}>
            <Appbar.Action 
              icon="arrow-left" 
              color={textColor} 
              onPress={() => setShowSettings(false)}
            />
            <Appbar.Content title="Settings" color={textColor} />
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
            bgColor={bgColor}
            surfaceColor={surfaceColor}
            textColor={textColor}
            subTextColor={subTextColor}
            dividerColor={dividerColor}
          />
        </View>
      )}
    </View>
  );
}

