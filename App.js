import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { NavigationContainer, DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { GroupPhotosProvider } from './context/GroupPhotosContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import BottomTabs from './navigation/BottomTabs';

const IU_CRIMSON = '#990000';
const IU_CREAM = '#EEEDEB';

function AppContent() {
  const { isDarkMode } = useTheme();

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

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer theme={navTheme}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <BottomTabs />
      </NavigationContainer>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <GroupPhotosProvider>
        <AppContent />
      </GroupPhotosProvider>
    </ThemeProvider>
  );
}
