// Account screen - user profile and settings
import * as React from 'react';
import { View, ScrollView } from 'react-native';
import { Appbar, Avatar, Text, Button, Switch, List, Divider } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { signOutUser } from '../services/authService';
import { getCurrentLocation } from '../services/locationService';

export default function AccountScreen({ navigation }) {
  // State for user settings
  const [publicAlbums, setPublicAlbums] = React.useState(true);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [location, setLocation] = React.useState(''); // GPS-based city name
  const [loadingLocation, setLoadingLocation] = React.useState(true);
  const { isDarkMode, toggleTheme } = useTheme();
  const { user, userData, refreshUserData } = useAuth();

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

  // Get GPS location on mount and when screen comes into focus
  React.useEffect(() => {
    if (!user) {
      return;
    }
    
    // Get GPS location
    setLoadingLocation(true);
    getCurrentLocation()
      .then((locationData) => {
        if (locationData.error) {
          console.error('❌ Error getting location:', locationData.error);
          // Fallback to city name from userData if available
          setLocation(userData?.location || 'Location not available');
        } else {
          console.log('✅ GPS location obtained for Account screen:', locationData);
          setLocation(locationData.city || 'Unknown Location');
        }
      })
      .catch((error) => {
        console.error('❌ Error getting location:', error);
        // Fallback to city name from userData if available
        setLocation(userData?.location || 'Location not available');
      })
      .finally(() => {
        setLoadingLocation(false);
      });
  }, [user]);

  // Refresh user data when screen comes into focus (after editing profile)
  // Also refresh when component mounts to ensure data is fresh
  React.useEffect(() => {
    // Refresh immediately when screen loads
    if (user?.uid) {
      console.log('🔄 Refreshing user data on AccountScreen mount...');
      refreshUserData(user.uid);
    }
    
    const unsubscribe = navigation.addListener('focus', () => {
      // Refresh user data when returning to Account screen
      if (user?.uid) {
        console.log('🔄 Refreshing user data on screen focus...');
        refreshUserData(user.uid);
        
        // Also refresh GPS location
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
  
  // Theme colors based on dark/light mode
  const bgColor = isDarkMode ? '#121212' : '#FAFAFA';
  const surfaceColor = isDarkMode ? '#2A2A2A' : '#F5F4F2';
  const textColor = isDarkMode ? '#E6E8F0' : '#1A1A1A';
  const subTextColor = isDarkMode ? '#8A90A6' : '#666666';
  const dividerColor = isDarkMode ? '#3A3A3A' : '#D0CFCD';
  
  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* Header */}
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: bgColor }}>
        <Appbar.Content title="Account" color={textColor} />
      </Appbar.Header>
      
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* User profile section */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <Avatar.Image size={96} source={{ uri: userData?.avatar || 'https://i.pravatar.cc/200?img=12' }} />
          <Text variant="titleLarge" style={{ color: textColor, marginTop: 8 }}>@{userData?.username || userData?.user || 'username'}</Text>
          
          {/* Bio */}
          {userData?.bio && (
            <Text style={{ color: textColor, marginTop: 8, textAlign: 'center', paddingHorizontal: 20, fontSize: 14 }}>
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
    </View>
  );
}
