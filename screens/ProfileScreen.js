// Profile screen - user profile with tabs for posts and settings
import * as React from 'react';
import { View, ScrollView, FlatList, RefreshControl } from 'react-native';
import { Appbar, Avatar, Text, Button, Switch, List, Divider } from 'react-native-paper';
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
  const { text, subText, background } = themeColors;

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
        setLoading(false);
        setRefreshing(false);
      },
      100 // Get up to 100 posts
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const handleRefresh = () => {
    setRefreshing(true);
    // Real-time listener will automatically update
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderPost = ({ item }) => (
    <FeedPost post={item} onDelete={() => {}} />
  );

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

  return (
    <FlatList
      data={posts}
      renderItem={renderPost}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
      showsVerticalScrollIndicator={false}
    />
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
  const [index, setIndex] = React.useState(0);
  const [routes] = React.useState([
    { key: 'posts', title: 'Posts' },
    { key: 'settings', title: 'Settings' },
  ]);
  
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

  const renderScene = () => {
    if (index === 0) {
      return <PostsTab user={user} userData={userData} themeColors={themeColors} />;
    } else {
      return (
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
      );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* Header */}
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: bgColor }}>
        <Appbar.Content title="Profile" color={textColor} />
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

      {/* Tab Buttons */}
      <View style={{ flexDirection: 'row', backgroundColor: bgColor, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: dividerColor }}>
        <Button
          mode={index === 0 ? 'contained' : 'text'}
          buttonColor={index === 0 ? IU_CRIMSON : 'transparent'}
          textColor={index === 0 ? '#FFFFFF' : textColor}
          onPress={() => setIndex(0)}
          style={{ flex: 1, marginRight: 8 }}
        >
          Posts
        </Button>
        <Button
          mode={index === 1 ? 'contained' : 'text'}
          buttonColor={index === 1 ? IU_CRIMSON : 'transparent'}
          textColor={index === 1 ? '#FFFFFF' : textColor}
          onPress={() => setIndex(1)}
          style={{ flex: 1, marginLeft: 8 }}
        >
          Settings
        </Button>
      </View>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {renderScene()}
      </View>
    </View>
  );
}

