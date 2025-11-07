import * as React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import NotificationsTab from './NotificationsTab';
import FriendsTab from './FriendsTab';
import { useTheme } from '../context/ThemeContext';

const TopTab = createMaterialTopTabNavigator();
const IU_CRIMSON = '#CC0000';

export default function NotificationsScreen() {
  const { isDarkMode } = useTheme();
  
  const bgColor = isDarkMode ? '#121212' : '#FAFAFA';
  const textColor = isDarkMode ? '#E6E8F0' : '#1A1A1A';
  const inactiveColor = isDarkMode ? '#8A90A6' : '#666666';
  
  return (
    <LinearGradient
      colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <TopTab.Navigator
          initialRouteName="Friends"
          screenOptions={{
            tabBarStyle: { backgroundColor: 'transparent' },
            tabBarIndicatorStyle: { backgroundColor: IU_CRIMSON },
            tabBarActiveTintColor: textColor,
            tabBarInactiveTintColor: inactiveColor,
          }}
        >
          <TopTab.Screen name="Friends" component={FriendsTab} />
          <TopTab.Screen name="Notifications" component={NotificationsTab} />
        </TopTab.Navigator>
      </SafeAreaView>
    </LinearGradient>
  );
}


