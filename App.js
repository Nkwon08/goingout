// Main app component - sets up providers and themes
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { NavigationContainer, DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { GroupPhotosProvider } from './context/GroupPhotosContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import BottomTabs from './navigation/BottomTabs';
import AuthStack from './navigation/AuthStack';
import { ActivityIndicator, View } from 'react-native';

// Brand colors
const IU_CRIMSON = '#990000';
const IU_CREAM = '#EEEDEB';

// App content component that uses theme context and auth
function AppContent() {
  const { isDarkMode } = useTheme();
  const { user, loading } = useAuth();

  // Create theme for React Native Paper components based on dark/light mode
  const paperTheme = React.useMemo(() => {
    if (isDarkMode) {
      return {
        ...MD3DarkTheme,
        colors: {
          ...MD3DarkTheme.colors,
          primary: IU_CRIMSON,
          secondary: IU_CREAM,
          background: '#1A1A1A',
          surface: '#2A2A2A',
          onSurface: '#E6E8F0',
        },
        roundness: 16,
      };
    } else {
      return {
        ...MD3LightTheme,
        colors: {
          ...MD3LightTheme.colors,
          primary: IU_CRIMSON,
          secondary: IU_CREAM,
          background: IU_CREAM,
          surface: '#F5F4F2',
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
          primary: IU_CRIMSON,
          background: '#1A1A1A',
          card: '#1A1A1A',
          text: '#E6E8F0',
          border: '#3A3A3A',
          notification: IU_CRIMSON,
        },
      };
    } else {
      return {
        ...NavigationDefaultTheme,
        colors: {
          ...NavigationDefaultTheme.colors,
          primary: IU_CRIMSON,
          background: IU_CREAM,
          card: IU_CREAM,
          text: '#1A1A1A',
          border: '#D0CFCD',
          notification: IU_CRIMSON,
        },
      };
    }
  }, [isDarkMode]);

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <PaperProvider theme={paperTheme}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#1A1A1A' : '#EEEDEB' }}>
          <ActivityIndicator size="large" color="#990000" />
        </View>
      </PaperProvider>
    );
  }

  // Render app with Paper provider (for Material Design components) and Navigation
  // Show AuthStack if not logged in, BottomTabs if logged in
  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer theme={navTheme}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        {user ? <BottomTabs /> : <AuthStack />}
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
        <AppContent />
      </GroupPhotosProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
