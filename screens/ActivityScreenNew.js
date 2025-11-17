// Activity screen - shows only Friends tab content
import * as React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import FriendsTab from './FriendsTab';
import { useTheme } from '../context/ThemeContext';

export default function ActivityScreenNew() {
  const { isDarkMode } = useTheme();
  
  return (
    <LinearGradient
      colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <FriendsTab />
      </SafeAreaView>
    </LinearGradient>
  );
}

