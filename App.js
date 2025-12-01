// Main app component - sets up providers and themes
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { NavigationContainer, DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme, useNavigation, CommonActions } from '@react-navigation/native';
import { GroupPhotosProvider } from './context/GroupPhotosContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import RootNavigator from './navigation/RootNavigator';
import AuthStack from './navigation/AuthStack';
import { ActivityIndicator, View, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkIsEmailSignInLink, completeEmailLinkSignIn } from './services/authService';
import NotificationPopup from './components/NotificationPopup';

// Brand colors
const PRIMARY_COLOR = '#CC0000';      // IU Crimson
const SECONDARY_COLOR = '#ffffff';    // White
const ACCENT_COLOR = '#CC0000';       // IU Crimson
const ACCENT_COLOR_2 = '#CC0000';     // IU Crimson
const ACCENT_COLOR_3 = '#CC0000';     // IU Crimson
const ACCENT_COLOR_4 = '#CC0000';     // IU Crimson
const IU_CREAM = '#FAFAFA';

// Component to handle notification popup inside NavigationContainer
function NotificationPopupWrapper() {
  const navigation = useNavigation();
  const { latestNotification, hasNewNotification, clearNewNotification } = useNotifications();

  const handleNotificationPress = () => {
    clearNewNotification();
    // Navigate to Notifications modal screen
    try {
      // Get the root navigator that contains the Notifications screen
      let currentNav = navigation;
      let rootNavigator = null;
      let parent = navigation.getParent();
      
      // Walk up the navigation tree to find RootNavigator (which has Notifications modal)
      while (parent) {
        const state = parent.getState();
        const routeNames = state?.routeNames || state?.routes?.map(r => r.name);
        
        // Check if this navigator has 'Notifications' (RootNavigator)
        if (routeNames && routeNames.includes('Notifications')) {
          rootNavigator = parent;
          break;
        }
        
        // Also check for MainTabs (RootNavigator)
        if (routeNames && routeNames.includes('MainTabs')) {
          rootNavigator = parent;
          break;
        }
        
        currentNav = parent;
        parent = parent.getParent();
      }
      
      if (rootNavigator) {
        // Navigate to Notifications modal
        rootNavigator.navigate('Notifications');
      } else {
        // Fallback: try direct navigation
        try {
          navigation.navigate('Notifications');
        } catch (e) {
          console.log('Could not navigate to Notifications:', e);
        }
      }
    } catch (err) {
      console.log('Could not navigate to Notifications:', err);
    }
  };

  const handleDismiss = () => {
    clearNewNotification();
  };

  return (
    <NotificationPopup
      visible={hasNewNotification}
      notification={latestNotification}
      onPress={handleNotificationPress}
      onDismiss={handleDismiss}
    />
  );
}

// App content component that uses theme context and auth
function AppContent() {
  const { isDarkMode } = useTheme();
  const { user, loading } = useAuth();
  const [authStackKey, setAuthStackKey] = React.useState(0);
  const prevUserRef = React.useRef(user);

  // Increment key when user logs out to force AuthStack remount
  React.useEffect(() => {
    // If user was logged in and now is null (logged out), increment key
    const wasLoggedIn = prevUserRef.current !== null && prevUserRef.current !== undefined;
    const isNowLoggedOut = user === null || user === undefined;
    
    if (wasLoggedIn && isNowLoggedOut) {
      console.log('🔄 User logged out, resetting navigation to Onboarding');
      setAuthStackKey(prev => prev + 1);
    }
    prevUserRef.current = user;
  }, [user]);

  // Debug: Log when user state changes
  React.useEffect(() => {
    console.log('👤 User state changed:', user ? `Logged in (${user.uid})` : 'Logged out');
  }, [user]);

  // Handle deep links for email sign-in
  React.useEffect(() => {
    const handleDeepLink = async (url) => {
      if (!url) return;

      console.log('🔗 Deep link received:', url);

      // Check if this is an email sign-in link
      // Firebase sends links in format: https://goingout-8b2e0.firebaseapp.com/__/auth/action?mode=signIn&oobCode=...
      // Or deep link format: roll://auth/email-signin?mode=signIn&oobCode=...
      const isEmailLink = checkIsEmailSignInLink(url) || 
                         url.includes('mode=signIn') || 
                         url.includes('oobCode=') ||
                         url.includes('__/auth/action');

      if (isEmailLink) {
        try {
          // Get the email from AsyncStorage (stored when link was sent)
          const email = await AsyncStorage.getItem('emailForSignIn');
          
          if (!email) {
            // User opened link on different device - need to ask for email
            Alert.alert(
              'Email Required',
              'Please enter the email address you used to request the sign-in link.',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'OK',
                  onPress: async () => {
                    // For now, show error - in production you'd show an input dialog
                    Alert.alert(
                      'Email Required',
                      'Please request a new sign-in link from the login screen.',
                    );
                  },
                },
              ]
            );
            return;
          }

          // Complete the sign-in
          const result = await completeEmailLinkSignIn(email, url);
          
          if (result.error) {
            Alert.alert('Sign In Failed', result.error);
          } else {
            // Clear stored email
            await AsyncStorage.removeItem('emailForSignIn');
            // User will be signed in automatically via auth state change
          }
        } catch (error) {
          console.error('Error handling email sign-in link:', error);
          Alert.alert('Error', 'Failed to complete sign-in. Please try again.');
        }
      }
    };

    // Handle initial URL (if app was opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Create theme for React Native Paper components based on dark/light mode
  const paperTheme = React.useMemo(() => {
    if (isDarkMode) {
      return {
        ...MD3DarkTheme,
        colors: {
          ...MD3DarkTheme.colors,
          primary: PRIMARY_COLOR,
          secondary: SECONDARY_COLOR,
          background: '#121212',
          surface: '#1E1E1E',
          onSurface: '#E6E8F0',
        },
        roundness: 16,
      };
    } else {
      return {
        ...MD3LightTheme,
        colors: {
          ...MD3LightTheme.colors,
          primary: PRIMARY_COLOR,
          secondary: SECONDARY_COLOR,
          background: IU_CREAM,
          surface: '#FFFFFF',
          onSurface: '#1A1A1A',
        },
        roundness: 16,
      };
    }
  }, [isDarkMode]);

  // Create theme for React Navigation based on dark/light mode
  const navTheme = React.useMemo(() => {
    if (isDarkMode) {
      return {
        ...NavigationDarkTheme,
        colors: {
          ...NavigationDarkTheme.colors,
          primary: PRIMARY_COLOR,
          background: '#121212',
          card: '#121212',
          text: '#E6E8F0',
          border: '#3A3A3A',
          notification: PRIMARY_COLOR,
        },
      };
    } else {
      return {
        ...NavigationDefaultTheme,
        colors: {
          ...NavigationDefaultTheme.colors,
          primary: PRIMARY_COLOR,
          background: IU_CREAM,
          card: IU_CREAM,
          text: '#1A1A1A',
          border: '#D0CFCD',
          notification: PRIMARY_COLOR,
        },
      };
    }
  }, [isDarkMode]);

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <PaperProvider theme={paperTheme}>
        <LinearGradient
          colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
          style={{ flex: 1 }}
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          </View>
        </LinearGradient>
      </PaperProvider>
    );
  }

  // Render app with Paper provider (for Material Design components) and Navigation
  // Show AuthStack if not logged in, BottomTabs if logged in
  // Use key props to force remount and reset navigation state when user logs out
  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer 
        key={user ? 'authenticated' : 'unauthenticated'}
        theme={navTheme}
      >
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        {user ? <RootNavigator /> : <AuthStack key={`auth-stack-${authStackKey}`} />}
        {user && <NotificationPopupWrapper />}
      </NavigationContainer>
    </PaperProvider>
  );
}

// Main app export - wraps everything in context providers
// Order matters: ThemeProvider must wrap components that use theme
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
      <GroupPhotosProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </GroupPhotosProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
