// Profile stack navigation - handles profile screen and edit profile
import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import UserProfileScreen from '../screens/UserProfileScreen';

const Stack = createNativeStackNavigator();

// Component to handle tab press listener
function ProfileStackContent() {
  const navigation = useNavigation();
  
  // Listen for tab press to reset stack to ProfileMain
  React.useEffect(() => {
    const unsubscribe = navigation?.addListener?.('tabPress', (e) => {
      // When Profile tab is pressed, reset to ProfileMain if we're deeper in the stack
      const state = navigation.getState();
      if (state && state.routes && state.routes.length > 1) {
        // Reset to ProfileMain when tab is pressed
        navigation.reset({
          index: 0,
          routes: [{ name: 'ProfileMain' }],
        });
      }
    });

    return unsubscribe;
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
    </Stack.Navigator>
  );
}

export default function ProfileStack() {
  return <ProfileStackContent />;
}

