// Profile stack navigation - handles profile screen and edit profile
import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';

const Stack = createNativeStackNavigator();

// Component to handle tab press listener
function ProfileStackContent() {
  const navigation = useNavigation();
  
  // Listen for tab press to reset stack to ProfileMain
  React.useEffect(() => {
    // Get the parent navigator (bottom tabs)
    const parent = navigation.getParent();
    
    const handleTabPress = (e) => {
      // Always reset to ProfileMain when Profile tab is pressed
      // This ensures clicking the Profile tab always shows your own profile
      const state = navigation.getState();
      const currentRoute = state?.routes?.[state?.index];
      
      // If we're not already on ProfileMain, reset to it
      if (currentRoute?.name !== 'ProfileMain') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'ProfileMain' }],
        });
      }
    };
    
    // Listen for tab press on the parent navigator
    const unsubscribeTabPress = parent?.addListener?.('tabPress', (e) => {
      // Only handle if it's the Profile tab
      if (e.target?.includes('Profile')) {
        handleTabPress(e);
      }
    });
    
    // Also listen for focus events as a backup
    const unsubscribeFocus = navigation?.addListener?.('focus', () => {
      // When Profile stack comes into focus, check if we need to reset
      const state = navigation.getState();
      const currentRoute = state?.routes?.[state?.index];
      
      // If we're on UserProfile (someone else's profile), reset to ProfileMain
      if (currentRoute?.name === 'UserProfile') {
        // Use setTimeout to avoid navigation during render
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'ProfileMain' }],
          });
        }, 0);
      }
    });

    return () => {
      if (unsubscribeTabPress) unsubscribeTabPress();
      if (unsubscribeFocus) unsubscribeFocus();
    };
  }, [navigation]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        // Use presentation: 'card' to preserve navigation history
        presentation: 'card',
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
        options={{
          presentation: 'card',
        }}
      />
      <Stack.Screen 
        name="UserProfile" 
        component={UserProfileScreen}
        options={{
          presentation: 'card',
          // This ensures the back button works correctly
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen 
        name="BlockedUsers" 
        component={BlockedUsersScreen}
        options={{
          presentation: 'card',
          animation: 'slide_from_right',
        }}
      />
    </Stack.Navigator>
  );
}

export default function ProfileStack() {
  return <ProfileStackContent />;
}

