import * as React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import NotificationsTab from './NotificationsTab';
import FriendsTab from './FriendsTab';
import { useTheme } from '../context/ThemeContext';

const TopTab = createMaterialTopTabNavigator();
const IU_CRIMSON = '#990000';

export default function NotificationsScreen() {
  const { isDarkMode } = useTheme();
  
  const bgColor = isDarkMode ? '#1A1A1A' : '#EEEDEB';
  const textColor = isDarkMode ? '#E6E8F0' : '#1A1A1A';
  const inactiveColor = isDarkMode ? '#8A90A6' : '#666666';
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={['top']}>
      <TopTab.Navigator
        initialRouteName="Friends"
        screenOptions={{
          tabBarStyle: { backgroundColor: bgColor },
          tabBarIndicatorStyle: { backgroundColor: IU_CRIMSON },
          tabBarActiveTintColor: textColor,
          tabBarInactiveTintColor: inactiveColor,
        }}
      >
        <TopTab.Screen name="Friends" component={FriendsTab} />
        <TopTab.Screen name="Notifications" component={NotificationsTab} />
      </TopTab.Navigator>
    </SafeAreaView>
  );
}


